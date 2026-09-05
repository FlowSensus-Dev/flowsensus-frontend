import { Check, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { ApplicantRecord } from '../../../app/types';

interface PredictiveForecastProps {
  applicants?: ApplicantRecord[];
}

export default function PredictiveForecast({ applicants = [] }: PredictiveForecastProps) {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          <TrendingUp className="w-8 h-8 inline-block mr-2 text-[#F59E0B]" />
          Predictive Timeline Forecast
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Real-time deployment date estimation based on document completion rate and historical processing times
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <TrendingUp className="w-6 h-6 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#0F172A] mb-2">How the Algorithm Works</p>
            <p className="text-sm text-[#64748B]">
              Because all departments update the system in real-time, FlowSensus can accurately predict future
              deployment dates. The system analyzes:
            </p>
            <ul className="text-sm text-[#64748B] mt-2 space-y-1 ml-4 list-disc">
              <li>Current phase progress and completion percentage</li>
              <li>Document completion rate from Admin department</li>
              <li>Historical average processing times by destination country</li>
              <li>Bottlenecks and delays in the workflow pipeline</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Forecast Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="font-bold text-[#0F172A] text-2xl">Juan Dela Cruz</p>
            <p className="text-sm text-[#64748B]">APP-2026-089 | Industrial Welder</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0EA5E9] border border-[#0EA5E9] px-4 py-2 rounded-full">
            JO-0042 (Saudi Arabia)
          </p>
        </div>

        {/* Progress Timeline */}
        <div className="relative pt-4 pb-8">
          {/* Background Bar */}
          <div className="h-4 bg-slate-100 rounded-full w-full border border-slate-200"></div>
          {/* Progress Bar */}
          <div
            className="h-4 bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] rounded-full absolute top-4 left-0 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
            style={{ width: '68%' }}
          ></div>

          {/* Checkpoints */}
          <div className="absolute top-2 left-[10%] w-8 h-8 bg-[#10B981] rounded-full border-4 border-white flex items-center justify-center shadow-sm">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="absolute top-2 left-[40%] w-8 h-8 bg-[#10B981] rounded-full border-4 border-white flex items-center justify-center shadow-sm">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="absolute top-2 left-[68%] w-8 h-8 bg-[#0EA5E9] rounded-full border-4 border-white shadow-sm ring-4 ring-[#0EA5E9]/20 animate-pulse"></div>
          <div className="absolute top-2 left-[95%] w-8 h-8 bg-slate-200 rounded-full border-4 border-white shadow-sm"></div>

          <div className="flex justify-between mt-8 text-xs font-black uppercase tracking-widest text-[#64748B]">
            <div className="text-center ml-2">
              <p className="text-[#10B981]">Phase 1</p>
              <p className="text-[10px] mt-1">Intake</p>
            </div>
            <div className="text-center">
              <p className="text-[#10B981]">Phase 2</p>
              <p className="text-[10px] mt-1">Medical</p>
            </div>
            <div className="text-center">
              <p className="text-[#0EA5E9]">Phase 3-4</p>
              <p className="text-[10px] mt-1">CV / Employer</p>
            </div>
            <div className="text-center mr-2">
              <p className="text-slate-400">Phase 5</p>
              <p className="text-[10px] mt-1">Final Visa</p>
            </div>
          </div>
        </div>

        {/* Estimated Date */}
        <div className="mt-8 pt-8 border-t-2 border-slate-100 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-[#F59E0B]" />
            <p className="text-xs font-black text-[#64748B] uppercase tracking-widest">
              Algorithm: Estimated Departure Date
            </p>
          </div>
          <p className="text-6xl font-black text-[#0F172A] my-4">August 12, 2026</p>
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#F59E0B]">
            <AlertCircle className="w-4 h-4" />
            Based on 42-day average for Saudi visa processing + Admin document completion rate
          </div>
        </div>

        {/* Analysis Breakdown */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Current Progress</p>
            <p className="text-3xl font-black text-[#0EA5E9]">68%</p>
            <p className="text-xs text-[#64748B] mt-1">Phase 3 of 5</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Days Remaining</p>
            <p className="text-3xl font-black text-[#F59E0B]">79</p>
            <p className="text-xs text-[#64748B] mt-1">Until estimated date</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Doc Completion</p>
            <p className="text-3xl font-black text-[#10B981]">85%</p>
            <p className="text-xs text-[#64748B] mt-1">Ready for visa</p>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-[#0F172A] mb-4">Risk Analysis & Bottleneck Detection</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <Check className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#0F172A]">On Track</p>
              <p className="text-sm text-[#64748B]">
                All critical documents are being processed on schedule. No expiration risks detected.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="w-5 h-5 text-[#64748B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#0F172A]">Monitoring</p>
              <p className="text-sm text-[#64748B]">
                Visa processing times can vary. System will auto-update forecast as Admin completes final documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
