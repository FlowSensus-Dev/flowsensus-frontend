# FlowSensus Complete Demo Walkthrough

## Overview
This guide provides a **complete step-by-step walkthrough** to demonstrate the full 5-phase deployment lifecycle using Juan Dela Cruz (APP-2026-089) as the demo applicant.

---

## 🎯 Demo Objective
Show how an applicant progresses from **Phase 1 (Walk-in)** → **Phase 5 (Final Deployment)** by completing workflow gates that unlock subsequent modules.

**Total Demo Time:** 15-20 minutes

---

## ✅ Pre-Demo Checklist
- [ ] System is running and accessible
- [ ] Login screen is loaded
- [ ] You have the applicant ID ready: **APP-2026-089** (Juan Dela Cruz)
- [ ] You understand the 5 phases: Intake → Medical → CV/Endorsement → Employer Review → Final Deployment

---

## 📋 Complete Step-by-Step Walkthrough

### **PHASE 1: INTAKE & SCREENING**

#### Step 1: Login as Recruitment Staff
1. On the login screen, click **"Recruitment Staff"** role
2. You'll see a toast notification: "Authenticated via RBAC as Recruitment Staff"
3. You land on the **Recruitment Dashboard**

#### Step 2: Select Juan Dela Cruz
1. In the top header, you'll see the **Applicant Selector** dropdown
2. It should default to "Juan Dela Cruz (APP-2026-089)"
3. If not, click the dropdown and select him from the list

#### Step 3: Register the Applicant (Optional - just to show registration)
1. In the sidebar, click **"Registration"** under Recruitment section
2. Notice the pre-filled form with Juan's details:
   - Name: Juan Dela Cruz
   - Date of Birth: 1992-03-15
   - Role: Industrial Welder
   - All document checkboxes are checked
3. Click **"Initialize Record & Capture Signature"** button
4. Toast appears: "Record initialized with digital signature captured"
5. ✅ **Juan is now in Phase 1 (Initial Screening)**

#### Step 4: Complete Screening Exam (CRITICAL - Unlocks Smart Profiling)
1. In the sidebar, click **"Screening & Medical"**
2. You'll see **Step 1: Exam Triggers & Interview Scorecard**
3. Note the pre-filled test scores:
   - IQ: 118
   - EQ: 92
   - Technical: 96
4. Click **"Pass & Generate Medical Referral"** button
5. A modal appears showing recruiter signature and clinic selection
6. Click **"Generate PDF"** button
7. Modal closes, toast appears: "Screening passed! Medical referral generated"
8. ✅ **Juan progresses to Phase 2 (Medical Clearance)**
9. ✅ **Smart Profiling module is now unlocked**

---

### **PHASE 2: MEDICAL VALIDATION**

#### Step 5: Validate Medical Clearance (CRITICAL - Unlocks CV & Job Matching)
1. Stay on the **"Screening & Medical"** page
2. Scroll down to **Step 2: Validate Medical Clearance**
3. You'll see an RBAC gate warning (if medical not yet validated)
4. From the dropdown, select **"✓ Fit to Work"**
5. Click **"Save Medical Status (Unlocks CV)"** button
6. Toast appears: "Medical clearance saved. CV module unlocked!"
7. ✅ **Juan progresses to Phase 3 (CV Encoding)**
8. ✅ **CV Encoding module is now unlocked**
9. ✅ **Smart Profiling job matching is now unlocked**

---

### **PHASE 3: SMART PROFILING & CV ENCODING**

#### Step 6: View Comprehensive Profile & Run Job Matching
1. In the sidebar, click **"Smart Profiling"** under Recruitment section
2. You'll see Juan's comprehensive profile header with **Overall Readiness: 102%**
3. Scroll down to the **Test Score Analysis** section:
   - IQ Score: 118/140 (Above Average) - Purple card
   - EQ Score: 92/100 (Excellent) - Blue card
   - Technical Score: 96/100 (Outstanding) - Green card
