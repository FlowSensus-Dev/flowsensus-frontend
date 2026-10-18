import { describe, it, expect, beforeEach } from 'vitest';
import {
  isJobRelatedExperience,
  formatExperienceDuration,
  calculateExperienceBreakdown,
  DEFAULT_SCORING_RULES,
  loadScoringRules,
  saveScoringRules,
  getCategoryCandidateExplanation,
  ScoringCategoryRules,
} from './profilingUtils';


describe('Experience Separation (Item 6)', () => {
  it('correctly detects job-related positions matching target trade', () => {
    // Substring & Token matching
    expect(isJobRelatedExperience('Senior Electrician', 'Electrician')).toBe(true);
    expect(isJobRelatedExperience('Electrical Technician', 'Electrician')).toBe(true);
    expect(isJobRelatedExperience('Pipe Fitter Lead', 'Pipefitter')).toBe(true);
    expect(isJobRelatedExperience('Master Welder', 'SMAW Welder')).toBe(true);

    // Unrelated positions
    expect(isJobRelatedExperience('Fast Food Cashier', 'Electrician')).toBe(false);
    expect(isJobRelatedExperience('Barista', 'Heavy Equipment Operator')).toBe(false);
    expect(isJobRelatedExperience('Administrative Assistant', 'Plumber')).toBe(false);
  });

  it('formats experience duration into human-readable years and months', () => {
    expect(formatExperienceDuration(0)).toBe('0 Months');
    expect(formatExperienceDuration(6)).toBe('6 Months');
    expect(formatExperienceDuration(12)).toBe('1 Year');
    expect(formatExperienceDuration(24)).toBe('2 Years');
    expect(formatExperienceDuration(38)).toBe('3 Years 2 Months');
  });

  it('calculates total work experience vs job-related experience cleanly', () => {
    const history = [
      {
        id: 'job-1',
        company: 'Apex Electric',
        position: 'Journeyman Electrician',
        startDate: '2021-01-01',
        endDate: '2023-01-01', // 24 months = 2 years
        isPresent: false,
      },
      {
        id: 'job-2',
        company: 'Burger Hub',
        position: 'Service Crew / Cashier',
        startDate: '2018-01-01',
        endDate: '2020-01-01', // 24 months = 2 years
        isPresent: false,
      },
    ];

    const breakdown = calculateExperienceBreakdown(history, 'Electrician');

    // Total should be 48 months (4 years)
    expect(breakdown.totalMonths).toBe(48);
    expect(breakdown.totalYears).toBe(4);
    expect(breakdown.totalDisplay).toBe('4 Years');

    // Job-related should be 24 months (2 years)
    expect(breakdown.jobRelatedMonths).toBe(24);
    expect(breakdown.jobRelatedYears).toBe(2);
    expect(breakdown.jobRelatedDisplay).toContain('2 Years as Electrician');

    // Unrelated should be 24 months (2 years)
    expect(breakdown.unrelatedMonths).toBe(24);
    expect(breakdown.unrelatedYears).toBe(2);

    // Verify per-job flags
    expect(breakdown.jobClassifications).toEqual([
      { id: 'job-1', isRelated: true },
      { id: 'job-2', isRelated: false },
    ]);
  });
});

describe('Admin Scoring & Category Rules Configuration (Item 4)', () => {
  const storageMap: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => storageMap[key] || null,
    setItem: (key: string, val: string) => {
      storageMap[key] = String(val);
    },
    removeItem: (key: string) => {
      delete storageMap[key];
    },
    clear: () => {
      Object.keys(storageMap).forEach((k) => delete storageMap[k]);
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    (globalThis as any).window = {
      localStorage: mockLocalStorage,
    };
  });

  it('DEFAULT_SCORING_RULES defaults to standard 30/25/20/15/10 weights totaling 100 points and 90%/75% thresholds', () => {
    const weights = DEFAULT_SCORING_RULES.weights;
    expect(weights.roleMatch).toBe(30);
    expect(weights.certifications).toBe(25);
    expect(weights.experience).toBe(20);
    expect(weights.skills).toBe(15);
    expect(weights.overseas).toBe(10);

    const totalPoints =
      weights.roleMatch +
      weights.certifications +
      weights.experience +
      weights.skills +
      weights.overseas;
    expect(totalPoints).toBe(100);

    expect(DEFAULT_SCORING_RULES.thresholds.recommended).toBe(90);
    expect(DEFAULT_SCORING_RULES.thresholds.furtherReview).toBe(75);
  });

  it('loadScoringRules returns default rules when no stored configuration exists', () => {
    mockLocalStorage.clear();
    const rules = loadScoringRules('test-agency');
    expect(rules).toEqual(DEFAULT_SCORING_RULES);
  });

  it('loadScoringRules falls back to defaults if stored weights do not sum to 100 points', () => {
    mockLocalStorage.setItem(
      'flowsensus_scoring_rules_test-agency',
      JSON.stringify({
        weights: {
          roleMatch: 30,
          certifications: 25,
          experience: 20,
          skills: 15,
          overseas: 5, // sums to 95, not 100
        },
        thresholds: {
          recommended: 90,
          furtherReview: 75,
        },
      })
    );

    const rules = loadScoringRules('test-agency');
    expect(rules).toEqual(DEFAULT_SCORING_RULES);
  });


  it('saveScoringRules and loadScoringRules persist and retrieve custom category rules', () => {
    const customRules: ScoringCategoryRules = {
      weights: {
        roleMatch: 40,
        certifications: 20,
        experience: 20,
        skills: 10,
        overseas: 10,
      },
      thresholds: {
        recommended: 85,
        furtherReview: 70,
      },
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Test Recruiter',
    };

    const saved = saveScoringRules(customRules, 'test-agency-2');
    expect(saved).toBe(true);

    const loaded = loadScoringRules('test-agency-2');
    expect(loaded.weights.roleMatch).toBe(40);
    expect(loaded.weights.certifications).toBe(20);
    expect(loaded.thresholds.recommended).toBe(85);
    expect(loaded.thresholds.furtherReview).toBe(70);
  });

  it('getCategoryCandidateExplanation formats dynamic max points based on active scoring rules', () => {
    const mockCandidate: any = {
      applicant: {
        id: 101,
        name: 'Juan Dela Cruz',
        appliedRole: 'Electrician',
      },
      categoryScores: {
        roleMatch: 40,
        certifications: 20,
        experience: 20,
        skills: 10,
        overseas: 10,
      },
      isFirstTimeApplicant: false,
      totalExperienceYears: 5,
      jobRelatedExperienceYears: 5,
    };

    const mockJobOrder = {
      position: 'Electrician',
      country: 'Saudi Arabia',
      minExperience: 3,
      certifications: ['TESDA NC II Electrician'],
    };

    const customRules: ScoringCategoryRules = {
      weights: {
        roleMatch: 40,
        certifications: 20,
        experience: 20,
        skills: 10,
        overseas: 10,
      },
      thresholds: {
        recommended: 85,
        furtherReview: 70,
      },
    };

    // Role Match explanation with custom 40 pt weight
    const roleExpl = getCategoryCandidateExplanation('roleMatch', mockCandidate, mockJobOrder, customRules);
    expect(roleExpl).toContain('40 / 40 pts awarded');

    // Experience explanation with custom 20 pt weight
    const expExpl = getCategoryCandidateExplanation('experience', mockCandidate, mockJobOrder, customRules);
    expect(expExpl).toContain('20 / 20 pts awarded');
  });
});

