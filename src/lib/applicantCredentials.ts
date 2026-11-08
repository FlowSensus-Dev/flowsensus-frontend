/** PF17S1 confirms email dispatch and never returns applicant passwords. */
export function confirmedApplicantResend(data: any) {
  if (data?.success !== true || data.email_dispatched !== true ||
      typeof data.email !== 'string' || !data.email.trim() ||
      typeof data.applicant_code !== 'string' || !data.applicant_code.trim()) {
    throw new Error('Applicant credential email dispatch was not confirmed. Check account status before retrying.');
  }
  return {
    title: 'Applicant Credentials Dispatched', name: typeof data.name === 'string' ? data.name : 'Applicant',
    email: data.email, username: data.applicant_code, portalName: 'Applicant Account', emailDispatched: true,
    message: `Credentials dispatched to ${data.email}. The applicant must use the email to access the temporary password.`,
  };
}
