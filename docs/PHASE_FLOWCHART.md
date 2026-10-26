# FlowSensus Phase Transition Flowchart

## Visual Guide to Workflow Gates and Unlocks

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLOWSENSUS WORKFLOW                              │
│                   Juan Dela Cruz (APP-2026-089)                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: INTAKE & INITIAL SCREENING                                     │
│ Department: RECRUITMENT                                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    [REGISTRATION MODULE]
                    Action: Initialize Record
                    Button: "Initialize Record & Capture Signature"
                                   │
                                   ▼
                    ✅ Digital Signature Captured
                    ✅ Duplicate Check Passed
                    ✅ Phase 1 Complete
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ GATE 1: SCREENING EXAM                                                   │
│ Module: Screening & Medical (Step 1)                                    │
│ Action: Pass & Generate Medical Referral                                │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    Test Scores Recorded:
                    • IQ: 118/140
                    • EQ: 92/100
                    • Technical: 96/100
                                   │
                                   ▼
                    🔓 UNLOCKS: Smart Profiling (Test Score View)
                    ✅ Medical Referral PDF Generated
                    ✅ Recruiter Signature Logged
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: MEDICAL CLEARANCE                                              │
│ Department: RECRUITMENT / ADMIN                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    [SCREENING & MEDICAL MODULE]
                    Step 2: Validate Medical Clearance
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ GATE 2: MEDICAL FIT-TO-WORK VALIDATION                                  │
│ Module: Screening & Medical (Step 2)                                    │
│ Action: Save Medical Status (Unlocks CV)                                │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    Select: "✓ Fit to Work"
                    Click: "Save Medical Status"
                                   │
                                   ▼
                    🔓 UNLOCKS: CV Encoding Module
                    🔓 UNLOCKS: Smart Profiling (Job Matching)
                    ✅ RBAC Gate Passed
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: CV PREPARATION & JOB MATCHING                                  │
│ Department: RECRUITMENT                                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         [SMART PROFILING]              [CV ENCODING]
                    │                             │
    Run Matching Algorithm            Submit for Approval
    • 94% Match (Saudi Arabia)        • CV Locked
    • 81% Match (Qatar)               • Routed to Management
    • 65% Match (UAE)
                    │                             │
    Endorse to Job Order                         │
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                    ✅ CV Submitted to Management
                    ✅ Status: "Pending Manager Approval"
                    ✅ Handler: Management Department
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: MANAGEMENT QUALITY CONTROL                                     │
│ Department: MANAGEMENT                                                   │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    SWITCH ROLE: Management
                                   │
                                   ▼
                    [CV & EMPLOYER HUB MODULE]
                    Review Locked CV
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 🗝️ GATE 3: THE MASTER KEY                                               │
│ Module: CV & Employer Hub                                               │
│ Action: Approve CV & Record Employer Acceptance                         │
│ This is the CRITICAL unlock that protects Phase 5                       │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    Click: "Approve CV & Record 
                            Employer Acceptance"
                                   │
                                   ▼
                    🎉 MASTER KEY ACTIVATED! 🎉
                                   │
                    ✅ CV Approved by Management
                    ✅ Employer Acceptance Recorded
                                   │
                    🔓 UNLOCKS: Document OCR (Admin)
                    🔓 UNLOCKS: Expense Ledger (Accounting)
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: FINAL DEPLOYMENT PROCESSING                                    │
│ Departments: ADMIN + ACCOUNTING                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         SWITCH: Admin Staff          SWITCH: Accounting
                    │                             │
                    ▼                             ▼
        [DOCUMENT OCR MODULE]          [EXPENSE LEDGER MODULE]
                    │                             │
    Upload Passport & Run OCR         View/Log Expenses
                    │                             │
    • Extract Text                    • Visa: ₱15,000
    • Cross-Validate                  • Medical: ₱3,500
    • Flag Mismatch                   • Total: ₱18,500
    • Activate 3-2-1 Monitoring
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                    ✅ Document Validated
                    ✅ Financial Tracking Complete
                    ✅ 3-2-1 Expiration Monitoring Active
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ DEPLOYMENT READY                                                         │
│ Status: Final Processing Complete                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
            ┌──────────────────────┴──────────────────────┐
            │                                              │
    [MANAGEMENT VIEW]                           [APPLICANT VIEW]
            │                                              │
    Predictive Timeline                         Applicant Portal
    • Est. Departure: Aug 12, 2026              • Phase 5 Status
    • Progress: 68%                             • Handler: Admin
    • Risk: On Track                            • Self-Service Tracking
            │                                              │
            └──────────────────────┬──────────────────────┘
                                   ▼
                        🎯 DEMO COMPLETE 🎯
