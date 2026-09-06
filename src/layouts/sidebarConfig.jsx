export const SIDEBAR_CONFIG = {
  "/manager": [
    { to: "/manager", label: "Dashboard" },
    { to: "/manager/administrative-compliance-center", label: "Compliance Center" },
    { to: "/manager/applicant-list", label: "Applicant List" },
    { to: "/manager/applicant-profile", label: "Applicant Profile" },
    { to: "/manager/agency-configuration", label: "Agency Config" },
  ],
  "/recruitment": [
    { to: "/recruitment", label: "Dashboard" },
    { to: "/recruitment/registration", label: "Registration" },
    { to: "/recruitment/applicant-list", label: "Applicant List" },
    { to: "/recruitment/applicant-profile", label: "Applicant Profile" },
    { to: "/recruitment/screening-panel", label: "Screening Panel" },
    { to: "/recruitment/intake-matching", label: "Intake & Matching" },
    { to: "/recruitment/applicant-profiling", label: "Applicant Profiling" },
  ],
  "/administration": [
    { to: "/administration", label: "Dashboard" },
    { to: "/administration/administrative-compliance-center", label: "Compliance Center" },
    { to: "/administration/applicant-list", label: "Applicant List" },
    { to: "/administration/applicant-profile", label: "Applicant Profile" },
    { to: "/administration/agency-configuration", label: "Agency Config" },
  ],
  "/accounting": [
    { to: "/accounting", label: "Dashboard" },
    { to: "/accounting/applicant-list", label: "Applicant List" },
    { to: "/accounting/applicant-profile", label: "Applicant Profile" },
    { to: "/accounting/financials", label: "Financials" },
    { to: "/accounting/expense-ledger", label: "Expense Ledger" },
  ],
  "/super-admin": [
    { to: "/super-admin", label: "Dashboard" },
    { to: "/super-admin/tenant-management", label: "Tenant Management" },
    { to: "/super-admin/agency-onboarding", label: "Agency Onboarding" },
    { to: "/super-admin/audit-ledger", label: "Audit Ledger" },
  ]
};