import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  Check,
  RefreshCw,
  Zap,
  Sliders,
  ShieldCheck,
  Clock,
  Layers,
  Sparkles,
  Play,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { ApplicantRecord } from '../../types';

interface StageForecast {
  stage_name: string;
  observation_count: number;
  optimistic: number | null;
  most_likely: number | null;
  pessimistic: number | null;
  pert_baseline: number;
  current_forecast: number;
  is_fallback: boolean;
  fallback_reason?: string;
}

interface DynamicException {
  reason_name: string;
  stage_name: string;
  seed_penalty_days: number;
  current_weight_days: number;
}

interface PipelineForecastData {
  agency_id: number;
  total_pipeline_duration_days: number;
  alpha_used: number;
  stages: StageForecast[];
  dynamic_exceptions: DynamicException[];
}

interface ApplicantTimelineData {
  applicant_id: number;
  full_name: string;
  agency_id: number;
  country_id?: number;
  current_stage: string;
  current_stage_index: number;
  completed_stages: string[];
  remaining_stages: string[];
  days_spent_in_current_stage: number;
  active_exception_penalty: number;
  predicted_remaining_days: number;
  reference_date: string;
  estimated_deployment_date: string;
  is_fallback: boolean;
  stage_breakdown: Record<string, number>;
}

interface PredictiveForecastProps {
  applicants?: ApplicantRecord[];
  selectedApplicantId?: string;
}

