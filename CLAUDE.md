# prog2review

Automated code review and oral examination system for Stockholm University programming courses.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** PostgreSQL (all storage including code and audio)
- **Cache:** Redis (semaphores, job queues, email queue)
- **Data Fetching:** TanStack React Query v4
- **Code Display:** highlight.js (syntax highlighting)
- **AI Review:** OpenAI GPT-5
- **Voice Agent:** ElevenLabs Conversational AI
- **Email:** dsv-wrapper (Python worker) via lambda@dsv.su.se
- **Deployment:** Kubernetes + Docker
- **Auth:** JWT cookie-based (development: trust login, production: SAML upstream)

## Key Architecture Decisions

1. **Two portals:** Admin (upload, review, grade) + Student (book, take seminar, view results)
2. **Two-stage AI pipeline:** GPT reviews code and creates discussion plan, ElevenLabs only receives condensed discussion points (code too large for voice agent context)
3. **All storage in PostgreSQL:** Code as TEXT, audio as BYTEA - no separate object storage
4. **Auth via JWT:** Development uses trust login (`/login`), production integrates with upstream SAML. Session stored in httpOnly cookie.
5. **Source files:** Supports common programming languages (.java, .py, .js, .ts, .c, .cpp, .go, .rs, etc.)
6. **Language choice:** Students choose Swedish or English when booking
7. **Flexible scheduling:** Students book a time window (e.g., 10-11), start anytime within it
8. **Max 8 concurrent seminars** per time slot

## Conventions

- Use raw SQL via `postgres` package (NO ORM)
- Use Redis semaphores for concurrent API call limiting
- Store all timestamps in UTC
- Use BIGINT for all primary keys (from external Snowflake generator)
- Submission statuses: 'pending', 'reviewing', 'reviewed', 'seminar_pending', 'seminar_completed', 'approved', 'rejected'
- Seminar statuses: 'booked', 'waiting', 'in_progress', 'completed', 'failed', 'no_show'

## Commands