4. Note the "Assessment Complete" green panel at the bottom
5. Scroll to **AI-Powered Job Matching** section
6. Click **"Run Matching Algorithm"** button
7. Three job matches appear:
   - **JO-2026-0042 (Saudi Arabia)** - 94% match ⭐ (Excellent Match - green background)
   - **JO-2026-0038 (Qatar)** - 81% match (Good Match - white background)
   - **JO-2026-0051 (UAE)** - 65% match (Moderate Match - grayed out)
8. Examine the top match details:
   - IQ Match: 96%, EQ Match: 89%, Technical Match: 97%
   - "Why This Match?" section explains the algorithm logic
9. Click **"Endorse to This Job Order"** button on the Saudi Arabia match
10. Toast appears: "Juan Dela Cruz endorsed to JO-2026-0042 (Saudi Arabia)"

#### Step 7: Format and Submit CV for Approval
1. In the sidebar, click **"CV Encoding"** under Recruitment section
2. You'll see the CV form with Juan's details pre-filled:
   - Professional Summary
   - Work Experience (5+ years welding)
   - Skills (Arc Welding, TIG, MIG, Safety Protocols)
   - Certifications (TESDA NCII)
3. Note: The form is unlocked because medical clearance was validated
4. Click **"Submit for Approval"** button at the bottom
5. Toast appears: "CV submitted to Manager for approval"
6. ✅ **Juan's status changes to "Pending Manager Approval"**
7. ✅ **Handler changes from Recruitment to Management**

---

### **PHASE 4: MANAGEMENT APPROVAL (THE MASTER KEY)**

#### Step 8: Switch to Management Role
1. Click the **"Logout"** button in the top-right corner
2. On the login screen, click **"Management"** role
3. You land on the **Management Dashboard**
4. Notice the "Manager Approval Inbox" showing Juan's CV awaiting review

#### Step 9: Approve CV and Record Employer Acceptance (MASTER KEY MOMENT 🗝️)
1. In the sidebar, click **"CV & Employer Hub"** under Management section
2. Read the blue demo banner explaining the Master Key concept
3. You'll see the **"Locked CV - Quality Control"** section
4. Review the applicant details and CV summary (read-only)
5. Notice the status panel on the right showing:
   - ❌ CV Approved by Management
   - ❌ Employer Acceptance Recorded
6. Click **"Approve CV & Record Employer Acceptance"** button (the MASTER KEY 🗝️)
7. Watch the status panel animate and update:
   - ✅ CV Approved by Management (turns green)
   - ✅ Employer Acceptance Recorded (turns green)
8. Toast appears: "✓ CV Approved & Employer Acceptance Recorded. Phase 5 modules unlocked!"
9. ✅ **Juan progresses to Phase 5 (Final Deployment Processing)**
10. ✅ **Document OCR (Admin) is now unlocked**
11. ✅ **Expense Ledger (Accounting) is now unlocked**

**🎉 THE MASTER KEY HAS BEEN ACTIVATED!**

---

### **PHASE 5: FINAL DEPLOYMENT PROCESSING**

#### Step 10: Process Documents with OCR (Admin Department)
1. Click **"Logout"** button
2. On the login screen, click **"Admin Staff"** role
3. You land on the **Admin Dashboard**
4. Notice the "Newly Unlocked Applicants" section showing Juan (Phase 5 ready)

#### Step 11: Upload and Process Passport
1. In the sidebar, click **"Document OCR"** under Admin section
2. **IMPORTANT:** The module is now UNLOCKED (because employer was accepted)
3. You'll see the upload area with "Upload Passport & Run OCR" button
4. Click **"Upload Passport & Run OCR"** button
5. OCR results appear instantly showing:
   
   **Comparison Table:**
   - System Record: "Juan Dela Cruz"
   - Extracted Data: "Juan P. Dela Cruz"
   
6. Notice the **red "Validation Mismatch Detected"** alert:
   - Flags the middle initial "P." discrepancy for manual review
7. Scroll down to see the **green "3-2-1 Expiration Monitoring Activated"** panel
8. Toast appears: "OCR processing complete. Document flagged for review"
9. ✅ **Document validation complete and 3-2-1 monitoring activated**

#### Step 12: Log Deployment Expenses (Accounting Department)
1. Click **"Logout"** button
2. On the login screen, click **"Accounting"** role
3. You land on the **Accounting Dashboard**
4. Notice the "Monthly Deployment Overhead" showing ₱18,500

