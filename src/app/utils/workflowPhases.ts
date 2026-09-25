import { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkflowPhase } from '../types';

export interface WorkflowPhaseConfig extends WorkflowPhase {
  shortTitle: string;
  color: string;
  bg: string;
  border: string;
  defaultPhaseNumber: number;
  statuses: string[];
}

export const DEFAULT_WORKFLOW_PHASES: WorkflowPhaseConfig[] = [
  {
    id: 'ph-001',
    defaultPhaseNumber: 1,
    phaseNumber: 1,
    name: 'Registration & Document Collection',
    shortTitle: 'Registration',
    description: 'Applicant submits personal information and required employment documents. Recruitment staff verifies completeness.',
    responsibleRole: 'Recruitment',
    isActive: true,
    requiredDocuments: ['req-001', 'req-002', 'req-003', 'req-004'],
    requiredEvaluations: [],
    autoAdvance: false,
    color: '#0EA5E9',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    statuses: [
      'registration & screening',
      'registration',
      'registered',
      'registration & document collection',
      'draft',
      'pending'
    ],
  },
  {
    id: 'ph-002',
    defaultPhaseNumber: 2,
    phaseNumber: 2,
    name: 'Screening & Evaluation',
    shortTitle: 'Screening',
    description: 'Applicant undergoes all active evaluation tests. Recruitment staff records scores and computes weighted final verdict.',
    responsibleRole: 'Recruitment',
    isActive: true,
    requiredDocuments: [],
    requiredEvaluations: ['ev-001', 'ev-002', 'ev-003', 'ev-004', 'ev-005'],
    autoAdvance: false,
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    statuses: [
      'screening',
      'screening & evaluation',
      'initial screening',
      'pending_screening',
      'provisional',
      'awaiting interview',
      'awaiting_interview',
      'passed interview',
      'passed_interview'
    ],
  },
  {
    id: 'ph-003',
    defaultPhaseNumber: 3,
    phaseNumber: 3,
    name: 'Medical Clearance',
    shortTitle: 'Medical',
    description: 'Admin validates pre-employment medical examination results from a DOH-accredited clinic.',
    responsibleRole: 'Admin',
    isActive: true,
    requiredDocuments: ['req-007'],
    requiredEvaluations: [],
    autoAdvance: false,
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    statuses: [
      'medical clearance',
      'medical',
      'fit to work',
      'fit-to-work',
      'awaiting medical',
      'clinic examination'
    ],
  },
  {
    id: 'ph-004',
    defaultPhaseNumber: 4,
    phaseNumber: 4,
    name: 'CV Encoding & Management Approval',
    shortTitle: 'CV Encoding',
    description: "Recruitment staff encodes the applicant's CV. CV Readiness Engine scores profile. Management approves for employer submission.",
    responsibleRole: 'Management',
    isActive: true,
    requiredDocuments: [],
    requiredEvaluations: [],
    autoAdvance: false,
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    statuses: [
      'cv encoding',
      'cv encoding & management approval',
      'pending manager approval',
      'management approved',
      'cv ready',
      'cv review'
    ],
  },
  {
    id: 'ph-005',
    defaultPhaseNumber: 5,
    phaseNumber: 5,
    name: 'Employer Endorsement',
    shortTitle: 'Endorsement',
    description: 'CV submitted to foreign employer. Endorsement tracking records employer selection, interview schedule, and approval.',
    responsibleRole: 'Management',
    isActive: true,
    requiredDocuments: [],
    requiredEvaluations: [],
    autoAdvance: false,
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    statuses: [
      'employer endorsement',
      'employer review',
      'interview scheduled',
      'endorsed',
      'selected'
    ],
  },
  {
    id: 'ph-006',
    defaultPhaseNumber: 6,
    phaseNumber: 6,
    name: 'Final Deployment Processing',
    shortTitle: 'Deployment',
    description: 'Admin completes OCR document verification, expense tracking, visa processing, and departure clearance.',
    responsibleRole: 'Admin',
    isActive: true,
    requiredDocuments: [],
    requiredEvaluations: [],
    autoAdvance: false,
    color: '#EC4899',
    bg: '#FDF2F8',
    border: '#FBCFE8',
    statuses: [
      'final deployment processing',
      'final deployment',
      'visa processing',
      'departure clearance',
      'deployed',
      'pre-departure'
    ],
  },
];

