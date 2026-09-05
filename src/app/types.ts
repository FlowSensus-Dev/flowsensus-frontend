export type UserRole = 'Recruitment' | 'Admin' | 'Accounting' | 'Management' | 'Applicant' | 'Employer' | '';

export interface WorkflowState {
  screeningPassed: boolean;
  medicalCleared: boolean;
  cvApproved: boolean;
  employerAccepted: boolean;
}

export interface ApplicantRecord {
  id: string;
  applicant_id?: number | string;
  agency_id?: number;
  country_id?: number | null;
  employer_id?: number | null;
  name: string;
  firstName?: string;
  first_name?: string;
  middleName?: string;
  middle_name?: string;
  lastName?: string;
  last_name?: string;
  role: string;
  jobOrder: string;
  phase: number;
  status: string;
  application_status?: string;
  currentHandler: string;
  currentDepartment: string;
  lastUpdated: string;
  phaseDescription: string;

  // Personal Information
  presentAddress?: string;
  provincialAddress?: string;
  email?: string;
  contact?: string;
  dateOfBirth?: string;
  birth_date?: string;
  passport_number?: string;
  is_deleted?: boolean;
  placeOfBirth?: string;
  age?: number;
  sex?: 'Male' | 'Female';
  civilStatus?: 'Single' | 'Married' | 'Widowed' | 'Separated';
  citizenship?: string;
  religion?: string;
  height?: string;
  weight?: string;
  languagesSpoken?: string[];

  // Skills and Qualifications
  skills?: string[];
  certifications?: string[];

  // Work Experience (legacy)
  workExperience?: WorkExperience[];

  // New structured profile fields
  photoDataUrl?: string;
  identifications?: IdentificationRecord[];
  education?: EducationRecord[];
  certificateRecords?: CertificateRecord[];
  trainings?: TrainingRecord[];
  languageRecords?: LanguageRecord[];
  employmentHistory?: EmploymentRecord[];
  employmentFlags?: EmploymentFlag[];

  // Selected job order
  selectedJobOrderId?: string;

  // Stop / Reject processing
  isStopped?: boolean;
  stoppedReason?: string;
  stoppedBy?: string;
  stoppedAt?: string;
  stoppedPhase?: number;

  // System fields
  address?: string;
  documents?: DocumentRecord[];
  expenses?: ExpenseRecord[];
  testScores?: TestScores;
  matchScore?: number;
  matchReasons?: string[];
}

export interface WorkExperience {
  companyName: string;
  position: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
  country?: string;
  isOverseas?: boolean;
}

export interface IdentificationRecord {
  id: string;
  type: string;
  identificationNo: string;
  expiryDate: string;
  proofDocumentUrl?: string;
  proofDocumentName?: string;
}

export interface EducationRecord {
  id: string;
  level: string;
  school: string;
  course: string;
  yearGraduated: string;
}

export interface CertificateRecord {
  id: string;
  title: string;
  serialNo: string;
  issuedBy: string;
  noOfHours: string;
  competencyDateIssued: string;
  expiryDate: string;
  proofDocumentUrl?: string;
  proofDocumentName?: string;
}

export interface TrainingRecord {
  id: string;
  trainingName: string;
  certNo: string;
  duration: string;
  noOfHours: string;
  conductedBy: string;
  skillsAcquired: string;
  proofDocumentUrl?: string;
  proofDocumentName?: string;
}

export interface LanguageRecord {
  id: string;
  language: string;
  competency: string;
  spokenRating: number;
  writtenRating: number;
}

export interface EmploymentRecord {
  id: string;
  company: string;
  position: string;
  dateStarted: string;
  dateEnded: string;
  country: string;
  isPresent: boolean;
  reasonForLeaving: string;
}

export type EmploymentFlagType = 'gap' | 'short_stint' | 'red_flag_resignation' | 'overlap' | 'demotion';

export interface EmploymentFlag {
  id: string;
  type: EmploymentFlagType;
  severity: 'warning' | 'critical';
  description: string;
  relatedJobIds: string[];
  dismissed: boolean;
  dismissedBy?: string;
  dismissalReason?: string;
  dismissedAt?: string;
  // Validation (second-level confirmation with evidence)
  validated?: boolean;
  validatedBy?: string;
  validationReason?: string;
  validatedAt?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  issueDate: string;
  expiryDate: string;
  status: 'verified' | 'pending' | 'flagged' | 'expired';
  ocrData?: any;
  uploadedBy: string;
  uploadedDate: string;
}

export interface ExpenseRecord {
  id: string;
  applicantId: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
  category: 'processing_fee' | 'visa' | 'medical' | 'cash_advance' | 'other';
}

export interface TestScores {
  englishProficiency: number; // Out of 100
  tradeSkills: number; // Out of 100
  iqAptitude: number; // Out of 100
  personalityEQ: 'Suitable' | 'Not Suitable' | 'Pending'; // Assessment result
  employerSpecific?: string; // Optional employer-specific test notes
}

export interface JobOrder {
  id: string;
  code: string;
  position: string;
  country: string;
  employerId: string;
  employerName: string;
  slots: number;
  filledSlots: number;
  salaryRange: string;
  contractDuration: string;
  requirements: string[];
  minExperience: number;
  certifications: string[];
  status: 'open' | 'closed' | 'filled' | 'pending';
  datePosted: string;
  deadline: string;
  notes: string;
}

export interface EmployerProfile {
  id: string;
  companyName: string;
  country: string;
  industry: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  website?: string;
  accreditationNo: string;
  accreditationExpiry: string;
  status: 'active' | 'blacklisted' | 'suspended' | 'pending';
  rating: 1 | 2 | 3 | 4 | 5;
  totalDeployed: number;
  activeJobOrders: number;
  remarks: EmployerRemark[];
  createdAt: string;
}

export interface EmployerRemark {
  id: string;
  date: string;
  author: string;
  category: 'positive' | 'negative' | 'neutral' | 'complaint' | 'commendation';
  content: string;
}

export const JOB_TYPE_OPTIONS = [
  { value: 'all',          label: 'All Job Types'               },
  { value: 'professional', label: 'Professional (Nurse, Engineer, Teacher)' },
  { value: 'skilled',      label: 'Skilled / Technical Trade'   },
  { value: 'hsw',          label: 'Household Service Worker'    },
  { value: 'sea_based',    label: 'Sea-Based / Manning'         },
  { value: 'driver',       label: 'Driver / Heavy Equipment'    },
] as const;

export type JobTypeValue = typeof JOB_TYPE_OPTIONS[number]['value'];

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  appliesTo: 'all' | 'new_ofw' | 'returning_ofw' | 'muslim';
  applicableJobTypes: JobTypeValue[];
  expiryTracked: boolean;
  validityMonths?: number;
  sortOrder: number;
  isActive: boolean;
}

export interface EvaluationTest {
  id: string;
  name: string;
  type: 'interview' | 'iq' | 'eq' | 'skills' | 'language' | 'medical' | 'custom';
  description: string;
  maxScore: number;
  passingScore: number;
  weight: number;
  isActive: boolean;
  scoringGuide: string;
}

export interface WorkflowPhase {
  id: string;
  phaseNumber: number;
  name: string;
  description: string;
  responsibleRole: UserRole;
  isActive: boolean;
  requiredDocuments: string[];
  requiredEvaluations: string[];
  autoAdvance: boolean;
}

export interface ActivityLog {
  id: string;
  applicantId: string;
  action: string;
  performedBy: string;
  department: string;
  timestamp: string;
  details: string;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

// ─── Direct Supabase Table Schemas (snake_case) ──────────────────────────────
export * from '../types/database';