#### Step 13: View and Log Expenses
1. In the sidebar, click **"Expense Ledger"** under Accounting section
2. **IMPORTANT:** The module is now UNLOCKED (because employer was accepted)
3. You'll see the summary cards:
   - Total Deployment Expenses: ₱18,500
   - Transactions Recorded: 2
   - Applicant: Juan Dela Cruz (APP-2026-089)
4. Scroll down to see existing transactions:
   - Visa Processing Fee: ₱15,000 (May 24, 2026)
   - Medical Examination: ₱3,500 (May 20, 2026)
5. Click **"Log New Expense"** button (optional)
6. A form appears with fields for Type, Amount, Description, Payment Method
7. Fill in new expense (e.g., "OWWA Contribution - ₱2,500") and click "Record Expense"
8. Toast appears: "Expense recorded: OWWA Contribution (₱2,500)"
9. ✅ **All financial tracking complete**

---

### **BONUS: PREDICTIVE TIMELINE (Management View)**

#### Step 14: View Deployment Forecast
1. Logout and login as **"Management"** role
2. In the sidebar, click **"Predictive Timeline"** under Management section
3. You'll see:
   - **Progress Timeline:** 68% complete
   - **Estimated Departure Date:** August 12, 2026 (large date display)
   - **Analysis Breakdown:**
     - Current Progress: 68%
     - Days Remaining: 79 days
     - Document Completion: 85%
   - **Risk Analysis:** "On Track" (green status)
4. Scroll down to see the detailed timeline with milestones
5. This shows how the system predicts deployment dates based on real-time progress

#### Step 15: Check Applicant Portal (Applicant's View)
1. Logout and login as **"Applicant"** role
2. You'll see the **Applicant Portal** showing Juan's perspective
3. Notice:
   - Welcome message explaining the portal
   - Status banner: Phase 5, Handler: Maria Santos, Department: Admin
   - Phase timeline with visual progress indicators (Phases 1-5)
   - All completed phases are marked with green checkmarks
   - Application details section showing current status
4. This is what Juan sees when he logs in from home - no need to call the agency!

---

## 🎬 Demo Flow Summary

| Phase | Role | Module | Key Action | Result |
|-------|------|--------|------------|--------|
| **1** | Recruitment | Registration | Initialize Record | Applicant registered |
| **1→2** | Recruitment | Screening & Medical (Step 1) | Pass & Generate Medical Referral | Medical referral generated, Smart Profiling unlocked |
| **2→3** | Recruitment | Screening & Medical (Step 2) | Save Medical Status (Fit to Work) | CV module unlocked, Job matching unlocked |
| **3** | Recruitment | Smart Profiling | Run Matching + Endorse | Job match scored, applicant endorsed |
| **3** | Recruitment | CV Encoding | Submit for Approval | CV locked and sent to Management |
| **4→5** | Management | CV & Employer Hub | **Approve CV & Record Acceptance** 🗝️ | **MASTER KEY - Phase 5 unlocked!** |
| **5** | Admin | Document OCR | Upload & Run OCR | Document validated, 3-2-1 monitoring active |
| **5** | Accounting | Expense Ledger | View/Log Expenses | Financial tracking complete |
| **View** | Management | Predictive Timeline | View Forecast | See estimated departure date |
| **View** | Applicant | Applicant Portal | Check Status | Applicant self-service view |

---

## 🔑 Critical RBAC Gates (What Unlocks What)

1. **Screening Exam Passed** → Unlocks Smart Profiling test scores
2. **Medical Clearance (Fit to Work)** → Unlocks CV Encoding + Job Matching
3. **CV Submitted** → Routes to Management for approval
4. **🗝️ MASTER KEY: Employer Acceptance** → Unlocks Phase 5 (Document OCR + Expense Ledger)

---

## 🎯 Key Demo Talking Points

