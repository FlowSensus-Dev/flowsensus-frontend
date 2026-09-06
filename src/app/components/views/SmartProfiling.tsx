import { useState, useEffect } from 'react';
import { Target, CheckCircle, AlertCircle, TrendingUp, Lock, ShieldCheck, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../types';
import { api } from '../../../lib/api';

interface SmartProfilingProps {
  showToast: (message: string) => void;
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  selectedApplicantId?: string;
  onSelectApplicant?: (applicantId: string) => void;
  workflow?: WorkflowState;
}

export default function SmartProfiling({
  showToast,
  applicants = [],
  currentUserName,
  addActivityLog,
  selectedApplicantId = '1',
  onSelectApplicant,
  workflow,
}: SmartProfilingProps) {
  const [activeApplicantId, setActiveApplicantId] = useState<string>(selectedApplicantId || '');
  const [selectedJobOrder, setSelectedJobOrder] = useState('');
  const [jobOrders, setJobOrders] = useState<any[]>([
    {
      id: 'JO-2026-0042',
      position: 'Industrial Welder',
      country: 'Saudi Arabia',
      employer: 'Al-Futtaim Engineering',
      employerId: 2,
      minExperience: 3,
      keyDuties: ['MIG/TIG welding', 'structural fabrication', 'blueprint reading'],
      certifications: ['TESDA NC II', 'Trade Test Passer'],
      languageRequirements: ['English (conversational)'],
    },
    {
      id: 'JO-2026-0038',
      position: 'Domestic Helper',
      country: 'Hong Kong',
      employer: 'Private Household',
      employerId: 3,
      minExperience: 2,
      keyDuties: ['cleaning rooms/houses', 'childcare', 'cooking'],
      certifications: ['TESDA NC II - Housekeeping'],
      languageRequirements: ['English (basic)', 'Cantonese (basic)'],
    },
    {
      id: 'JO-2026-0051',
      position: 'Caregiver',
      country: 'United Arab Emirates',
      employer: 'Emirates Healthcare Group',
      employerId: 4,
      minExperience: 2,
      keyDuties: ['elderly care', 'bedridden patient assistance', 'medication reminders'],
      certifications: ['TESDA NC II - Caregiving', 'CPR/First Aid'],
      languageRequirements: ['English (fluent)', 'Arabic (basic)'],
    },
  ]);

  const [matchingEval, setMatchingEval] = useState<any | null>(null);
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
      try {
        const res = await api.get('/job-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveOrders = res.data.map((jo: any) => ({
            id: jo.job_order_code || jo.job_code || `JO-${jo.job_order_id}`,
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
      }
    };
    fetchLiveJobOrders();
  }, []);

  const isLocked = !workflow?.screeningPassed;

  // Find selected applicant safely
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
      if (res.data.is_qualified) {
        showToast(`✓ Rule Check Passed: Applicant is ${res.data.status}. CV unlocked for Manager Approval.`);
      } else {
        showToast(`⚠ Pre-qualification Blocked: ${res.data.blocking_reasons?.length || 1} criteria blocked.`);
      }
    } catch (err: any) {
      console.error('Matching evaluation error:', err);
      showToast(err.response?.data?.detail || 'Failed to evaluate matching criteria.');
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
    <div className="space-y-6 max-w-6xl">
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
            <h3 className="font-black text-[#0F172A] text-lg">{applicant.name}</h3>
            <p className="text-sm text-[#64748B]">{applicant.id} | {applicant.role}</p>
          </div>
          {applicants.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#64748B] uppercase">Evaluate Candidate:</span>
              <select
                value={applicant.id}
                onChange={(e) => {
                  const newId = e.target.value;
                  setActiveApplicantId(newId);
                  if (onSelectApplicant) onSelectApplicant(newId);
                  setMatchingEval(null);
                }}
                className="border-2 border-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#0F172A] bg-white focus:border-[#F59E0B] outline-none"
              >
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
          <option value="">-- Select Job Order --</option>
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
                        onClick={() => handleEvaluateMatching(jobOrder)}
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

                    {matchingEval && (
                      <div className="space-y-4">
                        {/* Status & CV Gate Banner */}
                        <div
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            matchingEval.cv_unlocked
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                              : 'bg-amber-50/70 border-amber-300 text-amber-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {matchingEval.cv_unlocked ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                <ShieldCheck size={20} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 flex-shrink-0">
                                <ShieldAlert size={20} />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm">
                                  Classifier Decision: {matchingEval.status}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    matchingEval.cv_unlocked
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}
                                >
                                  {matchingEval.cv_unlocked ? 'CV UNLOCKED' : 'CV LOCKED'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {matchingEval.cv_unlocked
                                  ? 'Candidate satisfies 100% of regulatory 3-2-1 document rules and employer exam thresholds. CV unlocked for Manager Approval.'
                                  : 'Candidate has blocking criteria or missing assessments. Structural CV unlock gate prevents submission until resolved.'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                              Exam Screening Score
                            </span>
                            <span className="font-black text-xl text-slate-900 font-mono">
                              {matchingEval.overall_match_score?.toFixed(1) || 0}%
                            </span>
                          </div>
                        </div>

                        {/* Checks Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Passed Checks */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2.5">
                              <CheckCircle size={14} className="text-emerald-500" />
                              <span>Passed Checks ({matchingEval.passed_checks?.length || 0})</span>
                            </div>
                            <div className="space-y-2">
                              {matchingEval.passed_checks?.map((chk: any, i: number) => (
                                <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs">
                                  <div className="flex items-center justify-between font-bold text-slate-800">
                                    <span>{chk.check_name}</span>
                                    <span className="text-emerald-600 font-mono text-[11px]">✓ {chk.actual}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">{chk.details}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Failed / Blocking Checks */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-2.5">
                              <AlertCircle size={14} className="text-amber-500" />
                              <span>Failed or Incomplete ({matchingEval.failed_checks?.length || 0})</span>
                            </div>
                            {matchingEval.failed_checks && matchingEval.failed_checks.length > 0 ? (
                              <div className="space-y-2">
                                {matchingEval.failed_checks.map((chk: any, i: number) => (
                                  <div key={i} className="bg-white p-2.5 rounded-lg border border-amber-100 text-xs">
                                    <div className="flex items-center justify-between font-bold text-amber-800">
                                      <span>{chk.check_name}</span>
                                      <span className="text-amber-600 font-mono text-[11px]">✗ {chk.actual}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">{chk.details}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic p-3 text-center">
                                No failed or blocking checks detected.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Blocking Reasons List */}
                        {matchingEval.blocking_reasons && matchingEval.blocking_reasons.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900">
                            <span className="font-bold flex items-center gap-1.5 mb-1 text-red-800">
                              <AlertCircle size={13} />
                              Regulatory Blocking Reasons:
                            </span>
                            <ul className="list-disc ml-5 space-y-1 text-red-700 text-[11px]">
                              {matchingEval.blocking_reasons.map((reason: string, i: number) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
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
