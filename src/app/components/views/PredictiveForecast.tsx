import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  Check,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { ApplicantRecord, ApplicationForecastResponse } from '../../types';
import { Skeleton, SkeletonBadge } from '../ui/skeleton';
import ForecastingConfiguration from './ForecastingConfiguration';
import { forecastStageDisplayLabel } from '../../../lib/pertConfiguration';
import SesCalculationBreakdown, { SimulationCalculationBreakdown } from './SesCalculationBreakdown';

interface StageForecast {
  workflow_stage_id?: number;
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

interface PipelineForecastData {
  agency_id: number;
  total_pipeline_duration_days: number;
  alpha_used: number;
  stages: StageForecast[];
}

interface SimulationStepRequest {
  applicant_id: number | string;
  workflow_stage: string;
  days_passed: number;
  prior_forecast_days: number;
  alpha: number;
  reason?: string;
  actual_penalty?: number;
  advance_stage?: boolean;
}

interface SimulationStepResponse {
  applicant_id: string;
  workflow_stage: string;
  alpha_used: number;
  base_actual_days: number;
  actual_penalty_days: number;
  adjusted_stage_forecast_days: number;
  total_actual_days: number;
  previous_stage_forecast: number;
  new_stage_forecast: number;
  exception_weight_updated: boolean;
  previous_weight_days: number | null;
  new_exception_weight: number | null;
  applicant_advanced: boolean;
  new_stage_index: number;
  total_pipeline_eta: number | null;
  math_explanation: string;
  calculation_breakdown?: SimulationCalculationBreakdown | null;
}

interface PreviewObservation {
  data: SimulationStepResponse;
  liveBasis: string;
}

type PreviewChains = Record<string, PreviewObservation[]>;

// Pipeline responses expose the effective live duration as current_forecast.
function getLiveStageForecast(stage: StageForecast): number | undefined {
  return [stage.current_forecast, stage.current_ses_forecast_days, stage.pert_baseline]
    .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function getStageLiveBasis(pipeline: PipelineForecastData, stage: StageForecast): string {
  return JSON.stringify([pipeline.agency_id, stage.workflow_stage_id, pipeline.alpha_used, getLiveStageForecast(stage)]);
}

function prunePreviewChains(chains: PreviewChains, pipeline: PipelineForecastData | null): PreviewChains {
  if (!pipeline) return chains;
  let changed = false;
  const retained: PreviewChains = {};
  for (const [stageName, history] of Object.entries(chains)) {
    const stage = pipeline.stages.find((item) => item.stage_name === stageName);
    if (stage && history.every((observation) => observation.liveBasis === getStageLiveBasis(pipeline, stage))) {
      retained[stageName] = history;
    } else changed = true;
  }
  return changed ? retained : chains;
}

function getWhatIfPipelineForecast(pipeline: PipelineForecastData | null, chains: PreviewChains): number | null {
  if (!pipeline || !pipeline.stages.some((stage) => chains[stage.stage_name]?.length)) return null;
  let total = 0;
  for (const stage of pipeline.stages) {
    const history = chains[stage.stage_name] ?? [];
    const latest = history[history.length - 1]?.data;
    const contribution = latest ? latest.new_stage_forecast : getLiveStageForecast(stage);
    if (typeof contribution !== 'number' || !Number.isFinite(contribution)) return null;
    total += contribution;
  }
  return total;
}

export function StageWhatIf({ stage, applicantId, alpha, inputId, history, liveBasis, onSuccess, onReset }: {
  stage: StageForecast;
  applicantId: string;
  alpha: number | undefined;
  inputId: string;
  history: PreviewObservation[];
  liveBasis: string;
  onSuccess: (observation: PreviewObservation) => void;
  onReset: () => void;
}) {
  const [baseDuration, setBaseDuration] = useState('');
  const [result, setResult] = useState<PreviewObservation | null>(history[history.length - 1] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const requestId = useRef(0);
  const livePrior = getLiveStageForecast(stage);
  const prior = history[history.length - 1]?.data.new_stage_forecast ?? livePrior;
  const liveStateAvailable = typeof prior === 'number' && Number.isFinite(prior) && prior >= 0 &&
    typeof alpha === 'number' && Number.isFinite(alpha) && alpha > 0 && alpha <= 1;

  useLayoutEffect(() => () => { ++requestId.current; }, []);

  const clearResult = () => { setResult(null); setError(null); };
  const validDays = (value: string) => value.trim() !== '' &&
    Number.isFinite(Number(value)) && Number(value) >= 0;

  const runPreview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (running) return;
    clearResult();
    if (!validDays(baseDuration)) {
      setError('Enter a valid hypothetical stage duration of zero or more days.');
      return;
    }
    if (!liveStateAvailable || !applicantId) {
      setError('Live stage prior and agency alpha are required. Refresh the forecast and try again.');
      return;
    }
    const currentRequest = ++requestId.current;
    const payload: SimulationStepRequest = {
      applicant_id: applicantId,
      workflow_stage: stage.stage_name,
      days_passed: Number(baseDuration),
      prior_forecast_days: prior!,
      alpha: alpha!,
      // Neutral values preserve the existing stateless simulation contract.
      actual_penalty: 0,
      reason: 'Normal Process',
      advance_stage: true,
    };
    setRunning(true);
    try {
      const { data } = await api.post<SimulationStepResponse>('/forecasting/simulate-step', payload);
      if (currentRequest !== requestId.current) return;
      if (data.applicant_id !== applicantId || data.workflow_stage !== stage.stage_name ||
        ![data.previous_stage_forecast, data.base_actual_days, data.alpha_used,
          data.new_stage_forecast, data.actual_penalty_days, data.adjusted_stage_forecast_days]
          .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
        data.alpha_used !== payload.alpha || data.previous_stage_forecast !== payload.prior_forecast_days) {
        throw new Error('Unexpected preview response.');
      }
      if (data.base_actual_days !== payload.days_passed || data.actual_penalty_days !== payload.actual_penalty ||
        data.exception_weight_updated) {
        throw new Error('Unexpected exception preview response.');
      }
      const observation: PreviewObservation = { data, liveBasis };
      onSuccess(observation);
      setResult(observation);
    } catch (err: any) {
      if (currentRequest !== requestId.current) return;
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Unable to run this preview. Please try again.');
    } finally {
      if (currentRequest === requestId.current) setRunning(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60';
  return (
    <section aria-labelledby={`${inputId}-title`} className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 id={`${inputId}-title`} className="font-bold text-slate-800">What-if Forecast</h5>
        <button type="button" disabled={running || history.length === 0}
          onClick={() => { ++requestId.current; onReset(); clearResult(); }}
          className="text-[11px] font-semibold text-sky-700 hover:underline disabled:opacity-50 disabled:no-underline">
          Reset Preview Chain
        </button>
      </div>
      <form onSubmit={runPreview} noValidate className="mt-2 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label htmlFor={`${inputId}-base`} className="block text-slate-600 mb-1">Hypothetical Stage Duration (Days)</label>
            <input id={`${inputId}-base`} type="number" min="0" step="any" value={baseDuration} disabled={running}
              onChange={(event) => { setBaseDuration(event.target.value); clearResult(); }} className={`${inputClass} sm:w-44`} />
          </div>
          <button type="submit" disabled={running || !liveStateAvailable || !applicantId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
            {running && <RefreshCw size={12} className="animate-spin" />}
            {running ? 'Running Preview...' : 'Run Preview'}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
      {result && (
        <div role="status" className="mt-3">
          <span className="inline-block rounded border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">Preview</span>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span>Prior Forecast: <strong className="font-mono">{result.data.previous_stage_forecast.toFixed(2)} d</strong></span>
            <span aria-hidden="true">&rarr;</span>
            <span>Base Duration: <strong className="font-mono">{result.data.base_actual_days.toFixed(2)} d</strong></span>
            <span aria-hidden="true">&rarr;</span>
            <span>&alpha;: <strong className="font-mono">{result.data.alpha_used}</strong></span>
            <span aria-hidden="true">&rarr;</span>
            <span>Normal What-if SES: <strong className="font-mono text-sky-700">{result.data.new_stage_forecast.toFixed(2)} d</strong></span>
          </div>
          <SesCalculationBreakdown data={result.data} />
          <p className="text-[11px] text-slate-500 mt-2">Temporary preview &bull; Not saved</p>
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <p className="font-semibold text-slate-700">What-if Stage Learning Chain</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Preview history</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1 text-slate-600 max-h-32 overflow-y-auto">
            {history.map((observation, index) => (
              <li key={index} className="font-mono">
                Prior {observation.data.previous_stage_forecast.toFixed(2)} d &rarr; Actual {observation.data.base_actual_days.toFixed(2)} d &rarr; SES {observation.data.new_stage_forecast.toFixed(2)} d
                <SesCalculationBreakdown data={observation.data} compact />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

interface PredictiveForecastProps {
  applicants?: ApplicantRecord[];
  applicantsLoaded?: boolean;
  selectedApplicantId?: string;
  globalPipelineForecast?: any;
  canEditAgencySettings?: boolean;
}

export default function PredictiveForecast({
  applicants = [],
  applicantsLoaded = true,
  selectedApplicantId = '1',
  globalPipelineForecast,
  canEditAgencySettings = false,
}: PredictiveForecastProps) {
  const [pipelineData, setPipelineData] = useState<PipelineForecastData | null>(globalPipelineForecast ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const pipelineRequestId = useRef(0);

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
  const [previewChains, setPreviewChains] = useState<PreviewChains>({});
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [lightweightApplicants, setLightweightApplicants] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const applicationsRequestId = useRef(0);

  // Unique applicants for Target Candidate selector
  const uniqueApplicants = useMemo(() => {
    const map = new Map<string, any>();
    for (const app of lightweightApplicants) {
      if (!map.has(String(app.id))) {
        map.set(String(app.id), app);
      }
    }
    return Array.from(map.values());
  }, [lightweightApplicants]);

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
    return lightweightApplicants.filter(
      (a) => String(a.id) === String(activeApplicantId) &&
        typeof a.applicationId === 'number' && Number.isSafeInteger(a.applicationId) && a.applicationId > 0
    );
  }, [lightweightApplicants, activeApplicantId]);

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


  const fetchLightweightApplications = async () => {
    const requestId = ++applicationsRequestId.current;
    setLoadingApplications(true);
    setApplicationsError(null);
    try {
      const res = await api.get('/forecasting/applications');
      if (requestId !== applicationsRequestId.current) return;
      setLightweightApplicants(res.data || []);
    } catch (err) {
      if (requestId !== applicationsRequestId.current) return;
      console.error('Failed to load forecasting applications', err);
      setApplicationsError('Unable to load forecasting applications. Use Refresh Live Forecast to retry.');
    } finally {
      if (requestId === applicationsRequestId.current) setLoadingApplications(false);
    }
  };

  const fetchPipeline = async () => {
    const requestId = ++pipelineRequestId.current;
    setLoading(true);
    setBackendError(null);
    try {
      const res = await api.get('/forecasting/pipeline');
      if (requestId !== pipelineRequestId.current) return;
      setPipelineData(res.data);
      return true;
    } catch (err: any) {
      if (requestId !== pipelineRequestId.current) return;
      console.error('Failed to fetch forecasting data from backend:', err);
      setBackendError(
        err.response?.data?.detail || err.message || 'Could not connect to FastAPI backend.'
      );
      return false;
    } finally {
      if (requestId === pipelineRequestId.current) setLoading(false);
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
      return true;
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
      return false;
    } finally {
      if (requestId === forecastRequestId.current) setLoadingApplicant(false);
    }
  };

  useEffect(() => {
    // The login cache is initial display data only. Every visit checks live values.
    void fetchPipeline();
    void fetchLightweightApplications();
    return () => {
      ++pipelineRequestId.current;
      ++applicationsRequestId.current;
    };
  }, []);

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

  // Compare live primitive basis values; identical polling preserves both histories.
  const activePreviewChains = prunePreviewChains(previewChains, pipelineData);
  const whatIfPipelineForecast = getWhatIfPipelineForecast(pipelineData, activePreviewChains);
  useLayoutEffect(() => {
    setPreviewChains((previous) => prunePreviewChains(previous, pipelineData));
  }, [pipelineData]);

  useLayoutEffect(() => {
    setPreviewChains({});
    setPreviewEpoch((previous) => previous + 1);
  }, [activeApplicantId, activeApplicationId, pipelineData?.agency_id]);

  const handleRefresh = () => {
    void fetchLightweightApplications();
    setPreviewChains({});
    setPreviewEpoch((previous) => previous + 1);
    void fetchPipeline();
    if (activeApplicationId) {
      fetchApplicationForecast(activeApplicationId);
    }
  };

  const refreshAfterSettings = async () => {
    setPreviewChains({});
    setPreviewEpoch((previous) => previous + 1);
    const results = await Promise.all([
      fetchPipeline(),
      ...(activeApplicationId ? [fetchApplicationForecast(activeApplicationId)] : []),
    ]);
    if (results.some((result) => result === false)) throw new Error('Forecast refresh failed');
  };

  const configuration = <ForecastingConfiguration canEdit={canEditAgencySettings} onAlphaSaved={refreshAfterSettings} />;
  const refreshButton = <button
    onClick={handleRefresh}
    disabled={loading || loadingApplicant || loadingApplications}
    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
  >
    <RefreshCw size={14} className={loading || loadingApplicant || loadingApplications ? 'animate-spin text-sky-500' : ''} />
    <span>Refresh Live Forecast</span>
  </button>;

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

  const baselineRemainingDays = useMemo(() => {
    const stages = pipelineData?.stages ?? [];
    if (stages.length === 0) return null;

    const currentIndex = forecastResponse?.current_stage_index ?? 0;

    let total = 0;
    for (const stage of stages.slice(currentIndex)) {
      const stageForecast = getLiveStageForecast(stage);
      if (stageForecast == null) return null;
      total += stageForecast;
    }
    return total;
  }, [pipelineData, forecastResponse?.current_stage_index]);

  const usingBaselineFallback = !remainingDays && baselineRemainingDays !== null;

  const visibleLimitations = (forecastResponse?.limitations ?? []).filter((limitation) =>
    !(usingBaselineFallback && limitation.trim().replace(/\.$/, '').toLowerCase() ===
      'active-stage start timestamp is unavailable; remaining eta cannot be calculated')
  );

  if ((!applicantsLoaded || loadingApplications) && lightweightApplicants.length === 0) {
    return (
      <div role="status" aria-label="Loading forecasting applications" className="space-y-6 w-full">
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
      <div className="space-y-6"><div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">Predictive Timeline Forecast</h2>
        {applicationsError
          ? <p role="alert" className="text-sm text-rose-700">{applicationsError}</p>
          : <p className="text-sm text-slate-500">No applicants are available to forecast.</p>}
        {refreshButton}
      </div>{configuration}</div>
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

        {refreshButton}
      </div>

      {applicationsError && <p role="alert" className="text-sm text-rose-700">{applicationsError}</p>}

      {/* Live Backend Connection Status Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${backendError
          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
          : 'bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent border-emerald-300/40 text-slate-800'
          }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${backendError ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
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
            Current Pipeline Forecast: <strong>{(totalDays != null ? `${totalDays.toFixed(1)} days` : 'Unavailable')}</strong>
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
                  Current Stage: {forecastStageDisplayLabel(forecastResponse.current_stage)}
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

        {visibleLimitations.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Forecast Limitations</p>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                {visibleLimitations.map((lim, i) => (
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

        {/* Authoritative application phase and separate live/preview pipeline metrics */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-6 mb-8 relative overflow-hidden shadow-inner">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.15),transparent)] pointer-events-none" />
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
              Current Phase: {forecastResponse?.current_stage ? forecastStageDisplayLabel(forecastResponse.current_stage) : (loadingApplicant ? 'Loading...' : 'Unavailable')}
            </h3>
            {formattedEstimate && (
              <p className="text-xs text-slate-300 mt-2 flex items-center gap-1.5">
                <Calendar size={14} className="text-amber-400 shrink-0" />
                Estimated Deployment: {formattedEstimate}
              </p>
            )}
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-4 mb-2">Pipeline Forecast &middot; All Stages</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">Current Forecast</p>
                <p className="text-2xl font-black text-white mt-0.5">{totalDays != null ? `${totalDays.toFixed(1)} d` : 'Unavailable'}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">What-if Forecast {whatIfPipelineForecast != null && <span className="ml-1 text-sky-300">Preview</span>}</p>
                <p className="text-2xl font-black text-sky-400 mt-0.5">{whatIfPipelineForecast != null ? `${whatIfPipelineForecast.toFixed(1)} d` : 'Not run'}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400">Agency SES Alpha</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5">{pipelineData?.alpha_used ?? 'Unavailable'}</p>
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
              Current Pipeline Forecast Total: <strong className="text-slate-800">{(totalDays != null ? `${totalDays.toFixed(1)} days` : 'Unavailable')}</strong>
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
                  // current_forecast is the pipeline's effective duration; counts distinguish learned SES from PERT.
                  const ses = stage.current_forecast ?? stage.current_ses_forecast_days;
                  const learned = stage.observation_count > 0 && ses != null && (stage.current_ses_forecast_days !== undefined || !stage.is_fallback);
                  const coldStart = stage.observation_count === 0;
                  const expanded = expandedStages.has(stage.stage_name);
                  const detailsId = `forecast-stage-details-${idx}`;
                  const liveBasis = getStageLiveBasis(pipelineData!, stage);
                  const stageHistory = activePreviewChains[stage.stage_name] ?? [];
                  const latestPreview = stageHistory[stageHistory.length - 1]?.data;
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
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} Forecast Details for ${forecastStageDisplayLabel(stage.stage_name)}`}
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
                            <span>{forecastStageDisplayLabel(stage.stage_name)}</span>
                          </button>
                          {latestPreview && (
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-normal text-slate-600">
                              <span>Live: <strong className="font-mono">{days(getLiveStageForecast(stage))}</strong></span>
                              <span>Normal What-if: <strong className="font-mono text-sky-700">{days(latestPreview.new_stage_forecast)}</strong></span>
                            </div>
                          )}
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
                            <StageWhatIf
                              key={JSON.stringify([previewEpoch, activeApplicantId, activeApplicationId, liveBasis])}
                              stage={stage}
                              applicantId={activeApplicantId}
                              alpha={pipelineData?.alpha_used}
                              inputId={`stage-what-if-${idx}`}
                              history={stageHistory}
                              liveBasis={liveBasis}
                              onSuccess={(observation) => setPreviewChains((previous) => ({
                                ...previous,
                                [stage.stage_name]: [...(previous[stage.stage_name] ?? []), observation],
                              }))}
                              onReset={() => setPreviewChains((previous) => ({
                                ...previous,
                                [stage.stage_name]: [],
                              }))}
                            />
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

      {configuration}
    </div>
  );
}
