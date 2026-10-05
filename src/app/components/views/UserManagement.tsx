import { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Edit2, Trash2, ShieldOff, ShieldCheck, X, Key, Copy, Check,
  Mail, Eye, EyeOff, Sparkles, Loader2, RefreshCw, Clock, Users, Ban,
  Search, Filter, AlertTriangle, AlertCircle, Send, CheckCircle2, Lock,
  Phone, UserX, UserCheck
} from 'lucide-react';
import { Skeleton, SkeletonAvatar, SkeletonBadge } from '../ui/skeleton';
import { ActivityLog, UserRole, ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  roles: UserRole[];
  status: 'Active' | 'Inactive';
  createdDate: string;
  onboardingPending?: boolean;
  lastLoginAt?: string | null;
  lastSeenAt?: string | null;
}

interface ApplicantPortalAccount {
  applicant_id: number;
  id: string;
  applicant_code: string;
  name: string;
  email: string;
  contact_number?: string;
  photo_url?: string;
  auth_id?: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason?: string | null;
  status: 'Active' | 'Inactive' | 'Blocked';
  lifecycle_status?: string;
  applied_role?: string;
  job_code?: string;
  handler_name?: string;
  current_phase?: number;
  created_date?: string;
}

interface UserManagementProps {
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  globalStaff?: any[];
  globalRoles?: any[];
  applicants?: ApplicantRecord[];
  updateApplicant?: (id: string, updates: Partial<ApplicantRecord>) => void;
}

interface AvailableRole {
  id: UserRole;
  label: string;
  desc: string;
  badgeColor: string;
  activeColor: string;
}

