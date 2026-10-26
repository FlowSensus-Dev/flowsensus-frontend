import { EvaluationTest } from '../types';

export const EXAM_CATEGORIES = [
  'General Knowledge',
  'Language Proficiency',
  'IQ / Aptitude',
  'Trade & Technical Skills',
  'Personality / EQ',
  'Medical & Safety',
  'Interview',
  'Custom / Other',
] as const;

export type ExamCategory = typeof EXAM_CATEGORIES[number];

export function evalTypeToExamCategory(testType: EvaluationTest['type'] | string): string {
  const norm = (testType || '').toLowerCase().trim();
  switch (norm) {
    case 'general':
      return 'General Knowledge';
    case 'language':
      return 'Language Proficiency';
    case 'iq':
      return 'IQ / Aptitude';
    case 'skills':
      return 'Trade & Technical Skills';
    case 'eq':
      return 'Personality / EQ';
    case 'medical':
      return 'Medical & Safety';
    case 'interview':
      return 'Interview';
    case 'custom':
    default:
      return 'Custom / Other';
  }
}

export function examCategoryToEvalType(category: string): EvaluationTest['type'] {
  const norm = (category || '').toLowerCase().trim();
  if (norm.includes('general')) return 'general';
  if (norm.includes('english') || norm.includes('language')) return 'language';
  if (norm.includes('iq') || norm.includes('aptitude') || norm.includes('cognitive')) return 'iq';
  if (norm.includes('skill') || norm.includes('trade') || norm.includes('technical')) return 'skills';
  if (norm.includes('eq') || norm.includes('personality')) return 'eq';
  if (norm.includes('medical') || norm.includes('safety') || norm.includes('health')) return 'medical';
  if (norm.includes('interview')) return 'interview';
  return 'custom';
}
