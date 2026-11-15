import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotificationItem,
  sendHandlerReminderNotification,
  sendCandidateNotification,
  fetchApplicantDatabaseNotifications,
  isCandidateDocumentNotified,
  getReadNotificationIds,
  getDismissedNotificationIds,
  resetNotificationLocalState,
  isUnassignedHandlerName,
  getResponsibleTeamForPhase,
} from './notificationService';

vi.mock('./api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('offline')),
    post: vi.fn().mockRejectedValue(new Error('offline')),
    patch: vi.fn().mockRejectedValue(new Error('offline')),
    delete: vi.fn().mockRejectedValue(new Error('offline')),
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    resetNotificationLocalState();
  });

  it('combines persistent database reminders with role-aware live operational alerts and excludes LOGIN/LOGOUT noise', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const notifications = buildStaffNotifications({
      dbNotifications: [
        {
          notification_id: 101,
          agency_id: 2,
          user_id: 5,
          applicant_id: null,
          title: 'Follow-Up Reminder: Maria Santos (APP-008)',
          message: 'Please review Maria Santos in Stage 2.',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
      applicants: [
        {
          id: '8',
          name: 'Maria Santos',
          applicantCode: 'APP-008',
          role: 'Domestic Helper',
          phase: 2,
          status: 'Medical Pending',
          lastUpdated: tenDaysAgo,
          currentHandler: 'Juan Dela Cruz',
        } as any,
      ],
      complianceAlerts: [
        {
          alert_id: 55,
          applicant_id: 8,
          applicant_name: 'Maria Santos',
          requirement_name: 'Philippine Passport',
          alert_level: 'EXPIRED',
          message: 'Passport expired 4 days ago.',
        },
      ],
      expenses: [
        {
          id: 'EXP-1',
          applicantId: '8',
          purpose: 'Medical Package',
          amount: 4500,
          currency: 'PESO',
          type: 'expense',
          remarks: 'Pending verification',
          status: 'draft',
          date: '2026-10-30',
          recordedBy: 'System',
        },
      ],
      activityLogs: [
        {
          id: 'LOG-1',
          applicantId: '',
          action: 'LOGIN',
          performedBy: 'Admin',
          department: 'Admin',
          details: 'Admin logged in',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'LOG-2',
          applicantId: '8',
          action: 'Document Verified',
          performedBy: 'Admin',
          department: 'Admin',
          details: 'Verified NBI Clearance for Maria Santos',
          timestamp: new Date().toISOString(),
        },
      ],
      userRoles: ['Management', 'Admin', 'Recruitment', 'Accounting'],
      isSuperAdmin: false,
    });

    // Should include DB reminder, compliance alert, delayed candidate, and draft expense, while excluding all audit/activity log spam
    expect(notifications.some((n) => n.id === 'db-101' && n.source === 'database')).toBe(true);
    expect(notifications.some((n) => n.source === 'compliance')).toBe(true);
    expect(notifications.some((n) => n.id === 'delayed-candidate-8')).toBe(true);
    expect(notifications.some((n) => n.source === 'finance')).toBe(true);
    expect(notifications.some((n) => n.title === 'Document Verified')).toBe(false);
    expect(notifications.some((n) => n.title === 'LOGIN')).toBe(false);
  });

  it('marks individual and all notifications as read and supports dismissal', async () => {
    await markNotificationAsRead({ id: 'db-202', notificationId: 202 });
    expect(getReadNotificationIds().has('db-202')).toBe(true);

    await markAllNotificationsAsRead([
      { id: 'compliance-1' },
      { id: 'delayed-candidate-8' },
    ]);
    expect(getReadNotificationIds().has('compliance-1')).toBe(true);
    expect(getReadNotificationIds().has('delayed-candidate-8')).toBe(true);

    await dismissNotificationItem({ id: 'compliance-1' });
    expect(getDismissedNotificationIds().has('compliance-1')).toBe(true);
  });

  it('enforces the XOR constraint when creating handler vs candidate notifications', async () => {
    const staffRow = await sendHandlerReminderNotification({
      applicantId: '8',
      applicantName: 'Maria Santos',
      applicantCode: 'APP-008',
      handlerName: 'Juan Dela Cruz',
      stageLabel: 'Medical Clearance',
      senderName: 'Manager',
    });
    expect(staffRow.user_id).toBeTruthy();
    expect(staffRow.applicant_id).toBeNull();
    expect(staffRow.title).toContain('Follow-Up Reminder: Maria Santos');
    expect(staffRow.message).toContain('Assigned to Juan Dela Cruz');

    const candidateRow = await sendCandidateNotification({
      applicantId: 8,
      applicantName: 'Maria Santos',
      documentName: 'Philippine Passport',
      daysRemaining: -4,
    });
    expect(candidateRow.applicant_id).toBe(8);
    expect(candidateRow.user_id).toBeNull();
  });

  it('routes unassigned candidate reminders to the responsible department team based on stage', async () => {
    expect(isUnassignedHandlerName('Unassigned')).toBe(true);
    expect(isUnassignedHandlerName('Unassigned Pool')).toBe(true);
    expect(isUnassignedHandlerName('louise Basty Conchada')).toBe(false);

    expect(getResponsibleTeamForPhase(1)).toEqual({
      role: 'Recruitment',
      label: 'Recruitment Team',
    });
    expect(getResponsibleTeamForPhase(2)).toEqual({
      role: 'Admin',
      label: 'Admin Team',
    });

    const unassignedScreening = await sendHandlerReminderNotification({
      applicantId: '29',
      applicantName: 'Maricel Cayabyab',
      applicantCode: 'APP-2026-FPT-00029',
      handlerName: 'Unassigned',
      phase: 1,
      stageLabel: 'Initial Screening & Tests',
      senderName: 'Manager',
    });
    expect(unassignedScreening.title).toContain('Unassigned Candidate Follow-Up: Maricel Cayabyab');
    expect(unassignedScreening.message).toContain('No handler is assigned yet. Sent to Recruitment Team');

    const unassignedMedical = await sendHandlerReminderNotification({
      applicantId: '30',
      applicantName: 'Efren Magbanua',
      applicantCode: 'APP-2026-FPT-00030',
      handlerName: 'Unassigned',
      phase: 2,
      stageLabel: 'Medical Clearance',
      senderName: 'Manager',
    });
    expect(unassignedMedical.title).toContain('Unassigned Candidate Follow-Up: Efren Magbanua');
    expect(unassignedMedical.message).toContain('No handler is assigned yet. Sent to Admin Team');
  });

  it('ensures only the assigned handler receives the reminder, and the sender manager is excluded', () => {
    const reminderRow = {
      notification_id: 501,
      agency_id: 2,
      user_id: 12, // Assigned to handler Louise (user_id=12)
      applicant_id: null,
      title: 'Follow-Up Reminder: Maria Santos (APP-008)',
      message: 'Assigned to Louise Basty Conchada: Please review Maria Santos. Follow-up requested by John Carlo Jamolo.',
      is_read: false,
      created_at: new Date().toISOString(),
      created_by_name: 'John Carlo Jamolo',
    };

    // 1. When the sender manager (John Carlo Jamolo, user_id=1) views notifications:
    const senderFeed = buildStaffNotifications({
      dbNotifications: [reminderRow],
      applicants: [],
      userRoles: ['Management'],
      currentUserId: 1,
      currentUserName: 'John Carlo Jamolo',
    });
    expect(senderFeed.some((n) => n.id === 'db-501')).toBe(false);

    // 2. When the assigned handler (Louise Basty Conchada, user_id=12) views notifications:
    const handlerFeed = buildStaffNotifications({
      dbNotifications: [reminderRow],
      applicants: [],
      userRoles: ['Recruitment'],
      currentUserId: 12,
      currentUserName: 'Louise Basty Conchada',
    });
    expect(handlerFeed.some((n) => n.id === 'db-501')).toBe(true);

    // 3. When another unrelated staff member (e.g. user_id=99) views notifications:
    const otherFeed = buildStaffNotifications({
      dbNotifications: [reminderRow],
      applicants: [],
      userRoles: ['Admin'],
      currentUserId: 99,
      currentUserName: 'Other Staff',
    });
    expect(otherFeed.some((n) => n.id === 'db-501')).toBe(false);
  });

  it('strictly isolates Notify Candidate notifications to only that candidate and tracks per-candidate/per-document state', async () => {
    // Send notification to Jayson Mendoza (applicant_id=22, APP-2026-FPT-00022) for NBI Clearance
    const jaysonRow = await sendCandidateNotification({
      applicantId: 22,
      applicantCode: 'APP-2026-FPT-00022',
      applicantName: 'Jayson Mendoza',
      documentName: 'NBI Clearance',
      daysRemaining: 26,
      senderName: 'Admin',
    });

    expect(jaysonRow.applicant_id).toBe(22);
    expect(jaysonRow.user_id).toBeNull();
    expect(jaysonRow.title).toBe('Document Renewal Notice: NBI Clearance');
    expect(jaysonRow.message).toContain('Hello Jayson Mendoza');

    // Only Jayson Mendoza + NBI Clearance is marked notified
    expect(
      isCandidateDocumentNotified({
        applicantId: 22,
        applicantCode: 'APP-2026-FPT-00022',
        documentName: 'NBI Clearance',
      })
    ).toBe(true);

    // Jayson Mendoza's other documents are NOT marked notified
    expect(
      isCandidateDocumentNotified({
        applicantId: 22,
        applicantCode: 'APP-2026-FPT-00022',
        documentName: 'Philippine Passport',
      })
    ).toBe(false);

    // Other candidates (e.g. Jerome Corpuz, applicant_id=25, who also has NBI Clearance) are NOT marked notified
    expect(
      isCandidateDocumentNotified({
        applicantId: 25,
        applicantCode: 'APP-2026-FPT-00025',
        documentName: 'NBI Clearance',
      })
    ).toBe(false);

    // Fetch notifications for Jayson Mendoza (22) -> receives only his notification
    const jaysonNotifs = await fetchApplicantDatabaseNotifications(22, {
      applicantCode: 'APP-2026-FPT-00022',
      applicantName: 'Jayson Mendoza',
    });
    expect(jaysonNotifs).toHaveLength(1);
    expect(jaysonNotifs[0].applicant_id).toBe(22);

    // Fetch notifications for Datu Al-Rashid Sinsuat (23) -> receives 0 notifications
    const datuNotifs = await fetchApplicantDatabaseNotifications(23, {
      applicantCode: 'APP-2026-FPT-00023',
      applicantName: 'Datu Al-Rashid Sinsuat',
    });
    expect(datuNotifs).toHaveLength(0);

    // Fetch notifications for Applicant 1 -> receives 0 notifications (no fallback to applicant_id=1)
    const applicant1Notifs = await fetchApplicantDatabaseNotifications(1, {
      applicantCode: 'APP-2026-FPT-00001',
      applicantName: 'First Applicant',
    });
    expect(applicant1Notifs).toHaveLength(0);

    // Never falls back to applicant_id=1 when given a non-numeric applicant code
    const codeOnlyRow = await sendCandidateNotification({
      applicantId: 'APP-2026-FPT-00024',
      applicantCode: 'APP-2026-FPT-00024',
      applicantName: 'Ramil Sylver',
      documentName: 'Philippine Passport',
      daysRemaining: -4,
    });
    expect(codeOnlyRow.applicant_id).not.toBe(1);
    expect(codeOnlyRow.target_applicant_code).toBe('APP-2026-FPT-00024');

    const ramilNotifs = await fetchApplicantDatabaseNotifications('APP-2026-FPT-00024', {
      applicantCode: 'APP-2026-FPT-00024',
      applicantName: 'Ramil Sylver',
    });
    expect(ramilNotifs).toHaveLength(1);
    expect(ramilNotifs[0].message).toContain('Hello Ramil Sylver');
  });
});
