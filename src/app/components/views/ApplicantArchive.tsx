import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArchiveRestore, Search, RotateCcw, Trash2, OctagonX,
  X, Info, ShieldCheck, Clock, User, Briefcase, Phone, Mail,
  CheckCircle2, RefreshCw, AlertTriangle, Eye, ArrowLeft
} from 'lucide-react';
import { Skeleton, SkeletonAvatar } from '../ui/skeleton';
import { ApplicantRecord, ActivityLog, UserRole, ViewType } from '../../types';
import { api } from '../../../lib/api';
import { mapApplicantFromApi } from '../../../lib/applicantMapper';
import ApplicantProfile from './ApplicantProfile';

interface ApplicantArchiveProps {
  showToast: (msg: string) => void;
  currentUserName: string;
  currentUserRole?: UserRole | string;
  currentUserRoles?: (UserRole | string)[];
  onNavigate?: (view: ViewType, applicantId?: string) => void;
  applicants?: ApplicantRecord[];
  updateApplicant?: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  addApplicant?: (newApplicant: ApplicantRecord) => void;
  addActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}


export default function ApplicantArchive({
  showToast,
  currentUserName,
  currentUserRole,
  currentUserRoles = [],
  onNavigate,
  applicants = [],
  updateApplicant,
  addApplicant,
  addActivityLog,
}: ApplicantArchiveProps) {
  const [archivedRecords, setArchivedRecords] = useState<ApplicantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Restore Modal State
  const [applicantToRestore, setApplicantToRestore] = useState<ApplicantRecord | null>(null);
  const [restorePhase, setRestorePhase] = useState<number>(1);
  const [restoreNotes, setRestoreNotes] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Permanent Delete Modal State
  const [applicantToDelete, setApplicantToDelete] = useState<ApplicantRecord | null>(null);
  const [permanentDeleteConfirmed, setPermanentDeleteConfirmed] = useState(false);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<ApplicantRecord | null>(null);
  const [viewingProfile, setViewingProfile] = useState<ApplicantRecord | null>(null);

  // Fetch deleted applicants from the backend
  const fetchArchived = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/applicants/archived');
      if (res.data && Array.isArray(res.data)) {
        setArchivedRecords(res.data.map(mapApplicantFromApi));
      } else {
        setArchivedRecords([]);
      }
    } catch (err) {
      console.warn('Could not fetch archived applicants from backend:', err);
      setArchivedRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  // The archive only holds deleted records. Stopped applicants stay in the active lists.
  const allArchivePool = useMemo(
    () => archivedRecords.filter((r) => r.archiveType === 'deleted' || Boolean(r.deletedAt)),
    [archivedRecords]
  );

  const counts = useMemo(() => ({ total: allArchivePool.length }), [allArchivePool]);

  // Search logic
  const filteredRecords = useMemo(() => {
    return allArchivePool.filter((rec) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (rec.name || '').toLowerCase().includes(q) ||
          (rec.applicantCode || '').toLowerCase().includes(q) ||
          (rec.role || rec.appliedRole || '').toLowerCase().includes(q) ||
          (rec.email || '').toLowerCase().includes(q) ||
          (rec.deletedByEmail || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allArchivePool, search]);

  // Restore Action
  const openRestoreModal = (rec: ApplicantRecord) => {
    setApplicantToRestore(rec);
    const targetPhase = rec.stoppedPhase && rec.stoppedPhase > 0 ? rec.stoppedPhase : (rec.phase && rec.phase > 0 ? rec.phase : 1);
    setRestorePhase(targetPhase);
    setRestoreNotes('');
  };

  const handleConfirmRestore = async () => {
    if (!applicantToRestore) return;
    setIsRestoring(true);

    const appCode = applicantToRestore.applicantCode || applicantToRestore.id;
    const applicantName = applicantToRestore.name;
    const isDeletedType = applicantToRestore.archiveType === 'deleted' || Boolean(applicantToRestore.deletedAt);

    try {
      const res = await api.post(`/applicants/${applicantToRestore.id}/restore`, {
        targetPhase: restorePhase,
        notes: restoreNotes.trim() || undefined,
      });

      const restoredBackendData = res.data?.applicant;
      const restoredMapped: ApplicantRecord = restoredBackendData
        ? mapApplicantFromApi(restoredBackendData)
        : {
            ...applicantToRestore,
            phase: restorePhase,
            status: restorePhase === 1 ? 'Registered' : 'Active',
            isStopped: false,
            stoppedReason: undefined,
            stoppedBy: undefined,
            stoppedAt: undefined,
            stoppedPhase: undefined,
            deletedAt: undefined,
            deletedBy: undefined,
            archiveType: undefined,
            lastUpdated: new Date().toISOString(),
          };

      if (isDeletedType) {
        if (addApplicant) {
          addApplicant(restoredMapped);
        } else if (updateApplicant) {
          updateApplicant(applicantToRestore.id, restoredMapped);
        }
      } else {
        if (updateApplicant) {
          updateApplicant(applicantToRestore.id, {
            phase: restorePhase,
            status: restorePhase === 1 ? 'Registered' : 'Active',
            isStopped: false,
            stoppedReason: undefined,
            stoppedBy: undefined,
            stoppedAt: undefined,
            stoppedPhase: undefined,
            deletedAt: undefined,
            deletedBy: undefined,
            archiveType: undefined,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      setArchivedRecords((prev) => prev.filter((r) => r.id !== applicantToRestore.id));

      addActivityLog?.({
        applicantId: applicantToRestore.id,
        action: 'RESTORE_APPLICANT',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Restored ${appCode} (${applicantName}) to Phase ${restorePhase} from archive.${
          restoreNotes.trim() ? ` Reason: ${restoreNotes.trim()}` : ''
        }`,
      });

      showToast(`Applicant "${applicantName}" restored to active processing.`);
      setApplicantToRestore(null);
      if (selectedRecord?.id === applicantToRestore.id) {
        setSelectedRecord(null);
      }
    } catch (err) {
      console.warn('Backend restore fallback:', err);
      const restoredLocal: ApplicantRecord = {
        ...applicantToRestore,
        phase: restorePhase,
        status: restorePhase === 1 ? 'Registered' : 'Active',
        isStopped: false,
        stoppedReason: undefined,
        stoppedBy: undefined,
        stoppedAt: undefined,
        stoppedPhase: undefined,
        deletedAt: undefined,
        deletedBy: undefined,
        archiveType: undefined,
        lastUpdated: new Date().toISOString(),
      };

      if (isDeletedType && addApplicant) {
        addApplicant(restoredLocal);
      } else if (updateApplicant) {
        updateApplicant(applicantToRestore.id, restoredLocal);
      }

      setArchivedRecords((prev) => prev.filter((r) => r.id !== applicantToRestore.id));
      showToast(`Applicant "${applicantName}" returned to active pipeline.`);
      setApplicantToRestore(null);
      if (selectedRecord?.id === applicantToRestore.id) {
        setSelectedRecord(null);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Permanent Delete Action
  const openPermanentDeleteModal = (rec: ApplicantRecord) => {
    setApplicantToDelete(rec);
    setPermanentDeleteConfirmed(false);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!applicantToDelete) return;
    setIsPermanentDeleting(true);

    const appCode = applicantToDelete.applicantCode || applicantToDelete.id;
    const applicantName = applicantToDelete.name;

    try {
      await api.delete(`/applicants/${applicantToDelete.id}/permanent`);

      setArchivedRecords((prev) => prev.filter((r) => r.id !== applicantToDelete.id));

      addActivityLog?.({
        applicantId: applicantToDelete.id,
        action: 'PERMANENT_DELETE_APPLICANT',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Permanently removed applicant record ${appCode} (${applicantName}) from system.`,
      });

      showToast(`Applicant "${applicantName}" has been permanently deleted.`);
      setApplicantToDelete(null);
      setPermanentDeleteConfirmed(false);
      if (selectedRecord?.id === applicantToDelete.id) {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      console.warn('Backend permanent delete fallback:', err);
      // Fallback local removal
      setArchivedRecords((prev) => prev.filter((r) => r.id !== applicantToDelete.id));
      showToast(`Applicant "${applicantName}" record removed.`);
      setApplicantToDelete(null);
      setPermanentDeleteConfirmed(false);
      if (selectedRecord?.id === applicantToDelete.id) {
        setSelectedRecord(null);
      }
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  if (viewingProfile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-2xs px-3 py-2">
          <button
            type="button"
            onClick={() => setViewingProfile(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#0284C7] rounded-lg border border-slate-200 hover:border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to Archive</span>
          </button>
          <span className="text-xs font-semibold text-slate-700">{viewingProfile.name}</span>
          <span className="font-mono text-[11px] text-slate-400">
            {viewingProfile.applicantCode || `APP-${viewingProfile.id}`}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            Deleted
          </span>
        </div>
        <ApplicantProfile
          applicant={viewingProfile}
          isArchived
          onBack={() => setViewingProfile(null)}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
          currentUserRoles={currentUserRoles}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Clean Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Applicant Archive</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
              {counts.total} records
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Browse deleted applicant records. Restore an applicant back to active processing when needed.
          </p>
        </div>
      </div>

      {/* ── Minimal Search & Segmented Filter Bar ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived applicants..."
            className="w-full pl-8.5 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] bg-slate-50/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X size={13} />
            </button>
          )}
        </div>

      </div>

      {/* ── Table of Archived Records ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-none">
                <SkeletonAvatar className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56 bg-slate-100" />
                </div>
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <ArchiveRestore size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No archived applicants found</p>
            <p className="mt-0.5 text-slate-400">
              {search ? 'Try adjusting your search.' : 'No deleted applicant records yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/90 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 text-left font-semibold w-[30%]">Applicant</th>
                  <th className="py-3 px-4 text-center font-semibold w-[24%]">Archive Reason</th>
                  <th className="py-3 px-4 text-center font-semibold w-[26%]">Deleted By</th>
                  <th className="py-3 px-4 text-center font-semibold w-[12%]">Archived Date</th>
                  <th className="py-3 px-4 text-center font-semibold w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const isDeleted = rec.archiveType === 'deleted' || Boolean(rec.deletedAt);
                  const stoppedPhase = rec.stoppedPhase || rec.phase || 1;
                  const archiveDate = rec.deletedAt || rec.stoppedAt || rec.lastUpdated;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedRecord(rec)}
                    >
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0 text-xs">
                            {(rec.firstName?.[0] || rec.name?.[0] || 'A').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#0F172A] hover:text-[#0EA5E9] transition-colors">
                              {rec.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {rec.applicantCode || `APP-${rec.id}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reason & Category */}
                      <td className="py-3.5 px-4">
                        {isDeleted ? (
                          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600">
                            <Trash2 size={12} className="text-red-500 shrink-0" />
                            <span>Deleted from active records</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <OctagonX size={10} /> Stopped at Phase {stoppedPhase}
                            </span>
                            <p className="text-[11px] text-slate-500 truncate max-w-xs">
                              {rec.stoppedReason || 'Processing stopped'}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Staff Email Who Deleted It */}
                      <td className="py-3.5 px-4">
                        {rec.deletedByEmail ? (
                          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-600 font-mono">
                            <Mail size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[220px]" title={rec.deletedByEmail}>
                              {rec.deletedByEmail}
                            </span>
                          </div>
                        ) : rec.deletedByName ? (
                          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-600">
                            <User size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[220px]">{rec.deletedByName}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-center text-slate-500 whitespace-nowrap">
                        {archiveDate
                          ? new Date(archiveDate).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions: Restore & Permanent Delete */}
                      <td
                        className="py-3.5 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingProfile(rec)}
                            title="View applicant profile"
                            aria-label="View applicant profile"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-[#0284C7] hover:bg-sky-50 border border-slate-200 hover:border-sky-200 transition-all cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openRestoreModal(rec)}
                            title="Restore to active records"
                            aria-label="Restore to active records"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 hover:bg-[#0EA5E9] text-[#0284C7] hover:text-white border border-sky-200 hover:border-transparent transition-all cursor-pointer"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPermanentDeleteModal(rec)}
                            title="Permanently delete this record"
                            aria-label="Permanently delete this record"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Minimal Restore Confirmation Modal ────────────────────────────── */}
      {applicantToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-[#0EA5E9]" />
                <h3 className="font-bold text-[#0F172A] text-sm">Restore Applicant</h3>
              </div>
              <button
                type="button"
                onClick={() => setApplicantToRestore(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Are you sure you want to reinstate <strong className="text-slate-900">{applicantToRestore.name}</strong> ({applicantToRestore.applicantCode || `APP-${applicantToRestore.id}`}) back to active applicant processing?
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Target Phase
                </label>
                <select
                  value={restorePhase}
                  onChange={(e) => setRestorePhase(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                >
                  <option value={applicantToRestore.stoppedPhase || applicantToRestore.phase || 1}>
                    Previous Phase (Phase {applicantToRestore.stoppedPhase || applicantToRestore.phase || 1})
                  </option>
                  <option value={1}>Phase 1: Registration & Screening</option>
                  <option value={2}>Phase 2: Medical Clearance</option>
                  <option value={3}>Phase 3: CV Encoding</option>
                  <option value={4}>Phase 4: Employer Endorsement</option>
                  <option value={5}>Phase 5: Deployment Processing</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Optional Reason Note
                </label>
                <input
                  type="text"
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  placeholder="e.g. Returned with required documents"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplicantToRestore(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="inline-flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs disabled:opacity-60"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={12} />
                    <span>Confirm Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Candidate Preview Modal ───────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#0F172A] text-sm">{selectedRecord.name}</h3>
                <span className="font-mono text-[11px] text-slate-400">
                  {selectedRecord.applicantCode || `APP-${selectedRecord.id}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
                <div className="font-semibold text-slate-700">
                  {selectedRecord.archiveType === 'deleted' || selectedRecord.deletedAt
                    ? 'Deleted from Active Records'
                    : `Processing Stopped at Phase ${selectedRecord.stoppedPhase || selectedRecord.phase || 1}`}
                </div>
                {selectedRecord.deletedByEmail && (
                  <p className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                    <Mail size={11} className="text-slate-400 shrink-0" />
                    <span>Deleted by: {selectedRecord.deletedByEmail}</span>
                  </p>
                )}
                {selectedRecord.stoppedReason && (
                  <p className="text-slate-500 italic">"{selectedRecord.stoppedReason}"</p>
                )}
                {selectedRecord.stoppedBy && (
                  <p className="text-[11px] text-slate-400">Halted by {selectedRecord.stoppedBy}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Applied Role:</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.role || selectedRecord.appliedRole || 'Applicant'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Job Order:</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.jobOrder || 'None Assigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Contact:</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.contact || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email:</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.email || '—'}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    openPermanentDeleteModal(rec);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Delete Record</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    openRestoreModal(rec);
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Restore Applicant</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Delete Confirmation Modal ────────────────────────────── */}
      {applicantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-sm">Delete Record Permanently</h3>
                  <p className="text-[11px] text-slate-500">This action cannot be undone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApplicantToDelete(null);
                  setPermanentDeleteConfirmed(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2 text-red-900">
                <p className="font-bold text-sm">
                  Permanently delete {applicantToDelete.name}?
                </p>
                <p className="text-red-700 leading-relaxed">
                  This will completely erase this applicant ({applicantToDelete.applicantCode || `APP-${applicantToDelete.id}`}) and all related records from the database. <strong>Once deleted, this applicant cannot be returned or restored.</strong>
                </p>
              </div>

              {/* Accidental Click Safeguard Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permanentDeleteConfirmed}
                  onChange={(e) => setPermanentDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <span className="text-slate-700 font-medium leading-relaxed">
                  I understand that this applicant will be permanently removed and cannot be recovered.
                </span>
              </label>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setApplicantToDelete(null);
                  setPermanentDeleteConfirmed(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Keep Record
              </button>
              <button
                type="button"
                disabled={isPermanentDeleting || !permanentDeleteConfirmed}
                onClick={handleConfirmPermanentDelete}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {isPermanentDeleting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Deleting Record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}