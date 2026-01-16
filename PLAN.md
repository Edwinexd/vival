# prog2review - Stockholm University

## Overview
Automated code review and oral examination system for programming courses.

## Tech Stack
- **Database:** PostgreSQL
- **Cache/Semaphores:** Redis
- **Frontend/Backend:** Next.js 14+ (App Router, TypeScript)
- **AI Review:** OpenAI GPT-5
- **Voice Agent:** ElevenLabs Conversational AI
- **File Storage:** PostgreSQL (code as TEXT, audio as BYTEA)
- **Auth:** SAML SSO (Stockholm University)
- **Deployment:** Kubernetes + Docker

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Admin     │   Upload    │   Review    │   Seminar   │  API    │
│  Dashboard  │   Portal    │   Queue     │   Agent     │ Routes  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Service Layer                            │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Auth      │   Upload    │   Review    │   Seminar   │ Grading │
│  Service    │   Service   │   Service   │   Service   │ Service │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       ▼             ▼             ▼             ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│  PostgreSQL │ │    Redis    │ │   OpenAI    │ │   ElevenLabs    │
│   Database  │ │   Cache     │ │   GPT-5     │ │   Agent API     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘
```

---

## Database Schema

### Tables

#### `admins`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique, login |
| password_hash | VARCHAR(255) | bcrypt hash |
| name | VARCHAR(255) | Display name |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `students`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| student_id | VARCHAR(50) | University student ID |
| email | VARCHAR(255) | |
| name | VARCHAR(255) | |
| created_at | TIMESTAMP | |

#### `courses`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(20) | Course code (e.g., "PROG2") |
| name | VARCHAR(255) | Course name |
| semester | VARCHAR(20) | e.g., "VT2026" |
| created_at | TIMESTAMP | |

#### `assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| course_id | UUID | FK to courses |
| name | VARCHAR(255) | Assignment name |
| description | TEXT | Assignment description |
| review_prompt | TEXT | Custom GPT prompt for this assignment |
| seminar_prompt | TEXT | ElevenLabs agent system prompt |
| due_date | TIMESTAMP | |
| created_at | TIMESTAMP | |

#### `submissions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| student_id | UUID | FK to students |
| assignment_id | UUID | FK to assignments |
| filename | VARCHAR(255) | Original filename |
| file_content | TEXT | Full source code content |
| file_hash | VARCHAR(64) | SHA-256 hash (plagiarism detection) |
| status | ENUM | 'pending', 'reviewing', 'reviewed', 'seminar_pending', 'seminar_completed', 'approved', 'rejected' |
| uploaded_at | TIMESTAMP | |
| uploaded_by | UUID | FK to admins (who uploaded) |

#### `reviews`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| submission_id | UUID | FK to submissions |
| gpt_model | VARCHAR(50) | Model used |
| prompt_used | TEXT | Full prompt sent |
| raw_response | TEXT | Full GPT response |
| parsed_score | INTEGER | 0-100 score |
| parsed_feedback | TEXT | Structured feedback |
| issues_found | JSONB | Array of issues |
| discussion_plan | JSONB | Condensed discussion plan for ElevenLabs |
| created_at | TIMESTAMP | |

#### `seminar_slots`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| assignment_id | UUID | FK to assignments |
| window_start | TIMESTAMP | Window opens (e.g., 10:00) |
| window_end | TIMESTAMP | Window closes (e.g., 11:00) |
| max_concurrent | INTEGER | Max simultaneous seminars (default 8) |
| created_by | UUID | FK to admins |
| created_at | TIMESTAMP | |

#### `seminars`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| submission_id | UUID | FK to submissions |
| slot_id | UUID | FK to seminar_slots |
| language | ENUM | 'sv', 'en' - student's choice |
| elevenlabs_conversation_id | VARCHAR(255) | ElevenLabs session ID |
| status | ENUM | 'booked', 'waiting', 'in_progress', 'completed', 'failed', 'no_show' |
| booked_at | TIMESTAMP | When student booked |
| started_at | TIMESTAMP | When student actually started |
| ended_at | TIMESTAMP | |
| duration_seconds | INTEGER | Target: 30 min |

#### `transcripts`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| seminar_id | UUID | FK to seminars |
| speaker | ENUM | 'agent', 'student' |
| text | TEXT | Transcript text |
| timestamp_ms | INTEGER | Offset from start |
| confidence | FLOAT | Speech recognition confidence |

