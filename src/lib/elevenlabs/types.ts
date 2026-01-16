// ElevenLabs Conversational AI Types

export interface AgentConfig {
  agent_id: string;
  name: string;
  first_message: string;
  system_prompt: string;
  language: 'en' | 'sv';
  voice_id: string;
  llm: {
    model: string;
    temperature: number;
  };
  conversation: {
    max_duration_seconds: number;
  };
}

export interface DiscussionTopic {
  topic: string;
  question: string;
  expectedAnswer: string;
  followUp: string;
  redFlags: string[];
}

export interface ConceptCheck {
  concept: string;
  question: string;
}

export interface DiscussionPlan {
  overview: string;
  keyTopics: DiscussionTopic[];
  conceptChecks: ConceptCheck[];
}

export interface SeminarContext {
  studentName: string;
  assignmentName: string;
  assignmentDescription: string;
  discussionPlan: DiscussionPlan;
  language: 'en' | 'sv';
}

export interface ConversationSession {
  signed_url: string;
  expires_at: number;
  conversation_id?: string;
}

// Overrides config to send via WebSocket when starting conversation
export interface ConversationConfigOverride {
  agent: {
    prompt: {
      prompt: string;
    };
    language: 'en' | 'sv';
  };
}

export interface TranscriptEntry {
  role: 'agent' | 'user';
  text: string;
  timestamp_ms: number;
  confidence?: number;
}

export interface ConversationStatus {
  conversation_id: string;
  status: 'active' | 'completed' | 'failed';
  duration_seconds?: number;
  transcript?: TranscriptEntry[];
}

export interface WebhookPayload {
  event_type: 'conversation.started' | 'conversation.ended' | 'transcript.updated';
  conversation_id: string;
  agent_id: string;
  timestamp: string;
  data: {
    status?: 'completed' | 'failed' | 'abandoned';
    duration_seconds?: number;
    transcript?: TranscriptEntry[];
    metadata?: Record<string, string>;
    error_code?: string;
    error_message?: string;
    termination_reason?: string;
  };
}

export interface StartSessionRequest {
  seminarId: string;
  studentId: string;
  submissionId: string;
  discussionPlan: DiscussionPlan;
  studentName: string;
  assignmentName: string;
  language: 'en' | 'sv';
}

export interface StartSessionResponse {
  success: boolean;
  signedUrl?: string;
  conversationId?: string;
  error?: string;
}
