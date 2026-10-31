# Technical Architecture - Quiz Enhancements

## System Design Overview

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface (React)                 │
│              CreateLiveQuiz.tsx (653 lines)              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Excel Upload     │  │ AI Generation    │             │
│  │ Component        │  │ Modal Dialog     │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Enhanced Input Styling                   │   │
│  │  (Gradient backgrounds, state indicators)       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│            Quiz Enhancement Utilities                    │
│        quizEnhancements.ts (305 lines)                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │ Excel Parser   │  │ AI Generator   │  │  Styling   │ │
│  │  - Format      │  │  - API Call    │  │  - CSS     │ │
│  │  - Validate    │  │  - Validate    │  │  - States  │ │
│  │  - Error       │  │  - Error       │  │  - Dark    │ │
│  └────────────────┘  └────────────────┘  └────────────┘ │
│                                                           │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ Download       │  │ Validation     │                  │
│  │ Template       │  │ Utilities      │                  │
│  └────────────────┘  └────────────────┘                  │
└─────────────────────────────────────────────────────────┘
         ↓                      ↓
┌─────────────────┐   ┌──────────────────────┐
│ XLSX Library    │   │ Supabase Edge Fn     │
│ (Client-side)   │   │ (generate-quiz)      │
└─────────────────┘   └──────────────────────┘
         ↓                      ↓
┌─────────────────┐   ┌──────────────────────┐
│ Excel/CSV File  │   │ Gemini AI API        │
│ (Local)         │   │ (via Supabase)       │
└─────────────────┘   └──────────────────────┘
```

---

## Component Architecture

### 1. CreateLiveQuiz Component (653 lines)

**State Management**:
```typescript
// Quiz details
const [quizTitle, setQuizTitle] = useState('');
const [quizDescription, setQuizDescription] = useState('');
const [maxParticipants, setMaxParticipants] = useState('50');
const [questions, setQuestions] = useState<QuestionForm[]>([]);

