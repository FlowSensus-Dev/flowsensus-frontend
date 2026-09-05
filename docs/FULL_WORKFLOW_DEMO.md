# FLOWSENSUS - Full Workflow Demo Guide

## Overview
This guide demonstrates how to move a single applicant through all 5 phases of the deployment lifecycle, showing real-time updates across staff and applicant views.

---

## Demo Scenario: Juan Dela Cruz's Complete Journey

### Initial State
- **Applicant**: Juan Dela Cruz (APP-2026-089)
- **Position**: Industrial Welder
- **Job Order**: JO-2026-0042 (Al-Futtaim Engineering - Saudi Arabia)
- **Starting Phase**: 3 (CV Encoding)

---

## Phase-by-Phase Walkthrough

### **Phase 1: Registration & Screening**
**Staff Role**: Recruitment (Sarah Cruz)

**Login**: `sarah@flowsensus.com` / any password

**Actions**:
1. Navigate to **"Registration"** → Fill applicant demographic data
2. Navigate to **"Screening Panel"** → Enter test scores:
   - IQ: 118
   - EQ: 92
   - Technical: 96
3. Click **"Pass & Generate Medical Referral"**
4. Click **"Generate PDF"** in the modal

**Result**: 
- Applicant moves to **Phase 2** (Medical Clearance)
- Medical referral PDF generated
- Recruiter signature logged

**Verify as Applicant**:
- Logout → Login as `juan@applicant.com` → Select "Juan Dela Cruz"
- View Phase 1 marked as ✓ Completed
- Current phase shows "Medical Clearance"

---

### **Phase 2: Medical Clearance**
**Staff Role**: Admin (Maria Santos)

**Login**: `admin@flowsensus.com` / any password

**Actions**:
1. Navigate to **"Screening Panel"** (Medical validation section)
2. Select Medical Status: **"✓ Fit to Work"**
3. Click **"Save Medical Status (Unlocks CV)"**

**Result**:
- Applicant moves to **Phase 3** (CV Encoding)
- CV module unlocked
- Medical clearance recorded

**Verify as Applicant**:
- Refresh or re-login as Juan
- View Phase 2 marked as ✓ Completed
- Current phase shows "CV Encoding"

---

### **Phase 3: CV Encoding & Endorsement**
**Staff Role**: Recruitment (Sarah Cruz)

**Login**: `recruit@flowsensus.com` / any password

**Actions**:
1. Navigate to **"Applicant Profiling"** → Review match scores
2. Navigate to **"CV Encoding"** → Edit CV sections
3. Click **"Lock & Submit for Management Approval"**

**Result**:
- CV locked (no further edits allowed)
- Applicant status: "Awaiting Management Approval"
- Management approval queue updated

**Verify as Applicant**:
- View Phase 3 still in progress
- Status: "Awaiting Management Approval"

---

### **Phase 4: Management Approval & Employer Selection**
**Staff Role**: Management (Admin User)

**Login**: `manage@flowsensus.com` / any password

**Actions**:
1. Navigate to **"CV & Employer Hub"**
2. Review locked CV (read-only)
3. Click **"Approve CV & Record Employer Acceptance"**

**Result**:
- CV approved by management
- Employer acceptance recorded (Al-Futtaim Engineering confirmed hiring)
- **MASTER KEY ACTIVATED**: Phase 5 modules unlocked
- Applicant moves to **Phase 5** (Final Deployment Processing)

**Verify as Applicant**:
- View Phase 4 marked as ✓ Completed
- Current phase shows "Final Deployment Processing"
- Status: "Employer confirmed selection"

---

### **Phase 5: Final Deployment Processing**
**Staff Roles**: Admin (Document OCR) + Accounting (Expense Tracking)

#### **5A: Document OCR Processing**
**Login**: `admin@flowsensus.com` / any password

**Actions**:
1. Navigate to **"Document OCR"** (now unlocked)
2. Click **"Upload Passport & Run OCR"**
3. Review OCR extraction results
4. Handle validation mismatch (Accept with Correction / Reject)

**Result**:
- Passport data extracted and validated
- 3-2-1 expiration monitoring activated
- Document compliance check completed

#### **5B: Expense Tracking**
**Login**: `accounting@flowsensus.com` / any password

