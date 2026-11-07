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
  created_by_name?: string;
  target_applicant_code?: string;
  target_applicant_name?: string;
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
const NOTIFIED_CANDIDATE_DOCS_KEY = 'flowsensus_notified_candidate_docs_v1';

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
const memoryNotifiedCandidateDocs = new Set<string>();
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
  memoryNotifiedCandidateDocs.clear();
  memorySentNotifications = [];
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(READ_STORAGE_KEY);
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
      localStorage.removeItem(LOCAL_SENT_DB_CACHE_KEY);
      localStorage.removeItem(NOTIFIED_CANDIDATE_DOCS_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Strictly parse a positive integer applicant_id.
 * Returns null if the input is non-numeric (e.g. an applicant_code like "APP-2026-FPT-00022"),
 * preventing accidental fallback to another candidate's ID.
 */
export function parseStrictApplicantId(raw?: string | number | null): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }
  }
  return null;
}

/**
 * Build a deterministic, collision-free key for tracking whether a specific candidate
 * has been notified about a specific document expiration.
 */
export function buildCandidateDocumentNoticeKey(params: {
  applicantId?: string | number | null;
  applicantCode?: string | null;
  documentName?: string | null;
}): string {
  const strictId = parseStrictApplicantId(params.applicantId);
  const code = (params.applicantCode || '').trim().toLowerCase();
  const rawId = params.applicantId != null ? String(params.applicantId).trim().toLowerCase() : '';
  const candidateToken = strictId ? `id:${strictId}` : code ? `code:${code}` : `raw:${rawId}`;
  const docToken = (params.documentName || 'required document').trim().toLowerCase().replace(/\s+/g, ' ');
  return `cand-doc-notice::${candidateToken}::${docToken}`;
}

export function markCandidateDocumentNotified(params: {
  applicantId?: string | number | null;
  applicantCode?: string | null;
  documentName?: string | null;
}): void {
  const set = safeGetSet(NOTIFIED_CANDIDATE_DOCS_KEY, memoryNotifiedCandidateDocs);
  set.add(buildCandidateDocumentNoticeKey(params));
  if (params.applicantCode && parseStrictApplicantId(params.applicantId)) {
    // Also record under code key so views keying by either ID or code stay in sync for that exact candidate
    set.add(
      buildCandidateDocumentNoticeKey({
        applicantId: null,
        applicantCode: params.applicantCode,
        documentName: params.documentName,
      })
    );
  }
  safeSaveSet(NOTIFIED_CANDIDATE_DOCS_KEY, set, memoryNotifiedCandidateDocs);
}