#### `recordings`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| seminar_id | UUID | FK to seminars |
| audio_data | BYTEA | Full audio recording |
| mime_type | VARCHAR(50) | e.g., 'audio/webm', 'audio/mp3' |
| duration_seconds | INTEGER | Recording length |
| size_bytes | INTEGER | File size |
| created_at | TIMESTAMP | |

#### `grades`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| submission_id | UUID | FK to submissions |
| reviewed_by | UUID | FK to admins |
| review_score | INTEGER | GPT review score |
| seminar_score | INTEGER | Admin seminar assessment |
| final_grade | ENUM | 'pass', 'fail', 'pending_resubmit' |
| admin_notes | TEXT | Internal notes |
| student_feedback | TEXT | Feedback shown to student |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## Redis Usage

### Keys Structure

```
prog2review:semaphore:gpt:{assignment_id}       # Limit concurrent GPT calls
prog2review:semaphore:seminar:{slot_id}         # Track active seminars per slot
prog2review:active_seminars:{slot_id}           # Set of active seminar IDs
prog2review:queue:review                        # Review job queue
prog2review:session:{session_id}                # User sessions
prog2review:rate_limit:gpt                      # Rate limiting
```

### Semaphore Implementation
- Max 5 concurrent GPT reviews per assignment
- Max 8 concurrent seminars per time slot (configurable)
- Automatic release on timeout (35 min for seminars)

---

## Seminar Scheduling System

### Constraints
- **Seminar duration:** 30 minutes
- **Max concurrent:** 8 seminars at once per slot
- **Flexible start:** Student can start anytime within their booked window

### Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Seminar Booking Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Admin creates slots     2. Student books        3. Student starts    │
│  ┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Create time windows │    │ View available  │    │ Within window,  │  │
│  │ e.g., 10:00-11:00   │───▶│ slots, pick one │───▶│ click "Start"   │  │
│  │ capacity: 8         │    │                 │    │                 │  │
│  └─────────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                            │             │
│                                                            ▼             │
│  4. Concurrency check       5. Seminar runs         6. Complete          │
│  ┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Redis: active < 8?  │    │ 30 min with     │    │ Release slot,   │  │
│  │ Yes: acquire slot   │───▶│ ElevenLabs      │───▶│ save transcript │  │
│  │ No: "please wait"   │    │ agent           │    │                 │  │
│  └─────────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Booking Logic

```typescript
// Check slot availability for booking
async function canBookSlot(slotId: string): Promise<boolean> {
  const slot = await db.seminarSlots.findUnique({ where: { id: slotId } });
  const bookedCount = await db.seminars.count({
    where: { slot_id: slotId, status: { notIn: ['completed', 'failed', 'no_show'] } }
  });
  return bookedCount < slot.max_concurrent;
}

// Check if student can START their seminar now
async function canStartSeminar(seminarId: string): Promise<{ allowed: boolean; reason?: string }> {
  const seminar = await db.seminars.findUnique({
    where: { id: seminarId },
    include: { slot: true }
  });

  const now = new Date();

  // Check if within time window
  if (now < seminar.slot.window_start) {
    return { allowed: false, reason: 'Window not open yet' };
  }
  if (now > seminar.slot.window_end) {
    return { allowed: false, reason: 'Window has closed' };
  }

  // Check concurrent limit via Redis
  const activeCount = await redis.scard(`prog2review:active_seminars:${seminar.slot_id}`);
  if (activeCount >= seminar.slot.max_concurrent) {
    return { allowed: false, reason: 'All slots busy, please wait' };
  }

  return { allowed: true };
}

// Acquire seminar slot (atomic)
async function acquireSeminarSlot(seminarId: string, slotId: string): Promise<boolean> {
  const key = `prog2review:active_seminars:${slotId}`;
  const maxKey = `prog2review:seminar_max:${slotId}`;

  // Lua script for atomic check-and-add
  const script = `
    local current = redis.call('SCARD', KEYS[1])
    local max = tonumber(redis.call('GET', KEYS[2]) or '8')
    if current < max then
      redis.call('SADD', KEYS[1], ARGV[1])
      return 1
    end
    return 0
  `;

  const acquired = await redis.eval(script, 2, key, maxKey, seminarId);
  return acquired === 1;
}

// Release slot when done
async function releaseSeminarSlot(seminarId: string, slotId: string): Promise<void> {
  await redis.srem(`prog2review:active_seminars:${slotId}`, seminarId);
}
```

