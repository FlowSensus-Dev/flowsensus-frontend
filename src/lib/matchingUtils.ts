export interface FailedCheck {
  check_name: string;
  actual: string;
  expected?: string;
  details?: string;
}

export interface MatchingResponse {
  overall_match_score: number;
  is_qualified: boolean;
  failed_checks?: FailedCheck[];
  passed_checks?: any[];
  blocking_reasons?: string[];
  status?: string;
  cv_unlocked?: boolean;
}

export interface ParsedMatchingResult {
  hasNoExam: boolean;
  systemChecks: FailedCheck[];
  realFailedChecks: FailedCheck[];
  overallStatus: 'qualified' | 'system-pending' | 'blocked';
  score: number;
}

export function parseMatchingResult(response: MatchingResponse): ParsedMatchingResult {
  const failed_checks = response.failed_checks || [];
  
  const hasNoExam = failed_checks.some(
    (check) => check.check_name.includes('Score') && check.actual.includes('no examination')
  );

  const systemChecks = failed_checks.filter(
    (check) =>
      (check.check_name === 'Medical Fitness' || check.check_name === 'Passport Validity') &&
      check.actual === 'Unavailable'
  );

  const realFailedChecks = failed_checks.filter(
    (check) =>
      !((check.check_name === 'Medical Fitness' || check.check_name === 'Passport Validity') &&
        check.actual === 'Unavailable')
  );

  let overallStatus: 'qualified' | 'system-pending' | 'blocked';
  if (response.is_qualified) {
    overallStatus = 'qualified';
  } else if (realFailedChecks.length === 0) {
    overallStatus = 'system-pending';
  } else {
    overallStatus = 'blocked';
  }

  return {
    hasNoExam,
    systemChecks,
    realFailedChecks,
    overallStatus,
    score: response.overall_match_score != null ? response.overall_match_score : 0.0,
  };
}
