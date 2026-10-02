import {
  ApplicantRecord,
  CertificateRecord,
  TrainingRecord,
  LanguageRecord,
  IdentificationRecord,
  EducationRecord,
  EmploymentRecord,
  EmploymentFlag,
} from '../app/types';

export function mapApplicantFromApi(item: any): ApplicantRecord {
  const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.applicant_code || (item.applicant_id ? `APP-2026-FP-${String(item.applicant_id).padStart(5, '0')}` : 'Applicant');

  const parsedSkills: string[] = Array.isArray(item.skills)
    ? item.skills.map((s: any) => typeof s === 'string' ? s : (s.name || s.title || '')).filter(Boolean)
    : (typeof item.skills === 'string' ? item.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

  const parsedCerts: string[] = Array.isArray(item.certifications)
    ? item.certifications.map((c: any) => typeof c === 'string' ? c : (c.title || c.name || '')).filter(Boolean)
    : (typeof item.certifications === 'string' ? item.certifications.split(',').map((c: string) => c.trim()).filter(Boolean) : []);

  const rawCertList = (Array.isArray(item.certificateRecords) && item.certificateRecords.length > 0)
    ? item.certificateRecords
    : (Array.isArray(item.certifications) ? item.certifications : []);
  const parsedCertificateRecords: CertificateRecord[] = rawCertList.map((c: any, idx: number) => {
    if (typeof c === 'string') {
      return {
        id: `cert-${item.applicant_id}-${idx}`,
        title: c,
        serialNo: '—',
        issuedBy: c.includes('TESDA') ? 'TESDA' : (c.includes('PRC') ? 'PRC' : 'Accredited Issuer'),
        noOfHours: '—',
        competencyDateIssued: '—',
        expiryDate: 'No expiry'
      };
    }
    return {
      id: c.id || `cert-${item.applicant_id}-${idx}`,
      title: c.title || c.name || 'Certificate',
      serialNo: c.serialNo || c.serial_no || c.certificate_no || '—',
      issuedBy: c.issuedBy || c.issued_by || (c.title?.includes('TESDA') ? 'TESDA' : 'Accredited Issuer'),
      noOfHours: c.noOfHours ? String(c.noOfHours) : (c.no_of_hours ? String(c.no_of_hours) : '—'),
      competencyDateIssued: c.competencyDateIssued || c.dateIssued || c.issue_date || c.issued || '—',
      expiryDate: c.expiryDate || c.expiry_date || c.expiry || 'No expiry',
      proofDocumentUrl: c.proofDocumentUrl || c.proof_url
    };
  });

  const parsedTrainings: TrainingRecord[] = (Array.isArray(item.trainings) ? item.trainings : []).map((t: any, idx: number) => ({
    id: t.id || `tr-${item.applicant_id}-${idx}`,
    trainingName: t.trainingName || t.title || 'Training Program',
    certNo: t.certNo || t.cert_no || '—',
    duration: t.duration || (t.year ? `Completed (${t.year})` : '—'),
    noOfHours: t.noOfHours || t.hours || '—',
    conductedBy: t.conductedBy || t.provider || 'Accredited Provider',
    skillsAcquired: t.skillsAcquired || t.skills || 'Technical Competency',
    proofDocumentUrl: t.proofDocumentUrl || t.proof_url
  }));

  const rawLangList = (Array.isArray(item.languageRecords) && item.languageRecords.length > 0)
    ? item.languageRecords
    : (Array.isArray(item.languages) ? item.languages : []);
  const parsedLanguages: LanguageRecord[] = rawLangList.map((l: any, idx: number) => {
    const competency = l.competency || l.fluency_level || l.proficiency || 'Conversational';
    const defaultRating = competency.toLowerCase().includes('native') ? 10 :
                          competency.toLowerCase().includes('fluent') ? 9 :
                          competency.toLowerCase().includes('proficient') ? 8 :
                          competency.toLowerCase().includes('conversational') ? 7 :
                          competency.toLowerCase().includes('basic') ? 5 : 6;
    return {
      id: l.id || `lang-${item.applicant_id}-${idx}`,
      language: l.language || l.language_name || 'English',
      competency,
      spokenRating: typeof l.spokenRating === 'number' ? l.spokenRating : defaultRating,
      writtenRating: typeof l.writtenRating === 'number' ? l.writtenRating : defaultRating
    };
  });

  const parsedIdentifications: IdentificationRecord[] = (Array.isArray(item.identifications) ? item.identifications : []).map((idDoc: any, idx: number) => ({
    id: idDoc.id || `id-${item.applicant_id}-${idx}`,
    type: idDoc.type || 'Identification Document',
    identificationNo: idDoc.identificationNo || idDoc.number || '—',
    expiryDate: idDoc.expiryDate || idDoc.expiry || '',
    dateIssued: idDoc.dateIssued || idDoc.issued || '',
    proofDocumentUrl: idDoc.proofDocumentUrl || idDoc.proof_url
  }));

  const parsedEducation: EducationRecord[] = (Array.isArray(item.education) ? item.education : []).map((edu: any, idx: number) => ({
    id: edu.id || `edu-${item.applicant_id}-${idx}`,
    level: edu.level || '',
    school: edu.school || '',
    course: edu.course || edu.degree || (edu.honors ? `Honors: ${edu.honors}` : (edu.level === 'High School' ? 'High School Graduate' : 'General Program')),
    yearGraduated: edu.yearGraduated || edu.year || ''
  }));

  const parsedWork = Array.isArray(item.work_experience) ? item.work_experience : [];
  const rawHistory = (Array.isArray(item.employment_history) && item.employment_history.length > 0)
    ? item.employment_history
    : parsedWork;

  const parsedEmploymentHistory: EmploymentRecord[] = rawHistory.map((eh: any, idx: number) => ({
    id: eh.id || `eh-${item.applicant_id}-${idx}`,
    company: eh.company || eh.companyName || 'Previous Employer',
    position: eh.position || 'Worker',
    dateStarted: eh.dateStarted || eh.startDate || '',
    dateEnded: eh.dateEnded || eh.endDate || '',
    country: eh.country || 'Philippines',
    isPresent: Boolean(eh.isPresent),
    reasonForLeaving: eh.reasonForLeaving || (Array.isArray(eh.responsibilities) ? eh.responsibilities.join(', ') : 'Contract completed')
  }));

  const parsedFlags: EmploymentFlag[] = (Array.isArray(item.employment_flags) ? item.employment_flags : []).map((f: any, idx: number) => ({
    id: f.id || `flag-${item.applicant_id}-${idx}`,
    type: f.type || 'gap',
    severity: f.severity === 'critical' ? 'critical' : 'warning',
    description: f.description || 'Employment history anomaly',
    relatedJobIds: Array.isArray(f.relatedJobIds) ? f.relatedJobIds : [],
    dismissed: Boolean(f.dismissed),
    dismissedBy: f.dismissedBy,
    dismissalReason: f.dismissalReason,
    dismissedAt: f.dismissedAt,
    validated: Boolean(f.validated),
    validatedBy: f.validatedBy,
    validationReason: f.validationReason,
    validatedAt: f.validatedAt,
    startDate: f.startDate,
    endDate: f.endDate
  }));

  const rawApplicationId = item.application_id;
  const numericApplicationId = typeof rawApplicationId === 'number'
    ? rawApplicationId
    : typeof rawApplicationId === 'string' && /^\d+$/.test(rawApplicationId.trim())
    ? Number(rawApplicationId.trim())
    : undefined;
  const applicationId = typeof numericApplicationId === 'number' && Number.isSafeInteger(numericApplicationId) && numericApplicationId > 0
    ? numericApplicationId
    : undefined;

  const formattedApplicantCode = item.applicant_code || (item.applicant_id ? `APP-2026-FP-${String(item.applicant_id).padStart(5, '0')}` : undefined);
  const formattedJobOrderCode = item.job_order_code || item.job_code || (item.job_order_id ? `JO-2026-${String(item.job_order_id).padStart(4, '0')}` : 'Unassigned');

  return {
    id: String(item.applicant_id),
    applicationId,
    applicantCode: formattedApplicantCode,
    name: fullName,
    firstName: item.first_name || '',
    middleName: item.middle_name || '',
    role: item.applied_position || item.applied_role || item.position || item.appliedRole || 'Applicant',
    appliedPosition: item.applied_position || item.position || item.applied_role || '',
    appliedRole: item.applied_position || item.applied_role || item.position || '',
    jobOrder: formattedJobOrderCode,
    selectedJobOrderId: item.job_order_id ? String(item.job_order_id) : (formattedJobOrderCode !== 'Unassigned' ? formattedJobOrderCode : undefined),
    phase: typeof item.current_phase === 'number' ? item.current_phase : (typeof item.currentPhase === 'number' ? item.currentPhase : 1),
    status: item.application_status || item.status_code || item.statusCode || item.status || 'Applicant Registration',
    currentHandler: item.current_handler || 'System Agent',
    currentDepartment: item.current_department || 'Recruitment',
    lastUpdated: item.last_updated ? new Date(item.last_updated).toLocaleString() : (item.updated_at ? new Date(item.updated_at).toLocaleString() : new Date().toLocaleString()),
    createdAt: item.created_at || item.createdAt || item.application_created_at || item.last_updated || item.updated_at || '',
    phaseDescription: item.phase_description || 'Active in candidate pipeline',
    presentAddress: item.present_address || '',
    provincialAddress: item.provincial_address || '',
    email: item.email || '',
    contact: item.contact_number || '',
    dateOfBirth: item.birth_date || '',
    age: item.age || (item.birth_date ? Math.floor((Date.now() - new Date(item.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : 28),
    sex: (item.gender === 'Female' || item.sex === 'Female') ? 'Female' : 'Male',
    civilStatus: item.civil_status || 'Single',
    citizenship: item.nationality || 'Filipino',
    religion: item.religion || 'Roman Catholic',
    heightCm: item.height_cm || item.heightCm || undefined,
    weightKg: item.weight_kg || item.weightKg || undefined,
    noOfChildren: item.no_of_children !== undefined ? item.no_of_children : (item.noOfChildren || 0),
    placeOfBirth: item.place_of_birth || item.placeOfBirth || '',
    applicantTypes: Array.isArray(item.applicant_types) ? item.applicant_types : (item.applicantTypes || (item.is_indigenous ? ['INDIGENOUS_PEOPLES'] : [])),
    isIndigenous: Boolean(item.is_indigenous || item.isIndigenous || (Array.isArray(item.applicant_types) && item.applicant_types.includes('INDIGENOUS_PEOPLES'))),
    indigenousCommunity: item.indigenous_community || item.indigenousCommunity || '',
    emergencyContactName: item.emergency_contact_name || item.emergencyContactName || '',
    emergencyContactRelationship: item.emergency_contact_relationship || item.emergencyContactRelationship || '',
    emergencyContactNumber: item.emergency_contact_number || item.emergencyContactNumber || '',
    facebookUrl: item.facebook_url || item.facebookUrl || '',
    whatsappNumber: item.whatsapp_number || item.whatsappNumber || '',
    linkedinUrl: item.linkedin_url || item.linkedinUrl || '',
    socialMedia: Array.isArray(item.social_media) ? item.social_media : (item.socialMedia || []),
    skills: parsedSkills,
    certifications: parsedCerts,
    identifications: parsedIdentifications,
    education: parsedEducation,
    certificateRecords: parsedCertificateRecords,
    trainings: parsedTrainings,
    languageRecords: parsedLanguages,
    workExperience: parsedWork,
    address: item.present_address || item.provincial_address || 'Philippines',
    employmentHistory: parsedEmploymentHistory,
    employmentFlags: parsedFlags,
    requirements: Array.isArray(item.requirements) ? item.requirements : [],
    testScores: (item.test_scores && typeof item.test_scores === 'object' && Object.keys(item.test_scores).length > 0)
      ? item.test_scores
      : undefined,
    matchScore: item.match_score ?? item.matchScore ?? 90,
    photoDocumentId: item.photo_document_id || item.photoDocumentId || undefined,
    photoUrl: item.photo_url || item.photo || '',
    photoDataUrl: item.photo_url || item.photo || '',
  };
}