### Student Waiting UI

When a student's slot is full:

```typescript
// Poll for availability (or use WebSocket)
interface WaitingStatus {
  position: number;        // Rough queue position
  activeCount: number;     // Currently running
  maxConcurrent: number;   // Slot capacity
  estimatedWait: string;   // "~5 minutes"
}

// API endpoint: GET /api/seminars/{id}/status
async function getSeminarStatus(seminarId: string): Promise<WaitingStatus> {
  const seminar = await db.seminars.findUnique({ include: { slot: true } });
  const activeCount = await redis.scard(`prog2review:active_seminars:${seminar.slot_id}`);

  return {
    position: activeCount >= seminar.slot.max_concurrent ? activeCount - seminar.slot.max_concurrent + 1 : 0,
    activeCount,
    maxConcurrent: seminar.slot.max_concurrent,
    estimatedWait: activeCount >= seminar.slot.max_concurrent ? '~5-10 minutes' : 'Ready now',
  };
}
```

### Admin: Create Slots

```typescript
// Bulk create slots for a day
interface CreateSlotsRequest {
  assignment_id: string;
  date: string;              // '2026-01-20'
  windows: {
    start: string;           // '10:00'
    end: string;             // '11:00'
  }[];
  max_concurrent: number;    // 8
}

// Example: Create 10:00-11:00, 11:00-12:00, 13:00-14:00 slots
await createSlots({
  assignment_id: 'xxx',
  date: '2026-01-20',
  windows: [
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
  ],
  max_concurrent: 8,
});
```

---

## Features & Pages

### Student Portal (`/`)
- **Dashboard** (`/`) - See submissions, booked seminars, results
- **Book Seminar** (`/book`) - View available slots, select language (SV/EN), book
- **Seminar Room** (`/seminar/{id}`) - Waiting room + ElevenLabs agent interface
- **Results** (`/results`) - View grades and feedback

### Admin Dashboard (`/admin`)
- Overview statistics
- Recent submissions
- Pending reviews
- Quick actions

### Bulk Upload (`/admin/upload`)
- Drag & drop zone for ZIP files
- CSV mapping (student_id -> file mapping)
- Progress indicator
- Validation results

### Submissions List (`/admin/submissions`)
- Filterable by course, assignment, status
- Bulk actions (re-review, schedule seminar)
- Quick preview modal

### Review Queue (`/admin/reviews`)
- Pending reviews
- GPT review results
- Manual override options
- Approve/reject buttons

### Seminar Management (`/admin/seminars`)
- Schedule seminars
- Live seminar dashboard
- Transcript viewer
- Recording playback (if available)

### Grading (`/admin/grading`)
- Combined view: code + review + transcript
- Pass/fail decision
- Feedback editor
- Bulk export grades

### Settings (`/admin/settings`)
- API key management
- Prompt templates
- Course/assignment CRUD

---

## API Routes

### Upload
- `POST /api/upload/bulk` - Bulk upload ZIP
- `POST /api/upload/single` - Single file upload
- `GET /api/upload/status/{job_id}` - Upload job status

### Submissions
- `GET /api/submissions` - List submissions
- `GET /api/submissions/{id}` - Get submission details
- `PATCH /api/submissions/{id}` - Update submission status

### Reviews
- `POST /api/reviews/trigger` - Trigger GPT review
- `GET /api/reviews/{id}` - Get review results
- `POST /api/reviews/{id}/regenerate` - Re-run review

### Seminars
- `POST /api/seminars/schedule` - Schedule seminar
- `GET /api/seminars/{id}` - Get seminar details
- `GET /api/seminars/{id}/transcript` - Get transcript
- `POST /api/seminars/webhook` - ElevenLabs webhook

### Grading
- `POST /api/grades` - Submit grade
- `GET /api/grades/export` - Export grades CSV

---

## External Integrations

### OpenAI GPT-5
```typescript
interface ReviewRequest {
  code: string;
  assignment: {
    name: string;
    description: string;
    criteria: string[];
  };
  customPrompt?: string;
}

interface ReviewResponse {
  score: number;
  summary: string;
  issues: {
    severity: 'critical' | 'major' | 'minor';
    line?: number;
    description: string;
    suggestion: string;
  }[];
  strengths: string[];
  questionsForSeminar: string[];
}
```

