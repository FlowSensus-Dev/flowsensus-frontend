# FlowSensus Demo Guide

## Overview
This guide walks through the complete 6-act demo script for FlowSensus, showcasing the full deployment pipeline from applicant intake to final deployment.

---

## Setup
1. **Login**: Start at the login screen, select "Recruitment Staff" role
2. **Applicant**: The demo follows Juan Dela Cruz (APP-2026-089), an Industrial Welder

---

## Act 1: Intake & Screening (Recruitment Tab)

### Navigate to: `Registration` module

**What to Show:**
- Pre-filled demographic fields (Juan Dela Cruz, DOB: 1992-03-15, etc.)
- "On-Hand Documents" checklist (all checked)
- Click **"Initialize Record & Capture Signature"** button

**What to Say:**
> "When Juan walks in, Recruitment registers his profile and physical documents. The system instantly checks for duplicates. Notice the 'Digital Signature Captured' confirmation."

### Navigate to: `Screening & Medical` module

**What to Show:**
- **Step 1: Exam Triggers & Interview Scorecard**
  - Pre-filled exam scores (IQ: 118, EQ: 92, Technical: 96)
  - Click **"Pass & Generate Medical Referral"** button
  - Modal shows recruiter signature and clinic selection
  - Click **"Generate PDF"**

**What to Say:**
> "From there, he takes his exams. Once Recruitment inputs his interview scores, they click 'Pass.' This action does two things: it securely logs the recruiter's digital signature, and it automatically triggers a Medical Referral PDF."

---

## Act 2: Medical Validation (Admin & Recruitment Tabs)

### Stay on: `Screening & Medical` module

**What to Show:**
- **Step 2: Validate Medical Clearance**
  - Note the RBAC gate warning
  - Select **"✓ Fit to Work"** from dropdown
  - Click **"Save Medical Status (Unlocks CV)"**
  - Success toast appears

**What to Say:**
> "A few days later, Juan's medical results arrive. Recruitment (or Admin) marks him 'Fit to Work'. This is a critical RBAC gate—the system will not allow Recruitment to format Juan's CV or match him to an employer until this specific medical clearance is logged."

---

## Act 3: AI Matching & CV Drafting (Recruitment Tab)

### Navigate to: `Smart Profiling` module

**What to Show:**
- Point to Juan's comprehensive profile header with overall readiness score (102%)
- Highlight the three test score cards: IQ (118), EQ (92), Technical (96)
- Each card shows a progress bar, percentile rating, and detailed analysis
- Note the "Assessment Complete" green panel showing readiness summary
- Scroll to the "AI-Powered Job Matching" section
- Click **"Run Matching Algorithm"** button
- Results appear showing 3 job matches with compatibility scores
- Point to the top match: JO-2026-0042 (Saudi Arabia) with 94% match
- Show the detailed breakdown: IQ Match 96%, EQ Match 89%, Technical Match 97%
- Read the "Why This Match?" section explaining the algorithm logic
- Click **"Endorse to This Job Order"** button

**What to Say:**
> "With Juan cleared, Recruitment uses the Smart Profiling module. The system displays his comprehensive test scores—IQ 118, EQ 92, Technical 96—calculating an overall readiness of 102%. When we run the matching algorithm, it cross-evaluates these scores against active job orders. The Saudi welding position shows a 94% match because his technical score exceeds the threshold, his credentials match requirements, and his IQ is suitable for safety protocols."

**RBAC Unlock Instructions:**
> **If locked:** The top panel will show "Screening Required" with a lock icon. To unlock: Go to `Screening & Medical` → Complete Step 1 (Exam Triggers & Interview Scorecard) → Click "Pass & Generate Medical Referral". The profiling panel will unlock immediately.
> 
> **If job matching is locked:** The bottom panel will show "Medical Clearance Required". To unlock: Go to `Screening & Medical` → Complete Step 2 (Validate Medical Clearance) → Select "✓ Fit to Work" → Click "Save Medical Status". The job matching panel will unlock immediately.

### Navigate to: `CV Encoding` module

**What to Show:**
- CV form with Juan's details pre-filled
- Professional summary and skills displayed
- Click **"Submit for Approval"** button
- Success toast confirms submission

**What to Say:**
> "Recruitment then generates his standardized CV using the formatting tool. Once they click 'Submit,' the document is locked. Recruitment can no longer edit it, and it is routed directly to Management for quality control."

---

## Act 4: Quality Control & Employer Acceptance (Management Tab)

### Switch to: Management role (logout and login as "Management")

### Navigate to: `CV & Employer Hub` module

**What to Show:**
- Read the blue demo flow banner explaining the master key
- Point to the "Locked CV - Quality Control" section
- Show applicant details and CV summary (read-only)
- Click **"Approve CV & Record Employer Acceptance"** button
- Watch status panel update (all items turn green with checkmarks)

**What to Say:**
> "Over in the Management portal, the Manager reviews Juan's locked CV. They click 'Approve,' which officially allows Recruitment to send the CV to the Saudi employer. Once the employer emails back saying they want to hire Juan, the Manager logs the 'Employer Acceptance.' This single click is the master key of FlowSensus—it unlocks the final deployment modules for the Admin and Accounting departments."

---

## Act 5: Final Deployment Processing (Admin & Accounting Tabs)

