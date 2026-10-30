import { api } from './api';
import { supabase } from './supabase';
import { ApplicantRecord, ActivityLog, ExpenseRecord, UserRole } from '../app/types';

export interface DatabaseNotificationRow {
  notification_id: number;
  agency_id: number;
  user_id?: number | null;
  applicant_id?: number | null;
  title: string;
  message: string;
  is_read?: boolean;
  created_at?: string;
}

export interface AppNotification {
  id: string;
  notificationId?: number;
  source: 'database' | 'compliance' | 'pipeline' | 'finance';
  category: 'reminder' | 'compliance' | 'approval' | 'pipeline';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  createdAt: string;
  timeLabel: string;
  isRead: boolean;
  applicantId?: string;
  targetView?: string;
}

const READ_STORAGE_KEY = 'flowsensus_read_notifications_v1';
const DISMISSED_STORAGE_KEY = 'flowsensus_dismissed_notifications_v1';
const LOCAL_SENT_DB_CACHE_KEY = 'flowsensus_sent_notifications_cache_v1';

export const NOTIFICATION_SYNC_EVENT = 'flowsensus:notifications-updated';

const UNASSIGNED_NAMES = new Set([
  '',
  'unassigned',
  'unassigned pool',
  'system agent',
  'recruitment team',
  'admin team',
  'none',
]);

/**
 * Returns true if the candidate has no specific individual handler assigned yet.
 */
export function isUnassignedHandlerName(handlerName?: string | null): boolean {
  if (!handlerName || typeof handlerName !== 'string') return true;
  return UNASSIGNED_NAMES.has(handlerName.trim().toLowerCase());
}

/**
 * Determines which department/role team is responsible for claiming and handling
 * an unassigned candidate based on their current stage.
 */
export function getResponsibleTeamForPhase(
  phase?: number,
  department?: string
): { role: 'Recruitment' | 'Admin'; label: string } {
  if (department && department.trim().toLowerCase().includes('admin')) {
    return { role: 'Admin', label: 'Admin Team' };
  }
  if (phase === 2 || phase === 5) {
    return { role: 'Admin', label: 'Admin Team' };
  }
  return { role: 'Recruitment', label: 'Recruitment Team' };
}

// In-memory state synced with localStorage (ensures instant reactivity even if localStorage is restricted)
const memoryReadIds = new Set<string>();
const memoryDismissedIds = new Set<string>();
let memorySentNotifications: DatabaseNotificationRow[] = [];

function safeGetSet(key: string, memorySet: Set<string>): Set<string> {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => memorySet.add(String(id)));
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return new Set(memorySet);
}

function safeSaveSet(key: string, set: Set<string>, memorySet: Set<string>): void {
  set.forEach((id) => memorySet.add(String(id)));
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      const arr = Array.from(memorySet).slice(-500);
      localStorage.setItem(key, JSON.stringify(arr));
    }
  } catch {
    // ignore storage errors
  }
}

function getLocalSentNotifications(): DatabaseNotificationRow[] {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(LOCAL_SENT_DB_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memorySentNotifications = parsed;
        }
      }
    }
  } catch {
    // ignore
  }
  return [...memorySentNotifications];
}

function saveLocalSentNotification(row: DatabaseNotificationRow): void {
  const existing = getLocalSentNotifications().filter(
    (r) => r.notification_id !== row.notification_id
  );
  memorySentNotifications = [row, ...existing].slice(0, 100);
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(LOCAL_SENT_DB_CACHE_KEY, JSON.stringify(memorySentNotifications));
    }
  } catch {
    // ignore storage errors
  }
}

export function resetNotificationLocalState(): void {
  memoryReadIds.clear();
  memoryDismissedIds.clear();
  memorySentNotifications = [];
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(READ_STORAGE_KEY);
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
      localStorage.removeItem(LOCAL_SENT_DB_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

export function getReadNotificationIds(): Set<string> {
  return safeGetSet(READ_STORAGE_KEY, memoryReadIds);
}

export function getDismissedNotificationIds(): Set<string> {
  return safeGetSet(DISMISSED_STORAGE_KEY, memoryDismissedIds);
}

export function formatRelativeTime(isoOrDate?: string): string {
  if (!isoOrDate) return 'Just now';
  const date = new Date(isoOrDate);
  if (isNaN(date.getTime())) return isoOrDate;

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function notifyListeners(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_SYNC_EVENT));
  }
}

