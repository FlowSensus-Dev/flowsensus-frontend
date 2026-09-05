import { useState } from 'react';
import { Target, CheckCircle, AlertCircle, TrendingUp, Lock } from 'lucide-react';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../../app/types';

interface SmartProfilingProps {
  showToast: (message: string) => void;
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  selectedApplicantId?: string;
  workflow?: WorkflowState;
}

export default function SmartProfiling({
  showToast,
  applicants = [],
  currentUserName,
  addActivityLog,
  selectedApplicantId = 'APP-2026-089',
  workflow,
}: SmartProfilingProps) {
  const [selectedJobOrder, setSelectedJobOrder] = useState('');

  const isLocked = !workflow?.screeningPassed;

  // Find selected applicant
  const applicant = applicants.find((a) => a.id === selectedApplicantId) || applicants[0];

  // Mock job orders
  const jobOrders = [
    {
      id: 'JO-2026-0042',
      position: 'Industrial Welder',
      country: 'Saudi Arabia',
      employer: 'Al-Futtaim Engineering',
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
      minExperience: 2,
      keyDuties: ['elderly care', 'bedridden patient assistance', 'medication reminders'],
      certifications: ['TESDA NC II - Caregiving', 'CPR/First Aid'],
      languageRequirements: ['English (fluent)', 'Arabic (basic)'],
    },
  ];

  // Readiness detection engine
  const calculateReadiness = (jobOrder: any) => {
    if (!applicant) return { score: 0, strengths: [], gaps: [] };

    const strengths: string[] = [];
    const gaps: string[] = [];
    let score = 0;

    // A. Job Order Keyword Match (25 points)
    const positionKeywords = jobOrder.position.toLowerCase().split(' ');
    const applicantRole = (applicant.role || '').toLowerCase();
    const hasDirectMatch = positionKeywords.some(keyword => applicantRole.includes(keyword));

    if (hasDirectMatch) {
      score += 25;
      strengths.push(`Job title directly matches: ${applicant.role}`);
    } else if (applicant.workExperience) {
      const hasExperienceMatch = applicant.workExperience.some(exp =>
        positionKeywords.some(keyword => exp.position.toLowerCase().includes(keyword))
      );
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
    let dutyMatches = 0;
    if (applicant.workExperience && applicant.workExperience.length > 0) {
      jobOrder.keyDuties.forEach((duty: string) => {
        const dutyKeyword = duty.toLowerCase();
        const hasMatch = applicant.workExperience!.some(exp =>
          exp.responsibilities.some(resp => resp.toLowerCase().includes(dutyKeyword.split('/')[0]))
        );
        if (hasMatch) dutyMatches++;
      });
      const dutyScore = (dutyMatches / jobOrder.keyDuties.length) * 20;
      score += dutyScore;
      if (dutyScore >= 10) {
        strengths.push(`${dutyMatches}/${jobOrder.keyDuties.length} key duties match work experience`);
      } else {
        gaps.push('Limited task relevance to job requirements');
      }
    } else {
      gaps.push('No work experience to validate duties');
    }

    // C. Work Experience Duration (15 points)
    if (applicant.workExperience && applicant.workExperience.length > 0) {
      const totalYears = applicant.workExperience.reduce((sum, exp) => {
        const start = parseInt(exp.startDate);
        const end = exp.endDate.toLowerCase() === 'present' ? new Date().getFullYear() : parseInt(exp.endDate);
        return sum + (end - start);
      }, 0);

      if (totalYears >= jobOrder.minExperience + 2) {
        score += 15;
        strengths.push(`${totalYears} years of experience exceeds ${jobOrder.minExperience} year requirement`);
      } else if (totalYears >= jobOrder.minExperience) {
        score += 10;
        strengths.push(`Meets minimum ${jobOrder.minExperience} year experience requirement`);
      } else {
        gaps.push(`Insufficient experience: ${totalYears} years (needs ${jobOrder.minExperience})`);
      }
    } else {
      gaps.push('No work experience duration available');
    }

    // D. Country/Overseas Experience (20 points)
    if (applicant.workExperience) {
      const hasOverseasExp = applicant.workExperience.some(exp => exp.isOverseas);
      const hasSameCountryExp = applicant.workExperience.some(exp => exp.country === jobOrder.country);

      if (hasSameCountryExp) {
        score += 20;
        strengths.push(`Previous ${jobOrder.country} experience (high value)`);
      } else if (hasOverseasExp) {
        score += 15;
        const countries = applicant.workExperience.filter(e => e.isOverseas).map(e => e.country).join(', ');
        strengths.push(`Has overseas experience: ${countries}`);
      } else {
        gaps.push('No overseas work experience');
      }
    } else {
      gaps.push('No overseas experience');
    }

    // E. Skills & Special Abilities (10 points)
    if (applicant.skills && applicant.skills.length > 0) {
      const skillMatches = jobOrder.keyDuties.filter((duty: string) =>
        applicant.skills!.some(skill =>
          duty.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(duty.split('/')[0].toLowerCase())
        )
      );
      const skillScore = (skillMatches.length / jobOrder.keyDuties.length) * 10;
      score += skillScore;
      if (skillScore >= 5) {
        strengths.push(`${applicant.skills.length} relevant skills documented`);
      }
    } else {
      gaps.push('No skills documented');
    }

    // F. Certifications & Training (15 points)
    if (applicant.certifications && applicant.certifications.length > 0) {
      const certMatches = jobOrder.certifications.filter((cert: string) =>
        applicant.certifications!.some(c => c.toLowerCase().includes(cert.toLowerCase()))
      );
      const certScore = (certMatches.length / jobOrder.certifications.length) * 15;
      score += certScore;
      if (certScore >= 8) {
        strengths.push(`${certMatches.length}/${jobOrder.certifications.length} required certifications held`);
      } else {
        gaps.push('Missing key certifications');
      }
    } else {
      gaps.push('No certifications documented');
    }

    // G. Language Skills (5 points)
    if (applicant.languagesSpoken && applicant.languagesSpoken.length > 0) {
      const langMatches = jobOrder.languageRequirements.filter((lang: string) =>
        applicant.languagesSpoken!.some(l => lang.toLowerCase().includes(l.toLowerCase()))
      );
      const langScore = (langMatches.length / jobOrder.languageRequirements.length) * 5;
      score += langScore;
      if (langScore >= 3) {
        strengths.push('Language requirements met');
      } else {
        gaps.push('Language skills may not meet requirements');
      }
    } else {
      gaps.push('No language skills documented');
    }

    return {
      score: Math.round(score),
      strengths,
      gaps,
    };
  };

  const handleEndorse = (jobOrderName: string) => {
    if (!applicant) return;

    addActivityLog({
      applicantId: applicant.id,
      action: 'Applicant Endorsed to Job Order',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `Applicant endorsed to: ${jobOrderName}`,
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

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-[#0F172A] text-lg">{applicant.name}</h3>
            <p className="text-sm text-[#64748B]">{applicant.id} | {applicant.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Work Experience</p>
            <p className="text-sm text-[#0F172A] font-medium">
              {applicant.workExperience?.length || 0} Jobs
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
              {applicant.workExperience?.filter(e => e.isOverseas).length || 0} Countries
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