export default function PredictiveForecast({
  applicants = [],
  selectedApplicantId = '1',
}: PredictiveForecastProps) {
  const [pipelineData, setPipelineData] = useState<PipelineForecastData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Individualized Applicant Timeline
  const [activeApplicantId, setActiveApplicantId] = useState<string>(selectedApplicantId);
  const [applicantTimeline, setApplicantTimeline] = useState<ApplicantTimelineData | null>(null);
  const [loadingApplicant, setLoadingApplicant] = useState<boolean>(false);

  // Interactive Simulation State
  const [simStage, setSimStage] = useState<string>('Medical Clearance');
  const [simActual, setSimActual] = useState<number>(8.5);
  const [simAlpha, setSimAlpha] = useState<number>(0.35);
  const [simResult, setSimResult] = useState<{
    new_forecast_days: number;
    forecast_delta_days: number;
  } | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  const fetchForecast = async () => {
    setLoading(true);
    setBackendError(null);
    try {
      const res = await api.get('/forecasting/pipeline');
      setPipelineData(res.data);
      if (res.data.stages && res.data.stages.length > 0) {
        setSimStage(res.data.stages[1]?.stage_name || res.data.stages[0]?.stage_name);
      }
    } catch (err: any) {
      console.error('Failed to fetch forecasting data from backend:', err);
      setBackendError(
        err.response?.data?.detail || err.message || 'Could not connect to FastAPI backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicantForecast = async (appId: string | number) => {
    const numericId = parseInt(String(appId), 10);
    if (isNaN(numericId)) return;
    setLoadingApplicant(true);
    try {
      const res = await api.get(`/forecasting/applicant/${numericId}`);
      setApplicantTimeline(res.data);
    } catch (err) {
      console.warn(`Could not load specific forecast for applicant ${numericId}:`, err);
      setApplicantTimeline(null);
    } finally {
      setLoadingApplicant(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  useEffect(() => {
    if (activeApplicantId) {
      fetchApplicantForecast(activeApplicantId);
    }
  }, [activeApplicantId]);

  const handleSimulate = async () => {
    if (!pipelineData) return;
    const stageObj = pipelineData.stages.find((s) => s.stage_name === simStage);
    const prev = stageObj ? stageObj.current_forecast : 6.0;

    setSimulating(true);
    try {
      const res = await api.post('/forecasting/simulate-step', {
        applicant_id: parseInt(activeApplicantId, 10) || 1,
        workflow_stage: simStage,
        days_passed: Number(simActual),
        reason: 'Normal Process',
        actual_penalty: 0.0,
        advance_stage: true,
      });

      const newF = res.data.new_stage_forecast;
      const prevF = res.data.previous_stage_forecast ?? prev;
      setSimResult({
        new_forecast_days: newF,
        forecast_delta_days: Number((newF - prevF).toFixed(2)),
      });

      // Also refresh the overall pipeline and candidate forecasts
      fetchForecast();
      if (activeApplicantId) {
        fetchApplicantForecast(activeApplicantId);
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
      // Fallback local math in case backend simulate endpoint errors
      const newF = Number((simAlpha * simActual + (1 - simAlpha) * prev).toFixed(2));
      setSimResult({
        new_forecast_days: newF,
        forecast_delta_days: Number((newF - prev).toFixed(2)),
      });
    } finally {
      setSimulating(false);
    }
  };

  const selectedApplicant = applicants.find((a) => String(a.id) === String(activeApplicantId)) ||
    applicants[0] || {
      id: '1',
      name: 'Juan Dela Cruz',
      role: 'Industrial Welder',
      jobOrder: 'JO-2026-0042 (Saudi Arabia)',
    };

  // Compute departure estimate based on backend total pipeline duration
  const totalDays = pipelineData?.total_pipeline_duration_days || 45.42;
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + Math.round(totalDays));
  const fallbackFormattedEstimate = estimatedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedEstimate = applicantTimeline?.estimated_deployment_date
    ? new Date(applicantTimeline.estimated_deployment_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : fallbackFormattedEstimate;

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-amber-500" />
            Predictive Timeline Forecast
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Hybrid PERT + Single Exponential Smoothing (SES) engine dynamically predicting worker deployment timelines
          </p>
        </div>

        <button
          onClick={fetchForecast}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-sky-500' : ''} />
          <span>Refresh Live Forecast</span>
        </button>
      </div>

      {/* Live Backend Connection Status Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
          backendError
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent border-emerald-300/40 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              backendError ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">
                {backendError ? 'Backend Connection Notice' : 'FastAPI Backend Live & Connected'}
              </span>
              <span className="bg-slate-900 text-white font-mono text-[10px] px-2 py-0.5 rounded">
                http://localhost:8000
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {backendError
                ? `Using local baseline calculations (${backendError})`
                : `Active Tenant Agency: #${pipelineData?.agency_id || 1} • Smoothing Factor α: ${
                    pipelineData?.alpha_used || 0.35
                  } • Dynamic Exceptions Active`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="bg-white/80 border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            Total Pipeline: <strong>{totalDays.toFixed(1)} days</strong>
          </span>
        </div>
      </div>

      {/* Main Applicant Forecast Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {/* Applicant Selector & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Target Candidate:</span>
            <select
              value={activeApplicantId}
              onChange={(e) => setActiveApplicantId(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
            >
              {applicants.map((app) => (
                <option key={app.id} value={app.id}>
                  #{app.id} - {app.name} ({app.role || 'Applicant'})
                </option>
              ))}
            </select>
          </div>
          {applicantTimeline ? (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded">
                Current Stage: {applicantTimeline.current_stage}
              </span>
              {applicantTimeline.active_exception_penalty > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  Active Disruption: +{applicantTimeline.active_exception_penalty}d
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {loadingApplicant ? 'Loading applicant projection...' : 'Showing agency pipeline baseline'}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-2xl">
                {applicantTimeline?.full_name || selectedApplicant.name}
              </span>
              <span className="bg-sky-50 text-sky-700 text-xs font-bold px-2 py-0.5 rounded border border-sky-200">
                {applicantTimeline?.current_stage ? `Stage: ${applicantTimeline.current_stage}` : 'Active Applicant'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Applicant #{activeApplicantId} • {selectedApplicant.role}
            </p>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-600 border border-sky-300 bg-sky-50/50 px-4 py-2 rounded-full w-fit">
            {selectedApplicant.jobOrder || 'JO-2026-0042 (Al-Futtaim Engineering)'}
          </div>
        </div>

        {/* Dynamic Estimated Date */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-6 mb-8 relative overflow-hidden shadow-inner">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.15),transparent)] pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Calendar className="w-4 h-4" />
                Individualized Algorithm Departure Date
              </div>
              <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {formattedEstimate}
              </h3>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                {applicantTimeline
                  ? `Personalized via PERT baselines + recursive SES updates (${applicantTimeline.predicted_remaining_days.toFixed(1)} remaining days)`
                  : `Calculated via PERT prior baselines + SES learning with dynamic exception buffer (+${totalDays.toFixed(1)} days)`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:border-l md:border-slate-700 md:pl-6 text-center">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  {applicantTimeline ? 'Remaining Days' : 'Total Duration'}
                </p>
                <p className="text-2xl font-black text-sky-400 mt-0.5">
                  {applicantTimeline
                    ? `${applicantTimeline.predicted_remaining_days.toFixed(1)} d`
                    : `${totalDays.toFixed(1)} d`}
                </p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">Learning Alpha (α)</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5">
                  {pipelineData?.alpha_used || 0.35}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Forecast Breakdown Table */}
        <div>
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Layers size={16} className="text-sky-500" />
            Stage-by-Stage PERT & Exponential Smoothing Forecast
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Stage Name</th>
                  <th className="py-3 px-4 text-center">Observations</th>
                  <th className="py-3 px-4 text-right">PERT Baseline (Days)</th>
                  <th className="py-3 px-4 text-right">SES Current Forecast</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pipelineData?.stages?.map((stage, idx) => (
                  <tr key={stage.stage_name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        <span>{stage.stage_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {stage.observation_count} records
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {stage.pert_baseline.toFixed(2)} d
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-700 bg-sky-50/50">
                      {stage.current_forecast.toFixed(2)} d
                    </td>
                    <td className="py-3 px-4 text-center">
                      {stage.is_fallback ? (
                        <span
                          title={stage.fallback_reason || 'Using baseline prior'}
                          className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200"
                        >
                          <Clock size={10} />
                          Prior Baseline
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                          <Check size={10} />
                          Historical Empirical
                        </span>
                      )}
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Loading stage data from backend...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Simulation Panel (Matching Simulation.html & Manager Controls) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 font-bold text-xs px-2.5 py-1 rounded-md mb-1.5 border border-purple-200">
              <Zap size={13} />
              Manager Simulation Laboratory
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Test Single Exponential Smoothing (SES) Live
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate actual turnaround updates and observe recursive forecast adaptation in real time:
              <span className="font-mono ml-1 text-slate-700">F_(t+1) = α · A_t + (1 - α) · F_t</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 pb-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Stage</label>
            <select
              value={simStage}
              onChange={(e) => {
                setSimStage(e.target.value);
                setSimResult(null);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {pipelineData?.stages?.map((s) => (
                <option key={s.stage_name} value={s.stage_name}>
                  {s.stage_name} (Current: {s.current_forecast.toFixed(1)}d)
                </option>
              )) || <option>Medical Clearance</option>}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Simulated Turnaround (Actual Days)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              value={simActual}
              onChange={(e) => {
                setSimActual(parseFloat(e.target.value) || 0);
                setSimResult(null);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alpha Smoothing Factor (α: {simAlpha})
            </label>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={simAlpha}
              onChange={(e) => {
                setSimAlpha(parseFloat(e.target.value));
                setSimResult(null);
              }}
              className="w-full accent-sky-500 mt-2"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Play size={14} className={simulating ? 'animate-spin' : ''} />
            <span>Run SES Recalculation Step</span>
          </button>

          {simResult && (
            <div className="w-full sm:w-auto bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-4 text-xs">
              <span className="text-slate-500">New Stage Forecast:</span>
              <strong className="text-sky-700 font-mono text-sm">
                {simResult.new_forecast_days.toFixed(2)} days
              </strong>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  simResult.forecast_delta_days > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {simResult.forecast_delta_days > 0 ? '+' : ''}
                {simResult.forecast_delta_days.toFixed(2)} d
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Exception Weights Learned Card */}
      {pipelineData?.dynamic_exceptions && pipelineData.dynamic_exceptions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            Dynamic Exception Penalty Buffer Weights
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            FlowSensus auto-learns delay penalties from historical disruption resolution durations rather than fixed arbitrary estimates.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {pipelineData.dynamic_exceptions.map((ex) => (
              <div
                key={ex.reason_name}
                className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {ex.stage_name}
                  </span>
                  <span className="font-bold text-xs text-slate-800 mt-1 block">
                    {ex.reason_name}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-500">Weight:</span>
                  <span className="font-mono text-xs font-black text-amber-600">
                    +{ex.current_weight_days.toFixed(1)} days
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