**⚠️ IMPORTANT PRE-REQUISITE:** Document OCR and Expense Ledger are **Phase 5 modules** locked by the Master Key. They will only be accessible after completing Act 4 (Management records employer acceptance).

**If locked when you navigate to these modules:**
You'll see a detailed unlock screen with step-by-step instructions:
1. Switch to Management Role (logout → login as "Management")
2. Navigate to CV & Employer Hub module
3. Click **"Approve CV & Record Employer Acceptance"** button (the Master Key)
4. Switch back to Admin or Accounting role - modules are now unlocked

### Switch to: Admin role

### Navigate to: `Document OCR` module

**What to Show:**
- **If unlocked:** Click **"Upload Passport & Run OCR"** button
- OCR extraction results appear instantly
- Point to the comparison table: System Record vs. Extracted Data
- Highlight the red "Validation Mismatch Detected" alert (middle initial difference: "Juan P. Dela Cruz" vs "Juan Dela Cruz")
- Point to the green "3-2-1 Expiration Monitoring Activated" panel showing expiration tracking is now active
- **If locked:** The screen shows a full explanation of why it's locked and exactly how to unlock it (see pre-requisite above)

**What to Say:**
> "Now that Juan is hired, Admin uploads his passport. The OCR module automatically extracts the text, cross-validates it against our system records, and flags the name mismatch for review. Notice it detected that the passport has a middle initial 'P' that wasn't in our original registration. It then activates the 3-2-1 Expiration alerts so his documents don't expire before his flight."

### Switch to: Accounting role

### Navigate to: `Expense Ledger` module

**What to Show:**
- **If unlocked:** Total expenses dashboard shows ₱18,500
- Existing transactions displayed: Visa (₱15,000) and Medical (₱3,500)
- Click **"Log New Expense"** button (optional) to show the expense entry form
- Point to the RBAC isolation note at bottom explaining data separation
- **If locked:** Screen displays the Master Key unlock instructions (same as Document OCR)

**What to Say:**
> "Simultaneously, Accounting logs his Visa processing fees. Thanks to RBAC, Accounting only sees financial data, and Admin only sees compliance data—but everything writes to Juan's centralized master file. Notice how this module was also locked until employer acceptance, preventing premature expense logging for candidates who might be rejected."

---

## Act 6: The Predictive Forecast & Applicant View (Management & Applicant Tabs)

### Switch to: Management role

### Navigate to: `Predictive Timeline` module

**What to Show:**
- Read the orange info banner explaining the algorithm
- Point to the progress timeline showing 68% completion
- Highlight the large estimated date: **August 12, 2026**
- Show the analysis breakdown (68% progress, 79 days remaining, 85% doc completion)
- Point to the risk analysis panel (green "On Track" status)

**What to Say:**
> "Because all departments are updating the system in real-time, FlowSensus can accurately predict the future. Management views the Predictive Timeline, which calculates Juan's estimated departure date based on Admin's document completion rate."

### Switch to: Applicant Portal (logout and login as "Applicant")

**What to Show:**
- Welcome message explaining the portal
- Status banner showing current phase, handler, and department
- Phase timeline with visual progress indicators
- Application details section

**What to Say:**
> "And finally, what does Juan see? He logs into his Applicant Portal from home. Instead of calling the agency every day, he gets a clean, real-time tracker showing exactly where he is in the pipeline, who's handling his case, and what phase he's in—building trust and reducing administrative overhead."

---

## Key Demo Talking Points

### Throughout the demo, emphasize:

1. **Digital Signatures**: Every action captures who performed it and when
2. **RBAC Enforcement**: Modules lock/unlock based on workflow completion
3. **Master Key**: Employer acceptance is the critical unlock for Phase 5
4. **Real-Time Updates**: Handler tracking shows exactly who's responsible
5. **Centralized Data**: All departments write to the same applicant record
6. **Transparency**: Applicant portal builds trust without phone calls
7. **Predictive Intelligence**: Algorithm forecasts deployment dates automatically

---

## Navigation Shortcuts

**Recruitment Modules:**
- Registration
- Screening & Medical
- Smart Profiling
- CV Encoding
- Endorsement Tracker

**Admin Modules:**
- Document OCR
- 3-2-1 Alerts
- Fit-to-Work (under Screening & Medical)

**Accounting Modules:**
- Expense Ledger

**Management Modules:**
- CV & Employer Hub ⭐ (Master Key)
- Predictive Timeline
- Deployment History
- Operational Reports

**Applicant Portal:**
- Login as "Applicant" role to see the public-facing view

---

## Demo Tips

1. **Pace**: Allow 2-3 minutes per act
2. **Read the info banners**: They explain the logic to your audience
3. **Show the toasts**: Success messages confirm actions were logged
4. **Highlight RBAC locks**: Point out when modules unlock
5. **Emphasize the master key**: Act 4 is the pivotal moment
6. **End with applicant view**: This shows the customer-facing benefit

---

## Troubleshooting

- **Module locked?** Make sure you completed the previous phase actions
- **Need to reset?** Refresh the page to restart the workflow
- **Wrong role?** Log out and log back in with the correct role
- **Activity logs**: Check Dashboard to see all recorded actions

---

**Total Demo Time**: ~12-15 minutes for full walkthrough