```bash
# Development
npm run dev

# Database
npm run db:migrate

# Docker
docker-compose up -d    # Local dev with Postgres + Redis
docker build -t prog2review .

# Kubernetes
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/prod

# Terraform (GitHub environments/secrets)
cd terraform && terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## Environment Variables

See `.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `COMPILER_URL` - Java compiler service (default: http://localhost:3001)
- `OPENAI_API_KEY` - GPT-5 access
- `ELEVENLABS_API_KEY` - Voice agent access
- `JWT_SECRET` - Secret for JWT signing (generate random string)
- `ADMIN_USERNAMES` - Comma-separated admin usernames

## File Structure

```
terraform/            # GitHub environments and secrets (WireGuard VPN + kubectl)
├── main.tf           # Environment and secret resources
├── variables.tf      # Input variables
├── outputs.tf        # Output values
└── terraform.tfvars.example
compiler/             # Sandboxed Java compiler container
├── Dockerfile        # Alpine + OpenJDK 21 + Node.js
├── server.ts         # HTTP /compile endpoint
└── package.json
src/
├── app/              # Next.js App Router pages and API routes
│   ├── (student)/    # Student portal (route group with top nav)
│   ├── admin/        # Admin portal (sidebar layout)
│   ├── api/auth/     # Auth endpoints (login, logout, me)
│   └── login/        # Development login page
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   ├── logo.tsx      # Shared brand logo link
│   ├── header-actions.tsx  # Language switcher + dev login
│   └── footer.tsx    # Shared footer
├── lib/              # Core libraries (db, redis, auth, openai, elevenlabs)
├── middleware.ts     # Route protection (auth checks)
├── services/         # Business logic (reviewService, compilationService)
└── types/            # TypeScript types
```

## UI Components (shadcn/ui)

Using shadcn/ui with blue color scheme. Available components:
- button, card, input, label, table, tabs, badge
- dialog, dropdown-menu, select, form
- separator, avatar, sonner (toast notifications)

## Data Fetching (TanStack React Query v4)

Using `@tanstack/react-query@4` for client-side data fetching with caching and mutations.

**Provider setup** (`src/components/providers.tsx`):
- QueryClient with 60s stale time, refetchOnWindowFocus disabled
- Wraps the app in `src/app/layout.tsx`

**Usage pattern:**
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetch data
const { data, isLoading } = useQuery({
  queryKey: ["submission", submissionId],
  queryFn: () => fetchSubmission(submissionId),
  enabled: !!submissionId,
});

// Mutations with cache invalidation
const mutation = useMutation({
  mutationFn: () => triggerReviewApi(submissionId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
  },
});
```

## Code Display (highlight.js)

Using `highlight.js` for syntax highlighting via the `CodeViewer` component.

**Component:** `src/components/code-viewer.tsx`

**Props:**
- `code: string` - The source code to display
- `filename?: string | null` - Used to auto-detect language from extension
- `language?: string` - Override language detection (e.g., "java", "python")
- `showLineNumbers?: boolean` - Show line numbers (default: true)
- `highlightLines?: number[]` - Line numbers to highlight (e.g., error lines)
- `className?: string` - Additional CSS classes

**Supported languages:** Java, Python, JavaScript, TypeScript, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, R, MATLAB, SQL, Shell/Bash

**Usage:**
```tsx
import { CodeViewer } from "@/components/code-viewer";

<CodeViewer
  code={submission.file_content}
  filename={submission.filename}
  highlightLines={errorLines}
/>
```

**Styling:** Uses official `highlight.js/styles/github.css` theme, imported in the component.

## Language Detection

The system automatically detects the programming language from the file extension and tailors the GPT review accordingly.

**Supported languages:** Java, Python, JavaScript, TypeScript, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, Scala, R, MATLAB, SQL, Shell/Bash

**How it works:**
- `detectLanguage(filename)` in `src/lib/openai/index.ts` maps extensions to language names
- GPT system prompt and user prompt are dynamically built for the detected language
- Review feedback uses language-appropriate conventions and idioms

## Java Compilation Service

Sandboxed Java compilation check that runs **only for .java files** before GPT review. Uses a separate Docker container (`java-compiler`) with security constraints. Non-Java submissions skip compilation entirely.

**Container security:**
- `read_only: true` root filesystem
- `tmpfs: /tmp:size=32M` for compilation workspace
- `cap_drop: ALL` - no capabilities
- `cpus: 0.5`, `mem_limit: 256m`
- 30s compilation timeout

**Compilation Service** (`src/services/compilationService.ts`):
- `parseFilesFromContent(content, defaultFilename)` - Extract .java files using `// ===== filename =====` markers
- `compileSubmission(submissionId)` - Compile submission and store results
- `formatCompilationErrorsForReview(result)` - Format errors for GPT context

**Database fields** (submissions table):
- `compile_success` - Boolean compilation result
- `compile_output` - Raw compiler output
- `compile_errors` - JSONB array of parsed errors (file, line, message, type)
- `compiled_at` - Timestamp

**Flow:** Compilation runs first in `processSubmissionReview()`. If compilation fails, errors are prepended to GPT prompt for context. Review continues regardless (pedagogical value).

## OpenAI Integration

The GPT integration (`src/lib/openai/index.ts`) handles code review and discussion plan generation.

**Key types:**
- `CodeIssue` - type, line, description, severity (critical/major/minor)
- `DiscussionPoint` - topic, question, context, expectedAnswer, followUpQuestions
- `ReviewResult` - feedback, issues[], discussionPlan[], rawResponse (no score - grading is P/F only)

**Main functions:**
- `reviewCode(code, filename, customPrompt)` - Reviews code (auto-detects language from filename) and returns structured result
- `getCondensedDiscussionPlan(discussionPlan)` - Condenses plan for ElevenLabs voice context
- `isJavaFile(filename)` - Check if file is Java (used to conditionally run compilation)

**Review Service** (`src/services/reviewService.ts`):
- `processSubmissionReview(submissionId)` - Full review workflow with semaphore management
- `canStartReview(submissionId)` - Checks if submission is eligible for review
- `batchReviewSubmissions(submissionIds)` - Process multiple reviews sequentially

**API Routes:**
- `POST /api/admin/reviews/trigger` - Trigger single review `{ submissionId }`
- `POST /api/admin/reviews/batch` - Trigger batch review `{ submissionIds[] }` (max 500)
- `GET /api/admin/reviews/[submissionId]` - Get review details including condensed discussion plan

## Admin Assignment Management

Full CRUD for assignments and courses at `/admin/assignments`.

**API Routes:**
- `GET /api/admin/assignments` - List all assignments and courses
- `POST /api/admin/assignments` - Create assignment (with optional new course)
- `GET /api/admin/assignments/[id]` - Get single assignment
- `PUT /api/admin/assignments/[id]` - Update assignment
- `DELETE /api/admin/assignments/[id]` - Delete assignment (only if no submissions)

**Creating assignment with new course:**
```json
{
  "name": "Lab 1",
  "description": "Calculator assignment",
  "reviewPrompt": "Custom GPT instructions...",
  "seminarPrompt": "Custom voice agent instructions...",
  "dueDate": "2025-12-01",
  "newCourse": {
    "code": "DA2001",
    "name": "Programmering II",
    "semester": "HT2025"
  }
}
```

**Database queries** (`src/lib/db/queries.ts`):
- `createAssignment()`, `updateAssignment()`, `deleteAssignment()`
- `getAllAssignments()`, `getAssignmentById()`
- `createCourse()`, `getAllCourses()`

## Bulk Upload (Moodle + VPL)

Upload student submissions at `/admin/upload`. Auto-detects format.

**Supported formats:**

1. **Moodle ZIP** - Standard Moodle assignment export
   ```
   FirstName LastName_123456_assignsubmission_file_/
   └── Solution.java (or .py, .js, etc.)
   ```

2. **VPL Export** - Virtual Programming Lab export from DSV
   ```
   FirstName LastName 1234 username@su_se/
   ├── 2025-09-30-19-36-15/
   │   └── assignment.py (or .java, etc.)
   └── 2025-09-30-19-36-15.ceg/  (ignored - metadata)
   ```

**API Route:** `POST /api/admin/upload`
- Accepts: `multipart/form-data` with `file` (ZIP) and `assignmentId`
- Returns: `{ success, format, uploaded, failed, results, errors }`

**Format detection** (`src/app/api/admin/upload/route.ts`):
- VPL: Folders ending with `@su_se` or `@su.se`
- Moodle: Folders with `_\d+_assignsubmission_file_` pattern
- Username extraction: VPL uses `username@su_se`, Moodle derives from name

## Student Booking System

Student-facing seminar booking functionality at `/book-seminar`.

**API Routes:**
- `GET /api/student/assignments` - Get student's assignments with submission status and booking info
- `GET /api/student/slots?assignmentId=X` - Get available seminar slots with capacity
- `POST /api/student/book` - Book a seminar `{ submissionId, slotId, language: 'en'|'sv' }`
- `GET /api/student/seminars` - Get student's booked/completed seminars

**Booking rules:**
- Student must have a reviewed submission (status='reviewed')
- Cannot book if seminar already exists (excluding failed/no_show)
- Slot must have available capacity (max 8 concurrent)
- Slot window_end must be in the future
- Language: English ('en') or Swedish ('sv')

**Database queries** (`src/lib/db/queries.ts`):
- `getAssignmentsWithSubmissionsByStudent(studentId)` - Assignments with submission/booking status
- `getSeminarsByStudent(studentId)` - Seminars with slot and assignment details
- `getAvailableSeminarSlotsWithCount(assignmentId)` - Slots with booked_count and spots_available

## Internationalization (i18n)

Using `next-intl` with cookie-based locale detection (no URL prefixes).

**Supported locales:** English (`en`, default), Swedish (`sv`)

**Configuration:**
- `src/i18n.ts` - next-intl request config, reads `locale` cookie
- `next.config.ts` - Uses `withNextIntl` plugin
- `src/app/layout.tsx` - Wraps app with `NextIntlClientProvider`

**Message files:**
```
src/messages/
├── en/
│   ├── common.json    # Nav, buttons, status badges, language
│   ├── student.json   # Student portal (dashboard, booking, results)
│   ├── admin.json     # Admin portal (dashboard, upload, seminars, grading)
│   ├── auth.json      # Login page
│   └── seminar.json   # Seminar room UI
└── sv/
    └── (same structure with Swedish translations)
```

**Usage in components:**

Server Component:
```tsx
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('student.dashboard');
return <h1>{t('title')}</h1>;
```

Client Component:
```tsx
'use client';
import { useTranslations } from 'next-intl';
const t = useTranslations('common');
return <button>{t('actions.save')}</button>;
```

**Language switcher:**
- `src/components/language-switcher.tsx` - Globe dropdown in both portal headers
- Sets `locale` cookie with 1-year expiry, then calls `router.refresh()`
