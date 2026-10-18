import { ApplicantRecord } from '../app/types';

// ── Occupational Trade Cluster Definition & Contract ──────────────────────────
export interface OccupationalClusterData {
  cluster_id?: string;
  name: string;
  roles: string[];
  certifications: string[];
  skills: string[];
  description?: string;
  ai_powered?: boolean;
  engine?: string;
}

// ── Built-in Occupational Clusters (Aligned with DMW / POEA Overseas Standards) ──
export const OCCUPATIONAL_CLUSTERS: Record<string, OccupationalClusterData> = {
  welding_metal_fabrication: {
    cluster_id: 'welding_metal_fabrication',
    name: 'Welding & Metal Fabrication',
    roles: ['welder', 'pipe welder', 'structural welder', 'smaw welder', 'gtaw welder', 'mig welder', 'tig welder', '6g welder', 'fabricator', 'metal fabricator', 'boilermaker', 'steel fitter', 'pipefitter', 'rigger'],
    skills: ['welding', 'smaw', 'gmaw', 'gtaw', 'tig welding', 'mig welding', '6g welding', 'blueprint reading', 'grinding', 'cutting', 'fitting', 'metal fabrication'],
    certifications: ['welding nc ii', 'smaw nc ii', 'gmaw nc ii', 'gtaw nc ii', 'welding nc i', 'cswip', 'aws certification'],
    description: 'Fabrication, structural assembly, and specialized pipe/plate welding across construction, shipyards, and industrial projects.',
  },
  painting_coating: {
    cluster_id: 'painting_coating',
    name: 'Painting & Surface Coating',
    roles: ['painter', 'industrial painter', 'spray painter', 'sandblaster', 'blaster painter', 'coating applicator', 'surface preparation', 'wall painter'],
    skills: ['painting', 'spray painting', 'sandblasting', 'surface preparation', 'coating', 'protective coating', 'airless spraying'],
    certifications: ['painting nc ii', 'construction painting nc ii', 'nace', 'bgas'],
    description: 'Industrial blasting, protective coatings, and commercial surface painting.',
  },
  electrical: {
    cluster_id: 'electrical',
    name: 'Electrical Installation & Maintenance',
    roles: ['electrician', 'electrical technician', 'industrial electrician', 'building electrician', 'wireman', 'electrical installer', 'lineman', 'cable jointer', 'electrical maintenance'],
    skills: ['electrical wiring', 'wiring', 'circuit', 'panel installation', 'electrical maintenance', 'troubleshooting', 'conduit bending', 'cable pulling'],
    certifications: ['electrical installation and maintenance nc ii', 'eim nc ii', 'eim nc iii', 'registered master electrician', 'rme', 'peso'],
    description: 'Residential, commercial, and industrial electrical wiring, power distribution, and equipment servicing.',
  },
  instrumentation_control: {
    cluster_id: 'instrumentation_control',
    name: 'Instrumentation & Automation',
    roles: ['instrumentation technician', 'instrument technician', 'control technician', 'automation technician', 'calibration technician', 'plc technician', 'mechatronics technician'],
    skills: ['instrument calibration', 'plc programming', 'loop checking', 'sensors', 'transmitters', 'control valves', 'automation', 'troubleshooting'],
    certifications: ['instrumentation and control servicing nc ii', 'mechatronics servicing nc ii', 'mechatronics servicing nc iii'],
    description: 'Process automation, sensors, PLC control loops, and field instrument calibration.',
  },
  plumbing_piping: {
    cluster_id: 'plumbing_piping',
    name: 'Plumbing & Piping',
    roles: ['plumber', 'pipefitter', 'pipe fitter', 'plumbing technician', 'piping installer', 'sanitary installer', 'drainage technician'],
    skills: ['plumbing', 'pipe fitting', 'piping', 'water systems', 'drainage', 'pipe threading', 'soldering', 'leak repair'],
    certifications: ['plumbing nc ii', 'plumbing nc i', 'master plumber'],
    description: 'Potable water, sewage, sanitary drainage, and structural pipe layout systems.',
  },
  carpentry_masonry_construction: {
    cluster_id: 'carpentry_masonry_construction',
    name: 'Carpentry, Masonry & Construction',
    roles: ['carpenter', 'formwork carpenter', 'finish carpenter', 'mason', 'bricklayer', 'tile setter', 'tiler', 'scaffolder', 'steel fixer', 'concrete worker', 'construction worker', 'plasterer', 'rebar worker'],
    skills: ['carpentry', 'formwork', 'masonry', 'tiling', 'scaffolding', 'concrete', 'plastering', 'rebar fixing', 'construction'],
    certifications: ['carpentry nc ii', 'masonry nc ii', 'tile setting nc ii', 'scaffolding nc ii', 'reinforcing steel fixing nc ii'],
    description: 'Civil structural trades including formwork, masonry, reinforcement steel fixing, and interior finishes.',
  },
  mechanical_maintenance: {
    cluster_id: 'mechanical_maintenance',
    name: 'Mechanical & Maintenance',
    roles: ['mechanic', 'machinist', 'maintenance technician', 'millwright', 'auto mechanic', 'diesel mechanic', 'heavy equipment mechanic', 'hvac technician', 'refrigeration technician', 'air conditioning technician', 'chiller technician'],
    skills: ['mechanical maintenance', 'machining', 'lathe', 'milling', 'hvac', 'refrigeration', 'chiller systems', 'engine repair', 'preventive maintenance'],
    certifications: ['shielded metal arc welding', 'automotive servicing nc ii', 'refrigeration and airconditioning nc ii', 'rac servicing nc ii', 'commercial rac nc iii', 'heavy equipment servicing nc ii', 'machining nc ii'],
    description: 'Mechanical plant equipment, rotating machinery, automotive engines, and commercial HVAC/refrigeration systems.',
  },
  heavy_equipment_driving: {
    cluster_id: 'heavy_equipment_driving',
    name: 'Heavy Equipment & Driving',
    roles: ['driver', 'truck driver', 'trailer truck driver', 'heavy truck driver', 'heavy equipment operator', 'forklift operator', 'crane operator', 'mobile crane operator', 'tower crane operator', 'excavator operator', 'bulldozer operator', 'bus driver', 'delivery driver', 'storekeeper'],
    skills: ['driving', 'heavy equipment operation', 'forklift', 'crane operation', 'excavator', 'bulldozer', 'logistics', 'warehousing', 'defensive driving'],
    certifications: ["professional driver's license", 'heavy equipment operation nc ii', 'forklift operator nc ii', 'driving nc ii', 'driving nc iii'],
    description: 'Earthmoving machinery, crane lifting operations, commercial fleet transport, and warehouse logistics.',
  },
  healthcare_nursing: {
    cluster_id: 'healthcare_nursing',
    name: 'Healthcare, Nursing & Medical Support',
    roles: ['staff nurse', 'registered nurse', 'nurse', 'clinic nurse', 'ward nurse', 'icu nurse', 'operating room nurse', 'er nurse', 'charge nurse', 'medical technologist', 'laboratory technician', 'radiologic technologist', 'x-ray technician', 'physical therapist', 'pharmacy technician', 'dental assistant'],
    skills: ['patient care', 'vital signs', 'phlebotomy', 'medication administration', 'infection control', 'iv therapy', 'clinical charting', 'triage', 'wound care', 'bls', 'acls', 'laboratory analysis', 'sterilization'],
    certifications: ['prc nursing license', 'registered nurse', 'prometric', 'dha', 'haad', 'scfhs', 'nclex-rn', 'bls', 'acls', 'prc medical technologist', 'prc radiologic technologist'],
    description: 'Hospital wards, intensive care, clinical diagnostic laboratories, and overseas patient medical support.',
  },
  caregiving_health_support: {
    cluster_id: 'caregiving_health_support',
    name: 'Caregiving & Health Support',
    roles: ['caregiver', 'elderly caregiver', 'nurse aide', 'nursing aide', 'health care assistant', 'healthcare worker', 'patient care assistant', 'home care aide', 'home health aide'],
    skills: ['caregiving', 'patient care', 'elderly care', 'vital signs', 'first aid', 'bedside care', 'mobility assistance', 'hygiene assistance', 'medication monitoring'],
    certifications: ['caregiving nc ii', 'health care services nc ii', 'cpr', 'first aid', 'basic life support'],
    description: 'Assisted living, residential elder care, home health assistance, and patient daily living support.',
  },
  hospitality_food_service: {
    cluster_id: 'hospitality_food_service',
    name: 'Hospitality & Food Service',
    roles: ['cook', 'chef', 'commis', 'commis chef', 'line cook', 'chef de partie', 'baker', 'pastry cook', 'waiter', 'waitress', 'bartender', 'barista', 'kitchen staff', 'kitchen steward', 'food server', 'food and beverage attendant'],
    skills: ['cooking', 'culinary', 'food preparation', 'baking', 'bartending', 'food safety', 'customer service', 'food and beverage', 'table service'],
    certifications: ['cookery nc ii', 'commercial cooking nc iii', 'bread and pastry production nc ii', 'bartending nc ii', 'food and beverage services nc ii', 'food safety', 'haccp'],
    description: 'Commercial kitchen cookery, bakery, bar service, and front-of-house hospitality operations.',
  },
  housekeeping_cleaning: {
    cluster_id: 'housekeeping_cleaning',
    name: 'Housekeeping & Cleaning',
    roles: ['housekeeper', 'cleaner', 'janitor', 'room attendant', 'hotel room attendant', 'domestic helper', 'household service worker', 'laundry attendant', 'custodian', 'nanny', 'babysitter'],
    skills: ['housekeeping', 'cleaning', 'laundry', 'sanitation', 'room preparation', 'bed making', 'child care', 'household chores'],
    certifications: ['housekeeping nc ii', 'household services nc ii', 'first aid'],
    description: 'Hotel accommodation, institutional environmental cleaning, and overseas household service work.',
  },
  factory_production: {
    cluster_id: 'factory_production',
    name: 'Factory & Production',
    roles: ['production worker', 'assembler', 'machine operator', 'packer', 'quality inspector', 'factory worker', 'line worker', 'production operator', 'electronics assembler', 'smt operator', 'semiconductor operator', 'cnc operator'],
    skills: ['assembly', 'electronics assembly', 'packing', 'quality inspection', 'production line', 'machine operation', 'smt', '5s', 'soldering'],
    certifications: ['electronics products assembly and servicing nc ii', 'mechatronics servicing nc ii', 'machining nc ii'],
    description: 'High-volume factory assembly lines, electronics manufacturing, SMT placement, and packaging.',
  },
  oil_gas_offshore: {
    cluster_id: 'oil_gas_offshore',
    name: 'Oil, Gas & Offshore Operations',
    roles: ['roustabout', 'roughneck', 'rig floorhand', 'derrickman', 'offshore rigger', 'offshore pipefitter', 'hydrojetting operator', 'tank cleaner', 'offshore scaffolder'],
    skills: ['rigging', 'drilling operations', 'pipe handling', 'confined space entry', 'h2s safety', 'hydrojetting', 'sandblasting', 'high pressure washing'],
    certifications: ['bosiet', 'huet', 'opito rigger', 'h2s awareness', 'confined space entry nc ii', 'offshore safety passport'],
    description: 'Offshore drilling platforms, refinery maintenance, and heavy rig operations.',
  },
  agriculture_farming: {
    cluster_id: 'agriculture_farming',
    name: 'Agriculture, Farming & Food Processing',
    roles: ['agricultural worker', 'greenhouse worker', 'farm worker', 'farm laborer', 'crop worker', 'livestock caretaker', 'poultry worker', 'dairy farm worker', 'fruit picker', 'butcher', 'meat cutter', 'fish processing worker'],
    skills: ['crop cultivation', 'greenhouse maintenance', 'harvesting', 'animal husbandry', 'livestock feeding', 'meat cutting', 'meat processing', 'sorting and packing'],
    certifications: ['agricultural crops production nc ii', 'animal production nc ii', 'slaughtering operations nc ii', 'food processing nc ii'],
    description: 'Overseas agricultural farms, protected greenhouses, livestock facilities, and food processing plants.',
  },
  office_admin_support: {
    cluster_id: 'office_admin_support',
    name: 'Office Administration & Clerical Support',
    roles: ['document controller', 'data entry clerk', 'administrative assistant', 'office clerk', 'site clerk', 'project clerk', 'accounting clerk', 'bookkeeper', 'customer service representative', 'call center agent', 'receptionist'],
    skills: ['data entry', 'document control', 'record keeping', 'customer service', 'microsoft office', 'typing', 'bookkeeping', 'filing', 'clerical support'],
    certifications: ['computer systems servicing nc ii', 'bookkeeping nc iii', 'civil service eligibility'],
    description: 'Project site document control, clerical office management, record administration, and customer service.',
  },
  aviation_ground_handling: {
    cluster_id: 'aviation_ground_handling',
    name: 'Aviation & Airport Ground Support',
    roles: ['ramp agent', 'aircraft ground handler', 'baggage handler', 'cargo handler', 'aircraft cabin cleaner', 'gse operator', 'ramp serviceman'],
    skills: ['ground handling', 'baggage sorting', 'aircraft marshalling', 'cargo loading', 'cabin cleaning', 'gse operation', 'airport safety'],
    certifications: ['iata dgr', 'aviation ground handling', 'airside driving permit'],
    description: 'Airport ramp operations, baggage handling, aircraft turnover cleaning, and ground support equipment.',
  },
  maritime_seabased: {
    cluster_id: 'maritime_seabased',
    name: 'Maritime & Seabased Operations',
    roles: ['seaman', 'seafarer', 'able seaman', 'ordinary seaman', 'bosun', 'oiler', 'wiper', 'ship fitter', 'ship cook', 'messman', 'deckhand'],
    skills: ['seamanship', 'navigation watch', 'cargo handling', 'engine maintenance', 'line handling', 'shipboard safety', 'ship maintenance'],
    certifications: ["stcw '95", 'stcw 2010', 'sirb', "seaman's book", 'basic training', "ship's catering nc ii"],
    description: 'Ocean-going cargo vessels, passenger ships, and deck/engine department operations.',
  },
  garments_textile: {
    cluster_id: 'garments_textile',
    name: 'Garments, Textile & Apparel',
    roles: ['sewer', 'garment sewer', 'industrial sewer', 'sewing machine operator', 'pattern maker', 'textile cutter', 'tailor', 'dressmaker', 'garment qc'],
    skills: ['industrial sewing', 'garment assembly', 'pattern cutting', 'stitching', 'fabric cutting', 'sewing machine operation', 'apparel inspection'],
    certifications: ['dressmaking nc ii', 'tailoring nc ii'],
    description: 'Industrial garment assembly, commercial apparel manufacturing, and textile finishing.',
  },
  security_services: {
    cluster_id: 'security_services',
    name: 'Security & Asset Protection',
    roles: ['security guard', 'security officer', 'guard', 'watchman', 'cctv operator', 'surveillance officer', 'access control officer'],
    skills: ['security', 'surveillance', 'patrol', 'access control', 'incident reporting', 'cctv monitoring', 'emergency response'],
    certifications: ['security guard license', 'security services nc i', 'security services nc ii', 'sosia license'],
    description: 'Commercial building protection, access control checkpoints, and CCTV security monitoring.',
  },
};

