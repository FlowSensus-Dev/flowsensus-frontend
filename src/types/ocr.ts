export interface ExtractedData {
  documentType?: string;
  document_type?: string;
  passportNumber?: string | null;
  passport_number?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  middleName?: string | null;
  middle_name?: string | null;
  birthDate?: string | null;
  birth_date?: string | null;
  expiryDate?: string | null;
  expiry_date?: string | null;
  nationality?: string | null;
  sex?: string | null;
  mrzDetected?: boolean;
  mrz_detected?: boolean;
}

export interface DiscrepancyItem {
  field: string;
  systemValue?: string | null;
  system_value?: string | null;
  extractedValue?: string | null;
  extracted_value?: string | null;
  severity: 'info' | 'warning' | 'critical' | string;
  issue: string;
}

export interface SystemDataSummary {
  applicantId?: number;
  applicant_id?: number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  middleName?: string | null;
  middle_name?: string | null;
  fullName?: string;
  full_name?: string;
  birthDate?: string | null;
  birth_date?: string | null;
  passportNumber?: string | null;
  passport_number?: string | null;
}

export interface ExpirationTrackingSummary {
  expiryDate?: string | null;
  expiry_date?: string | null;
  daysUntilExpiration?: number | null;
  days_until_expiration?: number | null;
  alertLevel?: 'normal' | 'yellow_60d' | 'amber_30d' | 'red_expired' | string;
  alert_level?: 'normal' | 'yellow_60d' | 'amber_30d' | 'red_expired' | string;
  monitoringActive?: boolean;
  monitoring_active?: boolean;
  message?: string;
}

export interface OCRRawExtractResponse {
  documentType: string;
  document_type?: string;
  extractedData: ExtractedData;
  extracted_data?: ExtractedData;
  rawText: string;
  raw_text?: string;
  charCount: number;
  char_count?: number;
  processedAt: string;
  processed_at?: string;
}

export interface OCRVerificationResponse {
  matchStatus: 'VERIFIED' | 'FLAGGED_FOR_REVIEW' | string;
  match_status?: 'VERIFIED' | 'FLAGGED_FOR_REVIEW' | string;
  applicantId: number;
  applicant_id?: number;
  extractedData: ExtractedData;
  extracted_data?: ExtractedData;
  systemData: SystemDataSummary;
  system_data?: SystemDataSummary;
  discrepancies: DiscrepancyItem[];
  expirationMonitoring?: ExpirationTrackingSummary | null;
  expiration_monitoring?: ExpirationTrackingSummary | null;
  rawTextPreview: string;
  raw_text_preview?: string;
  processedAt: string;
  processed_at?: string;
}

export interface OCRStatusResponse {
  available: boolean;
  engine?: 'gemini' | string;
  geminiActive?: boolean;
  gemini_active?: boolean;
  path?: string | null;
  version?: string | null;
  error?: string | null;
}