### ElevenLabs Conversational AI

#### Agent Setup
We create one ElevenLabs agent per assignment (or reuse with dynamic context).

```typescript
interface ElevenLabsAgentConfig {
  name: string;
  first_message: string;           // "Hi! Let's discuss your code..."
  system_prompt: string;           // Assignment-specific + student context
  language: 'en' | 'sv';
  voice_id: string;
  llm: {
    model: 'gpt-4' | 'claude';     // ElevenLabs supports multiple LLMs
    temperature: number;
  };
  conversation: {
    max_duration_seconds: number;   // e.g., 900 (15 min)
  };
}
```

#### Two-Stage Context Pipeline

Student code is too large for ElevenLabs context. We use GPT to distill discussion points first.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Student Code   │────▶│  GPT-5 Review   │────▶│  ElevenLabs     │
│  (full source)  │     │  + Discussion   │     │  Agent          │
│                 │     │  Points         │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │                       │
       │  Full code             │  Condensed:           │  Only receives:
       │  submitted             │  - Summary            │  - Discussion plan
       │                        │  - Key issues         │  - Questions to ask
       │                        │  - Questions          │  - Expected answers
       │                        │  - Expected answers   │  - Grading rubric
```

**Stage 1: GPT Review & Discussion Planning**

```typescript
interface GPTReviewOutput {
  // Code review
  score: number;
  summary: string;
  issues: Issue[];
  strengths: string[];

  // Discussion plan for ElevenLabs (condensed)
  discussionPlan: {
    overview: string;           // 2-3 sentence summary of what code does
    keyTopics: {
      topic: string;            // e.g., "Recursion implementation"
      question: string;         // "Can you explain how your recursive call works?"
      expectedAnswer: string;   // What a student who wrote this should know
      followUp: string;         // If they struggle, ask this
      redFlags: string[];       // Signs they didn't write it themselves
    }[];
    conceptChecks: {
      concept: string;          // e.g., "Base case in recursion"
      question: string;
    }[];
  };
}
```

**Stage 2: ElevenLabs Context (Compact)**

```typescript
// System prompt for ElevenLabs - NO full code, just discussion plan
const systemPrompt = `
You are an oral examiner for a programming course at Stockholm University.
You are examining a student about code they submitted for: ${assignment.name}

## What the code does
${discussionPlan.overview}

## Discussion Topics
${discussionPlan.keyTopics.map((t, i) => `
### Topic ${i + 1}: ${t.topic}
- Ask: "${t.question}"
- A student who wrote this should mention: ${t.expectedAnswer}
- If struggling, follow up: "${t.followUp}"
- Red flags (possible plagiarism): ${t.redFlags.join(', ')}
`).join('\n')}

## Concept Checks
${discussionPlan.conceptChecks.map(c => `- ${c.concept}: "${c.question}"`).join('\n')}

## Your Role
1. Start friendly, ask them to describe what their code does
2. Go through the discussion topics naturally
3. Note if answers seem rehearsed or if they can't explain basics
4. Be encouraging but probe for genuine understanding
5. If they seem stuck, use the follow-up questions

Speak in ${language === 'sv' ? 'Swedish' : 'English'}. Keep it conversational.
`;
```

**Database: Store Discussion Plan**

Add to `reviews` table:

```sql
ALTER TABLE reviews ADD COLUMN discussion_plan JSONB;
```

#### WebSocket Connection (Real-time)
For live seminars, we use ElevenLabs WebSocket API:

```typescript
// Client-side: Connect student to agent
const ws = new WebSocket(
  `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`
);

// Server generates signed URL for secure access
const { signed_url } = await elevenlabs.conversations.getSignedUrl({
  agent_id: agentId,
  // Add custom session data
  metadata: {
    student_id: submission.student_id,
    submission_id: submission.id,
  }
});
```

#### Webhook Events
Configure webhook to receive events:

```typescript
// POST /api/seminars/webhook
interface ElevenLabsWebhook {
  event_type: 'conversation.started' | 'conversation.ended' | 'transcript.updated';
  conversation_id: string;
  data: {
    transcript?: TranscriptEntry[];
    duration_seconds?: number;
    status?: 'completed' | 'failed' | 'abandoned';
    metadata?: Record<string, string>;
  };
}