export function normalizeTokens(text: string): Set<string> {
  if (!text || typeof text !== 'string') return new Set();
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const stopwords = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'to', 'with', 'at', 'by', 'on',
    'level', 'senior', 'junior', 'lead', 'staff', 'registered', 'licensed', 'certified',
    'years', 'year', 'experience', 'required', 'preferred', 'must', 'have', 'works',
    'corp', 'inc', 'co', 'ltd', 'llc', 'center', 'hospital', 'services'
  ]);
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 1 && !stopwords.has(t));
  return new Set(tokens);
}

// Words that describe a kind/level of work but not a specific job family.
// Sharing only these (e.g. "operator") must never make two jobs look related.
const GENERIC_JOB_WORDS = new Set([
  'worker', 'operator', 'assistant', 'helper', 'technician', 'general', 'staff',
  'crew', 'personnel', 'attendant', 'officer', 'specialist', 'laborer', 'labourer',
  'skilled', 'unskilled', 'trainee', 'apprentice',
]);

/** Like normalizeTokens, but drops generic words so only job-specific words are compared. */
export function specificTokens(text: string): Set<string> {
  const out = new Set<string>();
  normalizeTokens(text).forEach((t) => {
    if (!GENERIC_JOB_WORDS.has(t)) out.add(t);
  });
  return out;
}