/**
 * Fetch persistent staff notifications from `public.notification` (via FastAPI `/notifications`
 * with automatic direct Supabase fallback).
 */
export async function fetchStaffDatabaseNotifications(): Promise<DatabaseNotificationRow[]> {
  const localSent = getLocalSentNotifications().filter((r) => !r.applicant_id);

  // 1. Try Backend API first
  try {
    const res = await api.get('/notifications');
    const list: DatabaseNotificationRow[] = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.notifications)
      ? res.data.notifications
      : [];
    if (list.length > 0) {
      return mergeDatabaseNotifications(list, localSent);
    }
  } catch {
    // Fallback to direct Supabase query below
  }

  // 2. Fallback to direct Supabase table query
  try {
    const { data, error } = await supabase
      .from('notification')
      .select('*')
      .is('applicant_id', null)
      .order('notification_id', { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data)) {
      return mergeDatabaseNotifications(data as DatabaseNotificationRow[], localSent);
    }
  } catch {
    // ignore
  }

  return localSent;
}

/**
 * Fetch persistent candidate notifications from `public.notification` for the Applicant Portal.
 */
export async function fetchApplicantDatabaseNotifications(
  applicantId?: number | string
): Promise<DatabaseNotificationRow[]> {
  const numericId = applicantId ? Number(applicantId) : NaN;
  const localSent = !isNaN(numericId)
    ? getLocalSentNotifications().filter((r) => Number(r.applicant_id) === numericId)
    : [];

  // 1. Try Backend Portal API
  try {
    const res = await api.get('/applicants/me/notifications');
    if (Array.isArray(res.data) && res.data.length > 0) {
      return mergeDatabaseNotifications(res.data, localSent);
    }
  } catch {
    // Fallback to direct Supabase query below
  }

  // 2. Fallback to direct Supabase query
  if (!isNaN(numericId) && numericId > 0) {
    try {
      const { data, error } = await supabase
        .from('notification')
        .select('*')
        .eq('applicant_id', numericId)
        .order('notification_id', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        return mergeDatabaseNotifications(data as DatabaseNotificationRow[], localSent);
      }
    } catch {
      // ignore
    }
  }

  return localSent;
}