export function isCandidateDocumentNotified(params: {
  applicantId?: string | number | null;
  applicantCode?: string | null;
  documentName?: string | null;
}): boolean {
  const set = safeGetSet(NOTIFIED_CANDIDATE_DOCS_KEY, memoryNotifiedCandidateDocs);
  if (set.has(buildCandidateDocumentNoticeKey(params))) {
    return true;
  }
  if (params.applicantCode) {
    const codeKey = buildCandidateDocumentNoticeKey({
      applicantId: null,
      applicantCode: params.applicantCode,
      documentName: params.documentName,
    });
    if (set.has(codeKey)) return true;
  }
  return false;
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
export async function fetchStaffDatabaseNotifications(options?: {
  currentUserId?: number;
  currentUserName?: string;
}): Promise<DatabaseNotificationRow[]> {
  const cleanSender = options?.currentUserName?.trim().toLowerCase();

  const isSentByCurrentUser = (r: DatabaseNotificationRow) => {
    if (!cleanSender) return false;
    if (r.created_by_name && r.created_by_name.trim().toLowerCase() === cleanSender) {
      return true;
    }
    const msg = (r.message || '').toLowerCase();
    return msg.includes(`requested by ${cleanSender}`) || msg.includes(`by ${cleanSender}`);
  };

  const isTargetedToOtherHandler = (r: DatabaseNotificationRow) => {
    if (options?.currentUserId && r.user_id && r.user_id !== options.currentUserId) {
      return true;
    }
    if (cleanSender) {
      const match = (r.message || '').match(/Assigned to ([^:]+):/i);
      if (match && match[1]) {
        const assignedHandler = match[1].trim().toLowerCase();
        if (
          assignedHandler !== cleanSender &&
          !assignedHandler.includes(cleanSender) &&
          !cleanSender.includes(assignedHandler)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const localSent = getLocalSentNotifications().filter((r) => {
    if (r.applicant_id) return false;
    if (isSentByCurrentUser(r)) return false;
    if (isTargetedToOtherHandler(r)) return false;
    return true;
  });

  // 1. Try Backend API first
  try {
    const res = await api.get('/notifications');
    const list: DatabaseNotificationRow[] = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.notifications)
      ? res.data.notifications
      : [];
    if (list.length > 0) {
      const filtered = list.filter(
        (r) => !r.applicant_id && !isSentByCurrentUser(r) && !isTargetedToOtherHandler(r)
      );
      return mergeDatabaseNotifications(filtered, localSent);
    }
  } catch {
    // Fallback to direct Supabase query below
  }

  // 2. Fallback to direct Supabase table query
  try {
    let query = supabase
      .from('notification')
      .select('*')
      .is('applicant_id', null)
      .order('notification_id', { ascending: false })
      .limit(50);

    if (options?.currentUserId && typeof options.currentUserId === 'number' && options.currentUserId > 0) {
      query = query.eq('user_id', options.currentUserId);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      const filtered = (data as DatabaseNotificationRow[]).filter(
        (r) => !isSentByCurrentUser(r) && !isTargetedToOtherHandler(r)
      );
      return mergeDatabaseNotifications(filtered, localSent);
    }
  } catch {
    // ignore
  }

  return localSent;
}

/**
 * Verify whether a notification row belongs strictly to the target candidate.
 * Prevents cross-candidate notification leakage in both DB responses and local caches.
 */
function doesNotificationMatchCandidate(
  row: DatabaseNotificationRow,
  numericId: number | null,
  options?: { applicantCode?: string; applicantName?: string }
): boolean {
  if (!row) return false;
  // Staff notifications (where user_id is populated) must never appear in a candidate portal
  if (row.user_id != null) return false;

  const rowApplicantId = parseStrictApplicantId(row.applicant_id);
  const cleanCode = options?.applicantCode?.trim().toLowerCase() || '';
  const cleanName = options?.applicantName?.trim().toLowerCase() || '';

  // 1. Primary check: if the candidate's numeric applicant_id is known, row must match it
  if (numericId !== null) {
    if (rowApplicantId !== null) {
      if (rowApplicantId !== numericId) return false;
    } else if (cleanCode && row.target_applicant_code) {
      if (row.target_applicant_code.trim().toLowerCase() !== cleanCode) return false;
    } else {
      return false;
    }
  } else if (cleanCode) {
    // 2. Fallback check when only applicantCode is known prior to profile load
    const rowCode = (row.target_applicant_code || '').trim().toLowerCase();
    const textIncludesCode =
      (row.title || '').toLowerCase().includes(cleanCode) ||
      (row.message || '').toLowerCase().includes(cleanCode);
    if (rowCode !== cleanCode && !textIncludesCode) {
      return false;
    }
  } else {
    // Without a resolved numeric applicantId or applicantCode, never return any rows
    return false;
  }

  // 3. Secondary identity guard: if the row has explicit target_applicant_code and caller supplied applicantCode,
  // they must not conflict.
  if (cleanCode && row.target_applicant_code) {
    if (row.target_applicant_code.trim().toLowerCase() !== cleanCode) {
      return false;
    }
  }

  // 4. Greeting guard: if the message starts with "Hello <Candidate Name>," or "Hello <Candidate Name> (",
  // ensure it does not address a completely different candidate name when applicantName is known.
  if (cleanName && cleanName !== 'applicant') {
    const greetingMatch = (row.message || '').match(/^Hello\s+([^,(]+?)(?:\s*\([^)]+\))?,/i);
    if (greetingMatch && greetingMatch[1]) {
      const greetedName = greetingMatch[1].trim().toLowerCase();
      const nameParts = cleanName.split(/\s+/).filter((p) => p.length > 1);
      const matchesAnyPart =
        greetedName === cleanName ||
        greetedName.includes(cleanName) ||
        cleanName.includes(greetedName) ||
        (nameParts.length > 0 && nameParts.every((part) => greetedName.includes(part)));
      if (!matchesAnyPart) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Fetch persistent candidate notifications from `public.notification` for the Applicant Portal.
 * Strictly filters by the candidate's `applicant_id` (and optional `applicantCode` / `applicantName`)
 * so a candidate only ever sees notifications sent specifically to them.
 */
export async function fetchApplicantDatabaseNotifications(
  applicantId?: number | string,
  options?: { applicantCode?: string; applicantName?: string }
): Promise<DatabaseNotificationRow[]> {
  const numericId = parseStrictApplicantId(applicantId);
  const localSent = getLocalSentNotifications().filter((r) =>
    doesNotificationMatchCandidate(r, numericId, options)
  );

  // 1. Try Backend Portal API
  try {
    const res = await api.get('/applicants/me/notifications');
    if (Array.isArray(res.data)) {
      const filteredRemote = (res.data as DatabaseNotificationRow[]).filter((r) =>
        doesNotificationMatchCandidate(r, numericId ?? parseStrictApplicantId(r.applicant_id), options)
      );
      return mergeDatabaseNotifications(filteredRemote, localSent);
    }
  } catch {
    // Fallback to direct Supabase query below
  }

  // 2. Fallback to direct Supabase query
  if (numericId !== null && numericId > 0) {
    try {
      const { data, error } = await supabase
        .from('notification')
        .select('*')
        .eq('applicant_id', numericId)
        .is('user_id', null)
        .order('notification_id', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        const filteredData = (data as DatabaseNotificationRow[]).filter((r) =>
          doesNotificationMatchCandidate(r, numericId, options)
        );
        return mergeDatabaseNotifications(filteredData, localSent);
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

function deriveStaffUserId(handlerName?: string, handlerUserId?: number): number {
  if (handlerUserId && typeof handlerUserId === 'number' && handlerUserId > 0) {
    return handlerUserId;
  }
  if (handlerName && !isUnassignedHandlerName(handlerName)) {
    let hash = 0;
    for (let i = 0; i < handlerName.length; i++) {
      hash = (hash << 5) - hash + handlerName.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 8999) + 100;
  }
  return 10;
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
        user_id: res.data.user_id || deriveStaffUserId(params.handlerName, params.handlerUserId),
        applicant_id: null,
        title: res.data.title || title,
        message: res.data.message || message,
        is_read: false,
        created_at: res.data.created_at || new Date().toISOString(),
        created_by_name: params.senderName,
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
        const rowWithSender: DatabaseNotificationRow = {
          ...(inserted as DatabaseNotificationRow),
          created_by_name: params.senderName,
        };
        saveLocalSentNotification(rowWithSender);
        notifyListeners();
        return rowWithSender;
      }
    }
  } catch {
    // Fallback to local cache below
  }

  const fallbackRow: DatabaseNotificationRow = {
    notification_id: Date.now(),
    agency_id: 2,
    user_id: deriveStaffUserId(params.handlerName, params.handlerUserId),
    applicant_id: null,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
    created_by_name: params.senderName,
  };
  saveLocalSentNotification(fallbackRow);
  notifyListeners();
  return fallbackRow;
}

/**
 * Send a persistent compliance or status notification to a single specific applicant (`applicant_id` in `public.notification`).
 * Used when Admin clicks "Notify Candidate" in AdminDashboard or "Notify Candidate" in ComplianceAlerts.
 */
export async function sendCandidateNotification(params: {
  applicantId: string | number;
  applicantCode?: string;
  applicantName: string;
  documentName?: string;
  daysRemaining?: number;
  customTitle?: string;
  customMessage?: string;
  senderName?: string;
}): Promise<DatabaseNotificationRow> {
  let numericApplicantId = parseStrictApplicantId(params.applicantId);
  const cleanCode = params.applicantCode?.trim() || undefined;
  const cleanName = (params.applicantName || 'Candidate').trim();
  const docName = (params.documentName || 'Required Document').trim();

  let statusDetail = 'requires your attention or renewal';
  if (typeof params.daysRemaining === 'number' && Number.isFinite(params.daysRemaining)) {
    if (params.daysRemaining < 0) {
      const absDays = Math.abs(params.daysRemaining);
      statusDetail = `expired ${absDays} ${absDays === 1 ? 'day' : 'days'} ago and requires immediate renewal`;
    } else if (params.daysRemaining === 0) {
      statusDetail = 'expires today and requires immediate renewal';
    } else {
      statusDetail = `will expire in ${params.daysRemaining} ${params.daysRemaining === 1 ? 'day' : 'days'} — please prepare a renewed copy`;
    }
  }

  const codeLabel = cleanCode ? ` (${cleanCode})` : '';
  const title = params.customTitle || `Document Renewal Notice: ${docName}`;
  const message =
    params.customMessage ||
    `Hello ${cleanName}${codeLabel}, your ${docName} ${statusDetail}. Please coordinate with your assigned agency officer and submit an updated copy.`;

  // Record per-candidate + per-document notified state
  markCandidateDocumentNotified({
    applicantId: numericApplicantId ?? params.applicantId,
    applicantCode: cleanCode,
    documentName: docName,
  });

  // 1. Try Backend POST /notifications (supports applicant_id, applicant_code, and applicant_name resolution)
  if ((numericApplicantId !== null && numericApplicantId > 0) || cleanCode) {
    try {
      const res = await api.post('/notifications', {
        applicant_id: numericApplicantId,
        applicant_code: cleanCode || null,
        applicant_name: cleanName,
        user_id: null,
        title,
        message,
      });
      const payloadData = res.data?.notification || res.data;
      if (payloadData && (payloadData.notification_id || payloadData.title)) {
        const resolvedId = parseStrictApplicantId(payloadData.applicant_id) ?? numericApplicantId;
        const created: DatabaseNotificationRow = {
          notification_id: payloadData.notification_id || Date.now(),
          agency_id: payloadData.agency_id || 2,
          user_id: null,
          applicant_id: resolvedId,
          title: payloadData.title || title,
          message: payloadData.message || message,
          is_read: false,
          created_at: payloadData.created_at || new Date().toISOString(),
          target_applicant_code: cleanCode,
          target_applicant_name: cleanName,
        };
        if (resolvedId) {
          markCandidateDocumentNotified({
            applicantId: resolvedId,
            applicantCode: cleanCode,
            documentName: docName,
          });
        }
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
      if (numericApplicantId !== null && numericApplicantId > 0) {
        const { data: appRow } = await supabase
          .from('applicant')
          .select('applicant_id, agency_id')
          .eq('applicant_id', numericApplicantId)
          .limit(1);
        if (appRow && appRow.length > 0) {
          if (appRow[0].agency_id) targetAgencyId = Number(appRow[0].agency_id);
        }
      } else if (cleanCode) {
        const { data: appRowByCode } = await supabase
          .from('applicant')
          .select('applicant_id, agency_id')
          .ilike('applicant_code', cleanCode)
          .limit(1);
        if (appRowByCode && appRowByCode.length > 0 && appRowByCode[0].applicant_id) {
          numericApplicantId = Number(appRowByCode[0].applicant_id);
          if (appRowByCode[0].agency_id) targetAgencyId = Number(appRowByCode[0].agency_id);
        }
      }

      if (numericApplicantId !== null && numericApplicantId > 0) {
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
          const insertedRow: DatabaseNotificationRow = {
            ...(inserted as DatabaseNotificationRow),
            user_id: null,
            applicant_id: numericApplicantId,
            target_applicant_code: cleanCode,
            target_applicant_name: cleanName,
          };
          saveLocalSentNotification(insertedRow);
          notifyListeners();
          return insertedRow;
        }
      }
    } catch {
      // Fallback to local cache below
    }
  }

  // 3. Offline / fallback row: strictly preserve the exact candidate's ID (never fallback to applicant_id = 1!)
  const fallbackRow: DatabaseNotificationRow = {
    notification_id: Date.now(),
    agency_id: 2,
    user_id: null,
    applicant_id: numericApplicantId,
    title,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
    target_applicant_code: cleanCode,
    target_applicant_name: cleanName,
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
  currentUserId?: number;
  currentUserName?: string;
}): AppNotification[] {
  const {
    dbNotifications = [],
    applicants = [],
    complianceAlerts = [],
    expenses = [],
    userRoles = [],
    isSuperAdmin = false,
    currentUserId,
    currentUserName,
  } = params;

  const readIds = getReadNotificationIds();
  const dismissedIds = getDismissedNotificationIds();
  const hasRole = (role: UserRole) =>
    isSuperAdmin || userRoles.some((r) => r.toLowerCase() === role.toLowerCase());

  const cleanCurrentUserName = currentUserName?.trim().toLowerCase();

  const items: AppNotification[] = [];

  // 1. Direct Persistent Reminders & Notices from `public.notification`
  dbNotifications.forEach((row) => {
    // Candidate portal notices (where applicant_id is set) must never appear in the staff feed
    if (row.applicant_id != null) {
      return;
    }

    // A. Filter out reminders sent by the current user so they don't receive their own follow-ups
    if (cleanCurrentUserName) {
      if (row.created_by_name && row.created_by_name.trim().toLowerCase() === cleanCurrentUserName) {
        return;
      }
      const msg = (row.message || '').toLowerCase();
      if (
        msg.includes(`requested by ${cleanCurrentUserName}`) ||
        msg.includes(`by ${cleanCurrentUserName}`)
      ) {
        return;
      }
    }

    // B. If targeted to a specific handler user_id and currentUserId is known, only that user sees it
    if (
      row.user_id &&
      typeof row.user_id === 'number' &&
      currentUserId &&
      typeof currentUserId === 'number' &&
      row.user_id !== currentUserId
    ) {
      return;
    }

    // C. If the message specifies "Assigned to <Handler Name>:", ensure only that handler sees it
    if (cleanCurrentUserName) {
      const match = (row.message || '').match(/Assigned to ([^:]+):/i);
      if (match && match[1]) {
        const assignedHandler = match[1].trim().toLowerCase();
        if (
          assignedHandler !== cleanCurrentUserName &&
          !assignedHandler.includes(cleanCurrentUserName) &&
          !cleanCurrentUserName.includes(assignedHandler)
        ) {
          return;
        }
      }
    }

    // D. If the notification is a team broadcast ("Sent to Recruitment Team:" or "Sent to Admin Team:")
    if (row.message?.includes('Sent to Recruitment Team:')) {
      if (!hasRole('Recruitment') && !isSuperAdmin) return;
    } else if (row.message?.includes('Sent to Admin Team:')) {
      if (!hasRole('Admin') && !isSuperAdmin) return;
    }

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
    const oneDayMs = 24 * 60 * 60 * 1000;

    applicants
      .filter((a) => {
        if (a.isStopped || a.status === 'Deployed' || a.phase >= 6) return false;
        const lastUpdate = new Date(a.lastUpdated || a.createdAt || 0).getTime();
        if (isNaN(lastUpdate)) return false;
        const unassigned = !a.currentHandlerUserId && isUnassignedHandlerName(a.currentHandler);
        const days = Math.floor((now - lastUpdate) / oneDayMs);
        const thresholdDays = unassigned ? 5 : 3;
        return days >= thresholdDays;
      })
      .slice(0, 4)
      .forEach((a) => {
        const id = `delayed-candidate-${a.id}`;
        if (dismissedIds.has(id)) return;
        const lastUpdate = new Date(a.lastUpdated || a.createdAt || 0).getTime();
        const unassigned = !a.currentHandlerUserId && isUnassignedHandlerName(a.currentHandler);
        const thresholdDays = unassigned ? 5 : 3;
        const days = Math.max(
          thresholdDays,
          Math.floor((now - lastUpdate) / oneDayMs)
        );
        const responsibleTeam = getResponsibleTeamForPhase(a.phase, a.currentDepartment);
        const handlerLabel = unassigned
          ? `Unassigned (${responsibleTeam.label})`
          : a.currentHandler;

        const delayMessage = unassigned
          ? `No handler assigned for ${days} days in Stage ${a.phase} (${a.status}). Needs ${responsibleTeam.label} claim.`
          : `Assigned to ${a.currentHandler} but idle for ${days} days without stage updates.`;

        items.push({
          id,
          source: 'pipeline',
          category: 'pipeline',
          severity: days >= 7 ? 'critical' : 'warning',
          title: `Follow-Up Needed: ${a.name}`,
          message: delayMessage,
          createdAt: a.lastUpdated || a.createdAt || new Date().toISOString(),
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