export function findClusterForText(text: string, clustersMap?: Record<string, any>): { id: string; data: any } | null {
  if (!text) return null;
  const activeClusters = (clustersMap && Object.keys(clustersMap).length > 0) ? clustersMap : OCCUPATIONAL_CLUSTERS;
  const textLower = text.toLowerCase().trim();
  const tokens = specificTokens(text);

  let bestMatch: { id: string; data: any; score: number } | null = null;

  for (const [clusterId, clusterData] of Object.entries(activeClusters)) {
    let score = 0;
    const clusterName = (clusterData.name || '').toLowerCase();
    if (textLower === clusterId.toLowerCase() || textLower === clusterName) {
      score = Math.max(score, 30);
    } else if (textLower.includes(clusterId) || textLower.includes(clusterName)) {
      score = Math.max(score, 15);
    }

    for (const role of (clusterData.roles || [])) {
      const rLower = String(role).toLowerCase().trim();
      if (rLower === textLower) {
        score = Math.max(score, 25);
        continue;
      }
      if (textLower.includes(rLower) || rLower.includes(textLower)) {
        score = Math.max(score, 12);
        continue;
      }
      const roleTokens = specificTokens(rLower);
      let overlapCount = 0;
      for (const t of tokens) {
        if (roleTokens.has(t)) overlapCount++;
      }
      if (overlapCount > 0) {
        score = Math.max(score, 3 + overlapCount * 2);
      }
    }

    for (const sk of (clusterData.skills || [])) {
      const skLower = String(sk).toLowerCase().trim();
      if (skLower && textLower.includes(skLower)) {
        score = Math.max(score, 8);
      }
    }

    if (score > (bestMatch?.score || 0)) {
      bestMatch = { id: clusterId, data: clusterData, score };
    }
  }

  return bestMatch ? { id: bestMatch.id, data: bestMatch.data } : null;
}