function mergeDatabaseNotifications(
  remote: DatabaseNotificationRow[],
  local: DatabaseNotificationRow[]
): DatabaseNotificationRow[] {
  const map = new Map<string, DatabaseNotificationRow>();
  remote.forEach((r) => {
    const key = String(r.notification_id || `${r.title}-${r.message}`);
    map.set(key, r);
  });
  local.forEach((l) => {
    const key = String(l.notification_id || `${l.title}-${l.message}`);
    const hasDuplicateText = remote.some(
      (r) => r.title === l.title && r.message === l.message
    );
    if (!map.has(key) && !hasDuplicateText) {
      map.set(key, l);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => (Number(b.notification_id) || 0) - (Number(a.notification_id) || 0)
  );
}

/**
 * Send a persistent reminder notification to a staff handler (`user_id` in `public.notification`),
 * or broadcast to the responsible department team (`Recruitment` / `Admin`) when the candidate has no handler assigned yet.
 */
export async function sendHandlerReminderNotification(params: {
  applicantId: string | number;
  applicantName: string;
  applicantCode?: string;
  handlerName?: string;
  handlerUserId?: number;
  phase?: number;
  department?: string;
  stageLabel?: string;
  senderName?: string;
}): Promise<DatabaseNotificationRow> {
  const unassigned = !params.handlerUserId && isUnassignedHandlerName(params.handlerName);
  const responsibleTeam = getResponsibleTeamForPhase(params.phase, params.department);
  const handlerDisplay = !unassigned && params.handlerName
    ? params.handlerName.trim()
    : responsibleTeam.label;

  const codePart = params.applicantCode ? ` (${params.applicantCode})` : '';
  const stagePart = params.stageLabel || 'their current recruitment stage';
  const senderPart = params.senderName ? ` by ${params.senderName}` : '';

  const title = unassigned
    ? `Unassigned Candidate Follow-Up: ${params.applicantName}${codePart}`
    : `Follow-Up Reminder: ${params.applicantName}${codePart}`;

  const message = unassigned
    ? `No handler is assigned yet. Sent to ${responsibleTeam.label}: Please claim ${params.applicantName}'s file and update their progress in ${stagePart}. Requested${senderPart}.`
    : `Assigned to ${handlerDisplay}: Please review and update ${params.applicantName}'s progress in ${stagePart}. Follow-up requested${senderPart}.`;

  // 1. Try Backend POST /notifications
  try {
    const res = await api.post('/notifications', {
      user_id: unassigned ? null : (params.handlerUserId || null),
      handler_name: unassigned ? 'Unassigned' : handlerDisplay,
      target_role: unassigned ? responsibleTeam.role : null,
      applicant_id: null,
      title,
      message,
    });
    if (res.data && (res.data.notification_id || res.data.title)) {
      const created: DatabaseNotificationRow = {
        notification_id: res.data.notification_id || Date.now(),
        agency_id: res.data.agency_id || 2,
        user_id: res.data.user_id || params.handlerUserId || 1,
        applicant_id: null,
        title: res.data.title || title,
        message: res.data.message || message,
        is_read: false,
        created_at: res.data.created_at || new Date().toISOString(),
      };
      saveLocalSentNotification(created);
      notifyListeners();
      return created;
    }
  } catch {
    // Fallback to direct Supabase insert below
  }

  // 2. Fallback to direct Supabase insert (enforcing XOR: user_id set, applicant_id = null)
  try {
    let targetUserId = params.handlerUserId || null;
    let targetAgencyId = 2;

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser?.app_metadata?.agency_id) {
      targetAgencyId = Number(sessionUser.app_metadata.agency_id) || 2;
    }

    if (!unassigned && !targetUserId && handlerDisplay) {
      const { data: staffRows } = await supabase
        .from('app_user')
        .select('user_id, agency_id')
        .ilike('full_name', `%${handlerDisplay}%`)
        .limit(1);
      if (staffRows && staffRows.length > 0) {
        targetUserId = staffRows[0].user_id;
        targetAgencyId = staffRows[0].agency_id || targetAgencyId;
      }
    }

    if (!targetUserId) {
      const { data: fallbackStaff } = await supabase
        .from('app_user')
        .select('user_id, agency_id')
        .eq('agency_id', targetAgencyId)
        .limit(1);
      if (fallbackStaff && fallbackStaff.length > 0) {
        targetUserId = fallbackStaff[0].user_id;
      }
    }

    if (targetUserId) {
      const { data: inserted } = await supabase
        .from('notification')
        .insert({
          agency_id: targetAgencyId,
          user_id: targetUserId,
          applicant_id: null,
          title,
          message,
        })
        .select('*')
        .single();

      if (inserted) {
        saveLocalSentNotification(inserted as DatabaseNotificationRow);
        notifyListeners();
        return inserted as DatabaseNotificationRow;
      }
    }
  } catch {
    // Fallback to local cache below
  }

  const fallbackRow: DatabaseNotificationRow = {
    notification_id: Date.now(),
    agency_id: 2,
    user_id: params.handlerUserId || 1,
    applicant_id: null,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  saveLocalSentNotification(fallbackRow);
  notifyListeners();
  return fallbackRow;
}

/**
 * Send a persistent compliance or status notification to an applicant (`applicant_id` in `public.notification`).
 * Used when Admin clicks "Notify Candidate" in AdminDashboard or "Notify" in ComplianceAlerts.
 */
export async function sendCandidateNotification(params: {
  applicantId: string | number;
  applicantName: string;
  documentName?: string;
  daysRemaining?: number;
  customTitle?: string;
  customMessage?: string;
}): Promise<DatabaseNotificationRow> {
  const numericApplicantId = Number(params.applicantId) || 0;
  const docName = params.documentName || 'Required Document';

  let statusDetail = 'requires your attention or renewal';
  if (typeof params.daysRemaining === 'number') {
    if (params.daysRemaining < 0) {
      statusDetail = `expired ${Math.abs(params.daysRemaining)} days ago and requires immediate renewal`;
    } else if (params.daysRemaining === 0) {
      statusDetail = 'expires today and requires immediate renewal';
    } else {
      statusDetail = `will expire in ${params.daysRemaining} days — please prepare a renewed copy`;
    }
  }

  const title = params.customTitle || `Document Renewal Notice: ${docName}`;
  const message =
    params.customMessage ||
    `Hello ${params.applicantName}, your ${docName} ${statusDetail}. Please coordinate with your assigned agency officer and submit an updated copy.`;

  // 1. Try Backend POST /notifications
  if (numericApplicantId > 0) {
    try {
      const res = await api.post('/notifications', {
        applicant_id: numericApplicantId,
        user_id: null,
        title,
        message,
      });
      if (res.data && (res.data.notification_id || res.data.title)) {
        const created: DatabaseNotificationRow = {
          notification_id: res.data.notification_id || Date.now(),
          agency_id: res.data.agency_id || 2,
          user_id: null,
          applicant_id: numericApplicantId,
          title: res.data.title || title,
          message: res.data.message || message,
          is_read: false,
          created_at: res.data.created_at || new Date().toISOString(),
        };
        saveLocalSentNotification(created);
        notifyListeners();
        return created;
      }
    } catch {
      // Fallback to direct Supabase insert below
    }

    // 2. Fallback to direct Supabase insert (enforcing XOR: applicant_id set, user_id = null)
    try {
      let targetAgencyId = 2;
      const { data: appRow } = await supabase
        .from('applicant')
        .select('agency_id')
        .eq('applicant_id', numericApplicantId)
        .limit(1);
      if (appRow && appRow.length > 0 && appRow[0].agency_id) {
        targetAgencyId = Number(appRow[0].agency_id);
      }

      const { data: inserted } = await supabase
        .from('notification')
        .insert({
          agency_id: targetAgencyId,
          user_id: null,
          applicant_id: numericApplicantId,
          title,
          message,
        })
        .select('*')
        .single();

      if (inserted) {
        saveLocalSentNotification(inserted as DatabaseNotificationRow);
        notifyListeners();
        return inserted as DatabaseNotificationRow;
      }
    } catch {
      // Fallback to local cache below
    }
  }

  const fallbackRow: DatabaseNotificationRow = {
    notification_id: Date.now(),
    agency_id: 2,
    user_id: null,
    applicant_id: numericApplicantId || 1,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  saveLocalSentNotification(fallbackRow);
  notifyListeners();
  return fallbackRow;
}

/**
 * Mark a single notification as read (persists locally and updates `public.notification` if DB-backed).
 */
export async function markNotificationAsRead(
  notification: { id: string; notificationId?: number },
  isApplicantPortal = false
): Promise<void> {
  const readSet = getReadNotificationIds();
  readSet.add(notification.id);
  if (notification.notificationId) {
    readSet.add(`db-${notification.notificationId}`);
  }
  safeSaveSet(READ_STORAGE_KEY, readSet, memoryReadIds);
  notifyListeners();

  if (notification.notificationId && notification.notificationId > 0) {
    const endpoint = isApplicantPortal
      ? `/applicants/me/notifications/${notification.notificationId}/read`
      : `/notifications/${notification.notificationId}/read`;
    try {
      await api.patch(endpoint);
      return;
    } catch {
      // Fallback to direct Supabase update
    }
    try {
      await supabase
        .from('notification')
        .update({ is_read: true })
        .eq('notification_id', notification.notificationId);
    } catch {
      // ignore
    }
  }
}

/**
 * Mark a list of notifications as read.
 */
export async function markAllNotificationsAsRead(
  notifications: Array<{ id: string; notificationId?: number }>,
  isApplicantPortal = false
): Promise<void> {
  const readSet = getReadNotificationIds();
  notifications.forEach((n) => {
    readSet.add(n.id);
    if (n.notificationId) {
      readSet.add(`db-${n.notificationId}`);
    }
  });
  safeSaveSet(READ_STORAGE_KEY, readSet, memoryReadIds);
  notifyListeners();

  const hasDbItems = notifications.some((n) => n.notificationId && n.notificationId > 0);
  if (hasDbItems) {
    const endpoint = isApplicantPortal
      ? '/applicants/me/notifications/read-all'
      : '/notifications/read-all';
    try {
      await api.post(endpoint);
      return;
    } catch {
      // Fallback to direct Supabase update
    }
    try {
      const dbIds = notifications
        .map((n) => n.notificationId)
        .filter((id): id is number => typeof id === 'number' && id > 0);
      if (dbIds.length > 0) {
        await supabase
          .from('notification')
          .update({ is_read: true })
          .in('notification_id', dbIds);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Dismiss / remove a notification from the user's feed.
 */
export async function dismissNotificationItem(notification: {
  id: string;
  notificationId?: number;
}): Promise<void> {
  const dismissedSet = getDismissedNotificationIds();
  dismissedSet.add(notification.id);
  if (notification.notificationId) {
    dismissedSet.add(`db-${notification.notificationId}`);
  }
  safeSaveSet(DISMISSED_STORAGE_KEY, dismissedSet, memoryDismissedIds);
  notifyListeners();

  if (notification.notificationId && notification.notificationId > 0) {
    try {
      await api.delete(`/notifications/${notification.notificationId}`);
      return;
    } catch {
      // Fallback to direct Supabase delete
    }
    try {
      await supabase
        .from('notification')
        .delete()
        .eq('notification_id', notification.notificationId);
    } catch {
      // ignore
    }
  }
}

/**
 * Build the unified Staff Notification Center feed combining:
 * 1. Persistent reminders/notices from `public.notification` (e.g. Management "Notify Handler" / "Notify Team" reminders)
 * 2. Role-relevant actionable alerts (compliance document expirations, delayed candidates, pending CV approvals, pending expense verifications)
 *
 * NOTE: Routine audit logs (e.g. CLINIC_UPDATED, SYSTEM updated...) belong strictly in the Audit Log view
 * and are intentionally excluded here so they never spam the user's notifications.
 */
export function buildStaffNotifications(params: {
  dbNotifications: DatabaseNotificationRow[];
  applicants: ApplicantRecord[];
  complianceAlerts?: any[];
  expenses?: ExpenseRecord[];
  activityLogs?: ActivityLog[];
  userRoles: UserRole[];
  isSuperAdmin?: boolean;
}): AppNotification[] {
  const {
    dbNotifications = [],
    applicants = [],
    complianceAlerts = [],
    expenses = [],
    userRoles = [],
    isSuperAdmin = false,
  } = params;

  const readIds = getReadNotificationIds();
  const dismissedIds = getDismissedNotificationIds();
  const hasRole = (role: UserRole) =>
    isSuperAdmin || userRoles.some((r) => r.toLowerCase() === role.toLowerCase());

  const items: AppNotification[] = [];

  // 1. Direct Persistent Reminders & Notices from `public.notification`
  dbNotifications.forEach((row) => {
    const id = `db-${row.notification_id}`;
    if (dismissedIds.has(id)) return;
    const isRead = Boolean(row.is_read) || readIds.has(id);

    // Try to match applicant from title/message if linked to a candidate
    const matchedApplicant = applicants.find(
      (a) =>
        (a.name && row.title?.includes(a.name)) ||
        (a.applicantCode && row.title?.includes(a.applicantCode))
    );

    items.push({
      id,
      notificationId: row.notification_id,
      source: 'database',
      category: 'reminder',
      severity: 'warning',
      title: row.title || 'Staff Reminder',
      message: row.message || '',
      createdAt: row.created_at || new Date().toISOString(),
      timeLabel: formatRelativeTime(row.created_at),
      isRead,
      applicantId: matchedApplicant ? String(matchedApplicant.id) : undefined,
      targetView: matchedApplicant ? 'applicants' : 'dashboard',
    });
  });

  // 2. Compliance Document Expiry Alerts (Admin & Management)
  if (hasRole('Admin') || hasRole('Management')) {
    complianceAlerts.slice(0, 5).forEach((alert: any) => {
      const id = `compliance-${alert.alert_id || `${alert.applicant_id}-${alert.requirement_name}`}`;
      if (dismissedIds.has(id)) return;
      const level = alert.alert_level || alert.alert_type || 'WARNING';
      const isExpired = level === 'EXPIRED';
      const docName = alert.requirement_name || 'Compliance Document';
      const candidateName = alert.applicant_name || `Applicant #${alert.applicant_id}`;

      items.push({
        id,
        source: 'compliance',
        category: 'compliance',
        severity: isExpired ? 'critical' : 'warning',
        title: isExpired ? `Expired Document: ${docName}` : `Expiring Soon: ${docName}`,
        message: `${candidateName} — ${alert.message || 'Document validity requires renewal check.'}`,
        createdAt: alert.created_at || new Date().toISOString(),
        timeLabel: formatRelativeTime(alert.created_at),
        isRead: readIds.has(id),
        applicantId: alert.applicant_id ? String(alert.applicant_id) : undefined,
        targetView: 'alerts',
      });
    });
  }

  // 3. Candidates Needing Follow-Up & Pending CV Approvals (Management & Recruitment)
  if (hasRole('Management') || hasRole('Recruitment')) {
    const now = Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

    applicants
      .filter((a) => {
        if (a.isStopped || a.status === 'Deployed' || a.phase >= 5) return false;
        const lastUpdate = new Date(a.lastUpdated || 0).getTime();
        return !isNaN(lastUpdate) && now - lastUpdate > fiveDaysMs;
      })
      .slice(0, 4)
      .forEach((a) => {
        const id = `delayed-candidate-${a.id}`;
        if (dismissedIds.has(id)) return;
        const days = Math.max(
          5,
          Math.floor((now - new Date(a.lastUpdated || 0).getTime()) / (24 * 60 * 60 * 1000))
        );
        const unassigned = isUnassignedHandlerName(a.currentHandler);
        const handlerLabel = unassigned
          ? `Unassigned (${getResponsibleTeamForPhase(a.phase, a.currentDepartment).label})`
          : a.currentHandler;

        items.push({
          id,
          source: 'pipeline',
          category: 'pipeline',
          severity: days >= 14 ? 'critical' : 'warning',
          title: `Follow-Up Needed: ${a.name}`,
          message: `In Stage ${a.phase} (${a.status}) for ${days} days. Handler: ${handlerLabel}.`,
          createdAt: a.lastUpdated || new Date().toISOString(),
          timeLabel: `${days}d in stage`,
          isRead: readIds.has(id),
          applicantId: String(a.id),
          targetView: 'applicants',
        });
      });
  }

  // 4. CVs Waiting for Manager Sign-Off (Management)
  if (hasRole('Management')) {
    applicants
      .filter(
        (a) =>
          !a.isStopped &&
          a.phase === 3 &&
          (a.status.toLowerCase().includes('cv') ||
            a.status.toLowerCase().includes('pending') ||
            a.status.toLowerCase().includes('review'))
      )
      .slice(0, 3)
      .forEach((a) => {
        const id = `cv-approval-${a.id}`;
        if (dismissedIds.has(id)) return;
        items.push({
          id,
          source: 'pipeline',
          category: 'approval',
          severity: 'info',
          title: `CV Ready for Review: ${a.name}`,
          message: `${a.role || 'Candidate'} profile is waiting for manager sign-off before employer endorsement.`,
          createdAt: a.lastUpdated || new Date().toISOString(),
          timeLabel: 'Pending Review',
          isRead: readIds.has(id),
          applicantId: String(a.id),
          targetView: 'manager',
        });
      });
  }

  // 5. Draft / Pending Financial Disbursements (Accounting & Management)
  if (hasRole('Accounting') || hasRole('Management')) {
    const draftExpenses = expenses.filter((e) => e.status === 'draft');
    if (draftExpenses.length > 0) {
      const id = `finance-drafts-${draftExpenses.length}`;
      if (!dismissedIds.has(id)) {
        items.push({
          id,
          source: 'finance',
          category: 'approval',
          severity: 'warning',
          title: `${draftExpenses.length} Pending Expense Record${draftExpenses.length > 1 ? 's' : ''}`,
          message: `There ${draftExpenses.length > 1 ? 'are' : 'is'} ${draftExpenses.length} draft candidate expense entry awaiting verification in the Expense Ledger.`,
          createdAt: draftExpenses[0]?.date || new Date().toISOString(),
          timeLabel: 'Action Needed',
          isRead: readIds.has(id),
          targetView: 'expense',
        });
      }
    }
  }

  return items;
}