// Handle webhook
async function handleWebhook(payload: ElevenLabsWebhook) {
  if (payload.event_type === 'conversation.ended') {
    // Fetch full transcript
    const transcript = await elevenlabs.conversations.getTranscript(
      payload.conversation_id
    );

    // Store in database
    await db.transcripts.createMany({
      data: transcript.entries.map(entry => ({
        seminar_id: seminarId,
        speaker: entry.role,  // 'agent' or 'user'
        text: entry.text,
        timestamp_ms: entry.timestamp,
      }))
    });

    // Update seminar status
    await db.seminars.update({
      where: { elevenlabs_conversation_id: payload.conversation_id },
      data: {
        status: 'completed',
        ended_at: new Date(),
        duration_seconds: payload.data.duration_seconds,
      }
    });
  }
}
```

#### Audio Recording
ElevenLabs provides audio recordings - store in PostgreSQL:

```typescript
// Get audio URL (signed, time-limited)
const { audio_url } = await elevenlabs.conversations.getAudioUrl(
  conversationId
);

// Download and store in PostgreSQL
const response = await fetch(audio_url);
const audioBuffer = await response.arrayBuffer();

await db.recordings.create({
  data: {
    seminar_id: seminarId,
    audio_data: Buffer.from(audioBuffer),
    mime_type: response.headers.get('content-type') || 'audio/webm',
    size_bytes: audioBuffer.byteLength,
    duration_seconds: durationFromMetadata,
  }
});
```

**Note:** For large audio files (>10MB), consider:
- Compressing audio before storage
- Streaming playback via chunked API route
- Setting up PostgreSQL large object storage (LOB)

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (Next.js, TypeScript, ESLint)
- [ ] PostgreSQL schema & migrations
- [ ] Redis connection
- [ ] Basic auth (admin login)
- [ ] Core database models

### Phase 2: Upload & Storage
- [ ] Bulk upload interface
- [ ] ZIP extraction & parsing
- [ ] Student-file mapping
- [ ] File storage system

### Phase 3: AI Review
- [ ] OpenAI integration
- [ ] Review queue with Redis semaphores
- [ ] Review results display
- [ ] Prompt management

### Phase 4: Seminars
- [ ] ElevenLabs agent setup
- [ ] Seminar scheduling
- [ ] Live session handling
- [ ] Transcript capture

### Phase 5: Grading & Export
- [ ] Grading interface
- [ ] Pass/fail workflow
- [ ] Grade export
- [ ] Student notifications (optional)

### Phase 6: Polish
- [ ] Error handling
- [ ] Logging & monitoring
- [ ] Performance optimization
- [ ] Documentation

---

## Project Structure

```
prog2review/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (student)/          # Student portal (default)
│   │   │   ├── page.tsx        # Dashboard - submissions & seminars
│   │   │   ├── book/
│   │   │   │   └── page.tsx    # Book seminar slot
│   │   │   ├── seminar/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Waiting room + agent
│   │   │   └── results/
│   │   │       └── page.tsx    # View grades
│   │   ├── admin/
│   │   │   ├── page.tsx        # Admin dashboard
│   │   │   ├── upload/
│   │   │   ├── submissions/
│   │   │   ├── reviews/
│   │   │   ├── seminars/
│   │   │   ├── slots/          # Manage time slots
│   │   │   ├── grading/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── upload/
│   │   │   ├── submissions/
│   │   │   ├── reviews/
│   │   │   ├── seminars/
│   │   │   ├── slots/
│   │   │   └── grades/
│   │   ├── layout.tsx
│   │   └── middleware.ts       # Auth + role check
│   ├── components/
│   │   ├── ui/                 # Base components (shadcn)
│   │   ├── admin/              # Admin-specific
│   │   ├── student/            # Student-specific
│   │   └── shared/             # Shared components
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema
│   │   │   ├── migrations/
│   │   │   └── index.ts
│   │   ├── redis/
│   │   │   ├── client.ts
│   │   │   ├── semaphore.ts
│   │   │   └── queue.ts        # Email queue
│   │   ├── openai/
│   │   │   ├── client.ts
│   │   │   └── review.ts
│   │   ├── elevenlabs/
│   │   │   ├── client.ts
│   │   │   └── agent.ts
│   │   ├── email/
│   │   │   └── queue.ts        # Queue emails to Redis
│   │   └── auth/
│   │       └── middleware.ts
│   ├── services/
│   │   ├── upload.ts
│   │   ├── review.ts
│   │   ├── seminar.ts
│   │   ├── booking.ts
│   │   └── grading.ts
│   └── types/
│       └── index.ts
├── email-worker/               # Python email service
│   ├── worker.py
│   ├── templates/
│   │   ├── code_uploaded.txt
│   │   ├── review_complete.txt
│   │   ├── seminar_booked.txt
│   │   ├── seminar_reminder.txt
│   │   └── graded.txt
│   ├── requirements.txt
│   └── Dockerfile
├── k8s/
│   ├── base/
│   │   ├── postgres/
│   │   ├── redis/
│   │   ├── app/
│   │   └── email-worker/
│   └── overlays/
│       ├── dev/
│       └── prod/
├── docker-compose.yml          # Local dev: Postgres + Redis
├── Dockerfile                  # Next.js app
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/prog2review