// ── Applicant Profiling Stage Detection Helper ──────────────────────────────────
// Checks if applicant is currently in the 'Applicant Profiling' stage (after passing screening and medical clearance)
export function isApplicantInProfiling(applicant: ApplicantRecord): boolean {
  if (!applicant) return false;
  const s = String(
    applicant.status ||
    (applicant as any).applicant_status ||
    (applicant as any).status_code ||
    (applicant as any).application_status ||
    ''
  ).trim().toLowerCase();
  if (s === 'medical clearance' || s === 'medical referral' || s === 'provisional' || s === 'initial screening' || s === 'applicant registration') {
    return false;
  }
  return s === 'applicant profiling' || s === 'profiling';
}

// ── Job Order Preference Mismatch Detection ────────────────────────────────────
// Detects if candidate applied for a different job order or role than the currently selected job order
export function getJobOrderMismatchInfo(applicant: ApplicantRecord, currentJobOrder: any): {
  isMismatch: boolean;
  chosenRole?: string;
  chosenJobOrder?: string;
  noticeText: string;
} | null {
  if (!currentJobOrder || !applicant) return null;

  const currentJoRealId = String(currentJobOrder.realId ?? currentJobOrder.job_order_id ?? '').trim();
  const currentJoCode = String(currentJobOrder.id ?? currentJobOrder.code ?? currentJobOrder.job_code ?? '').trim().toLowerCase();
  const currentJoPos = String(currentJobOrder.position ?? currentJobOrder.position_title ?? '').trim().toLowerCase();

  const appJoId = String((applicant as any).job_order_id || (applicant as any).jobOrderId || applicant.selectedJobOrderId || '').trim();
  const appJoCode = String(applicant.jobOrder || '').trim();
  const appRole = String(applicant.appliedPosition || applicant.appliedRole || applicant.role || '').trim();

  const hasAppJoId = Boolean(appJoId && !['undefined', 'null', '0', ''].includes(appJoId));
  const hasAppJoCode = Boolean(appJoCode && !['unassigned', 'undefined', 'null', ''].includes(appJoCode.toLowerCase()));

  // 1. Direct match check: Did candidate directly pick this job order?
  const matchesRealId = Boolean(hasAppJoId && currentJoRealId && appJoId === currentJoRealId);
  const matchesJoCode = Boolean(
    hasAppJoCode &&
    currentJoCode &&
    (appJoCode.toLowerCase() === currentJoCode ||
     appJoCode.toLowerCase().replace(/[^a-z0-9]/g, '') === currentJoCode.replace(/[^a-z0-9]/g, ''))
  );
  const matchesJobPosition = Boolean(
    hasAppJoCode &&
    currentJoPos &&
    (appJoCode.toLowerCase().includes(currentJoPos) || currentJoPos.includes(appJoCode.toLowerCase()))
  );
  const matchesRoleAndNotDifferentJo = Boolean(
    !hasAppJoId &&
    !hasAppJoCode &&
    appRole &&
    currentJoPos &&
    (appRole.toLowerCase().includes(currentJoPos) || currentJoPos.includes(appRole.toLowerCase()))
  );

  // If candidate is specifically tied to this exact job order, there is no mismatch
  if (matchesRealId || matchesJoCode || matchesJobPosition || matchesRoleAndNotDifferentJo) {
    return null;
  }

  // 2. Candidate applied for a different job order, role, or entered the general pool
  let chosenJoDisplay = '';
  if (hasAppJoCode && appJoCode.toLowerCase() !== 'unassigned') {
    chosenJoDisplay = appJoCode;
  } else if (hasAppJoId) {
    chosenJoDisplay = `Job Order #${appJoId}`;
  }

  let pickSummary = '';
  if (chosenJoDisplay && appRole && !chosenJoDisplay.toLowerCase().includes(appRole.toLowerCase())) {
    pickSummary = `${chosenJoDisplay} (${appRole})`;
  } else if (chosenJoDisplay) {
    pickSummary = chosenJoDisplay;
  } else if (appRole) {
    pickSummary = `"${appRole}"`;
  } else {
    pickSummary = 'General Talent Pool';
  }

  return {
    isMismatch: true,
    chosenRole: appRole || undefined,
    chosenJobOrder: chosenJoDisplay || undefined,
    noticeText: `Candidate applied for ${pickSummary}, which differs from this Job Order (${currentJobOrder.position || 'Current Order'}). Recommended based on compatible qualifications, but not the applicant's original selection.`,
  };
}

