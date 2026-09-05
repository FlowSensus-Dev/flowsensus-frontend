# FLOWSENSUS - Registration & Screening Update

## Summary (May 25, 2026)

Updated the Registration and Screening modules to match real recruitment agency practices, with comprehensive personal information capture and industry-standard test scoring.

---

## 1. **Registration Module - Enhanced** ✓

### **New Header**: "Applicant Registration (Sourcing / Initial Stage)"

### **Comprehensive Personal Information Capture**:

The registration form now captures ALL fields that appear in the Applicant Profile:

#### **Name Fields**:
- First Name
- Middle Name
- Last Name

#### **Address Fields**:
- Present Address (Brgy., City, Province)
- Provincial Address (if different)
- Email Address
- Contact Number

#### **Birth Information**:
- Date of Birth
- Place of Birth
- Age

#### **Personal Details**:
- Sex (Male/Female dropdown)
- Civil Status (Single/Married/Widowed/Separated dropdown)
- Citizenship (e.g., Filipino)
- Religion
- Height (e.g., 5'7")
- Weight (e.g., 68 kg)
- Language/Dialect Spoken (comma-separated)

#### **Target Role**:
- Target Role / Designation (e.g., Industrial Welder)

#### **On-Hand Documents**:
- Valid Passport (checkbox)
- NBI Clearance (checkbox)
- Resume / CV (checkbox)
- TESDA NCII (checkbox)

### **Features**:
- ✓ Auto Duplicate Check indicator
- ✓ Form validation
- ✓ Digital signature capture on submit
- ✓ All data flows directly to Applicant Profile

---

## 2. **Screening Module - Industry Standard Tests** ✓

### **Replaced Generic Scorecard with Real Agency Tests**:

#### **1. English Proficiency Test** (out of 100)
- **Purpose**: Communication ability (grammar, comprehension, conversation)
- **Passing Rate**: 60-70% minimum
- **Higher for**: Hospitality or skilled roles (75-80%)
- **Display**: Score input, progress bar, pass/fail badge

#### **2. Trade / Skills Test** (out of 100) - **MOST CRITICAL** ⭐
- **Purpose**: Verify actual job capability
- **Examples**:
  - Caregiver → patient handling demo
  - Domestic worker → cleaning, ironing, cooking
  - Welder → actual welding test
  - Electrician → wiring assessment
- **Passing Rate**: 70-85% depending on job difficulty
- **Display**: Highlighted in amber background with "MOST CRITICAL" badge
- **Note**: This is often the final deciding factor

#### **3. IQ / Aptitude Test** (out of 100)
- **Purpose**: Learning ability and problem-solving
- **What is tested**: Logical reasoning, basic math, pattern recognition
- **Passing Rate**: 50-60% (used as support, not elimination)
- **Display**: Score input, progress bar, pass/fail badge

#### **4. Personality / EQ Assessment** (Suitable / Not Suitable / Pending)
- **Purpose**: Evaluate attitude, behavior, emotional stability
- **What is checked**: Patience, obedience/adaptability, stress tolerance
- **Passing**: No strict percentage—used for screening red flags
- **Display**: Dropdown selection

#### **5. Employer-Specific Tests** (Optional text field)
- **Examples**:
  - Cooking test (for domestic workers)
  - Arabic language basics
  - Customer service simulation (for hospitality)
- **Display**: Text area for notes

### **Visual Design**:
- Each test has its own card with color coding
- Trade/Skills test highlighted in amber with ⭐ badge
- Real-time pass/fail indicators
- Progress bars showing score percentages
- Overall status summary at bottom

### **Passing Logic**:
```typescript
English: >= 60%
Trade/Skills: >= 70%
IQ/Aptitude: >= 50%
Personality: === 'Suitable'

Overall Pass: ALL tests must pass
```

### **"Pass & Generate Medical Referral" Button**:
- Disabled until all tests pass
- On click → Opens modal with test summary
- Generates medical referral PDF
- Logs recruiter signature
- Moves applicant to Phase 2 (Medical Clearance)

---

## 3. **Updated Test Scores Data Structure** ✓

### **BEFORE**:
```typescript
testScores: {
  iq: number;
  eq: number;
  technical: number;
}
```

### **AFTER**:
```typescript
testScores: {
  englishProficiency: number; // Out of 100
  tradeSkills: number; // Out of 100
  iqAptitude: number; // Out of 100
  personalityEQ: 'Suitable' | 'Not Suitable' | 'Pending';
  employerSpecific?: string; // Optional notes
}
```

---

## 4. **Applicant Profile - Test Scores Tab Updated** ✓

### **New Display Format**:

**Row 1** (3 columns):
- **English Proficiency**: Score % with pass/fail status
- **Trade/Skills Test**: Score % with pass/fail status (highlighted in amber with ★)
- **IQ/Aptitude**: Score % with pass/fail status

**Row 2** (2 columns):
- **Personality/EQ Assessment**: Result displayed in color (Green=Suitable, Red=Not Suitable)
- **Employer-Specific Test**: Optional notes (only shown if present)

### **Visual Indicators**:
- Trade/Skills gets special amber background and star icon
- Pass/fail text shows passing threshold for each test
- Color-coded results (Green for pass, Red for fail)

---

## 5. **Updated Mock Data** ✓

All 3 applicants now have complete test scores:

### **Juan Dela Cruz**:
```typescript
testScores: {
  englishProficiency: 85,
  tradeSkills: 92,
  iqAptitude: 75,
  personalityEQ: 'Suitable',
  employerSpecific: 'Passed welding certification exam',
}
```

### **Pedro Garcia**:
```typescript
testScores: {
  englishProficiency: 72,
  tradeSkills: 88,
  iqAptitude: 68,
  personalityEQ: 'Suitable',
}
```

### **Ana Reyes**:
```typescript
testScores: {
  englishProficiency: 95,
  tradeSkills: 93,
  iqAptitude: 88,
  personalityEQ: 'Suitable',
  employerSpecific: 'Passed CPR/First Aid practical exam',
}
```

---

## 6. **Workflow Flow** ✓

### **Complete Registration → Screening Flow**:

```
1. Recruitment: Registration
   ├─ Fill all personal information fields
   ├─ Check on-hand documents
   └─ Click "Initialize Record & Capture Signature"
   → Creates applicant record with all demographics
   → Applicant ready for screening

2. Recruitment: Screening Panel
   ├─ Enter English Proficiency score (aim for 60%+)
   ├─ Enter Trade/Skills score (aim for 70%+, MOST CRITICAL)
   ├─ Enter IQ/Aptitude score (aim for 50%+)
   ├─ Select Personality/EQ (must be "Suitable")
   ├─ Optional: Add employer-specific test notes
   └─ Click "Pass & Generate Medical Referral"
   → Opens modal to confirm
   → Generates PDF referral for partner clinic
   → Logs recruiter signature
   → Moves to Phase 2 (Medical Clearance)
   → Hands off to Admin for medical validation

3. Admin: Fit-to-Work
   ├─ Navigate to "Fit-to-Work" module
   └─ Mark applicant as "Fit to Work"
   → Unlocks CV Encoding module
   → Moves to Phase 3
```

---

## 7. **Testing the System** ✓

### **Test Registration**:
1. Login as `recruit@flowsensus.com`
2. Navigate to "Registration"
3. See expanded form with ALL personal fields
4. Fill in: Names, addresses, DOB, place of birth, age, sex, civil status, etc.
5. Check document checkboxes
6. Click "Initialize Record & Capture Signature"
7. View confirmation toast

### **Test Screening**:
1. Navigate to "Screening Panel"
2. See 5 test sections:
   - English Proficiency: Enter 85
   - Trade/Skills: Enter 92 (notice amber highlight)
   - IQ/Aptitude: Enter 75
   - Personality/EQ: Select "Suitable"
   - Employer-Specific: Enter optional notes
3. Notice "Pass & Generate Medical Referral" button enabled
4. Click button → See modal with test summary
5. Click "Generate PDF"
6. See success toast

### **Test Profile View**:
1. Navigate to "Applicant Profile"
2. Click "Test Scores" tab
3. See all 5 test results with pass/fail indicators
4. Notice Trade/Skills test highlighted with amber background

---

## Files Modified

1. `/src/app/types.ts` - Updated TestScores interface
2. `/src/app/components/views/Registration.tsx` - Complete rewrite with all personal fields
3. `/src/app/components/views/Screening.tsx` - Complete rewrite with 5-test scorecard
4. `/src/app/components/views/ApplicantProfile.tsx` - Updated test scores display
5. `/src/app/App.tsx` - Updated mock applicant test scores

---

## Key Improvements

✅ **Complete Personal Information**: Registration now captures all fields that appear in profile

✅ **Industry-Standard Tests**: Matches real recruitment agency testing practices

✅ **Trade/Skills Priority**: Highlighted as "MOST CRITICAL" (often the deciding factor)

✅ **Clear Passing Thresholds**: Each test shows its passing percentage

✅ **Visual Pass/Fail Indicators**: Real-time feedback on test performance

✅ **Comprehensive Documentation**: Test purposes and scoring clearly explained

✅ **Optional Employer Tests**: Flexibility for special requirements

✅ **Seamless Data Flow**: Registration fields flow directly to Applicant Profile

---

## Passing Thresholds Reference

| Test | Passing Score | Notes |
|------|---------------|-------|
| English Proficiency | 60-70% | Higher (75-80%) for hospitality/skilled roles |
| Trade/Skills | 70-85% | **MOST CRITICAL** - Often final deciding factor |
| IQ/Aptitude | 50-60% | Support metric, not elimination factor |
| Personality/EQ | "Suitable" | Screens for red flags in behavior/attitude |
| Employer-Specific | Varies | Optional, depends on job requirements |

---

## Real-World Examples

### **Domestic Helper (Hong Kong)**:
- English: 65% ✓
- Trade/Skills: 82% (cleaning, cooking demo) ✓
- IQ/Aptitude: 58% ✓
- Personality: Suitable ✓
- Employer-Specific: "Passed Cantonese basic phrases test"

### **Industrial Welder (Saudi Arabia)**:
- English: 75% ✓
- Trade/Skills: 92% (actual welding test) ✓
- IQ/Aptitude: 70% ✓
- Personality: Suitable ✓
- Employer-Specific: "Passed Arabic basic safety commands"

### **Caregiver (UAE)**:
- English: 88% ✓
- Trade/Skills: 90% (patient handling, CPR demo) ✓
- IQ/Aptitude: 82% ✓
- Personality: Suitable ✓
- Employer-Specific: "Passed bedridden patient care simulation"

---

## Summary

The Registration and Screening modules now accurately reflect real-world recruitment agency practices:

- **Registration** captures complete demographic information matching profile fields
- **Screening** uses 5 industry-standard tests with proper passing thresholds
- **Trade/Skills** test is properly emphasized as the most critical factor
- **Data flows seamlessly** from registration → screening → profile
- **Visual feedback** helps recruiters make informed decisions

This creates a professional, industry-compliant applicant evaluation system.