# Redis
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...

# Auth (admin usernames - matched without domain suffix)
ADMIN_USERNAMES=edsu8469,anel1234,prof5678

# App
BASE_URL=https://prog2review.dsv.su.se

# Email (dsv-wrapper credentials)
MAIL_USER=lambda
MAIL_PASS=...
```

---

## Kubernetes Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Kubernetes Cluster                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────────────────────────────────────┐  │
│  │   Ingress    │────▶│              NextJS Deployment               │  │
│  │  (nginx)     │     │  ┌────────┐ ┌────────┐ ┌────────┐           │  │
│  └──────────────┘     │  │ Pod 1  │ │ Pod 2  │ │ Pod 3  │  (HPA)    │  │
│                       │  └────────┘ └────────┘ └────────┘           │  │
│                       └──────────────────────────────────────────────┘  │
│                                        │                                 │
│                    ┌───────────────────┴───────────────────┐            │
│                    ▼                                       ▼            │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────┐  │
│  │           PostgreSQL                │  │         Redis           │  │
│  │         (StatefulSet)               │  │      (StatefulSet)      │  │
│  │  - All data: code, audio, meta      │  │  - Semaphores           │  │
│  │  ┌───────────────────────────────┐  │  │  - Job queues           │  │
│  │  │      PVC (persistent)         │  │  │  - Session cache        │  │
│  │  └───────────────────────────────┘  │  └─────────────────────────┘  │
│  └─────────────────────────────────────┘                                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      ConfigMaps & Secrets                         │   │
│  │  - db-credentials    - redis-credentials    - api-keys           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### K8s Manifests Structure

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   └── app/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── hpa.yaml
│       └── ingress.yaml
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml
│   └── prod/
│       └── kustomization.yaml
└── kustomization.yaml
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Authentication (Header-based, SAML upstream)

### Stockholm University Integration

SAML authentication is handled upstream (by a reverse proxy/gateway). Our app receives the authenticated username via HTTP header.

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │────▶│   SU SAML    │────▶│   Ingress/   │────▶│  prog2review │
│ Browser  │     │   Gateway    │     │   Proxy      │     │   App        │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                       │                     │                    │
                       │  SAML handled       │                    │
                       │  here               │  X-Remote-User:    │
                       │                     │  edsu8469@su.se    │
                       │                     │───────────────────▶│
```

### Implementation

```typescript
// middleware.ts or auth utility
function getAuthenticatedUser(request: Request): User | null {
  // Header name may vary - common options:
  // X-Remote-User, X-Forwarded-User, Remote-User
  const username = request.headers.get('X-Remote-User');

  if (!username) {
    return null;
  }

  // Username format: edsu8469@su.se or just edsu8469
  const suUsername = username.includes('@')
    ? username.split('@')[0]
    : username;

  return {
    suUsername,
    email: username.includes('@') ? username : `${username}@su.se`,
    isAdmin: ADMIN_USERNAMES.includes(suUsername),
  };
}

// Protect admin routes
export async function middleware(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.redirect('/unauthorized');
  }

  if (request.nextUrl.pathname.startsWith('/admin') && !user.isAdmin) {
    return NextResponse.redirect('/forbidden');
  }

  // Pass user info to the app
  const response = NextResponse.next();
  response.headers.set('x-user-id', user.suUsername);
  response.headers.set('x-user-admin', user.isAdmin.toString());
  return response;
}
```