1. **Digital Signatures:** Every action captures who performed it and when
2. **RBAC Enforcement:** Modules lock/unlock based on workflow completion
3. **Master Key Concept:** Employer acceptance is the critical unlock for Phase 5
4. **Real-Time Handler Tracking:** Shows exactly who's responsible at each phase
5. **Centralized Data:** All departments write to the same applicant record
6. **Transparency:** Applicant portal builds trust without phone calls
7. **Predictive Intelligence:** Algorithm forecasts deployment dates automatically
8. **3-2-1 Compliance:** Automatic expiration monitoring prevents last-minute issues
9. **Cross-Validation:** OCR catches data discrepancies early

---

## 🚨 Troubleshooting

**Problem:** Module is locked
- **Solution:** Check the on-screen unlock instructions. Each locked module displays exact steps to unlock it.

**Problem:** Can't find an applicant
- **Solution:** Use the global search bar (top header) or the Applicant Selector dropdown

**Problem:** Toast notifications not appearing
- **Solution:** Make sure to complete each step fully before moving to the next

**Problem:** Wrong role selected
- **Solution:** Logout (top-right) and login with the correct role

**Problem:** Phase didn't advance
- **Solution:** Make sure you clicked the final action button (e.g., "Save Medical Status", "Submit for Approval")

---

## ⏱️ Recommended Pacing

- **Phase 1-2 (Screening & Medical):** 3-4 minutes
- **Phase 3 (Smart Profiling & CV):** 4-5 minutes
- **Phase 4 (Management Approval - Master Key):** 2-3 minutes
- **Phase 5 (Document OCR & Expenses):** 3-4 minutes
- **Bonus (Predictive Timeline & Applicant Portal):** 2-3 minutes
- **Q&A Buffer:** 5 minutes

**Total:** 15-20 minutes + Q&A

---

## 📝 Script for Live Demo

**Opening (30 seconds):**
> "Today I'll show you FlowSensus—a complete recruitment management system that tracks overseas workers from walk-in to deployment. We'll follow Juan Dela Cruz, an industrial welder, through all 5 phases. Watch how RBAC gates enforce workflow compliance and how the Master Key concept prevents premature resource allocation."

**Phase 1-2 (3 minutes):**
> "Juan walks in. Recruitment registers his profile, captures his signature digitally. He takes the exams—IQ 118, EQ 92, Technical 96. I click 'Pass'—this logs my signature and generates a medical referral PDF automatically. A few days later, medical results arrive. I mark him Fit-to-Work. Notice how the CV module just unlocked—the system won't let me proceed until medical clearance is validated."

**Phase 3 (4 minutes):**
> "Now let's see the Smart Profiling module. Juan's comprehensive scores are displayed with detailed analysis. I run the matching algorithm—it evaluates him against active job orders. The Saudi welding position shows 94% compatibility because his technical score exceeds thresholds and credentials match. I endorse him. Then I format his CV and submit it. Notice it's now locked—Recruitment can't edit it anymore. It's routed to Management."

**Phase 4 (2 minutes):**
> "Switching to Management. The Manager reviews the locked CV and clicks 'Approve.' Once the employer emails back saying they want Juan, the Manager records the acceptance. This single click is the Master Key—watch the status panel turn green. Phase 5 modules are now unlocked."

**Phase 5 (3 minutes):**
> "Now Admin uploads Juan's passport. The OCR extracts text automatically and flags a mismatch—the passport has a middle initial 'P' that wasn't in our system. It activates 3-2-1 expiration monitoring. Meanwhile, Accounting logs visa fees—₱15,000. Thanks to RBAC, they only see financial data, but everything writes to Juan's centralized file."

**Closing (1 minute):**
> "Finally, Management can view the Predictive Timeline—it forecasts Juan's departure date as August 12 based on document completion rates. And Juan? He logs into his Applicant Portal from home and sees exactly where he is in the pipeline. No phone calls needed. That's FlowSensus—automated compliance, predictive intelligence, and full transparency."

---

## 🎓 Training Notes for Presenters

- **Always read the info banners**—they explain the logic to your audience
- **Show the toast notifications**—they confirm actions were logged
- **Highlight when modules unlock**—this demonstrates the RBAC power
- **Emphasize the Master Key moment**—Act 4 is the pivotal unlock
- **End with the applicant view**—shows the customer-facing benefit
- **Practice the flow 2-3 times** before presenting to ensure smooth transitions

---

**END OF WALKTHROUGH**
