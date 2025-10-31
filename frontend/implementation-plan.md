# Frontend Implementation Plan

## Project Overview
Google Forms-like web application for creating and managing forms with collaborative features.

## Backend API Summary
- **Auth Service** (port 3001): User registration and login
- **Forms Service** (port 3002): Form CRUD, submissions, collaborators, responses, export

---

## Feature Mapping (PDF Requirements → Frontend Implementation)

### 1. User Registration (10% of grade)
**PDF Section:** Functional Requirement #1
**Backend API:** POST `/register` (auth-service:3001)
**Frontend Files:**
- `src/pages/Register.tsx` - Registration form component
- `src/api/auth.ts` - API calls for authentication

**Acceptance Criteria:**
- [ ] Form with name, email, password fields
- [ ] Client-side validation (email format, password min length)
- [ ] Error handling for existing emails
- [ ] Success message and redirect to login
- [ ] Responsive layout

**Verification:** Navigate to /register, fill form, submit. Check user created in database.

---

### 2. User CRUD (7.5% of grade)
**PDF Section:** Technical Requirement - Unit tests mention user CRUD
**Backend API:** Missing endpoints (needs backend implementation or frontend mock)
**Frontend Files:**
- `src/pages/Profile.tsx` - User profile management
- `src/api/users.ts` - User CRUD operations

**Acceptance Criteria:**
- [ ] View current user profile
- [ ] Edit user name, email
- [ ] Delete account (with confirmation)
- [ ] Error handling

**Verification:** Login, navigate to /profile, update details, verify changes persist.

**Note:** Backend does not have user update/delete endpoints. Will implement frontend UI and document required backend endpoints.

---