```

---

## 🔑 Gate Summary

| Gate # | Name | Module | Required Action | What It Unlocks |
|--------|------|--------|-----------------|-----------------|
| **1** | Screening Exam | Screening & Medical (Step 1) | Pass & Generate Medical Referral | Smart Profiling (Test Scores) |
| **2** | Medical Clearance | Screening & Medical (Step 2) | Save Medical Status (Fit to Work) | CV Encoding + Job Matching |
| **3** | 🗝️ Master Key | CV & Employer Hub | Approve CV & Record Employer Acceptance | Document OCR + Expense Ledger (Phase 5) |

---

## 🚦 Status Progression

```
Phase 1: Initial Screening
   ↓ (Pass Exam)
Phase 2: Medical Clearance
   ↓ (Fit to Work)
Phase 3: CV Encoding
   ↓ (Submit CV)
Phase 4: Pending Manager Approval
   ↓ (Employer Acceptance) 🗝️
Phase 5: Final Deployment Processing
   ↓ (Complete)
Ready for Deployment
```

---

## 🎭 Role Transitions During Demo

```
START → Recruitment (Phases 1-3)
           │
           ├─ Registration
           ├─ Screening & Medical
           ├─ Smart Profiling
           └─ CV Encoding
           │
           ▼ LOGOUT
           │
      → Management (Phase 4)
           │
           └─ CV & Employer Hub (🗝️ Master Key)
           │
           ▼ LOGOUT
           │
      → Admin (Phase 5a)
           │
           └─ Document OCR
           │
           ▼ LOGOUT
           │
      → Accounting (Phase 5b)
           │
           └─ Expense Ledger
           │
           ▼ LOGOUT
           │
      → Applicant (View Only)
           │
           └─ Applicant Portal
           │
           ▼
         END DEMO
```

---

## 🎯 Module Dependency Tree

```
Registration
    │
    └─ Unlocks: Screening & Medical (Step 1)
           │
           └─ Unlocks: Smart Profiling (Test Score View)
                  │
                  └─ Screening & Medical (Step 2)
                         │
                         └─ Unlocks: CV Encoding
                                │   └─ Unlocks: Smart Profiling (Job Matching)
                                │
                                └─ CV & Employer Hub (Management)
                                       │
                                       └─ 🗝️ MASTER KEY UNLOCKS:
                                              │
                                              ├─ Document OCR (Admin)
                                              └─ Expense Ledger (Accounting)
```

---

## 💡 Quick Reference: "I'm Stuck!"

| If this is locked... | You need to... | In this module... |
|---------------------|----------------|-------------------|
| Smart Profiling (Test Scores) | Pass the screening exam | Screening & Medical → Step 1 |
| CV Encoding | Validate medical clearance | Screening & Medical → Step 2 → "✓ Fit to Work" |
| Smart Profiling (Job Matching) | Validate medical clearance | Screening & Medical → Step 2 → "✓ Fit to Work" |
| Document OCR | Record employer acceptance | CV & Employer Hub → "Approve CV & Record Employer Acceptance" |
| Expense Ledger | Record employer acceptance | CV & Employer Hub → "Approve CV & Record Employer Acceptance" |

---

## 📊 Data Flow Visualization

```
Applicant Record (Juan Dela Cruz - APP-2026-089)
    │
    ├─ Phase: 1 → 2 → 3 → 4 → 5
    ├─ Status: [Updates at each gate]
    ├─ Handler: [Rotates between departments]
    ├─ Department: Recruitment → Management → Admin
    │
    ├─ Linked Data:
    │     │
    │     ├─ Activity Logs (all departments write here)
    │     ├─ Test Scores (Recruitment)
    │     ├─ Medical Status (Admin/Recruitment)
    │     ├─ CV Document (Management)
    │     ├─ Job Match Results (Recruitment)
    │     ├─ OCR Validation (Admin)
    │     └─ Expense Records (Accounting)
    │
    └─ Real-Time Updates → Applicant Portal
```

---

This flowchart shows the exact path Juan takes through the system, with every gate clearly marked and every unlock explicitly shown. Follow this path during your demo for a smooth presentation!
