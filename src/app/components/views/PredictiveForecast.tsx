import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  Check,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { ApplicantRecord, ApplicationForecastResponse } from '../../types';
import { Skeleton, SkeletonBadge } from '../ui/skeleton';

interface StageForecast {
  stage_name: string;
  observation_count: number;
  optimistic: number | null;
  most_likely: number | null;
  pessimistic: number | null;
  pert_baseline: number;
  current_forecast?: number | null;
  current_ses_forecast_days?: number | null;
  is_fallback: boolean;
  fallback_reason?: string;
}

interface DynamicException {
  reason_name: string;
  stage_name: string;
  seed_penalty_days: number;
  current_weight_days: number;
  observation_count: number;
}

interface PipelineForecastData {
  agency_id: number;
  total_pipeline_duration_days: number;
  alpha_used: number;
  stages: StageForecast[];
  dynamic_exceptions: DynamicException[];
}

interface PredictiveForecastProps {
  applicants?: ApplicantRecord[];
  applicantsLoaded?: boolean;
  selectedApplicantId?: string;
  globalPipelineForecast?: any;
}

export default function PredictiveForecast({
  applicants = [],
  applicantsLoaded = true,
  selectedApplicantId = '1',
  globalPipelineForecast,
}: PredictiveForecastProps) {
  const [pipelineData, setPipelineData] = useState<PipelineForecastData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Candidate and Application Selection
  const [candidateId, setActiveApplicantId] = useState<string>(selectedApplicantId);
  const incomingCandidateId = useRef(selectedApplicantId);
  const [applicationSelection, setApplicationSelection] = useState<{
    applicantId: string;
    applicationId: number | null;
  } | null>(null);
  const [forecastResponse, setForecastResponse] = useState<ApplicationForecastResponse | null>(null);
  const [loadingApplicant, setLoadingApplicant] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const forecastRequestId = useRef(0);
  const forecastApplicationId = useRef<number | null>(null);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  // Unique applicants for Target Candidate selector
  const uniqueApplicants = useMemo(() => {
    const map = new Map<string, ApplicantRecord>();
    for (const app of applicants) {
      if (!map.has(String(app.id))) {
        map.set(String(app.id), app);
      }
    }
    return Array.from(map.values());
  }, [applicants]);

  const incomingCandidateChanged = incomingCandidateId.current !== selectedApplicantId;
  const selectedApplicant =
    (incomingCandidateChanged
      ? uniqueApplicants.find((a) => String(a.id) === String(selectedApplicantId))
      : undefined) ||
    uniqueApplicants.find((a) => String(a.id) === String(candidateId)) ||
    uniqueApplicants.find((a) => String(a.id) === String(selectedApplicantId)) ||
    uniqueApplicants[0];
  const activeApplicantId = selectedApplicant ? String(selectedApplicant.id) : '';

  // Reconcile invalid IDs after loading without resetting valid manual choices.
  useEffect(() => {
    incomingCandidateId.current = selectedApplicantId;
    setActiveApplicantId(activeApplicantId);
  }, [selectedApplicantId, activeApplicantId]);

  // All applications belonging to the currently selected applicant
  const matchingApplications = useMemo(() => {
    return applicants.filter(
      (a) => String(a.id) === String(activeApplicantId) &&
        typeof a.applicationId === 'number' && Number.isSafeInteger(a.applicationId) && a.applicationId > 0
    );
  }, [applicants, activeApplicantId]);

  // Application selection safety:
  // - If exactly 1 application, use it automatically.
  // - If > 1 application, require the user to select one (do not guess).
  // - If 0 applications, clear selection.
  const activeApplicationId = matchingApplications.length === 1
    ? matchingApplications[0].applicationId!
    : applicationSelection?.applicantId === activeApplicantId &&
      matchingApplications.some((a) => a.applicationId === applicationSelection.applicationId)
    ? applicationSelection.applicationId
    : null;

  const setActiveApplicationId = (applicationId: number | null) => {
    setApplicationSelection({ applicantId: activeApplicantId, applicationId });
  };

  useEffect(() => {
    setApplicationSelection(null);
  }, [activeApplicantId]);

  const fetchPipeline = async () => {
    setLoading(true);
    setBackendError(null);
    try {
      const res = globalPipelineForecast ? { data: globalPipelineForecast } : await api.get('/forecasting/pipeline');
      setPipelineData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch forecasting data from backend:', err);
      setBackendError(
        err.response?.data?.detail || err.message || 'Could not connect to FastAPI backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationForecast = async (appId: number) => {
    if (!Number.isSafeInteger(appId) || appId <= 0 || forecastApplicationId.current !== appId) return;
    const requestId = ++forecastRequestId.current;
    setForecastResponse(null);
    setLoadingApplicant(true);
    setForecastError(null);
    try {
      const res = await api.get(`/forecasting/application/${appId}`);
      if (requestId !== forecastRequestId.current) return;
      if (res.data.application_id !== appId) {
        throw new Error('Forecast response does not match the requested application.');
      }
      setForecastResponse(res.data);
    } catch (err: any) {
      if (requestId !== forecastRequestId.current) return;
      console.warn(`Could not load forecast for application ${appId}:`, err);
      setForecastResponse(null);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setForecastError(detail);
      } else if (err.response?.status === 404) {
        setForecastError('Application or forecasting resource not found.');
      } else if (err.response?.status === 409) {
        setForecastError(detail || 'Application workflow phase has no confirmed forecasting mapping.');
      } else {
        setForecastError('Unable to load forecast for this application.');
      }
    } finally {
      if (requestId === forecastRequestId.current) setLoadingApplicant(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [globalPipelineForecast]);

  // Clear the previous application before paint and invalidate requests on selection changes.
  useLayoutEffect(() => {
    forecastApplicationId.current = activeApplicationId;
    if (activeApplicationId) {
      fetchApplicationForecast(activeApplicationId);
    } else {
      setForecastResponse(null);
      setForecastError(null);
      setLoadingApplicant(false);
    }
    return () => {
      forecastApplicationId.current = null;
      ++forecastRequestId.current;
    };
  }, [activeApplicationId]);

  const handleRefresh = () => {
    fetchPipeline();
    if (activeApplicationId) {
      fetchApplicationForecast(activeApplicationId);
    }
  };

  const selectedApplicationRecord =
    matchingApplications.find((a) => a.applicationId === activeApplicationId) ||
    (matchingApplications.length === 1 ? matchingApplications[0] : null);

  const totalDays = pipelineData?.total_pipeline_duration_days;

  const hasRecord = Boolean(forecastResponse?.record);
  const isDeployed =
    (forecastResponse?.current_stage || '').toLowerCase() === 'deployed' ||
    (selectedApplicationRecord?.status || '').toLowerCase() === 'deployed';
  const formattedEstimate =
    !isDeployed && hasRecord && forecastResponse?.record?.estimated_deployment_date
      ? new Date(forecastResponse.record.estimated_deployment_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const remainingDays =
    isDeployed
      ? '0.0 d'
      : hasRecord && forecastResponse?.record?.estimated_remaining_days !== undefined
      ? `${forecastResponse.record.estimated_remaining_days.toFixed(1)} d`
      : null;

  if (!applicantsLoaded) {
    return (
      <div className="space-y-6 w-full">
        {/* Connection banner skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-56 bg-slate-100" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        {/* 3 KPI stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-2.5 w-32 bg-slate-100" />
            </div>
          ))}
        </div>
        {/* Stage timeline cards */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-4 w-44" />
                </div>
                <SkeletonBadge />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16 bg-slate-100" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-1.5 w-full rounded-full mt-4 bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedApplicant) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">Predictive Timeline Forecast</h2>
        <p className="text-sm text-slate-500">No applicants are available to forecast.</p>
      </div>
    );
  }

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
          onClick={handleRefresh}
          disabled={loading || loadingApplicant}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCw size={14} className={loading || loadingApplicant ? 'animate-spin text-sky-500' : ''} />
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
                {backendError ? 'Backend Connection Notice' : loading ? 'Loading Backend Forecast' : 'Backend Forecast Loaded'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {backendError
                ? `Forecast refresh unavailable (${backendError}). Previously loaded data, if shown, may be stale.`
                : pipelineData
                ? `Active Tenant Agency: #${pipelineData.agency_id} | Agency SES Alpha: ${pipelineData?.alpha_used ?? 'Unavailable'}`
                : 'Waiting for backend forecasting data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="bg-white/80 border border-slate-200 px-3 py-1 rounded-full shadow-sm text-slate-600">
            Agency Baseline Total: <strong>{(totalDays != null ? `${totalDays.toFixed(1)} days` : 'Unavailable')}</strong>
          </span>
        </div>
      </div>

      {/* Main Applicant Forecast Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {/* Applicant & Application Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex flex-wrap items-center gap-3">
            {/* Candidate Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Target Candidate:</span>
              <select
                value={activeApplicantId}
                onChange={(e) => setActiveApplicantId(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
              >
                {uniqueApplicants.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.applicantCode || `#${app.id}`} - {app.name} ({app.role || 'Applicant'})
                  </option>
                ))}
              </select>
            </div>

            {/* Application Selector (only shown if candidate has multiple applications) */}
            {matchingApplications.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Job Application:</span>
                <select
                  value={activeApplicationId ?? ''}
                  onChange={(e) => setActiveApplicationId(e.target.value ? Number(e.target.value) : null)}
                  className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                >
                  <option value="">-- Select Application to Forecast --</option>
                  {matchingApplications.map((app) => (
                    <option key={app.applicationId} value={app.applicationId}>
                      Application #{app.applicationId} - {app.role || 'Applicant'} ({app.jobOrder || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {matchingApplications.length === 1 && (
              <span className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm">
                Application #{matchingApplications[0].applicationId}
                {matchingApplications[0].jobOrder ? ` • ${matchingApplications[0].jobOrder}` : ''}
              </span>
            )}
          </div>

          {forecastResponse ? (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              {forecastResponse.current_stage && (
                <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  Current Stage: {forecastResponse.current_stage}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {loadingApplicant
                ? 'Loading application forecast...'
                : matchingApplications.length === 0
                ? 'No job application available'
                : matchingApplications.length > 1 && !activeApplicationId
                ? 'Select an application above'
                : 'Showing agency pipeline baseline'}
            </span>
          )}
        </div>

        {/* Informational / Safety Banners */}
        {matchingApplications.length === 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="font-semibold">No job application is available for this applicant.</span>
          </div>
        )}

        {matchingApplications.length > 1 && !activeApplicationId && (
          <div className="mb-6 p-4 rounded-xl border border-sky-200 bg-sky-50/80 text-sky-900 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} className="text-sky-600 flex-shrink-0" />
            <span className="font-semibold">
              This applicant has multiple job applications. Please select an application above to view its forecast.
            </span>
          </div>
        )}

        {forecastError && (
          <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-900 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Forecast Notice</p>
              <p className="mt-0.5">{forecastError}</p>
            </div>
          </div>
        )}

        {forecastResponse?.limitations && forecastResponse.limitations.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Forecast Limitations</p>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                {forecastResponse.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Selected Applicant Summary */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-2xl">
                {selectedApplicant.name}
              </span>
              <span className="bg-sky-50 text-sky-700 text-xs font-bold px-2 py-0.5 rounded border border-sky-200">
                {forecastResponse?.current_stage
                  ? `Stage: ${forecastResponse.current_stage}`
                  : selectedApplicationRecord?.status
                  ? `Status: ${selectedApplicationRecord.status}`
                  : 'Active Applicant'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Applicant {selectedApplicant.applicantCode || `#${activeApplicantId}`}
              {selectedApplicationRecord?.applicationId ? ` • Application #${selectedApplicationRecord.applicationId}` : ''}
              {' • '}
              {selectedApplicationRecord?.role || selectedApplicant.role}
            </p>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-600 border border-sky-300 bg-sky-50/50 px-4 py-2 rounded-full w-fit">
            {selectedApplicationRecord?.jobOrder || selectedApplicant.jobOrder || 'Unassigned'}
          </div>
        </div>

        {/* Dynamic Estimated Date / Output Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-6 mb-8 relative overflow-hidden shadow-inner">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.15),transparent)] pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Calendar className="w-4 h-4" />
                {isDeployed ? 'Deployment Status' : 'Algorithm Deployment Forecast'}
              </div>
              <h3 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                {isDeployed ? 'Deployed' : formattedEstimate || (forecastError ? 'Forecast Unavailable' : 'ETA Unavailable')}
              </h3>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400 flex-shrink-0" />
                {isDeployed ? (
                  'Actual deployment date unavailable'
                ) : hasRecord ? (
                  `Backend timeline estimate using PERT and available SES state (${remainingDays} remaining)`
                ) : forecastResponse?.limitations && forecastResponse.limitations.length > 0 ? (
                  `Limitation: ${forecastResponse.limitations.join('; ')}`
                ) : forecastError ? (
                  `Notice: ${forecastError}`
                ) : matchingApplications.length === 0 ? (
                  'No job application available for this applicant'
                ) : matchingApplications.length > 1 && !activeApplicationId ? (
                  'Select a job application above to view estimated deployment'
                ) : (
                  'Reliable timeline forecast unavailable for this application'
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:border-l md:border-slate-700 md:pl-6 text-center">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Remaining Days
                </p>
                <p className="text-2xl font-black text-sky-400 mt-0.5">
                  {remainingDays || 'N/A'}
                </p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">Agency SES Alpha (α)</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5">
                  {forecastResponse?.record?.ses_alpha_used ?? (pipelineData?.alpha_used ?? 'N/A')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Agency Stage Baseline Table (Clearly presented as agency reference, not fake individual forecast) */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers size={16} className="text-sky-500" />
              Agency Stage-by-Stage Baseline (PERT & SES Reference)
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Baseline Pipeline Total: <strong className="text-slate-800">{(totalDays != null ? `${totalDays.toFixed(1)} days` : 'Unavailable')}</strong>
            </span>
          </div>

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
                {pipelineData?.stages?.map((stage, idx) => {
                  // Prefer explicit persisted state; legacy current_forecast can include a PERT prior.
                  const ses = stage.current_ses_forecast_days !== undefined
                    ? stage.current_ses_forecast_days
                    : stage.current_forecast;
                  const learned = stage.observation_count > 0 && ses != null && (stage.current_ses_forecast_days !== undefined || !stage.is_fallback);
                  const coldStart = stage.observation_count === 0;
                  const expanded = expandedStages.has(stage.stage_name);
                  const detailsId = `forecast-stage-details-${idx}`;
                  const days = (value: number | null | undefined) =>
                    value != null ? `${value.toFixed(2)} d` : 'Unavailable';
                  return (
                    <React.Fragment key={stage.stage_name}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={expanded ? detailsId : undefined}
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} Forecast Details for ${stage.stage_name}`}
                            onClick={() => setExpandedStages((previous) => {
                              const next = new Set(previous);
                              if (next.has(stage.stage_name)) next.delete(stage.stage_name);
                              else next.add(stage.stage_name);
                              return next;
                            })}
                            className="flex items-center gap-2 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          >
                            <ChevronDown size={14} className={`shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                            <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono">{idx + 1}</span>
                            <span>{stage.stage_name}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">{stage.observation_count ?? 'Unavailable'}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">{days(stage.pert_baseline)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sky-700 bg-sky-50/50">{learned ? days(ses) : coldStart ? 'Not learned yet' : 'Unavailable'}</td>
                        <td className="py-3 px-4 text-center">
                          <span title={stage.fallback_reason} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${learned ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {learned ? <Check size={10} /> : <Clock size={10} />}
                            {learned ? 'Learned SES' : coldStart ? 'PERT Baseline' : 'SES Unavailable'}
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr id={detailsId}>
                          <td colSpan={5} className="px-4 py-3 bg-slate-50/70">
                            <p className="font-bold text-slate-700 mb-2">Forecast Details</p>
                            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-4 gap-y-2">
                              {[
                                ['Optimistic', days(stage.optimistic)],
                                ['Most Likely', days(stage.most_likely)],
                                ['Pessimistic', days(stage.pessimistic)],
                                ['PERT Baseline', days(stage.pert_baseline)],
                                ['Current SES Forecast', learned ? days(ses) : coldStart ? 'Not learned yet' : 'Unavailable'],
                                ['Observation Count', stage.observation_count ?? 'Unavailable'],
                                ['Agency SES Alpha', pipelineData?.alpha_used ?? 'Unavailable'],
                              ].map(([label, value]) => (
                                <div key={String(label)}><dt className="text-slate-500">{label}</dt><dd className="font-mono font-semibold text-slate-800 mt-1">{value}</dd></div>
                              ))}
                            </dl>
                            {coldStart && stage.pert_baseline != null && <p className="text-amber-700 mt-3">No learned observations yet - using PERT baseline</p>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }) || (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      {backendError ? 'Stage forecast unavailable.' : loading ? 'Loading stage data from backend...' : 'No stage data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Backend Exception Penalty Weights */}
      {pipelineData?.dynamic_exceptions && pipelineData.dynamic_exceptions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            Configured Exception Penalty Weights
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Current penalty weights and observation history
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
                <p className="text-[10px] text-slate-500 mt-2">
                  {`Backend reports ${ex.observation_count} observation${ex.observation_count === 1 ? '' : 's'}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