### Admin Detection

Admins defined in environment variable:

```env
ADMIN_USERNAMES=edsu8469,anel1234,prof5678
```

### Security Note

The ingress must be configured to:
1. Strip any client-provided `X-Remote-User` header (prevent spoofing)
2. Only allow traffic from the trusted SAML gateway
3. Set the header only after successful SAML authentication

---

## Email Notifications

### Integration: dsv-wrapper

Since dsv-wrapper is Python, we run it as a small sidecar service or use a message queue.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   Redis Queue   │────▶│  Email Worker   │
│                 │     │  email:queue    │     │  (Python)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   mail.su.se    │
                                                │ lambda@dsv.su.se│
                                                └─────────────────┘
```

### Email Events

| Event | Recipient | Subject |
|-------|-----------|---------|
| Code uploaded | Student | "Your code has been submitted for PROG2 review" |
| Review complete | Student | "Your code review is ready - book your seminar" |
| Seminar booked | Student | "Seminar booked: {date} {time}" |
| Seminar reminder | Student | "Reminder: Your seminar starts in 1 hour" |
| Graded | Student | "Your PROG2 seminar has been graded" |

### Email Worker (Python)

```python
# email_worker.py
import redis
import json
from dsv_wrapper import MailClient, BodyType

TEMPLATES = {
    'code_uploaded': {
        'subject': 'Your code has been submitted for {course} review',
        'body': '''
Hej {name},

Your code for {assignment} has been uploaded and is being reviewed.
You will receive another email when you can book your seminar.

/prog2review
'''
    },
    'review_complete': {
        'subject': 'Book your {course} seminar',
        'body': '''
Hej {name},

Your code review is complete. Please book your oral seminar at:
{booking_url}

Available slots are filling up - book soon!

/prog2review
'''
    },
    # ... more templates
}

def process_email(job: dict):
    template = TEMPLATES[job['type']]
    subject = template['subject'].format(**job['data'])
    body = template['body'].format(**job['data'])

    with MailClient(username=MAIL_USER, password=MAIL_PASS) as mail:
        result = mail.send_email(
            to=job['to'],
            subject=subject,
            body=body,
            body_type=BodyType.TEXT,
            save_to_sent=True
        )
        return result.success

# Redis queue consumer
r = redis.from_url(REDIS_URL)
while True:
    _, job_json = r.blpop('prog2review:email:queue')
    job = json.loads(job_json)
    process_email(job)
```

### Sending from Next.js

```typescript
// lib/email.ts
import { redis } from './redis';

interface EmailJob {
  type: 'code_uploaded' | 'review_complete' | 'seminar_booked' | 'seminar_reminder' | 'graded';
  to: string;
  data: Record<string, string>;
}

export async function queueEmail(job: EmailJob): Promise<void> {
  await redis.rpush('prog2review:email:queue', JSON.stringify(job));
}

// Usage
await queueEmail({
  type: 'review_complete',
  to: 'edsu8469@student.su.se',
  data: {
    name: 'Edwin',
    course: 'PROG2',
    assignment: 'Lab 3',
    booking_url: `${process.env.BASE_URL}/book`, // https://prog2review.dsv.su.se/book
  }
});
```

### K8s: Email Worker Deployment

```yaml
# k8s/base/email-worker/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: email-worker
  template:
    spec:
      containers:
      - name: email-worker
        image: prog2review-email-worker:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: MAIL_USER
          valueFrom:
            secretKeyRef:
              name: mail-credentials
              key: username
        - name: MAIL_PASS
          valueFrom:
            secretKeyRef:
              name: mail-credentials
              key: password
```

---

## Decisions Made

1. **Portals:** Two portals - Admin (upload, review, grade) + Student (book seminar, take seminar, view results)
2. **File types:** Java only (`.java` files)
3. **Seminar language:** Student chooses Swedish OR English when booking
4. **Notifications:** Yes, via dsv-wrapper (lambda@dsv.su.se)
5. **Code upload:** Admin only (pulled from Moodle, students don't upload)

## Remaining Questions

1. **Auth header name?** What's the exact header name from your SAML proxy?

## Confirmed Details

- **Domain:** `prog2review.dsv.su.se`
- **Email credentials:** SU username/password for lambda@dsv.su.se (provided via env vars)
