-- prog2review database schema
-- All IDs are BIGINT (from external Snowflake generator)

-- users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  su_username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- courses
CREATE TABLE IF NOT EXISTS courses (
  id BIGINT PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  semester VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- assignments
CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  review_prompt TEXT,
  seminar_prompt TEXT,
  due_date TIMESTAMPTZ,
  target_time_minutes INTEGER DEFAULT 30,
  max_time_minutes INTEGER DEFAULT 35,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- submissions (student code stored as TEXT)
CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT PRIMARY KEY,
  student_id BIGINT REFERENCES users(id),
  assignment_id BIGINT REFERENCES assignments(id),
  filename VARCHAR(255),
  file_content TEXT NOT NULL,
  file_hash VARCHAR(64),
  status VARCHAR(50) DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by BIGINT REFERENCES users(id),
  compile_success BOOLEAN,
  compile_output TEXT,
  compile_errors JSONB,
  compiled_at TIMESTAMPTZ
);

-- reviews (GPT output with discussion_plan as JSONB)
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT PRIMARY KEY,
  submission_id BIGINT REFERENCES submissions(id),
  gpt_model VARCHAR(50),
  prompt_used TEXT,
  raw_response TEXT,
  parsed_score INTEGER,
  parsed_feedback TEXT,
  issues_found JSONB,
  discussion_plan JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- seminar_slots (time windows)
CREATE TABLE IF NOT EXISTS seminar_slots (
  id BIGINT PRIMARY KEY,
  assignment_id BIGINT REFERENCES assignments(id),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  max_concurrent INTEGER DEFAULT 8,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- seminars
CREATE TABLE IF NOT EXISTS seminars (
  id BIGINT PRIMARY KEY,
  submission_id BIGINT REFERENCES submissions(id),
  slot_id BIGINT REFERENCES seminar_slots(id),
  language VARCHAR(2) DEFAULT 'en',
  elevenlabs_conversation_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'booked',
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id BIGINT PRIMARY KEY,
  seminar_id BIGINT REFERENCES seminars(id),
  speaker VARCHAR(20),
  text TEXT,
  timestamp_ms INTEGER,
  confidence FLOAT
);

-- recordings (audio as BYTEA)
CREATE TABLE IF NOT EXISTS recordings (
  id BIGINT PRIMARY KEY,
  seminar_id BIGINT REFERENCES seminars(id),
  audio_data BYTEA,
  mime_type VARCHAR(50),
  duration_seconds INTEGER,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- grades
CREATE TABLE IF NOT EXISTS grades (
  id BIGINT PRIMARY KEY,
  submission_id BIGINT REFERENCES submissions(id),
  reviewed_by BIGINT REFERENCES users(id),
  review_score INTEGER,
  seminar_score INTEGER,
  final_grade VARCHAR(20),
  admin_notes TEXT,
  student_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_grades (GPT grading of seminar transcripts)
CREATE TABLE IF NOT EXISTS ai_grades (
  id BIGINT PRIMARY KEY,
  seminar_id BIGINT REFERENCES seminars(id),
  submission_id BIGINT REFERENCES submissions(id),
  score_1 INTEGER,
  reasoning_1 TEXT,
  score_2 INTEGER,
  reasoning_2 TEXT,
  score_3 INTEGER,
  reasoning_3 TEXT,
  suggested_score INTEGER,
  scoring_method VARCHAR(20) DEFAULT 'average',
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_seminars_slot ON seminars(slot_id);
CREATE INDEX IF NOT EXISTS idx_seminars_status ON seminars(status);
CREATE INDEX IF NOT EXISTS idx_transcripts_seminar ON transcripts(seminar_id);
CREATE INDEX IF NOT EXISTS idx_ai_grades_seminar ON ai_grades(seminar_id);
CREATE INDEX IF NOT EXISTS idx_ai_grades_submission ON ai_grades(submission_id);