### 3. User Login (10% of grade)
**PDF Section:** Functional Requirement #2
**Backend API:** POST `/login` (auth-service:3001)
**Frontend Files:**
- `src/pages/Login.tsx` - Login form component
- `src/api/auth.ts` - Login API call
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/utils/tokenStorage.ts` - JWT token handling

**Acceptance Criteria:**
- [ ] Form with email, password fields
- [ ] Client-side validation
- [ ] Store JWT token in localStorage
- [ ] Redirect to dashboard on success
- [ ] Error messages for invalid credentials
- [ ] Protected routes that require authentication

**Verification:** Login with valid credentials, verify token stored, access protected routes.

---

### 4. Form Search (10% of grade)
**PDF Section:** Functional Requirement #11, Integration test [UI] form search by name
**Backend API:** GET `/my-forms` (forms-service:3002)
**Frontend Files:**
- `src/pages/Dashboard.tsx` - Main dashboard with form list
- `src/components/FormSearch.tsx` - Search input component
- `src/hooks/useFormSearch.ts` - Search logic hook

**Acceptance Criteria:**
- [ ] Search input filters forms by title (case-insensitive)
- [ ] Real-time search results
- [ ] Display form title and description
- [ ] Link to edit each form
- [ ] Empty state when no forms match

**Verification:** Create multiple forms, use search to filter by name.

---

### 5. Form Creation (12.5% of grade)
**PDF Section:** Functional Requirements #3, #4
**Backend API:** POST `/create-form` (forms-service:3002)
**Frontend Files:**
- `src/pages/FormBuilder.tsx` - Form builder interface
- `src/components/QuestionEditor.tsx` - Individual question editor
- `src/components/QuestionTypes/` - Components for each question type
  - `ShortTextQuestion.tsx`
  - `LongTextQuestion.tsx`
  - `SingleChoiceQuestion.tsx`
  - `MultipleChoiceQuestion.tsx`
  - `NumericQuestion.tsx` - with range/scale generator
  - `DateQuestion.tsx`
  - `TimeQuestion.tsx`
- `src/api/forms.ts` - Form CRUD API calls

**Question Types Implementation:**
1. **Short Text** (up to 512 chars) - `<input type="text" maxLength={512}>`
2. **Long Text** (up to 4096 chars) - `<textarea maxLength={4096}>`
3. **Single Choice** - Radio buttons with custom options
4. **Multiple Choice** - Checkboxes with option count validation
5. **Numeric** - Number input or scale generator (start, end, step)
6. **Date** - `<input type="date">`
7. **Time** - `<input type="time">`

**Acceptance Criteria:**
- [ ] Form title and description inputs
- [ ] Toggle for "allow anonymous users"
- [ ] Add question button
- [ ] Each question has:
  - [ ] Question text input
  - [ ] Type selector dropdown
  - [ ] Required checkbox
  - [ ] Image upload for question
- [ ] Dynamic question editor based on type
- [ ] For single/multiple choice: add/remove options
- [ ] For numeric: option to specify list OR range with step
- [ ] Form submission creates form in backend
- [ ] File upload handling for images (multipart/form-data)

**Verification:** Create form with all 7 question types, verify saved correctly, can retrieve and display.

---

### 6. Clone Question (5% of grade)
**PDF Section:** Functional Requirement #5
**Backend API:** Handled client-side, saved via PUT `/edit-form/:id`
**Frontend Files:**
- `src/components/QuestionEditor.tsx` - Clone button

**Acceptance Criteria:**
- [ ] Clone button on each question
- [ ] Duplicates question with all properties (text, type, options, required status)
- [ ] Cloned question inserted after original
- [ ] Image is also duplicated if present

**Verification:** Create question with options and image, clone it, verify duplicate appears.

---

### 7. Update Question (7.5% of grade)
**PDF Section:** Functional Requirement #6
**Backend API:** PUT `/edit-form/:id` (forms-service:3002)
**Frontend Files:**
- `src/components/QuestionEditor.tsx` - Inline editing

**Acceptance Criteria:**
- [ ] All question fields editable inline
- [ ] Changes saved on form submit
- [ ] Can change question type (resets type-specific data)
- [ ] Can update image

**Verification:** Edit question text, type, options; save form; reload and verify changes.

---

### 8. Delete Question (5% of grade)
**PDF Section:** Functional Requirement #7
**Backend API:** Handled client-side, saved via PUT `/edit-form/:id`
**Frontend Files:**
- `src/components/QuestionEditor.tsx` - Delete button

**Acceptance Criteria:**
- [ ] Delete button on each question
- [ ] Confirmation dialog before delete
- [ ] Question removed from list
- [ ] Changes saved on form submit

**Verification:** Delete question, save form, verify question no longer appears.

---

### 9. Reorder Questions (Included in Form Management 7.5%)
**PDF Section:** Functional Requirement #8
**Backend API:** POST `/form/:id/reorder` (forms-service:3002)
**Frontend Files:**
- `src/components/FormBuilder.tsx` - Drag-and-drop question reordering
- May use `@dnd-kit/core` or `react-beautiful-dnd`

**Acceptance Criteria:**
- [ ] Drag handle on each question
- [ ] Visual feedback during drag
- [ ] Questions reorder in real-time
- [ ] API call to save new order

**Verification:** Drag questions to reorder, save, verify order persists.

---

### 10. Lock Form (5% of grade)
**PDF Section:** Functional Requirement #10 (editors can lock form)
**Backend API:** Needs backend endpoint (currently `is_locked` field exists but no endpoint)
**Frontend Files:**
- `src/components/FormSettings.tsx` - Lock toggle button
- `src/api/forms.ts` - Lock/unlock API call

**Acceptance Criteria:**
- [ ] Toggle button to lock/unlock form
- [ ] Only owner and editors can lock
- [ ] Locked forms cannot be filled
- [ ] Visual indicator when form is locked

**Verification:** Lock form, attempt to fill it, verify error message.

**Note:** Need backend endpoint: PUT `/forms/:id/lock` or PATCH `/forms/:id` with `{is_locked: true}`.

---

### 11. Collaborator Management (7.5% of grade)
**PDF Section:** Functional Requirement #10
**Backend API:** POST `/forms/:id/collaborators` (forms-service:3002)
**Frontend Files:**
- `src/pages/FormCollaborators.tsx` - Manage collaborators
- `src/components/CollaboratorList.tsx` - List of collaborators
- `src/components/AddCollaborator.tsx` - Add collaborator form
- `src/api/collaborators.ts` - Collaborator API calls

**Acceptance Criteria:**
- [ ] Form to add collaborator by email
- [ ] Select role: viewer or editor
- [ ] List current collaborators with roles
- [ ] Remove collaborator button (owner only)
- [ ] Only form owner can manage collaborators
- [ ] Editors can edit form but not manage collaborators

**Verification:** Add collaborator as owner, login as collaborator, verify access level.

**Note:** Backend needs GET `/forms/:id/collaborators` and DELETE endpoints.

---

### 12. Form Sharing (Included in Form Management)
**PDF Section:** Functional Requirement #9
**Frontend Files:**
- `src/components/ShareFormButton.tsx` - Copy link button

**Acceptance Criteria:**
- [ ] Button to copy form fill URL
- [ ] URL format: `/fill/{formId}`
- [ ] Toast notification on copy
- [ ] QR code generation (optional enhancement)

**Verification:** Click share button, paste URL in new tab, verify form loads.

---

### 13. Fill Form (Filling functionality included in Creation 12.5%)
**PDF Section:** Functional Requirements #2, #3(g)
**Backend API:** POST `/form/:id/submit` (forms-service:3002)
**Frontend Files:**
- `src/pages/FillForm.tsx` - Public form filling interface
- `src/components/FormQuestion.tsx` - Render question based on type
- `src/components/QuestionTypes/` - Answer input components

**Acceptance Criteria:**
- [ ] Load form by ID (public or authenticated)
- [ ] Render all questions with appropriate inputs
- [ ] Mark required questions
- [ ] Client-side validation:
  - [ ] Required fields filled
  - [ ] Text length limits
  - [ ] Multiple choice: correct number of selections
  - [ ] Numeric: value in valid range
- [ ] Submit answers with images
- [ ] Success message after submission
- [ ] Anonymous submission if form allows

**Verification:**
- Fill form while logged in → verify submission recorded with user_id
- Fill anonymous form while logged out → verify submission recorded with null user_id
- Try submitting locked form → verify error

---

### 14. View Responses - Individual (10% of grade)
**PDF Section:** Functional Requirement #12, bullet 1
**Backend API:**
- GET `/my-results` (forms-service:3002) - list responses
- GET `/response/:id` (forms-service:3002) - single response detail
**Frontend Files:**
- `src/pages/FormResponses.tsx` - Response list
- `src/pages/ResponseDetail.tsx` - Single response view

**Acceptance Criteria:**
- [ ] List all responses for form
- [ ] Show submission time, user name/email (or "Anonymous")
- [ ] Click to view individual response
- [ ] Display all questions with answers
- [ ] Show images if uploaded
- [ ] For choice questions, display selected option text

**Verification:** Submit form multiple times, view list, click to see details.

---

### 15. View Responses - Grouped (Included in 10% above)
**PDF Section:** Functional Requirement #12, bullet 2
**Backend API:** GET `/form/:id/grouped-answers` (forms-service:3002)
**Frontend Files:**
- `src/pages/GroupedResponses.tsx` - Aggregated view

**Acceptance Criteria:**
- [ ] Group responses by question
- [ ] For text questions: list all answers
- [ ] For choice questions: show count/percentage per option
- [ ] For numeric: show min, max, average
- [ ] For date/time: show range
- [ ] Chart visualization (optional: bar chart for choices)

**Verification:** Submit form multiple times with varied answers, view grouped view, verify aggregations.

---

### 16. Export to XLSX (10% of grade)
**PDF Section:** Functional Requirement #12, bullet 3
**Backend API:** GET `/form/:responseId/export` (forms-service:3002)
**Frontend Files:**
- `src/components/ExportButton.tsx` - Trigger download

**Acceptance Criteria:**
- [ ] Export button on response list
- [ ] Downloads .xlsx file with questions and answers
- [ ] Filename includes form/response ID
- [ ] Works for individual responses (backend supports this)

**Verification:** Click export, open file, verify data matches.

**Note:** Backend currently exports single response. For all responses, may need to export grouped data (requires backend endpoint or client-side generation with library like `xlsx`).

---

## Non-Functional Requirements

### Routing Structure
```
/                    - Landing page (redirect to /login if not authenticated, /dashboard if authenticated)
/login               - Login page
/register            - Register page
/dashboard           - User dashboard (list of forms, search)
/forms/new           - Create new form
/forms/:id/edit      - Edit form (builder interface)
/forms/:id/settings  - Form settings (collaborators, lock, share)
/fill/:id            - Public form fill page
/forms/:id/responses - Response list
/forms/:id/responses/grouped - Grouped response view
/responses/:id       - Individual response detail
/profile             - User profile (edit, delete account)
```

### Authentication Flow
1. User visits protected route → redirect to /login
2. Login → store JWT in localStorage
3. AuthContext provides user state globally
4. API client includes `Authorization: Bearer {token}` header
5. Token expiration → logout and redirect to login

### State Management
- **Auth State:** React Context (`AuthContext`)
- **Server State:** TanStack Query (React Query) for caching API responses
- **Form State:** Local state in FormBuilder component

### Styling
- Tailwind CSS for utility-first styling
- Responsive design (mobile-first)
- Semantic HTML for accessibility
- ARIA labels for screen readers

### Error Handling
- API errors displayed as toast notifications
- Form validation errors shown inline
- Network errors with retry option
- 404 page for not found routes

---

## Testing Requirements

### Unit Tests (Jest + React Testing Library)
**PDF Section:** Page 3 - Unit tests
**Files:** `src/**/*.test.tsx`

Test Coverage:
- [ ] Registration form validation
- [ ] Login form validation
- [ ] Question type components render correctly
- [ ] Form search filtering logic
- [ ] Token storage utilities

### Integration/E2E Tests (Playwright)
**PDF Section:** Page 3 - Integration tests
**Files:** `tests/e2e/*.spec.ts`

Required Tests:
- [ ] [UI] User registration flow
- [ ] [UI] User login flow
- [ ] [UI] Form search by name
- [ ] [API] User CRUD operations (via UI)
- [ ] [API] Form CRUD operations (via UI)
- [ ] [API] Form filling with all question types
- [ ] [API] Form locking
- [ ] [API] Adding collaborators
- [ ] [API] Viewing responses (individual and grouped)

Manual Tests:
- [ ] Form filling on UI
- [ ] XLSX export download and open

---

## Backend Modifications Needed

The following backend endpoints are missing or need modification:

### Required New Endpoints:
1. **User CRUD:**
   - `GET /users/me` - Get current user profile
   - `PUT /users/me` - Update user profile
   - `DELETE /users/me` - Delete account

2. **Collaborators:**
   - `GET /forms/:id/collaborators` - List collaborators
   - `DELETE /forms/:id/collaborators/:userId` - Remove collaborator

3. **Form Locking:**
   - `PATCH /forms/:id` - Update form properties (including `is_locked`)

4. **Export All Responses:**
   - `GET /forms/:id/export` - Export all form responses to XLSX

5. **Form Search/Filter:**
   - Current `GET /my-forms` could accept query param `?search=term`

### CORS Configuration:
Backend already has `app.use(cors())` which allows all origins. For production, should restrict to frontend origin.

---

## Implementation Priority

### Phase 1: Core Features (Week 1)
1. ✅ Scaffold frontend
2. ✅ Setup routing and layout
3. Authentication (register, login)
4. Dashboard with form list
5. Form builder (create form with all question types)

### Phase 2: Advanced Features (Week 2)
6. Form editing (update, delete, reorder, clone questions)
7. Form filling (public and authenticated)
8. Collaborator management
9. Form locking and sharing

### Phase 3: Responses & Export (Week 3)
10. View individual responses
11. View grouped responses
12. XLSX export

### Phase 4: Testing & Polish (Week 4)
13. Unit tests
14. E2E tests with Playwright
15. Accessibility improvements
16. Responsive design refinements
17. Error handling and loading states
18. Documentation (README)

---

## Deployment Checklist

- [ ] Environment variables documented
- [ ] Build script works (`npm run build`)
- [ ] Backend services start with `npm run dev`
- [ ] Frontend connects to backend APIs
- [ ] All tests pass
- [ ] README with setup instructions
- [ ] Git commits follow best practices (meaningful messages, regular commits)

---

## Success Criteria

Each feature maps to a percentage of the grade. All items should be:
1. ✅ Implemented in frontend
2. ✅ Connected to backend API (or documented if backend support missing)
3. ✅ Tested (unit or E2E as specified)
4. ✅ Documented in README
5. ✅ Accessible and responsive

Total functionality: 100% of project grade.