**Actions**:
1. Navigate to **"Expense Ledger"** (now unlocked)
2. Click **"Log New Expense"**
3. Enter transaction details:
   - Type: "Visa Processing Fee"
   - Amount: ₱15,000
   - Description: "Saudi Arabia work visa application"
4. Click **"Record Transaction"**

**Result**:
- Financial transaction logged
- Total deployment cost updated
- Audit trail recorded

**Verify as Applicant**:
- View Phase 5 in progress
- Status: "Final Deployment Processing"
- Current handler: Admin/Accounting departments

---

## Multi-Applicant Demo

### Additional Test Applicants

**Pedro Garcia (APP-2026-112)**
- Position: Pipefitter
- Job Order: JO-2026-0038 (Qatar Construction)
- Current Phase: 2 (Medical Clearance)
- Login: `pedro@applicant.com` → Select "Pedro Garcia"

**Ana Reyes (APP-2026-051)**
- Position: Nurse
- Job Order: JO-2026-0051 (Dubai Healthcare)
- Current Phase: 4 (Employer Review)
- Login: `ana@applicant.com` → Select "Ana Reyes"

---

## Key Features to Demonstrate

### 1. **Role-Based Access Control (RBAC)**
- Login as different roles → Notice different sidebar menus
- Try accessing locked modules → See "Access Restricted" messages

### 2. **Real-Time Activity Logging**
- Perform any action → Check "Deployment History" (Management)
- Every workflow action creates an audit trail entry

### 3. **Dynamic Applicant Selection**
- Staff can switch between applicants using header dropdown
- Each applicant has independent workflow state

### 4. **Phase-Based Locking/Unlocking**
- CV module locked until medical clearance
- Phase 5 modules locked until employer acceptance
- Visual feedback with lock icons and explanation messages

### 5. **Applicant Portal Updates**
- Staff perform action → Logout → Login as applicant
- See real-time phase progress and status updates
- Timeline visualization shows completed vs in-progress phases

### 6. **Department-Specific Dashboards**
- Recruitment: Pipeline counters, priority queues
- Admin: 3-2-1 alerts, OCR queue
- Accounting: Financial quick-entry, transaction ledger
- Management: Escalation alerts, performance metrics

---

## Quick Test Credentials

| Role | Email | Default Name |
|------|-------|-------------|
| Recruitment | `recruit@flowsensus.com` | Sarah Cruz |
| Admin | `admin@flowsensus.com` | Maria Santos |
| Accounting | `accounting@flowsensus.com` | Mark Tan |
| Management | `manage@flowsensus.com` | Admin User |
| Applicant | `juan@applicant.com` | Juan Dela Cruz |
| Applicant | `pedro@applicant.com` | Pedro Garcia |
| Applicant | `ana@applicant.com` | Ana Reyes |

**Password**: Any text (not validated in demo mode)

---

## Expected Demo Duration
- **Quick Demo**: 10-15 minutes (one applicant, key actions only)
- **Full Demo**: 20-30 minutes (all phases, multiple applicants)
- **Deep Dive**: 45-60 minutes (all features, edge cases, RBAC validation)

---

## Troubleshooting

**Issue**: Modules remain locked after completing required steps
- **Solution**: Ensure you clicked the exact workflow trigger button (e.g., "Pass & Generate Medical Referral", "Save Medical Status")

**Issue**: Applicant portal shows outdated information
- **Solution**: Logout and login again to refresh state

**Issue**: Cannot see certain sidebar menu items
- **Solution**: Check current role - some modules are department-specific

---

## Demo Script (Executive Presentation)

1. **Introduction** (2 min)
   - "FLOWSENSUS is an RBAC-driven deployment pipeline system for overseas worker agencies"

2. **Staff Workflow** (8 min)
   - Login as Recruitment → Show screening → Generate medical referral
   - Login as Admin → Validate medical clearance → Unlock CV
   - Login as Management → Approve CV → Activate master key

3. **Applicant Experience** (3 min)
   - Login as applicant → Show real-time phase tracking
   - Demonstrate transparency (no need to call agency daily)

4. **Advanced Features** (5 min)
   - Show department dashboards
   - Demonstrate activity logging
   - Highlight RBAC gates and automation

5. **Q&A** (5 min)

---

## Next Steps After Demo

For production deployment:
1. Connect to real Supabase database
2. Implement actual authentication (JWT tokens)
3. Add file upload functionality (PDF generation, image OCR)
4. Configure email notifications
5. Set up role permissions in production environment
