import { useState, useEffect } from 'react';
import { Target, CheckCircle, AlertCircle, TrendingUp, Lock, ShieldCheck, ShieldAlert, Sparkles, Loader2, Clock } from 'lucide-react';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../types';
import { api } from '../../../lib/api';
import { parseMatchingResult, ParsedMatchingResult } from '../../../lib/matchingUtils';

interface SmartProfilingProps {
  showToast: (message: string) => void;
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  selectedApplicantId?: string;
  onSelectApplicant?: (applicantId: string) => void;
  workflow?: WorkflowState;
  globalJobOrders?: any[];
}

export default function SmartProfiling({
  showToast,
  applicants = [],
  currentUserName,
  addActivityLog,
  selectedApplicantId = '1',
  onSelectApplicant,
  workflow,
  globalJobOrders,
}: SmartProfilingProps) {
  const [activeApplicantId, setActiveApplicantId] = useState<string>(selectedApplicantId || '');
  const [selectedJobOrder, setSelectedJobOrder] = useState('');
  const [jobOrders, setJobOrders] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);

  const [matchingEval, setMatchingEval] = useState<any | null>(null);
  const [parsedMatching, setParsedMatching] = useState<ParsedMatchingResult | null>(null);
  const [matchingError, setMatchingError] = useState<{ status: number; message: string } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Sync activeApplicantId when selectedApplicantId prop changes
  useEffect(() => {
    if (selectedApplicantId) {
      setActiveApplicantId(selectedApplicantId);
      setMatchingEval(null);
    }
  }, [selectedApplicantId]);

  // Fetch live job orders from backend
  useEffect(() => {
    const fetchLiveJobOrders = async () => {
      setIsLoadingJobs(true);
      try {
        const res = globalJobOrders ? { data: globalJobOrders } : await api.get('/job-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveOrders = res.data.map((jo: any) => ({
            id: jo.job_order_code || jo.job_code || (jo.job_order_id ? `JO-2026-${String(jo.job_order_id).padStart(4, '0')}` : `JO-${jo.job_order_id}`),
            position: jo.position_title || jo.position || 'General Position',
            country: jo.client_employer?.country?.country_name || jo.country || 'International',
            employer: jo.client_employer?.company_name || jo.employer_name || 'Partner Principal',
            employerId: jo.employer_id,
            minExperience: jo.min_experience_years || 1,
            keyDuties: Array.isArray(jo.required_skills) && jo.required_skills.length > 0
              ? jo.required_skills
              : ['Standard duties', 'Trade operations'],
            certifications: Array.isArray(jo.required_certifications) ? jo.required_certifications : [],
            languageRequirements: ['English (conversational)'],
          }));
          setJobOrders(liveOrders);
        }
      } catch (err) {
        console.warn('Could not fetch live job orders for smart profiling, using defaults:', err);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchLiveJobOrders();
  }, [globalJobOrders]);

  const isLocked = !workflow?.screeningPassed;

  // Filter candidates based on preconditions
  const profilingCandidates = applicants.filter(a => a.status === 'Applicant Profiling' || a.status === 'CV Encoding');
  
  // A2 - Incomplete Applicant Assessment Records
  // Using backend-provided hasCompleteAssessments flag mapped from real examination records
  const incompleteCandidates = profilingCandidates.filter(a => a.hasCompleteAssessments === false);
  const eligibleCandidates = profilingCandidates.filter(a => a.hasCompleteAssessments !== false);

  // Find selected applicant safely among all applicants to prevent crash if an invalid ID is passed
  const applicant = applicants.find((a) => String(a.id) === String(activeApplicantId)) || applicants[0];

  // Robust readiness detection engine
  const calculateReadiness = (jobOrder: any) => {
    if (!applicant || !jobOrder) return { score: 0, strengths: [], gaps: [] };

    const strengths: string[] = [];
    const gaps: string[] = [];
    let score = 0;

    const jobPosition = (jobOrder.position || '').toLowerCase();
    const positionKeywords = jobPosition
      .split(/[\s,/]+/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 2);

    const applicantRole = (applicant.role || applicant.appliedPosition || applicant.appliedRole || '').toLowerCase();

    // Normalized experiences (supporting both workExperience and employmentHistory)
    const experiences = (Array.isArray(applicant.workExperience) && applicant.workExperience.length > 0
      ? applicant.workExperience
      : Array.isArray(applicant.employmentHistory)
      ? applicant.employmentHistory.map((eh: any) => ({
          companyName: eh.company || eh.companyName || '',
          position: eh.position || '',
          startDate: eh.fromYear || eh.startDate || '',
          endDate: eh.toYear || eh.endDate || '',
          responsibilities: Array.isArray(eh.responsibilities) ? eh.responsibilities : [],
          country: eh.country || '',
          isOverseas: Boolean(eh.country && eh.country.toLowerCase() !== 'philippines'),
        }))
      : []) as any[];

    // A. Job Order Keyword Match (25 points)
    const hasDirectMatch =
      jobPosition &&
      (applicantRole.includes(jobPosition) ||
        jobPosition.includes(applicantRole) ||
        (positionKeywords.length > 0 && positionKeywords.some((keyword: string) => applicantRole.includes(keyword))));

    if (hasDirectMatch) {
      score += 25;
      strengths.push(`Job title directly matches: ${applicant.role || jobOrder.position}`);
    } else if (experiences.length > 0) {
      const hasExperienceMatch = experiences.some((exp: any) => {
        const expPos = (exp.position || '').toLowerCase();
        return positionKeywords.some((keyword: string) => expPos.includes(keyword));
      });
      if (hasExperienceMatch) {
        score += 20;
        strengths.push('Previous role matches job order requirements');
      } else {
        gaps.push('No direct job title match found');
      }
    } else {
      gaps.push('No work experience or job title match');
    }

    // B. Duties & Task Relevance (20 points)
    const keyDuties: string[] = Array.isArray(jobOrder.keyDuties) && jobOrder.keyDuties.length > 0
      ? jobOrder.keyDuties
      : ['General tasks', 'Operational duties'];

    let dutyMatches = 0;
    if (experiences.length > 0) {
      keyDuties.forEach((duty: string) => {
        const dutyKeyword = (duty || '').toLowerCase().split('/')[0].trim();
        if (!dutyKeyword) return;
        const hasMatch = experiences.some((exp: any) => {
          const expPos = (exp.position || '').toLowerCase();
          const resps = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
          return expPos.includes(dutyKeyword) || resps.some((r: string) => (r || '').toLowerCase().includes(dutyKeyword));
        });
        if (hasMatch) dutyMatches++;
      });
      const dutyScore = (dutyMatches / Math.max(1, keyDuties.length)) * 20;
      score += dutyScore;
      if (dutyScore >= 10) {
        strengths.push(`${dutyMatches}/${keyDuties.length} key duties match work experience`);
      } else {
        gaps.push('Limited task relevance to job requirements');
      }
    } else {
      gaps.push('No work experience to validate duties');
    }

    // C. Work Experience Duration (15 points)
    if (experiences.length > 0) {
      const totalYears = experiences.reduce((sum: number, exp: any) => {
        const startStr = String(exp.startDate || '').trim();
        const endStr = String(exp.endDate || '').trim();
        const start = parseInt(startStr.slice(0, 4), 10);
        const end = !endStr || endStr.toLowerCase() === 'present'
          ? new Date().getFullYear()
          : parseInt(endStr.slice(0, 4), 10);
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          return sum + (end - start);
        }
        return sum + 1;
      }, 0);

      const minExp = Number(jobOrder.minExperience ?? 1);
      if (totalYears >= minExp + 2) {
        score += 15;
        strengths.push(`${totalYears} years of experience exceeds ${minExp} year requirement`);
      } else if (totalYears >= minExp) {
        score += 10;
        strengths.push(`Meets minimum ${minExp} year experience requirement`);
      } else {
        gaps.push(`Insufficient experience: ${totalYears} years (needs ${minExp})`);
      }
    } else {
      gaps.push('No work experience duration available');
    }

    // D. Country/Overseas Experience (20 points)
    if (experiences.length > 0) {
      const targetCountry = (jobOrder.country || '').toLowerCase();
      const hasOverseasExp = experiences.some((exp: any) => exp.isOverseas || (exp.country && exp.country.toLowerCase() !== 'philippines'));
      const hasSameCountryExp = targetCountry && experiences.some((exp: any) => (exp.country || '').toLowerCase().includes(targetCountry) || targetCountry.includes((exp.country || '').toLowerCase()));

      if (hasSameCountryExp) {
        score += 20;
        strengths.push(`Previous ${jobOrder.country} experience (high value)`);
      } else if (hasOverseasExp) {
        score += 15;
        const countries = experiences.filter((e: any) => (e.isOverseas || e.country) && e.country).map((e: any) => e.country).join(', ');
        strengths.push(`Has overseas experience: ${countries || 'International'}`);
      } else {
        gaps.push('No overseas work experience');
      }
    } else {
      gaps.push('No overseas experience');
    }

    // E. Skills & Special Abilities (10 points)
    const skillsList = Array.isArray(applicant.skills) ? applicant.skills : [];
    if (skillsList.length > 0 && keyDuties.length > 0) {
      const skillMatches = keyDuties.filter((duty: string) => {
        const d = (duty || '').toLowerCase();
        return skillsList.some((skill: string) => {
          const s = (skill || '').toLowerCase();
          return s && (d.includes(s) || s.includes(d));
        });
      });
      const skillScore = (skillMatches.length / Math.max(1, keyDuties.length)) * 10;
      score += skillScore;
      if (skillScore >= 5) {
        strengths.push(`${skillsList.length} relevant skills documented`);
      }
    } else if (skillsList.length > 0) {
      score += 5;
      strengths.push(`${skillsList.length} skills documented`);
    } else {
      gaps.push('No skills documented');
    }

    // F. Certifications & Training (15 points)
    const certsList = Array.isArray(applicant.certifications) ? applicant.certifications : [];
    const reqCerts = Array.isArray(jobOrder.certifications) && jobOrder.certifications.length > 0
      ? jobOrder.certifications
      : [];

    if (reqCerts.length > 0) {
      const certMatches = reqCerts.filter((cert: string) => {
        const cLower = (cert || '').toLowerCase();
        return certsList.some((c: string) => {
          const cName = (c || '').toLowerCase();
          return cName && (cName.includes(cLower) || cLower.includes(cName));
        });
      });
      const certScore = (certMatches.length / Math.max(1, reqCerts.length)) * 15;
      score += certScore;
      if (certScore >= 8) {
        strengths.push(`${certMatches.length}/${reqCerts.length} required certifications held`);
      } else {
        gaps.push('Missing key certifications');
      }
    } else if (certsList.length > 0) {
      score += 15;
      strengths.push(`${certsList.length} certifications held`);
    }

    // G. Language Skills (5 points)
    const languages = Array.isArray(applicant.languagesSpoken) && applicant.languagesSpoken.length > 0
      ? applicant.languagesSpoken
      : ['English'];
    const reqLangs = Array.isArray(jobOrder.languageRequirements) && jobOrder.languageRequirements.length > 0
      ? jobOrder.languageRequirements
      : ['English'];

    const langMatches = reqLangs.filter((lang: string) => {
      const lLower = (lang || '').toLowerCase();
      return languages.some((l: string) => {
        const lName = (l || '').toLowerCase();
        return lName && (lLower.includes(lName) || lName.includes(lLower));
      });
    });
    const langScore = (langMatches.length / Math.max(1, reqLangs.length)) * 5;
    score += langScore;
    if (langScore >= 3) {
      strengths.push('Language requirements met');
    } else {
      gaps.push('Language skills may not meet requirements');
    }

    const safeScore = isNaN(score) ? 0 : Math.min(100, Math.max(0, Math.round(score)));

    return {
      score: safeScore,
      strengths,
      gaps,
    };
  };


  const handleEvaluateMatching = async (jobOrder: any) => {
    if (!applicant) return;
    setIsEvaluating(true);
    try {
      const numericApplicantId = parseInt(String(applicant.id), 10) || 1;
      const payload = {
        applicant_id: numericApplicantId,
        job_order_id: jobOrder.id,
        medical_status: 'Fit to Work',
        criteria: {
          job_title: jobOrder.position,
          employer_name: jobOrder.employer,
          min_iq: 50,
          min_skills: 70,
          min_interview: 60,
          min_eq: 70,
          required_medical_validity_days: 90,
          required_passport_validity_days: 60,
          required_clearance_validity_days: 30,
        },
        documents: {
          medical_expiry: '2027-01-15',
          passport_expiry: '2027-06-30',
          clearance_expiry: '2026-12-15',
        },
      };

      const res = await api.post('/matching/evaluate', payload);
      setMatchingEval(res.data);
      const parsed = parseMatchingResult(res.data);
      setParsedMatching(parsed);

      if (parsed.overallStatus === 'qualified') {
        showToast(`✓ Rule Check Passed: Applicant is Recommended. CV unlocked for Manager Approval.`);
      } else if (parsed.overallStatus === 'system-pending') {
        showToast(`ℹ Screening In Progress: Pending authoritative data checks.`);
      } else {
        showToast(`⚠ Pre-qualification Blocked: ${parsed.realFailedChecks.length} criteria blocked.`);
      }
    } catch (err: any) {
      console.error('Matching evaluation error:', err);
      const status = err.response?.status || 500;
      let msg = err.response?.data?.detail || 'Failed to evaluate matching criteria.';
      if (status === 503) msg = 'Matching service temporarily unavailable';
      if (status === 404) msg = 'Applicant record not found';
      setMatchingError({ status, message: msg });
      showToast(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEndorse = (jobOrderName: string) => {
    if (!applicant) return;

    if (matchingEval && !matchingEval.cv_unlocked) {
      showToast('⚠️ CV is locked by Rule-Based Classifier. Resolve blocking criteria before endorsing.');
      return;
    }

    addActivityLog({
      applicantId: applicant.id,
      action: 'Applicant Endorsed to Job Order',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `Applicant endorsed to: ${jobOrderName}. Evaluation status: ${matchingEval?.status || 'Direct Endorsement'}. CV Unlocked: ${matchingEval?.cv_unlocked ? 'Yes' : 'Pending'}`,
    });

    showToast(`✓ Applicant endorsed to ${jobOrderName}`);
  };

  if (!applicant) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-[#64748B] font-medium">No applicant selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          <Target className="w-8 h-8 inline-block mr-2 text-[#F59E0B]" />
          Applicant Profiling & Job Matching
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Readiness detection engine that evaluates applicant qualifications for job orders
        </p>
      </div>

      {/* Applicant Profile Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 relative">
        {isLocked && (
          <div className="absolute inset-0 bg-[#F1F5F9]/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
            <Lock className="w-10 h-10 text-slate-400 mb-3" />
            <h3 className="font-black text-[#0F172A] text-lg mb-2">Screening Required</h3>
            <p className="text-sm text-[#64748B] text-center max-w-md">
              Complete the exam screening process first to unlock profiling
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-black text-[#0F172A] text-lg">{applicant?.name || 'No Applicant Selected'}</h3>
            {applicant && <p className="text-sm text-[#64748B]">{applicant.applicantCode || applicant.id} | {applicant.role}</p>}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {incompleteCandidates.length > 0 && (
              <div className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {incompleteCandidates.length} candidate(s) excluded due to incomplete assessment data
              </div>
            )}
            
            {eligibleCandidates.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#64748B] uppercase">Evaluate Candidate:</span>
                <select
                  value={applicant?.id || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setActiveApplicantId(newId);
                    if (onSelectApplicant) onSelectApplicant(newId);
                    setMatchingEval(null);
                    setParsedMatching(null);
                    setMatchingError(null);
                  }}
                  className="border-2 border-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#0F172A] bg-white focus:border-[#F59E0B] outline-none"
                >
                  {eligibleCandidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-600 uppercase">A1: No Qualified Candidates Found</span>
              </div>
            )}
          </div>
        </div>

        {eligibleCandidates.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-[#0F172A] font-bold mb-1">No qualified candidates found for this job order.</h3>
            <p className="text-[#64748B] text-sm">Review alternative applicants or wait for additional applicants to pass medical clearance.</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Work Experience</p>
            <p className="text-sm text-[#0F172A] font-medium">
              {(applicant.workExperience?.length || applicant.employmentHistory?.length || 0)} Jobs
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Skills</p>
            <p className="text-sm text-[#0F172A] font-medium">
              {applicant.skills?.length || 0} Documented
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Certifications</p>
            <p className="text-sm text-[#0F172A] font-medium">
              {applicant.certifications?.length || 0} Held
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Overseas Exp.</p>
            <p className="text-sm text-[#0F172A] font-medium">
              {(applicant.workExperience?.filter(e => e.isOverseas).length || applicant.employmentHistory?.filter(e => e.country && e.country.toLowerCase() !== 'philippines').length || 0)} Records
            </p>
          </div>
        </div>
        )}
      </div>

      {/* Job Order Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-[#0F172A] mb-4">Select Job Order to Evaluate Readiness</h3>
        <select
          value={selectedJobOrder}
          onChange={(e) => setSelectedJobOrder(e.target.value)}
          disabled={isLocked}
          className="w-full border-2 border-slate-200 px-4 py-3 rounded-lg text-sm focus:border-[#F59E0B] outline-none font-medium disabled:opacity-50"
        >
          <option value="">{isLoadingJobs ? 'Loading job orders...' : '-- Select Job Order --'}</option>
          {jobOrders.map((jo) => (
            <option key={jo.id} value={jo.id}>
              {jo.id} - {jo.position} ({jo.country}) - {jo.employer}
            </option>
          ))}
        </select>
      </div>

      {/* Readiness Results */}
      {selectedJobOrder && !isLocked && (
        <div className="space-y-4">
          {jobOrders
            .filter((jo) => jo.id === selectedJobOrder)
            .map((jobOrder) => {
              const readiness = calculateReadiness(jobOrder);
              const isStrongMatch = readiness.score >= 70;
              const isModerateMatch = readiness.score >= 50 && readiness.score < 70;

              return (
                <div key={jobOrder.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  {/* Readiness Score Banner */}
                  <div
                    className={`rounded-lg p-6 mb-6 ${
                      isStrongMatch
                        ? 'bg-[#10B981]/10 border border-[#10B981]/30'
                        : isModerateMatch
                        ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="text-xs font-bold uppercase tracking-wider mb-1"
                          style={{
                            color: isStrongMatch ? '#10B981' : isModerateMatch ? '#F59E0B' : '#EF4444',
                          }}
                        >
                          Readiness Score
                        </p>
                        <p
                          className="text-5xl font-black"
                          style={{
                            color: isStrongMatch ? '#10B981' : isModerateMatch ? '#F59E0B' : '#EF4444',
                          }}
                        >
                          {readiness.score}%
                        </p>
                        <p className="text-sm text-[#64748B] mt-2">
                          {isStrongMatch
                            ? 'Strong Match - Recommended'
                            : isModerateMatch
                            ? 'Moderate Match - Consider'
                            : 'Weak Match - Not Recommended'}
                        </p>
                      </div>
                      <TrendingUp
                        className="w-12 h-12"
                        style={{
                          color: isStrongMatch ? '#10B981' : isModerateMatch ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                  </div>

                  {/* Job Order Details */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Job Order</p>
                      <p className="font-bold text-[#0F172A]">{jobOrder.position}</p>
                      <p className="text-sm text-[#64748B]">{jobOrder.id}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Employer & Location</p>
                      <p className="font-bold text-[#0F172A]">{jobOrder.employer}</p>
                      <p className="text-sm text-[#64748B]">{jobOrder.country}</p>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Strengths */}
                    <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-4">
                      <p className="text-xs font-bold text-[#10B981] uppercase mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Strengths ({readiness.strengths.length})
                      </p>
                      <ul className="text-xs text-[#0F172A] space-y-2">
                        {readiness.strengths.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#10B981] mt-0.5">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Gaps */}
                    {readiness.gaps.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-xs font-bold text-[#EF4444] uppercase mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Gaps ({readiness.gaps.length})
                        </p>
                        <ul className="text-xs text-[#0F172A] space-y-2">
                          {readiness.gaps.map((g, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#EF4444] mt-0.5">✗</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* AI Rule-Based Classifier & 3-2-1 Compliance Section */}
                  <div className="border-t border-slate-200 pt-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-bold px-2.5 py-1 rounded border border-amber-200 mb-1">
                          <Sparkles size={13} className="text-amber-600" />
                          <span>AI Rule-Based Pre-Qualification & 3-2-1 Document Audit</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Automated evaluation against POEA/DMW 3-2-1 Document Expiration rules and employer exam thresholds
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setMatchingError(null);
                          setMatchingEval(null);
                          setParsedMatching(null);
                          handleEvaluateMatching(jobOrder);
                        }}
                        disabled={isEvaluating}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                      >
                        {isEvaluating ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Evaluating Rules...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} />
                            <span>Run 3-2-1 Compliance Audit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isEvaluating && (
                      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                        <div className="h-8 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    )}

                    {!isEvaluating && matchingError && (
                      <div className="p-6 rounded-xl border bg-slate-50 border-slate-200 text-center">
                        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                        <h3 className="font-bold text-slate-800 mb-1">
                          {matchingError.status === 503 ? 'Service Unavailable' : 'Error'}
                        </h3>
                        <p className="text-sm text-slate-500">{matchingError.message}</p>
                      </div>
                    )}

                    {!isEvaluating && !matchingError && parsedMatching && (
                      <div className="space-y-4">
                        {/* Status & CV Gate Banner */}
                        <div
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            parsedMatching.overallStatus === 'qualified'
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                              : parsedMatching.overallStatus === 'system-pending'
                              ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                              : 'bg-red-50/70 border-red-300 text-red-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {parsedMatching.overallStatus === 'qualified' ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                <ShieldCheck size={20} />
                              </div>
                            ) : parsedMatching.overallStatus === 'system-pending' ? (
                              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 flex-shrink-0">
                                <Clock size={20} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 flex-shrink-0">
                                <ShieldAlert size={20} />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm">
                                  {parsedMatching.overallStatus === 'qualified' && (parsedMatching.score >= 85 ? 'Highly Recommended' : 'Recommended')}
                                  {parsedMatching.overallStatus === 'system-pending' && 'Screening In Progress'}
                                  {parsedMatching.overallStatus === 'blocked' && 'Blocked'}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    parsedMatching.overallStatus === 'qualified'
                                      ? 'bg-emerald-600 text-white'
                                      : parsedMatching.overallStatus === 'system-pending'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {parsedMatching.overallStatus === 'qualified' ? 'CV UNLOCKED' : 'CV LOCKED'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {parsedMatching.overallStatus === 'qualified'
                                  ? 'Candidate satisfies document rules and employer exam thresholds.'
                                  : parsedMatching.overallStatus === 'system-pending'
                                  ? 'Pending authoritative data checks.'
                                  : 'Candidate has blocking criteria or missing assessments.'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                              Exam Screening Score
                            </span>
                            {parsedMatching.hasNoExam ? (
                              <div className="flex flex-col items-end gap-1 mt-1">
                                <span className="font-black text-xl text-slate-400 font-mono">—</span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-slate-300 text-slate-500">
                                  Pending Exam
                                </span>
                              </div>
                            ) : (
                              <span className="font-black text-xl text-slate-900 font-mono">
                                {parsedMatching.score.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Checks Grid */}
                        <div className="grid grid-cols-1 gap-3">
                          {parsedMatching.realFailedChecks.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 mb-2.5">
                                <AlertCircle size={14} className="text-red-500" />
                                <span>Failed Checks ({parsedMatching.realFailedChecks.length})</span>
                              </div>
                              <div className="space-y-2">
                                {parsedMatching.realFailedChecks.map((chk, i) => (
                                  <div key={i} className="bg-white p-2.5 rounded-lg border border-red-100 text-xs flex items-center justify-between font-bold text-red-900">
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-600 mt-0.5">✗</span>
                                      <span>{chk.check_name}</span>
                                    </div>
                                    <span className="text-red-600 font-mono text-[11px] bg-red-50 px-2 py-0.5 rounded">{chk.actual}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedMatching.systemChecks.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2.5">
                                <div className="w-3.5 h-3.5 rounded-full bg-slate-300 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                </div>
                                <span>Also pending ({parsedMatching.systemChecks.length})</span>
                              </div>
                              <div className="space-y-2">
                                {parsedMatching.systemChecks.map((chk, i) => (
                                  <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between font-medium text-slate-600 group relative">
                                    <div className="flex items-center gap-2">
                                      <div className="text-slate-400">🔘</div>
                                      <span>{chk.check_name}</span>
                                    </div>
                                    <span 
                                      className="text-slate-500 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded cursor-help"
                                      title="This check requires an authoritative data source that is not yet available."
                                    >
                                      Pending Verification
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  {isStrongMatch && (
                    <button
                      onClick={() =>
                        handleEndorse(`${jobOrder.id} (${jobOrder.country}) - ${jobOrder.position}`)
                      }
                      className="w-full px-5 py-3 bg-[#10B981] text-white text-sm font-bold rounded-lg hover:bg-[#059669] shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Endorse to This Job Order
                    </button>
                  )}
                  {isModerateMatch && (
                    <button
                      onClick={() =>
                        handleEndorse(`${jobOrder.id} (${jobOrder.country}) - ${jobOrder.position}`)
                      }
                      className="w-full px-5 py-3 bg-[#F59E0B] text-white text-sm font-bold rounded-lg hover:bg-[#D97706] shadow-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Endorse with Conditions
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