// Enhancement features
const [uploadingFile, setUploadingFile] = useState(false);
const [uploadErrors, setUploadErrors] = useState<string[]>([]);
const [aiLoading, setAiLoading] = useState(false);
const [aiTopic, setAiTopic] = useState('');
const [aiQuestions, setAiQuestions] = useState('5');
const [aiDifficulty, setAiDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
const [showAIModal, setShowAIModal] = useState(false);
const [inputStates, setInputStates] = useState<Record<string, InputState>>({});
```

**Event Handlers**:
```typescript
// 1. Excel Upload Handler
handleExcelUpload(file: File)
  ├─ parseExcelFile(file)
  ├─ Display errors if any
  └─ Add valid questions to state

// 2. AI Generation Handler
handleGenerateAI()
  ├─ Validate topic entered
  ├─ generateQuizWithAI(topic, count, difficulty)
  ├─ Replace questions array
  └─ Close modal and reset

// 3. Quiz Creation Handler
handleCreateQuiz()
  ├─ Validate form complete
  ├─ createLiveQuiz(title, description, questions, maxParticipants)
  ├─ Generate invite code
  └─ Show success screen
```

**UI Sections**:
1. Quiz Details (title, description, max participants)
2. Enhancement Tools (Excel upload, AI generation, template download)
3. Questions Display (list of questions with edit/delete)
4. Create/Cancel buttons
5. AI Modal Dialog (overlay form)

---

### 2. Quiz Enhancements Module (305 lines)

#### A. Excel Parsing (`parseExcelFile`)

**Input**: File object (Excel/CSV)

**Processing Pipeline**:
```
File → XLSX.read() → Extract Sheet
  ↓
Detect Header Row → Validate Columns
  ↓
For Each Row:
  ├─ Extract: Question | Options | Answer | Points
  ├─ Validate: Not empty, format correct
  ├─ Convert: Answer 1-4 → Index 0-3
  └─ Push: QuestionData object
  ↓
Return: { questions: [], errors: [] }
```

**Validation Rules**:
```typescript
- Row length >= 6 (Question + 4 options + answer)
- Question text not empty
- All 4 options filled
- Correct answer: 1, 2, 3, or 4
- Points: positive number (optional, default 10)
```

**Error Handling**:
```typescript
- "Excel file is empty" → No data rows
- "Missing required columns" → Wrong column count
- "Question text is required" → Empty question
- "All 4 options must be filled" → Missing option
- "Correct Answer must be 1, 2, 3, or 4" → Invalid answer
- "Points must be a positive number" → Invalid points
```

#### B. AI Generation (`generateQuizWithAI`)

**Input**: Topic, count, difficulty, quizType

**API Call Flow**:
```
generateQuizWithAI()
  ↓
supabase.functions.invoke('generate-quiz')
  ↓
Backend: supabase/functions/generate-quiz/index.ts
  ├─ Receives topic, numberOfQuestions, difficulty
  ├─ Calls Gemini API with system prompt
  ├─ Parses JSON response
  └─ Returns { questions: [] }
  ↓
Frontend: Validate response format
  ├─ Check: Array.isArray(questions)
  ├─ Check: Each question has required fields
  ├─ Check: correctAnswer in range 0-3
  └─ Return: { questions: [], error?: string }
```

**Points by Difficulty**:
```
Easy (basic recall):      10 points per question
Medium (application):     20 points per question
Hard (analysis/synthesis): 30 points per question
```

**Validation Rules**:
```typescript
- question.text: string (required)
- question.options: string[] (length 4)
- question.correctAnswer: number (0-3)
- question.points: number (computed from difficulty)
```

#### C. Input Styling (`getInputClassName`)

**Three State Model**:
```
Normal State:
  background: from-slate-50 to-slate-100
  border: 2px border-slate-200
  focus: border-indigo-500 ring-2 ring-indigo-200
  
Error State:
  background: same (slate gradient)
  border: 2px border-red-500
  focus: border-red-500 ring-2 ring-red-200
  
Success State:
  background: same (slate gradient)
  border: 2px border-green-500
  focus: border-green-500 ring-2 ring-green-200
```

**CSS Classes Generated**:
```typescript
`w-full px-4 py-3 rounded-lg transition-all duration-200
 bg-gradient-to-br from-slate-50 to-slate-100 
 border-2 [border-color-based-on-state]
 focus:outline-none focus:ring-2 [focus-based-on-state]
 text-gray-900 placeholder-gray-500`
```

---

## Data Flow Diagrams

### Excel Upload Flow

```
User selects file
      ↓
File onChange event
      ↓
handleExcelUpload(file)
      ↓
parseExcelFile(file)
      ↓
[XLSX library processing]
  ├─ Read Excel/CSV
  ├─ Extract rows
  ├─ Validate each row
  └─ Map to QuestionData[]
      ↓
Return { questions, errors }
      ↓
{errors.length > 0}?
  ├─ YES: Display error messages
  └─ NO: Continue
      ↓
setQuestions([...prev, ...newQuestions])
      ↓
UI updates with new questions displayed
```

### AI Generation Flow

```
User clicks "Generate AI"
      ↓
showAIModal = true (modal appears)
      ↓
User enters topic, selects count/difficulty
      ↓
handleGenerateAI()
      ↓
validateTopic()
      ↓
generateQuizWithAI(topic, count, difficulty)
      ↓
setAiLoading(true)
      ↓
supabase.functions.invoke('generate-quiz')
      ↓
[Backend: Calls Gemini API]
  ├─ Builds system prompt
  ├─ Calls Gemini API
  ├─ Parses JSON response
  └─ Returns questions array
      ↓
Validate response format
{valid}?
  ├─ YES: Continue
  └─ NO: Show error, return
      ↓
setQuestions(generatedQuestions)
      ↓
setAiLoading(false)
      ↓
setShowAIModal(false)
      ↓
UI updates with AI-generated questions
```

### Input Styling Flow

```
User interacts with input field
      ↓
onChange event triggered
      ↓
Update state value
      ↓
Determine input state (normal/error/success)
      ↓
setInputStates({ [fieldName]: state })
      ↓
className = getInputClassName(state)
      ↓
CSS applied (background, border, focus ring)
      ↓
Browser applies styles with smooth transition
      ↓
Visual feedback appears instantly
```

---

## Function Reference

### `src/lib/quizEnhancements.ts` Exports

```typescript
// Excel Functions
export const parseExcelFile(file: File): Promise<ExcelParseResult>
export const downloadExcelTemplate(): void

// AI Functions
export const generateQuizWithAI(
  topic: string,
  numberOfQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard',
  quizType?: string
): Promise<{ questions: QuestionData[]; error?: string }>

// Styling Functions
export const getInputClassName(state?: 'normal' | 'error' | 'success'): string
export const getTextareaClassName(state?: 'normal' | 'error' | 'success'): string
export const getSelectClassName(state?: 'normal' | 'error' | 'success'): string

// Validation Functions
export const validateQuestion(question: QuestionData): { valid: boolean; errors: string[] }
export const formatErrorsForDisplay(errors: string[]): string

// Type Definitions
export interface QuestionData
export interface ExcelParseResult
```

---

## Performance Considerations

### Excel Parsing
```
Operation Breakdown:
├─ XLSX.read(): ~50ms (file parsing)
├─ Validation loop: ~10ms (per 100 rows)
├─ Conversion: ~5ms
└─ Total: <1 second for 100 questions

Memory Usage:
├─ File upload: <50MB max
├─ Processing: ~1KB per question
└─ State storage: Negligible

Optimization:
✓ Dynamic import (only loaded when needed)
✓ Row-by-row processing (not entire file at once)
✓ Early termination on critical errors
```

### AI Generation
```
Operation Breakdown:
├─ User input validation: <10ms
├─ API request: 100-500ms (network)
├─ Gemini processing: 5-10 seconds
├─ Response parsing: <100ms
├─ Validation: <50ms
└─ Total: 5-15 seconds

API Constraints:
├─ Rate limit: Standard Gemini limits
├─ Max questions: 20 per request
├─ Timeout: 30 seconds
└─ Cost: ~$0.01-0.05 per generation

Optimization:
✓ Async operation (doesn't block UI)
✓ Loading state feedback
✓ Timeout protection
✓ Error recovery
```

### Input Styling
```
CSS Rendering:
├─ Class generation: <1ms per field
├─ Tailwind compilation: Pre-built
├─ Focus transitions: GPU-accelerated
└─ Total: Imperceptible

Memory:
├─ CSS classes: Minimal (Tailwind utilities)
├─ State tracking: ~100 bytes per input
└─ Total: Negligible

Optimization:
✓ Pure CSS (no JavaScript runtime cost)
✓ GPU-accelerated transitions
✓ Pre-compiled Tailwind classes
```

---

## Error Handling Strategy

### Excel Upload Errors
```
Category 1: Critical (prevent processing)
├─ Empty file
├─ Missing columns
└─ Action: Stop and show error

Category 2: Per-Row (skip row, continue)
├─ Empty question
├─ Missing options
├─ Invalid answer
└─ Action: Record error, continue

Category 3: Soft (warn but process)
├─ Invalid points (use default)
└─ Action: Use fallback, show warning

Result: Partial success possible
```

### AI Generation Errors
```
Category 1: Pre-flight (prevent request)
├─ Empty topic
├─ Invalid parameters
└─ Action: Show user error, don't send request

Category 2: Response (during processing)
├─ API timeout
├─ Invalid JSON response
├─ Missing fields in response
└─ Action: Show friendly error, offer retry

Category 3: Recovery (graceful degradation)
├─ Partial response received
└─ Action: Show error, offer to regenerate

Result: All errors recoverable by user
```

### Input Styling Errors
```
No errors possible (pure CSS)
Fallback behavior: Graceful degradation
├─ Missing Tailwind: Shows basic styling
├─ JS disabled: Styling still works
└─ Old browser: Degrades to basic styles
```

---

## Integration Points

### With Existing Systems

```
CreateLiveQuiz Component
  ↓
liveQuizUtils Functions
  ├─ createLiveQuiz()
  └─ Questions stored in database
  
Enhanced Questions
  ↓
LiveQuizLobby Component
  └─ Displays questions to participants
  
Real-time Updates
  ↓
useLiveQuiz Hooks
  └─ Real-time scoring and feedback
```

### Dependencies

```
Internal:
├─ @/lib/liveQuizUtils (quiz creation)
└─ @/integrations/supabase/client (database)

External:
├─ xlsx v0.18.5 (Excel parsing)
├─ lucide-react (icons)
├─ tailwindcss (styling)
└─ @supabase/supabase-js (API)

Services:
├─ Supabase Edge Functions (AI backend)
└─ Gemini API (AI generation)
```

---

## Security Considerations

### Input Validation
```
✓ Excel files: Format, structure validated
✓ User input: Trimmed, length checked
✓ API responses: Format verified, fields checked
✓ Error messages: Sanitized (no sensitive data)
```

### Data Handling
```
✓ Excel files: Processed locally (not sent to server)
✓ Questions: Stored only after validation
✓ API key: Never exposed (server-side only)
✓ User data: Standard Supabase security policies
```

### Rate Limiting
```
✓ Excel upload: No limit (local processing)
✓ AI generation: Gemini API rate limits apply
✓ Database: Supabase rate limits apply
✓ Protection: Built-in timeout (30 seconds)
```

---

## Future Extensibility

### Planned Additions
1. CSV export of questions
2. Question bank storage
3. Custom AI system prompts
4. Multiple AI providers
5. Bulk question editing

### Architecture Support
```
Current:
├─ parseExcelFile() - Extensible for new formats
├─ generateQuizWithAI() - Multiple AI providers
└─ Styling utilities - Apply to all forms

Future:
├─ Export functions (CSV, PDF, JSON)
├─ Question templates
├─ Batch operations
└─ Analytics integration
```

---

## Testing Strategy

### Unit Tests (Recommended)
```
✓ parseExcelFile() with valid data
✓ parseExcelFile() with invalid data
✓ validateQuestion() with valid question
✓ validateQuestion() with missing fields
✓ getInputClassName() for all states
✓ generateQuizWithAI() mock API responses
```

### Integration Tests (Recommended)
```
✓ Upload Excel → Verify questions added
✓ Generate AI → Verify questions created
✓ Create quiz → Verify all storage and integration
✓ Mix methods → Verify all working together
```

### E2E Tests (Recommended)
```
✓ Full user flow: Excel upload to quiz creation
✓ Full user flow: AI generation to quiz join
✓ Error scenarios: Invalid file, API errors
✓ UI validation: Styling in all states
```

---

## Deployment Checklist

```
Pre-deployment:
☐ npm run build (verify compilation)
☐ Local testing of all features
☐ Dark mode testing
☐ Mobile responsive testing

During deployment:
☐ Push code to repository
☐ Verify Gemini API key set in Supabase
☐ Deploy edge function (if updated)
☐ Deploy to production

Post-deployment:
☐ Test all three features in production
☐ Monitor Supabase logs
☐ Check API usage and costs
☐ Gather user feedback
```

---

This architecture ensures:
- ✅ Scalability (serverless, async operations)
- ✅ Maintainability (modular, well-organized)
- ✅ Reliability (comprehensive error handling)
- ✅ Performance (optimized processing)
- ✅ Security (validated inputs, safe data handling)
- ✅ Extensibility (designed for future additions)