export interface TakenExamRecord {
  id: string;
  name: string;
  type?: string;
  scoringType: 'numeric' | 'pass_fail';
  score?: number;
  passingScore: number;
  maxScore: number;
  passed: boolean;
  statusText: string;
  weight?: number;
  isJobSpecific?: boolean;
}

export interface RankedCandidate {
  applicant: ApplicantRecord;
  rank: number;
  readinessScore: number;
  matchScore: number;
  assessmentScore: number;
  classification: 'Recommended' | 'For Further Review' | 'For Consideration' | 'Not Recommended';
  clearanceStatus: 'cleared' | 'pending_job_specific' | 'pending_general' | 'failed';
  totalExperienceYears: number;
  jobRelatedExperienceYears: number;
  considerationReason?: string;
  certificationsCount: number;
  techScore: number;
  iqScore: number;
  interviewScore: number;
  eqStatus: string;
  eqPass: boolean;
  techPass: boolean;
  iqPass: boolean;
  interviewPass: boolean;
  allGatesPass: boolean;
  hasRecordedAssessments: boolean;
  takenExams: TakenExamRecord[];
  pendingJobSpecificTestNames: string[];
  activeTestResults: Array<{
    id: string;
    name: string;
    type: string;
    scoringType: 'numeric' | 'pass_fail';
    score?: number;
    passingScore: number;
    maxScore: number;
    passed: boolean;
    statusText: string;
    isJobSpecific?: boolean;
    isPendingMandate?: boolean;
  }>;
  compliancePassed: boolean;
  complianceReasons: string[];
  failureReasons: string[];
  categoryScores: {
    roleMatch: number;
    certifications: number;
    experience: number;
    skills: number;
    overseas: number;
  };
  strengths: string[];
  gaps: string[];
  isFirstTimeApplicant: boolean;
  passportStatus: { valid: boolean; status: string; expiry?: string; daysRemaining?: number };
  nbiStatus: { valid: boolean; status: string; expiry?: string; daysRemaining?: number };
  medicalStatus: { valid: boolean; status: string; expiry?: string };
  expiredDocs: Array<{ name: string; expiry: string; type: string }>;
  genderCriteria?: { required: string; candidate: string; isMismatch: boolean; notice?: string };
  ageCriteria?: { minAge?: number; maxAge?: number; candidateAge?: number; isMismatch: boolean; notice?: string };
  jobOrderRequirementsAudit?: Array<{
    name: string;
    category: 'CERTIFICATION' | 'DOCUMENT' | 'MEDICAL' | 'OTHER';
    status: 'VERIFIED' | 'SUBMITTED' | 'PENDING' | 'MISSING';
    isSatisfied: boolean;
  }>;
}

// ── Experience Separation & Helper Functions (Item 6) ──────────────────────────

/**
 * Checks whether an applicant's past job position matches or relates to the applied trade.
 */
