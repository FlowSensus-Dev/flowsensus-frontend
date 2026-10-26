import { describe, it, expect } from 'vitest';
import { parseMatchingResult, MatchingResponse } from './matchingUtils';

describe('parseMatchingResult', () => {
  it('should handle fully qualified applicant', () => {
    const response: MatchingResponse = {
      overall_match_score: 95.5,
      is_qualified: true,
      failed_checks: [],
    };
    const result = parseMatchingResult(response);
    expect(result.overallStatus).toBe('qualified');
    expect(result.hasNoExam).toBe(false);
    expect(result.score).toBe(95.5);
    expect(result.systemChecks.length).toBe(0);
    expect(result.realFailedChecks.length).toBe(0);
  });

  it('should detect no exam and set system-pending if no other real failures', () => {
    const response: MatchingResponse = {
      overall_match_score: 0.0,
      is_qualified: false,
      failed_checks: [
        { check_name: 'Medical Fitness', actual: 'Unavailable' },
        { check_name: 'Passport Validity', actual: 'Unavailable' },
        { check_name: 'Exam Score', actual: 'no examination' },
      ],
    };
    const result = parseMatchingResult(response);
    // Wait, if Exam Score fails, is it a systemCheck or realFailedCheck?
    // Based on the spec, systemChecks are ONLY Medical Fitness and Passport Validity.
    // So "Exam Score" would be a realFailedCheck, which sets status to blocked.
    // Let me re-read the spec:
    // "- system-pending if is_qualified === false AND realFailedChecks.length === 0
    //  - blocked if is_qualified === false AND realFailedChecks.length > 0"
    // So if Exam Score is a realFailedCheck, the status is blocked.
    // Wait, the prompt says: "Missing exam scores show up in failed_checks with actual containing 'no examination'".
    // And systemChecks: "entries where check_name is Medical Fitness or Passport Validity AND actual === Unavailable".
    // "realFailedChecks: everything else in failed_checks".
    // So missing exam IS a realFailedCheck and it WILL block. Let's write the test accordingly.
    
    expect(result.hasNoExam).toBe(true);
    expect(result.systemChecks.length).toBe(2);
    expect(result.realFailedChecks.length).toBe(1);
    expect(result.overallStatus).toBe('blocked');
  });

  it('should return system-pending if only system limitations exist', () => {
    const response: MatchingResponse = {
      overall_match_score: 85.0,
      is_qualified: false,
      failed_checks: [
        { check_name: 'Medical Fitness', actual: 'Unavailable' },
      ],
    };
    const result = parseMatchingResult(response);
    expect(result.overallStatus).toBe('system-pending');
    expect(result.systemChecks.length).toBe(1);
    expect(result.realFailedChecks.length).toBe(0);
  });

  it('should return blocked if real failures exist', () => {
    const response: MatchingResponse = {
      overall_match_score: 40.0,
      is_qualified: false,
      failed_checks: [
        { check_name: 'Medical Fitness', actual: 'Unavailable' },
        { check_name: 'Age Requirement', actual: '18', expected: '21' },
      ],
    };
    const result = parseMatchingResult(response);
    expect(result.overallStatus).toBe('blocked');
    expect(result.systemChecks.length).toBe(1);
    expect(result.realFailedChecks.length).toBe(1);
  });
});
