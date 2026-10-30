import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { ApplicantRecord, ActivityLog, ExpenseRecord, UserRole, ViewType } from '../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  AppNotification,
  DatabaseNotificationRow,
  NOTIFICATION_SYNC_EVENT,
  fetchStaffDatabaseNotifications,
  buildStaffNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../lib/notificationService';

interface NotificationCenterProps {
  applicants: ApplicantRecord[];
  activityLogs: ActivityLog[];
  expenses: ExpenseRecord[];
  userRoles: UserRole[];
  isSuperAdmin?: boolean;
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: ViewType) => void;
}

export default function NotificationCenter({
  applicants,
  activityLogs,
  expenses,
  userRoles,
  isSuperAdmin = false,
  onViewApplicant,
  onNavigate,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<DatabaseNotificationRow[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<any[]>([]);
  const [syncVersion, setSyncVersion] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const dbRows = await fetchStaffDatabaseNotifications();
      setDbNotifications(dbRows);

      const canSeeCompliance =
        isSuperAdmin ||
        userRoles.some((r) => r.toLowerCase() === 'admin' || r.toLowerCase() === 'management');
      if (canSeeCompliance) {
        try {
          const res = await api.get('/documents/alerts');
          const list = Array.isArray(res.data) ? res.data : res.data?.alerts || [];
          setComplianceAlerts(list);
        } catch {
          // ignore if backend alerts endpoint is unavailable
        }
      }
    } finally {
      setSyncVersion((v) => v + 1);
    }
  }, [isSuperAdmin, userRoles]);

  useEffect(() => {
    loadNotifications();

    const handleLocalSync = () => {
      loadNotifications();
    };
    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleLocalSync);

    const channel = supabase
      .channel('realtime:staff_notification_center')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification' },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleLocalSync);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const notifications: AppNotification[] = useMemo(() => {
    void syncVersion;
    return buildStaffNotifications({
      dbNotifications,
      applicants,
      complianceAlerts,
      expenses,
      activityLogs,
      userRoles,
      isSuperAdmin,
    });
  }, [dbNotifications, applicants, complianceAlerts, expenses, activityLogs, userRoles, isSuperAdmin, syncVersion]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const handleSelectNotification = async (notif: AppNotification) => {
    await markNotificationAsRead(notif, false);
    setSyncVersion((v) => v + 1);
    setIsOpen(false);

    if (notif.applicantId && (!notif.targetView || notif.targetView === 'applicants')) {
      onViewApplicant(notif.applicantId);
    } else if (notif.targetView) {
      onNavigate(notif.targetView as ViewType);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = notifications.filter((n) => !n.isRead);
    if (unreadItems.length === 0) return;
    await markAllNotificationsAsRead(unreadItems, false);
    setSyncVersion((v) => v + 1);
  };

  return (
    <div className="relative font-['Inter',sans-serif]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            loadNotifications();
          }
        }}
        className="relative text-[#475569] hover:text-[#0EA5E9] transition-colors cursor-pointer flex items-center justify-center"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#EF4444] rounded-full text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {/* Simple, Single-Row Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0F172A]">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-[#0EA5E9] hover:text-[#0284C7] transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-xs font-medium text-slate-600">No notifications right now</p>
                <p className="text-xs text-slate-400 mt-1">
                  Staff reminders and document alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleSelectNotification(notif)}
                  className={`w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-start gap-3 ${
                    notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-sky-50/30 hover:bg-sky-50/60'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      notif.isRead ? 'bg-slate-200' : 'bg-[#0EA5E9]'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          notif.isRead ? 'font-medium text-slate-700' : 'font-semibold text-[#0F172A]'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[11px] text-slate-400 flex-shrink-0">
                        {notif.timeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