export function isJobRelatedExperience(
  jobPosition: string,
  targetTrade: string,
  clustersMap?: Record<string, any>
): boolean {
  if (!jobPosition || !targetTrade) return false;
  const posLower = jobPosition.toLowerCase().trim();
  const tradeLower = targetTrade.toLowerCase().trim();

  // 1. Direct or partial substring match
  if (posLower.includes(tradeLower) || tradeLower.includes(posLower)) return true;

  // 2. Token overlap & trade stem matching (e.g. "electrical" vs "electrician", "welding" vs "welder")
  const posTokens = specificTokens(posLower);
  const tradeTokens = specificTokens(tradeLower);
  for (const tt of tradeTokens) {
    if (posTokens.has(tt)) return true;
    for (const pt of posTokens) {
      if (pt.length >= 4 && tt.length >= 4 && pt.slice(0, 4) === tt.slice(0, 4)) {
        return true;
      }
    }
  }

  // 3. Trade Cluster alignment
  const targetCluster = findClusterForText(targetTrade, clustersMap);
  if (targetCluster) {
    const jobCluster = findClusterForText(jobPosition, clustersMap);
    if (jobCluster && jobCluster.id === targetCluster.id) return true;

    const clusterRoles = targetCluster.data?.roles || [];
    for (const r of clusterRoles) {
      if (posLower.includes(r.toLowerCase())) return true;
      const rTokens = specificTokens(r);
      for (const t of rTokens) {
        if (posTokens.has(t)) return true;
      }
    }
  }

  return false;
}

/**
 * Formats a duration in months into a clean human-readable label (e.g., "5 Years 2 Months", "3 Years").
 */
export function formatExperienceDuration(months: number): string {
  if (!months || months <= 0) return '0 Months';
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return `${mos} Month${mos > 1 ? 's' : ''}`;
  if (mos === 0) return `${yrs} Year${yrs > 1 ? 's' : ''}`;
  return `${yrs} Year${yrs > 1 ? 's' : ''} ${mos} Month${mos > 1 ? 's' : ''}`;
}

export interface ExperienceCalculation {
  totalMonths: number;
  totalYears: number;
  totalDisplay: string;
  jobRelatedMonths: number;
  jobRelatedYears: number;
  jobRelatedDisplay: string;
  unrelatedMonths: number;
  unrelatedYears: number;
  unrelatedDisplay: string;
  jobClassifications: Array<{ id: string | number; isRelated: boolean }>;
}

/**
 * Computes Total Work Experience vs Job-Related Experience across an employment history list.
 */
export function calculateExperienceBreakdown(
  history: any[],
  targetTrade: string,
  clustersMap?: Record<string, any>
): ExperienceCalculation {
  let totalMonths = 0;
  let jobRelatedMonths = 0;
  const jobClassifications: Array<{ id: string | number; isRelated: boolean }> = [];

  const now = new Date();

  (history || []).forEach((rec: any, idx: number) => {
    const recId = rec.id || `job-${idx}`;
    const pos = rec.position || rec.title || '';
    const isRelated = isJobRelatedExperience(pos, targetTrade, clustersMap);
    jobClassifications.push({ id: recId, isRelated });

    const startStr = rec.startDate || rec.dateStarted || '';
    const endStr = rec.endDate || rec.dateEnded || '';
    const isPresent = rec.isPresent || String(endStr).toLowerCase() === 'present';

    let months = 0;
    if (startStr) {
      const startDate = new Date(startStr);
      if (!isNaN(startDate.getTime())) {
        const endDate = isPresent || !endStr ? now : new Date(endStr);
        if (!isNaN(endDate.getTime())) {
          months = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()));
        }
      }
    }

    if (months === 0) {
      // Fallback: estimate 1 year if year is known
      const startYear = parseInt(String(startStr).slice(0, 4), 10);
      const endYear = isPresent ? now.getFullYear() : parseInt(String(endStr).slice(0, 4), 10);
      if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
        months = Math.max(12, (endYear - startYear) * 12);
      } else {
        months = 12; // 1 year baseline
      }
    }

    totalMonths += months;
    if (isRelated) {
      jobRelatedMonths += months;
    }
  });

  const unrelatedMonths = Math.max(0, totalMonths - jobRelatedMonths);
  const totalYears = Math.round((totalMonths / 12) * 10) / 10;
  const jobRelatedYears = Math.round((jobRelatedMonths / 12) * 10) / 10;
  const unrelatedYears = Math.round((unrelatedMonths / 12) * 10) / 10;

  return {
    totalMonths,
    totalYears,
    totalDisplay: formatExperienceDuration(totalMonths),
    jobRelatedMonths,
    jobRelatedYears,
    jobRelatedDisplay: targetTrade
      ? `${formatExperienceDuration(jobRelatedMonths)} as ${targetTrade}`
      : formatExperienceDuration(jobRelatedMonths),
    unrelatedMonths,
    unrelatedYears,
    unrelatedDisplay: formatExperienceDuration(unrelatedMonths),
    jobClassifications,
  };
}

// ── Admin Scoring & Category Rules Configuration (Item 4) ────────────────────
export interface ScoringCategoryWeights {
  roleMatch: number;
  certifications: number;
  experience: number;
  skills: number;
  overseas: number;
}

export interface ScoringThresholds {
  recommended: number;
  furtherReview: number;
}