const ROLE_STYLE_MAP: Record<string, { badgeColor: string; activeColor: string }> = {
  Recruitment: { badgeColor: 'bg-sky-50 text-sky-700 border-sky-200', activeColor: 'border-sky-400 bg-sky-50 text-sky-900' },
  Admin: { badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', activeColor: 'border-purple-400 bg-purple-50 text-purple-900' },
  Accounting: { badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeColor: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  Management: { badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', activeColor: 'border-amber-400 bg-amber-50 text-amber-900' },
};

const DEFAULT_ROLES_CATALOG: AvailableRole[] = [
  { id: 'Recruitment', label: 'Recruitment', desc: 'Screening & Profiling', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200', activeColor: 'border-sky-400 bg-sky-50 text-sky-900' },
  { id: 'Admin', label: 'Admin', desc: 'Agency Setup & Visas', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', activeColor: 'border-purple-400 bg-purple-50 text-purple-900' },
  { id: 'Accounting', label: 'Accounting', desc: 'Ledger & Expenses', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeColor: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  { id: 'Management', label: 'Management', desc: 'Analytics & Hub', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', activeColor: 'border-amber-400 bg-amber-50 text-amber-900' },
];

const PHASE_CONFIG: Record<number, { name: string; color: string }> = {
  1: { name: 'Phase 1: Screening', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  2: { name: 'Phase 2: Medical', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  3: { name: 'Phase 3: Vetting', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  4: { name: 'Phase 4: Interview', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  5: { name: 'Phase 5: Deployment', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const mapStaffFromApi = (u: any): StaffAccount => {
  const rawRoles: UserRole[] = (u.role_names && Array.isArray(u.role_names) && u.role_names.length > 0)
    ? u.role_names
    : (u.role_name ? u.role_name.split(',').map((r: string) => r.trim() as UserRole) : ['Recruitment']);
  const primaryRole = rawRoles[0] || 'Recruitment';
  return {
    id: String(u.user_id),
    name: u.full_name || 'Staff Member',
    email: u.email,
    department: u.department_name || u.department || 'Unassigned',
    role: primaryRole,
    roles: rawRoles,
    status: u.status === 'Inactive' ? 'Inactive' : 'Active',
    createdDate: u.created_at ? u.created_at.split('T')[0] : '',
    onboardingPending: Boolean(u.onboarding_pending),
    lastLoginAt: u.last_login_at || null,
    lastSeenAt: u.last_seen_at || null,
  };
};

export default function UserManagement({
  currentUserName,
  addActivityLog,
  globalStaff,
  globalRoles,
  applicants,
  updateApplicant
}: UserManagementProps) {
  // ── Tab Navigation ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'staff' | 'applicants'>('staff');

  // ── Staff State ────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(!globalStaff || globalStaff.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>(DEFAULT_ROLES_CATALOG);
  const [staff, setStaff] = useState<StaffAccount[]>(() => {
    return (globalStaff && Array.isArray(globalStaff) && globalStaff.length > 0)
      ? globalStaff.map(mapStaffFromApi)
      : [];
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Applicant Accounts State ───────────────────────────────────────────────
  const [applicantAccounts, setApplicantAccounts] = useState<ApplicantPortalAccount[]>([]);
  const [applicantLoading, setApplicantLoading] = useState(false);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Blocked'>('All');
  const [applicantPhaseFilter, setApplicantPhaseFilter] = useState<'All' | '1' | '2' | '3' | '4' | '5'>('All');

  // ── Custom UI Confirmation Overlays ────────────────────────────────────────
  // 1. Resend Confirmation Modal
  const [resendTarget, setResendTarget] = useState<{
    type: 'staff' | 'applicant';
    id: string | number;
    name: string;
    email: string;
    applicantCode?: string;
  } | null>(null);
  const [isResending, setIsResending] = useState(false);

  // 2. Block/Unblock Applicant Modal
  const [blockTarget, setBlockTarget] = useState<{
    applicant_id: number;
    name: string;
    code: string;
    isBlockedCurrently: boolean;
    currentReason?: string | null;
  } | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [isBlockSubmitting, setIsBlockSubmitting] = useState(false);

  // 3. Credentials Result Modal (Replaces browser alert)
  const [credentialsResult, setCreatedCredentialsResult] = useState<{
    title: string;
    name: string;
    email: string;
    username: string;
    password?: string;
    portalName: string;
    emailDispatched?: boolean;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Staff Add Form State ───────────────────────────────────────────────────
  const generateTempPassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const all = uppers + lowers + numbers + specials;
    const pick = (s: string) => s.charAt(Math.floor(Math.random() * s.length));
    const chars = [pick(uppers), pick(lowers), pick(numbers), pick(specials)];
    for (let i = 0; i < 8; i++) chars.push(pick(all));
    return chars.sort(() => Math.random() - 0.5).join('');
  };

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    department: '',
    role: '' as UserRole,
    roles: [] as UserRole[],
    password: generateTempPassword(),
    requirePasswordChange: true,
  });
  const [showPassword, setShowPassword] = useState(false);

  // Synchronize when globalStaff updates
  useEffect(() => {
    if (globalStaff && Array.isArray(globalStaff) && globalStaff.length > 0) {
      setStaff(globalStaff.map(mapStaffFromApi));
      setLoading(false);
    }
  }, [globalStaff]);

  // ── Fetch Staff & Roles ────────────────────────────────────────────────────
  const fetchStaffAndRoles = async (silent = false) => {
    try {
      if (!silent && (!globalStaff || globalStaff.length === 0)) setLoading(true);
      setErrorMsg(null);

      try {
        const rolesRes = (globalRoles && globalRoles.length > 0) ? { data: globalRoles } : await api.get('/users/roles');
        if (rolesRes.data && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
          const mappedRoles: AvailableRole[] = rolesRes.data.map((r: any) => {
            const sysRole = (r.system_role || r.role_name) as UserRole;
            const style = ROLE_STYLE_MAP[sysRole] || {
              badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
              activeColor: 'border-slate-400 bg-slate-50 text-slate-900',
            };
            return {
              id: sysRole,
              label: r.role_name || sysRole,
              desc: r.description || `${sysRole} permissions`,
              badgeColor: style.badgeColor,
              activeColor: style.activeColor,
            };
          });
          setAvailableRoles(mappedRoles);
        }
      } catch (roleErr) {
        console.warn('Could not fetch roles from backend, using default catalog:', roleErr);
      }

      const res = await api.get('/users');
      if (res.data && Array.isArray(res.data)) {
        setStaff(res.data.map(mapStaffFromApi));
      }
    } catch (err: any) {
      console.warn('Could not fetch live users from Supabase:', err);
      if (!silent) {
        setErrorMsg(err?.response?.data?.detail || err.message || 'Failed to fetch staff accounts.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // ── Fetch Applicant Accounts ───────────────────────────────────────────────
  const fetchApplicantAccounts = async (silent = false) => {
    try {
      if (!silent) setApplicantLoading(true);
      const res = await api.get('/users/applicants');
      if (res.data && Array.isArray(res.data)) {
        setApplicantAccounts(res.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch applicant portal accounts:', err);
    } finally {
      setApplicantLoading(false);
      setIsRefreshing(false);
    }
  };

  // Refresh both on mount or tab change
  useEffect(() => {
    fetchStaffAndRoles();
    fetchApplicantAccounts();

    // Supabase realtime channel for updates
    const channel = supabase
      .channel('realtime:user_mgmt_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_user' }, () => {
        fetchStaffAndRoles(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applicant' }, () => {
        fetchApplicantAccounts(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Staff Handlers ─────────────────────────────────────────────────────────
  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.email || isSubmitting) return;
    if (!newStaff.roles || newStaff.roles.length === 0) {
      alert('Please select at least one role before creating the account.');
      return;
    }
    setIsSubmitting(true);

    const chosenRoles = newStaff.roles.length > 0 ? newStaff.roles : [newStaff.role];
    const primaryRole = chosenRoles[0] || 'Recruitment';
    const finalPassword = newStaff.password.trim() || generateTempPassword();
    const customDept = newStaff.department.trim();
    let emailDispatched = false;

    try {
      const res = await api.post('/users', {
        fullName: newStaff.name,
        email: newStaff.email,
        roleNames: chosenRoles,
        roleName: chosenRoles.join(', '),
        department: customDept,
        password: finalPassword,
        requirePasswordChange: newStaff.requirePasswordChange,
      });

      if (res.data) {
        emailDispatched = Boolean(res.data.emailDispatched ?? res.data.email_dispatched);
      }

      const createdStaff: StaffAccount = {
        id: String(res.data?.userId || res.data?.user_id || Date.now()),
        name: newStaff.name,
        email: newStaff.email,
        department: res.data?.department || res.data?.department_name || customDept,
        role: primaryRole,
        roles: chosenRoles,
        status: 'Active',
        createdDate: new Date().toISOString().split('T')[0],
        onboardingPending: true,
        lastLoginAt: null,
        lastSeenAt: null,
      };
      setStaff([createdStaff, ...staff]);

      addActivityLog({
        applicantId: '',
        action: 'New Staff Provisioned',
        performedBy: currentUserName,
        department: primaryRole,
        details: `Staff account provisioned for ${newStaff.name} (${newStaff.email}) with roles: ${chosenRoles.join(', ')}`,
      });

      setShowAddModal(false);
      setCreatedCredentialsResult({
        title: 'Staff Account Created Successfully',
        name: newStaff.name,
        email: newStaff.email,
        username: newStaff.email,
        password: finalPassword,
        portalName: 'Agency Staff Portal',
        emailDispatched: emailDispatched,
        message: emailDispatched
          ? `Welcome invitation with temporary credentials dispatched to ${newStaff.email}.`
          : 'Credentials created. You can copy the temporary password below.',
      });

      setNewStaff({
        name: '',
        email: '',
        department: '',
        role: '' as UserRole,
        roles: [],
        password: generateTempPassword(),
        requirePasswordChange: true,
      });
    } catch (err: any) {
      console.error('Failed to add staff:', err);
      const errMsg = err?.response?.data?.detail || err.message || 'Failed to create staff account.';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = async () => {
    if (!selectedStaff || isEditing) return;
    setIsEditing(true);

    const numId = parseInt(selectedStaff.id, 10);
    const chosenRoles = editRoles.length > 0 ? editRoles : [selectedStaff.role];
    const primaryRole = chosenRoles[0] || 'Recruitment';

    try {
      let savedDept = (selectedStaff.department || '').trim();
      let updatedRoles = chosenRoles;
      if (!isNaN(numId)) {
        const res = await api.put(`/users/${numId}`, {
          roleNames: chosenRoles,
          roleName: chosenRoles.join(', '),
          department: savedDept,
        });
        if (res.data?.department || res.data?.department_name) {
          savedDept = res.data.department || res.data.department_name;
        }
        if (res.data?.role_names && Array.isArray(res.data.role_names) && res.data.role_names.length > 0) {
          updatedRoles = res.data.role_names;
        }
      }

      setStaff(
        staff.map((s) =>
          s.id === selectedStaff.id
            ? { ...s, role: updatedRoles[0] || primaryRole, roles: updatedRoles, department: savedDept }
            : s
        )
      );

      addActivityLog({
        applicantId: '',
        action: 'Staff Roles Updated',
        performedBy: currentUserName,
        department: 'Management',
        details: `Staff roles updated: ${selectedStaff.name} - Roles: ${updatedRoles.join(', ')}`,
      });

      setShowEditModal(false);
      setSelectedStaff(null);
    } catch (err: any) {
      console.error('Backend update user failed:', err);
      const errMsg = err?.response?.data?.detail || err.message || 'Failed to update staff roles.';
      alert(errMsg);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff || isDeleting) return;
    setIsDeleting(true);

    const numId = parseInt(selectedStaff.id, 10);
    const deletedStaffName = selectedStaff.name;
    try {
      if (!isNaN(numId)) {
        await api.delete(`/users/${numId}`);
      }

      setStaff(staff.filter((s) => s.id !== selectedStaff.id));

      if (applicants && updateApplicant && deletedStaffName) {
        const deletedLower = deletedStaffName.trim().toLowerCase();
        applicants.forEach((app) => {
          if (app.currentHandler && app.currentHandler.trim().toLowerCase() === deletedLower) {
            updateApplicant(app.id, {
              currentHandler: 'Unassigned',
              phaseDescription: 'Returned to unassigned candidates (Staff account deleted)',
            });
          }
        });
      }

      addActivityLog({
        applicantId: '',
        action: 'Staff Account Deleted',
        performedBy: currentUserName,
        department: 'Management',
        details: `Staff account deleted: ${selectedStaff.name} (${selectedStaff.id}).`,
      });

      setShowDeleteModal(false);
      setSelectedStaff(null);
    } catch (err) {
      console.warn('Backend delete user failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStaffAccess = async (staffMember: StaffAccount) => {
    const newStatus = staffMember.status === 'Active' ? 'Inactive' : 'Active';
    const numId = parseInt(staffMember.id, 10);
    if (!isNaN(numId)) {
      try {
        await api.put(`/users/${numId}`, { status: newStatus });
      } catch (err) {
        console.warn('Backend status toggle failed:', err);
      }
    }

    setStaff(staff.map((s) => (s.id === staffMember.id ? { ...s, status: newStatus } : s)));
    addActivityLog({
      applicantId: '',
      action: newStatus === 'Active' ? 'Access Restored' : 'Access Revoked',
      performedBy: currentUserName,
      department: 'Management',
      details: `Access ${newStatus === 'Active' ? 'restored for' : 'revoked from'} staff ${staffMember.name}`,
    });
  };

  // ── Applicant Actions ──────────────────────────────────────────────────────
  const handleToggleApplicantStatus = async (acc: ApplicantPortalAccount) => {
    const newActive = !acc.is_active;
    try {
      await api.put(`/users/applicants/${acc.applicant_id}/status`, { is_active: newActive });
      setApplicantAccounts((prev) =>
        prev.map((a) =>
          a.applicant_id === acc.applicant_id
            ? {
                ...a,
                is_active: newActive,
                status: a.is_blocked ? 'Blocked' : newActive ? 'Active' : 'Inactive',
              }
            : a
        )
      );

      addActivityLog({
        applicantId: String(acc.applicant_id),
        action: newActive ? 'Applicant Portal Restored' : 'Applicant Portal Deactivated',
        performedBy: currentUserName,
        department: 'Management',
        details: `Applicant portal access ${newActive ? 'restored' : 'deactivated'} for ${acc.name} (${acc.applicant_code})`,
      });
    } catch (err: any) {
      console.error('Failed to toggle applicant status:', err);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget || isBlockSubmitting) return;
    setIsBlockSubmitting(true);

    const willBlock = !blockTarget.isBlockedCurrently;
    try {
      await api.put(`/users/applicants/${blockTarget.applicant_id}/block`, {
        is_blocked: willBlock,
        reason: willBlock ? (blockReasonInput.trim() || 'Blocked by Agency Administrator') : null,
      });

      setApplicantAccounts((prev) =>
        prev.map((a) =>
          a.applicant_id === blockTarget.applicant_id
            ? {
                ...a,
                is_blocked: willBlock,
                blocked_reason: willBlock ? (blockReasonInput.trim() || 'Blocked by Agency Administrator') : null,
                status: willBlock ? 'Blocked' : a.is_active ? 'Active' : 'Inactive',
              }
            : a
        )
      );

      addActivityLog({
        applicantId: String(blockTarget.applicant_id),
        action: willBlock ? 'Applicant Account Blocked' : 'Applicant Account Unblocked',
        performedBy: currentUserName,
        department: 'Management',
        details: willBlock
          ? `Applicant ${blockTarget.name} (${blockTarget.code}) blocked: ${blockReasonInput.trim() || 'No reason provided'}`
          : `Applicant ${blockTarget.name} (${blockTarget.code}) unblocked`,
      });

      setBlockTarget(null);
      setBlockReasonInput('');
    } catch (err: any) {
      console.error('Failed to block/unblock applicant:', err);
    } finally {
      setIsBlockSubmitting(false);
    }
  };

  // ── Unified Resend Execution ───────────────────────────────────────────────
  const handleExecuteResend = async () => {
    if (!resendTarget || isResending) return;
    setIsResending(true);

    try {
      if (resendTarget.type === 'staff') {
        const numId = parseInt(String(resendTarget.id), 10);
        const res = await api.post(`/users/${numId}/resend-onboarding-email`, {});
        const newPass = res.data?.new_temp_pass;
        setStaff((prev) =>
          prev.map((s) => (s.id === String(resendTarget.id) ? { ...s, onboardingPending: true } : s))
        );

        setCreatedCredentialsResult({
          title: 'Staff Credentials Dispatched',
          name: resendTarget.name,
          email: resendTarget.email,
          username: resendTarget.email,
          password: newPass,
          portalName: 'Agency Staff Account',
          emailDispatched: Boolean(res.data?.email_dispatched),
          message: `Official login credentials were emailed to ${resendTarget.email}.`,
        });
      } else {
        const res = await api.post(`/users/applicants/${resendTarget.id}/resend-email`, {});
        const newPass = res.data?.temp_pass || res.data?.password || 'New Secure Temp Pass';
        setCreatedCredentialsResult({
          title: 'Applicant Credentials Dispatched',
          name: resendTarget.name,
          email: resendTarget.email,
          username: resendTarget.applicantCode || res.data?.applicant_code || resendTarget.email,
          password: newPass,
          portalName: 'Applicant Account',
          emailDispatched: Boolean(res.data?.email_dispatched),
          message: `Official login credentials were sent to ${resendTarget.email}.`,
        });
      }

      setResendTarget(null);
    } catch (err: any) {
      console.error('Failed to resend credentials:', err);
      const msg = err?.response?.data?.detail || err.message || 'Failed to dispatch credentials email.';
      alert(msg);
    } finally {
      setIsResending(false);
    }
  };

  // ── Filtered Applicants ────────────────────────────────────────────────────
  const filteredApplicants = useMemo(() => {
    return applicantAccounts.filter((a) => {
      // Search
      const searchMatch =
        !applicantSearch ||
        a.name.toLowerCase().includes(applicantSearch.toLowerCase()) ||
        a.applicant_code.toLowerCase().includes(applicantSearch.toLowerCase()) ||
        (a.email && a.email.toLowerCase().includes(applicantSearch.toLowerCase())) ||
        (a.applied_role && a.applied_role.toLowerCase().includes(applicantSearch.toLowerCase())) ||
        (a.handler_name && a.handler_name.toLowerCase().includes(applicantSearch.toLowerCase()));

      // Status Filter
      const statusMatch =
        applicantStatusFilter === 'All' ||
        (applicantStatusFilter === 'Active' && a.is_active && !a.is_blocked) ||
        (applicantStatusFilter === 'Inactive' && !a.is_active && !a.is_blocked) ||
        (applicantStatusFilter === 'Blocked' && a.is_blocked);

      // Phase Filter
      const phaseMatch =
        applicantPhaseFilter === 'All' ||
        String(a.current_phase || 1) === applicantPhaseFilter;

      return searchMatch && statusMatch && phaseMatch;
    });
  }, [applicantAccounts, applicantSearch, applicantStatusFilter, applicantPhaseFilter]);

  // Applicant KPI counts
  const applicantStats = useMemo(() => {
    const total = applicantAccounts.length;
    const active = applicantAccounts.filter((a) => a.is_active && !a.is_blocked).length;
    const inactive = applicantAccounts.filter((a) => !a.is_active && !a.is_blocked).length;
    const blocked = applicantAccounts.filter((a) => a.is_blocked).length;
    return { total, active, inactive, blocked };
  }, [applicantAccounts]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header & Top-Level Tabs ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
            User Account Management
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Manage agency staff permissions (RBAC) and overseas applicant account credentials
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setIsRefreshing(true);
              if (activeTab === 'staff') fetchStaffAndRoles();
              else fetchApplicantAccounts();
            }}
            disabled={isRefreshing}
            className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0EA5E9]' : ''}`} />
          </button>

          {activeTab === 'staff' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-[#0EA5E9]/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add New Staff
            </button>
          )}
        </div>
      </div>

      {/* ── Modern Navigation Tabs ─────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'border-[#0EA5E9] text-[#0EA5E9]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Staff Accounts</span>
          <span
            className={`ml-1 text-xs px-2 py-0.5 rounded-full font-black ${
              activeTab === 'staff' ? 'bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {staff.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('applicants')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'applicants'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Applicant Accounts</span>
          <span
            className={`ml-1 text-xs px-2 py-0.5 rounded-full font-black ${
              activeTab === 'applicants' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {applicantAccounts.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── STAFF ACCOUNTS VIEW ─────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">System Roles</th>
                  <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <SkeletonAvatar />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-32" />
                              <Skeleton className="h-2.5 w-44 bg-slate-100" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><Skeleton className="h-3.5 w-20" /></td>
                        <td className="px-6 py-4"><SkeletonBadge className="w-24" /></td>
                        <td className="px-6 py-4"><SkeletonBadge className="w-20" /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : errorMsg ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-rose-500">
                        <ShieldOff className="w-8 h-8 mb-3 opacity-80" />
                        <p className="font-bold text-sm mb-1">Error Loading Accounts</p>
                        <p className="text-xs text-rose-400 mb-4">{errorMsg}</p>
                        <button
                          onClick={() => fetchStaffAndRoles()}
                          className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[#64748B]">
                      No staff accounts found.
                    </td>
                  </tr>
                ) : (
                  staff.map((staffMember) => (
                    <tr
                      key={staffMember.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        staffMember.status === 'Inactive' ? 'bg-slate-50/50 opacity-60' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${
                              staffMember.status === 'Active'
                                ? 'bg-[#0EA5E9] text-white'
                                : 'bg-slate-200 text-slate-400'
                            } flex items-center justify-center font-bold text-xs flex-shrink-0`}
                          >
                            {getInitials(staffMember.name)}
                          </div>
                          <div>
                            <div className={`font-semibold text-sm ${staffMember.status === 'Inactive' ? 'text-slate-400' : 'text-[#0F172A]'}`}>
                              {staffMember.name}
                            </div>
                            <div className="text-[11px] text-slate-400">{staffMember.email}</div>
                            {staffMember.onboardingPending ? (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                <Clock size={9} /> Awaiting First Login
                              </span>
                            ) : staffMember.lastLoginAt ? (
                              <span
                                className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-emerald-600 font-semibold"
                                title={`Last login: ${new Date(staffMember.lastLoginAt).toLocaleString()}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-medium">
                                Active staff
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${staffMember.status === 'Inactive' ? 'text-slate-400' : 'text-[#64748B]'}`}>
                        {staffMember.department}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(staffMember.roles && staffMember.roles.length > 0 ? staffMember.roles : [staffMember.role]).map((r, idx) => {
                            const colors: Record<string, string> = {
                              Admin: 'bg-purple-50 text-purple-700 border-purple-200',
                              Recruitment: 'bg-sky-50 text-sky-700 border-sky-200',
                              Accounting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                              Management: 'bg-amber-50 text-amber-700 border-amber-200',
                            };
                            return (
                              <span
                                key={idx}
                                className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                                  staffMember.status === 'Inactive'
                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                    : colors[r] || 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {r}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
                            staffMember.status === 'Active'
                              ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                              : 'bg-slate-200 text-slate-500 border-slate-300'
                          }`}
                        >
                          {staffMember.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send / Resend Onboarding Email via Custom Overlay */}
                          <button
                            onClick={() =>
                              setResendTarget({
                                type: 'staff',
                                id: staffMember.id,
                                name: staffMember.name,
                                email: staffMember.email,
                              })
                            }
                            className="p-2 hover:bg-amber-50 rounded-lg transition-colors group cursor-pointer"
                            title="Send Login Credentials via Email"
                          >
                            <Mail className={`w-4 h-4 ${staffMember.onboardingPending ? 'text-amber-500' : 'text-[#64748B] group-hover:text-amber-500'}`} />
                          </button>

                          {/* Edit Roles */}
                          <button
                            onClick={() => {
                              setSelectedStaff(staffMember);
                              setEditRoles(staffMember.roles && staffMember.roles.length > 0 ? staffMember.roles : [staffMember.role]);
                              setShowEditModal(true);
                            }}
                            className="p-2 hover:bg-sky-50 rounded-lg transition-colors group cursor-pointer"
                            title="Edit Roles"
                          >
                            <Edit2 className="w-4 h-4 text-[#64748B] group-hover:text-[#0EA5E9]" />
                          </button>

                          {/* Toggle Active/Inactive */}
                          <button
                            onClick={() => handleToggleStaffAccess(staffMember)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors group cursor-pointer"
                            title={staffMember.status === 'Active' ? 'Deactivate Access' : 'Restore Access'}
                          >
                            {staffMember.status === 'Active' ? (
                              <ShieldOff className="w-4 h-4 text-[#64748B] group-hover:text-[#F59E0B]" />
                            ) : (
                              <ShieldCheck className="w-4 h-4 text-[#64748B] group-hover:text-[#10B981]" />
                            )}
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => {
                              setSelectedStaff(staffMember);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 hover:bg-rose-50 rounded-lg transition-colors group cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4 text-[#64748B] group-hover:text-[#EF4444]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── APPLICANT ACCOUNTS VIEW ─────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'applicants' && (
        <div className="space-y-5">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center flex-shrink-0">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Applicants</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{applicantStats.total}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <UserCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Active Accounts</p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">{applicantStats.active}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                <UserX size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Deactivated</p>
                <p className="text-2xl font-black text-slate-700 mt-0.5">{applicantStats.inactive}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Ban size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Blocked Accounts</p>
                <p className="text-2xl font-black text-rose-600 mt-0.5">{applicantStats.blocked}</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={applicantSearch}
                onChange={(e) => setApplicantSearch(e.target.value)}
                placeholder="Search by code, name, trade, handler..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                <Filter size={13} /> Filters:
              </div>

              {/* Status Filter */}
              <select
                value={applicantStatusFilter}
                onChange={(e: any) => setApplicantStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 font-medium outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Account</option>
                <option value="Inactive">Deactivated</option>
                <option value="Blocked">Blocked</option>
              </select>

              {/* Phase Filter */}
              <select
                value={applicantPhaseFilter}
                onChange={(e: any) => setApplicantPhaseFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 font-medium outline-none"
              >
                <option value="All">All 5 Phases</option>
                <option value="1">Phase 1: Screening</option>
                <option value="2">Phase 2: Medical</option>
                <option value="3">Phase 3: Vetting</option>
                <option value="4">Phase 4: Interview</option>
                <option value="5">Phase 5: Deployment</option>
              </select>

              {(applicantSearch || applicantStatusFilter !== 'All' || applicantPhaseFilter !== 'All') && (
                <button
                  onClick={() => {
                    setApplicantSearch('');
                    setApplicantStatusFilter('All');
                    setApplicantPhaseFilter('All');
                  }}
                  className="text-xs text-[#0EA5E9] hover:underline font-bold px-2 py-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Applicant Accounts Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Applicant & Code</th>
                    <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Applied Trade & Handler</th>
                    <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Current Phase</th>
                    <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Account Access</th>
                    <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {applicantLoading ? (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <SkeletonAvatar />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-44 bg-slate-100" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><Skeleton className="h-3.5 w-28" /></td>
                          <td className="px-6 py-4"><SkeletonBadge className="w-28" /></td>
                          <td className="px-6 py-4"><SkeletonBadge className="w-20" /></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Skeleton className="h-8 w-8 rounded-lg" />
                              <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : filteredApplicants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-sm">No applicant accounts match your filters</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try clearing search keywords or status filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApplicants.map((acc) => {
                      const phase = acc.current_phase || 1;
                      const phaseInfo = PHASE_CONFIG[phase] || PHASE_CONFIG[1];

                      return (
                        <tr
                          key={acc.applicant_id}
                          className={`hover:bg-slate-50 transition-colors ${
                            acc.is_blocked ? 'bg-rose-50/20' : !acc.is_active ? 'bg-slate-50/40 opacity-70' : ''
                          }`}
                        >
                          {/* Applicant Info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 flex-shrink-0">
                                {getInitials(acc.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-[#0F172A] truncate flex items-center gap-2">
                                  <span>{acc.name}</span>
                                  {acc.is_blocked && (
                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded">
                                      Blocked
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-[#0EA5E9] font-bold">
                                  {acc.applicant_code}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {acc.email || 'No registered email'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Applied Trade & Handler */}
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-[#0F172A]">{acc.applied_role}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="text-[11px] text-slate-400">Handler:</span>
                              <span className="font-medium text-slate-700">{acc.handler_name}</span>
                            </div>
                          </td>

                          {/* Current Phase */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${phaseInfo.color}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {phaseInfo.name}
                            </span>
                            {acc.lifecycle_status && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                {acc.lifecycle_status}
                              </div>
                            )}
                          </td>

                          {/* Portal Access Status */}
                          <td className="px-6 py-4">
                            {acc.is_blocked ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                  <Ban size={10} /> Blocked
                                </span>
                                {acc.blocked_reason && (
                                  <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={acc.blocked_reason}>
                                    {acc.blocked_reason}
                                  </p>
                                )}
                              </div>
                            ) : acc.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Deactivated
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Resend Login Credentials Email (Custom Overlay) */}
                              <button
                                onClick={() =>
                                  setResendTarget({
                                    type: 'applicant',
                                    id: acc.applicant_id,
                                    name: acc.name,
                                    email: acc.email,
                                    applicantCode: acc.applicant_code,
                                  })
                                }
                                className="p-2 hover:bg-sky-50 text-slate-500 hover:text-[#0EA5E9] rounded-lg transition-colors cursor-pointer"
                                title="Resend Login Credentials Email"
                              >
                                <Mail size={15} />
                              </button>

                              {/* Toggle Active / Inactive Status */}
                              <button
                                onClick={() => handleToggleApplicantStatus(acc)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  acc.is_active
                                    ? 'hover:bg-amber-50 text-slate-500 hover:text-amber-600'
                                    : 'hover:bg-emerald-50 text-slate-500 hover:text-emerald-600'
                                }`}
                                title={acc.is_active ? 'Deactivate Account Access' : 'Restore Account Access'}
                              >
                                {acc.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                              </button>

                              {/* Block / Unblock Modal */}
                              <button
                                onClick={() => {
                                  setBlockTarget({
                                    applicant_id: acc.applicant_id,
                                    name: acc.name,
                                    code: acc.applicant_code,
                                    isBlockedCurrently: acc.is_blocked,
                                    currentReason: acc.blocked_reason,
                                  });
                                  setBlockReasonInput(acc.blocked_reason || '');
                                }}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  acc.is_blocked
                                    ? 'hover:bg-emerald-50 text-rose-500 hover:text-emerald-600'
                                    : 'hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                                }`}
                                title={acc.is_blocked ? 'Unblock Applicant Account' : 'Block Applicant Account'}
                              >
                                <Ban size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── CUSTOM CONFIRMATION OVERLAYS (NO WINDOW.CONFIRM OR ALERT) ───────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* 1. RESEND CREDENTIALS CONFIRMATION MODAL */}
      {resendTarget && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-base">Confirm Credentials Dispatch</h3>
                  <p className="text-xs text-slate-500">
                    {resendTarget.type === 'staff' ? 'Agency Staff Account' : 'Overseas Applicant Account'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResendTarget(null)}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to dispatch official login credentials to{' '}
                <strong className="text-slate-900">{resendTarget.name}</strong>.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Destination Email:</span>
                  <span className="font-bold text-slate-900">{resendTarget.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account Type:</span>
                  <span className="font-bold text-[#0EA5E9]">
                    {resendTarget.type === 'staff' ? 'Agency Staff Account' : 'Applicant Account'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Login Username:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {resendTarget.applicantCode || resendTarget.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Password Provisioning:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    New Secure Temp Pass
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setResendTarget(null)}
                  disabled={isResending}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResend}
                  disabled={isResending}
                  className="flex-1 py-2.5 px-4 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-[#0EA5E9]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isResending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send Credentials</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. BLOCK / UNBLOCK APPLICANT MODAL */}
      {blockTarget && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    blockTarget.isBlockedCurrently
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}
                >
                  {blockTarget.isBlockedCurrently ? <UserCheck size={20} /> : <Ban size={20} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-base">
                    {blockTarget.isBlockedCurrently ? 'Unblock Applicant Account' : 'Block Applicant Account'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{blockTarget.code}</p>
                </div>
              </div>
              <button
                onClick={() => setBlockTarget(null)}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {blockTarget.isBlockedCurrently ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 leading-relaxed">
                  <p className="font-bold mb-1">Restore Account Access</p>
                  <p>
                    Are you sure you want to unblock <strong className="text-emerald-950">{blockTarget.name}</strong>?
                    They will immediately be allowed to sign in to their applicant account again.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 leading-relaxed">
                    <p className="font-bold mb-1">Immediate Access Revocation</p>
                    <p>
                      Blocking <strong className="text-rose-950">{blockTarget.name}</strong> will immediately terminate
                      their active sessions and prevent any further logins until unblocked by an agency manager.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                      Reason for Account Suspension / Block
                    </label>
                    <input
                      type="text"
                      value={blockReasonInput}
                      onChange={(e) => setBlockReasonInput(e.target.value)}
                      placeholder="e.g., Falsified documentation, Withdrawn, Disciplinary flag..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[
                        'Falsified documentation',
                        'Withdrew application',
                        'Unresponsive to agency',
                        'Disciplinary suspension',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBlockReasonInput(preset)}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockTarget(null)}
                  disabled={isBlockSubmitting}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlock}
                  disabled={isBlockSubmitting}
                  className={`flex-1 py-2.5 px-4 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    blockTarget.isBlockedCurrently
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {isBlockSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : blockTarget.isBlockedCurrently ? (
                    <>
                      <UserCheck size={14} />
                      <span>Unblock Account</span>
                    </>
                  ) : (
                    <>
                      <Ban size={14} />
                      <span>Block Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CREDENTIALS RESULT OVERLAY (REPLACES BROWSER ALERT) */}
      {credentialsResult && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-base">{credentialsResult.title}</h3>
                  <p className="text-xs text-slate-500">{credentialsResult.portalName}</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedCredentialsResult(null)}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Recipient Name:</span>
                  <span className="font-bold text-slate-900">{credentialsResult.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Registered Email:</span>
                  <span className="font-bold text-slate-900">{credentialsResult.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Username / Code:</span>
                  <span className="font-mono font-bold text-[#0EA5E9] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    {credentialsResult.username}
                  </span>
                </div>

                {credentialsResult.password && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Login Password</p>
                        <p className="text-base font-mono font-black text-slate-900 tracking-wider mt-0.5">
                          {credentialsResult.password}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (credentialsResult.password) {
                            navigator.clipboard.writeText(credentialsResult.password);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 shadow-sm cursor-pointer"
                      >
                        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {credentialsResult.emailDispatched ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    Credentials email successfully delivered to <strong>{credentialsResult.email}</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Credentials account is active. You can copy the credentials above to send manually if needed.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setCreatedCredentialsResult(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md mx-4 border border-slate-100">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Add New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="john.doe@flowsensus.com"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Department
                </label>
                <input
                  type="text"
                  value={newStaff.department}
                  onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., Documentation Department, Recruitment..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Roles <span className="text-slate-400 font-normal lowercase">(select one or more)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map((r) => {
                    const isChecked = (newStaff.roles || []).includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          const current = newStaff.roles || [newStaff.role];
                          let next: UserRole[];
                          if (current.includes(r.id)) {
                            next = current.filter((x) => x !== r.id);
                            if (next.length === 0) next = [r.id];
                          } else {
                            next = [...current, r.id];
                          }
                          setNewStaff({ ...newStaff, roles: next, role: next[0] });
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                          isChecked
                            ? r.activeColor + ' shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{r.label}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              isChecked ? 'bg-[#0EA5E9] text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#475569] uppercase tracking-wide flex items-center gap-1.5">
                    <Key size={13} className="text-[#0EA5E9]" /> Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewStaff((s) => ({ ...s, password: generateTempPassword() }))}
                    className="text-[11px] font-bold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={11} /> Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full border border-slate-200 pl-3 pr-10 py-2 rounded-lg text-sm font-mono focus:border-[#0EA5E9] outline-none"
                    placeholder="Enter or generate temporary password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddStaff}
                  disabled={!newStaff.name || !newStaff.email || isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating Staff...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ────────────────────────────────────────────────── */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md mx-4 border border-slate-100">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Edit Staff Role</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Staff Member
                </label>
                <input
                  type="text"
                  value={selectedStaff.name}
                  readOnly
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm bg-slate-50 font-bold text-[#0F172A]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Department
                </label>
                <input
                  type="text"
                  value={selectedStaff.department}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, department: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., Documentation Department"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Roles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map((r) => {
                    const isChecked = (editRoles || []).includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          const current = editRoles || [selectedStaff.role];
                          let next: UserRole[];
                          if (current.includes(r.id)) {
                            next = current.filter((x) => x !== r.id);
                            if (next.length === 0) next = [r.id];
                          } else {
                            next = [...current, r.id];
                          }
                          setEditRoles(next);
                          setSelectedStaff({ ...selectedStaff, roles: next, role: next[0] });
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                          isChecked
                            ? r.activeColor + ' shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{r.label}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              isChecked ? 'bg-[#0EA5E9] text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditStaff}
                  disabled={isEditing}
                  className="flex-1 px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isEditing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Staff Modal ──────────────────────────────────────────────── */}
      {showDeleteModal && selectedStaff && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md mx-4 border border-slate-100">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Delete Staff Account</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-sm mb-1 text-rose-900">
                  <AlertTriangle size={15} /> Warning: Irreversible Action
                </p>
                <p>
                  You are about to permanently delete the staff account for <strong>{selectedStaff.name}</strong>. All
                  associated permissions and access will be revoked immediately.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedStaff(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStaff}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-xs font-bold shadow-lg shadow-[#EF4444]/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Account</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