export interface ComputedWorkflowPhase extends WorkflowPhaseConfig {
  adjustedPhaseNumber: number | null; // Sequential index 1, 2, 3... among enabled phases, or null if disabled
}

export function computeWorkflowPhases(phases: WorkflowPhaseConfig[]): ComputedWorkflowPhase[] {
  let activeIndex = 1;
  return phases.map((phase) => {
    if (phase.isActive) {
      return {
        ...phase,
        adjustedPhaseNumber: activeIndex++,
      };
    }
    return {
      ...phase,
      adjustedPhaseNumber: null,
    };
  });
}

export function resolveApplicantPhase(
  applicant: { phase?: number; status?: string; isStopped?: boolean },
  computedPhases: ComputedWorkflowPhase[]
): {
  phaseId: string;
  name: string;
  shortTitle: string;
  description: string;
  displayPhaseNumber: number | null;
  color: string;
  bg: string;
  border: string;
  isStopped: boolean;
  isActive: boolean;
} {
  if (applicant.isStopped) {
    return {
      phaseId: 'stopped',
      name: 'Process Stopped',
      shortTitle: 'Stopped',
      description: 'Application process halted permanently.',
      displayPhaseNumber: null,
      color: '#EF4444',
      bg: '#FEF2F2',
      border: '#FECACA',
      isStopped: true,
      isActive: true,
    };
  }

  const statusLower = (applicant.status || '').toLowerCase().trim();

  // 1. Try to match by known status
  let matched = computedPhases.find((p) =>
    p.statuses.some((s) => statusLower.includes(s) || s.includes(statusLower))
  );

  // 2. If not found by status string, match by original default phase number (1-6)
  if (!matched && typeof applicant.phase === 'number') {
    matched = computedPhases.find((p) => p.defaultPhaseNumber === applicant.phase);
  }

  // 3. Fallback to first phase
  if (!matched) {
    matched = computedPhases[0] || computeWorkflowPhases(DEFAULT_WORKFLOW_PHASES)[0];
  }

  return {
    phaseId: matched.id,
    name: matched.name,
    shortTitle: matched.shortTitle,
    description: matched.description,
    displayPhaseNumber: matched.adjustedPhaseNumber,
    color: matched.color,
    bg: matched.bg,
    border: matched.border,
    isStopped: false,
    isActive: matched.isActive,
  };
}

const STORAGE_KEY = 'flowsensus_workflow_phases';
const UPDATE_EVENT = 'flowsensus_workflow_phases_updated';

export function getStoredWorkflowPhases(): WorkflowPhaseConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return DEFAULT_WORKFLOW_PHASES.map((def) => {
          const found = parsed.find((p: any) => p.id === def.id || p.name === def.name);
          return found ? { ...def, ...found } : def;
        });
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored workflow phases', e);
  }
  return DEFAULT_WORKFLOW_PHASES;
}

export function saveStoredWorkflowPhases(phases: WorkflowPhaseConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phases));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: phases }));
  } catch (e) {
    console.warn('Failed to save workflow phases', e);
  }
}

export function useWorkflowPhases() {
  const [phases, setPhases] = useState<WorkflowPhaseConfig[]>(getStoredWorkflowPhases);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setPhases(e.detail);
      } else {
        setPhases(getStoredWorkflowPhases());
      }
    };
    window.addEventListener(UPDATE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(UPDATE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const updatePhases = useCallback((newPhases: WorkflowPhaseConfig[]) => {
    setPhases(newPhases);
    saveStoredWorkflowPhases(newPhases);
  }, []);

  const computedPhases = useMemo(() => computeWorkflowPhases(phases), [phases]);

  return {
    phases,
    computedPhases,
    updatePhases,
  };
}