export interface ScoringCategoryRules {
  weights: ScoringCategoryWeights;
  thresholds: ScoringThresholds;
  lastUpdated?: string;
  updatedBy?: string;
}

export const DEFAULT_SCORING_RULES: ScoringCategoryRules = {
  weights: {
    roleMatch: 30,
    certifications: 25,
    experience: 20,
    skills: 15,
    overseas: 10,
  },
  thresholds: {
    recommended: 90,
    furtherReview: 75,
  },
};

export function loadScoringRules(agencyId?: string | number): ScoringCategoryRules {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = `flowsensus_scoring_rules_${agencyId || 'default'}`;
      const saved = window.localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.weights && parsed.thresholds) {
          const sum =
            Number(parsed.weights.roleMatch || 0) +
            Number(parsed.weights.certifications || 0) +
            Number(parsed.weights.experience || 0) +
            Number(parsed.weights.skills || 0) +
            Number(parsed.weights.overseas || 0);
          if (sum === 100) {
            return {
              weights: {
                roleMatch: Number(parsed.weights.roleMatch),
                certifications: Number(parsed.weights.certifications),
                experience: Number(parsed.weights.experience),
                skills: Number(parsed.weights.skills),
                overseas: Number(parsed.weights.overseas),
              },
              thresholds: {
                recommended: Number(parsed.thresholds.recommended || 90),
                furtherReview: Number(parsed.thresholds.furtherReview || 75),
              },
              lastUpdated: parsed.lastUpdated,
              updatedBy: parsed.updatedBy,
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not load custom scoring rules, using defaults:', e);
  }
  return DEFAULT_SCORING_RULES;
}

export function saveScoringRules(rules: ScoringCategoryRules, agencyId?: string | number): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = `flowsensus_scoring_rules_${agencyId || 'default'}`;
      window.localStorage.setItem(key, JSON.stringify(rules));
      return true;
    }
  } catch (e) {
    console.warn('Could not save scoring rules:', e);
  }
  return false;
}

export async function fetchAgencyScoringRules(agencyId?: string | number): Promise<ScoringCategoryRules> {
  // 1. Try backend API endpoint first (authoritative multi-tenant store)
  try {
    const { api } = await import('./api');
    const res = await api.get('/matching/scoring-rules');
    if (res.data && res.data.weights && res.data.thresholds) {
      const w = res.data.weights;
      const t = res.data.thresholds;
      const rules: ScoringCategoryRules = {
        weights: {
          roleMatch: Number(w.role_match ?? w.roleMatch ?? 30),
          certifications: Number(w.certifications ?? 25),
          experience: Number(w.experience ?? 20),
          skills: Number(w.skills ?? 15),
          overseas: Number(w.overseas ?? 10),
        },
        thresholds: {
          recommended: Number(t.recommended ?? 90),
          furtherReview: Number(t.further_review ?? t.furtherReview ?? 75),
        },
        lastUpdated: res.data.last_updated || res.data.lastUpdated,
        updatedBy: res.data.updated_by || res.data.updatedBy,
      };
      saveScoringRules(rules, agencyId);
      return rules;
    }
  } catch (err) {
    // Backend offline or running in mock mode, proceed to Supabase direct
  }

  // 2. Direct Supabase query fallback
  try {
    const { supabase } = await import('./supabase');
    const targetAgencyId = Number(agencyId) || 2;
    const { data } = await supabase
      .from('agency_scoring_rule')
      .select('*')
      .eq('agency_id', targetAgencyId)
      .maybeSingle();

    if (data) {
      const rules: ScoringCategoryRules = {
        weights: {
          roleMatch: Number(data.role_match_weight ?? 30),
          certifications: Number(data.certifications_weight ?? 25),
          experience: Number(data.experience_weight ?? 20),
          skills: Number(data.skills_weight ?? 15),
          overseas: Number(data.overseas_weight ?? 10),
        },
        thresholds: {
          recommended: Number(data.recommended_threshold ?? 90),
          furtherReview: Number(data.further_review_threshold ?? 75),
        },
        lastUpdated: data.updated_at,
        updatedBy: data.updated_by,
      };
      saveScoringRules(rules, agencyId);
      return rules;
    }
  } catch (err) {
    // Proceed to local fallback
  }

  // 3. Fallback to localStorage or default rules
  return loadScoringRules(agencyId);
}

export async function saveAgencyScoringRulesRemote(
  rules: ScoringCategoryRules,
  agencyId?: string | number
): Promise<{ success: boolean; error?: string }> {
  // Always update local cache immediately
  saveScoringRules(rules, agencyId);

  // Send to backend endpoint (enforces Management/Admin authorization)
  try {
    const { api } = await import('./api');
    const payload = {
      weights: {
        roleMatch: rules.weights.roleMatch,
        certifications: rules.weights.certifications,
        experience: rules.weights.experience,
        skills: rules.weights.skills,
        overseas: rules.weights.overseas,
      },
      thresholds: {
        recommended: rules.thresholds.recommended,
        furtherReview: rules.thresholds.furtherReview,
      },
    };
    await api.put('/matching/scoring-rules', payload);
    return { success: true };
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err?.message || 'Failed to save rules to server';
    console.warn('Backend save scoring rules failed:', detail);
    return { success: false, error: detail };
  }
}


export function getCategoryCandidateExplanation(
  categoryKey: string,
  candidate: RankedCandidate,
  jobOrder: any,
  rules: ScoringCategoryRules = DEFAULT_SCORING_RULES
): string {
  const jobPos = (jobOrder?.position || '').trim();
  const jobCountry = (jobOrder?.country || '').trim();
  const minYears = Number(jobOrder?.minExperience || 1);
  const appRole = candidate.applicant.appliedRole || (candidate.applicant as any).applied_role || (candidate.applicant as any).position || 'Unspecified';
  const weights = rules.weights || DEFAULT_SCORING_RULES.weights;

  switch (categoryKey) {
    case 'roleMatch': {
      const maxW = weights.roleMatch;
      const score = candidate.categoryScores.roleMatch;
      if (score >= maxW) {
        return `Candidate applied role '${appRole}' directly matches target position '${jobPos}' : Full ${score} / ${maxW} pts awarded.`;
      } else if (score > 0) {
        return `Candidate applied role or work history aligns with target position '${jobPos}' : ${score} / ${maxW} pts awarded.`;
      } else {
        return `Candidate profile role '${appRole}' is unrelated to target position '${jobPos}' (different job family) : 0 / ${maxW} pts.`;
      }
    }
    case 'certifications': {
      const maxW = weights.certifications;
      const score = candidate.categoryScores.certifications;
      const jobCerts = Array.isArray(jobOrder?.certifications) ? jobOrder.certifications : [];
      if (jobCerts.length === 0) {
        return `Job order has no mandatory certifications specified : Full ${maxW} / ${maxW} pts baseline awarded.`;
      }
      if (score >= maxW) {
        return `Candidate holds all required certifications for ${jobPos} (${jobCerts.join(', ')}) : Full ${score} / ${maxW} pts awarded.`;
      } else if (score > 0) {
        return `Candidate holds partial or related qualifications, earning ${score} / ${maxW} pts (related credentials receive 70% matching credit).`;
      } else {
        return `Candidate missing required certifications: ${jobCerts.join(', ')} : 0 / ${maxW} pts.`;
      }
    }
    case 'experience': {
      const maxW = weights.experience;
      const score = candidate.categoryScores.experience;
      if (candidate.isFirstTimeApplicant) {
        if (score >= maxW) {
          return `First-time applicant: Verified completion of certified institutional TVET / tertiary education in related field : Full ${score} / ${maxW} pts awarded.`;
        } else if (score > 0) {
          return `First-time applicant: Secondary educational foundation verified in related field : ${score} / ${maxW} pts awarded.`;
        } else {
          return `First-time applicant: Educational preparation is in an unrelated field ('${appRole}') : ${score} / ${maxW} pts general educational credit.`;
        }
      } else {
        const totalYrs = candidate.totalExperienceYears;
        const relatedYrs = candidate.jobRelatedExperienceYears ?? candidate.totalExperienceYears;
        if (relatedYrs >= minYears + 2) {
          return `Job-Related Experience (${relatedYrs} yrs related) exceeds requirement (${minYears} yrs) by 2+ years (${totalYrs} yrs total career) : Full ${score} / ${maxW} pts awarded.`;
        } else if (relatedYrs >= minYears) {
          return `Job-Related Experience (${relatedYrs} yrs related) meets the required ${minYears} years (${totalYrs} yrs total career) : ${score} / ${maxW} pts awarded.`;
        } else if (relatedYrs > 0) {
          return `Job-Related Experience (${relatedYrs} yrs related) is below required ${minYears} years; candidate received partial experience credit plus baseline credit for background in other fields (${totalYrs} yrs total) : ${score} / ${maxW} pts.`;
        } else {
          return `Candidate's ${totalYrs} years total experience is in unrelated industries rather than '${jobPos}' (req: ${minYears} yrs related) : General workplace baseline credit ${score} / ${maxW} pts awarded.`;
        }
      }
    }
    case 'skills': {
      const maxW = weights.skills;
      const score = candidate.categoryScores.skills;
      if (score >= maxW) {
        return `Candidate profile possesses 2 or more core practical skills required for '${jobPos}' : Full ${score} / ${maxW} pts awarded.`;
      } else if (score > 0) {
        return `Candidate profile matched core practical skills for '${jobPos}' : ${score} / ${maxW} pts awarded.`;
      } else {
        return `No matching practical skills found in candidate profile for '${jobPos}' : 0 / ${maxW} pts.`;
      }
    }
    case 'overseas': {
      const maxW = weights.overseas;
      const score = candidate.categoryScores.overseas;
      if (score >= maxW) {
        return `Candidate has verified prior overseas employment in target destination (${jobCountry}) : Full ${score} / ${maxW} pts awarded.`;
      } else if (score > 0) {
        return candidate.isFirstTimeApplicant
          ? `First-time applicant neutral overseas baseline (clean record, eligible for deployment) : ${score} / ${maxW} pts awarded.`
          : `Candidate has employment experience, earning ${score} / ${maxW} pts overseas readiness.`;
      } else {
        return `No prior employment history recorded : 0 / ${maxW} pts.`;
      }
    }
    default:
      return '';
  }
}
