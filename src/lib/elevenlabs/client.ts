import { createHmac, timingSafeEqual } from 'crypto';
import type {
  SeminarContext,
  ConversationSession,
  ConversationStatus,
  TranscriptEntry,
} from './types';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Generate system prompt for the ElevenLabs agent based on discussion plan
 */
export function generateSystemPrompt(context: SeminarContext): string {
  const { studentName, assignmentName, assignmentDescription, discussionPlan, language } = context;

  const langInstruction = language === 'sv'
    ? 'Speak in Swedish throughout the conversation.'
    : 'Speak in English throughout the conversation.';

  const topicsSection = (discussionPlan.keyTopics || []).map((t, i) => `
### Topic ${i + 1}: ${t.topic}
- Ask: "${t.question}"
- A student who wrote this should mention: ${t.expectedAnswer}
- If struggling, follow up with: "${t.followUp}"
- Red flags (possible plagiarism indicators): ${(t.redFlags || []).join(', ')}
`).join('\n');

  const conceptsSection = (discussionPlan.conceptChecks || []).map(c =>
    `- ${c.concept}: "${c.question}"`
  ).join('\n');

  return `You are an oral examiner for a programming course at Stockholm University (DSV).
You are conducting a 30-minute oral examination with ${studentName} about code they submitted for: ${assignmentName}

${langInstruction}

## Assignment Description
${assignmentDescription || 'A programming assignment requiring demonstration of core concepts.'}

## What the code does
${discussionPlan.overview}

## Discussion Topics
Go through these topics naturally during the conversation:
${topicsSection}

## Concept Checks
Also verify understanding of these concepts:
${conceptsSection}

## Your Role
1. Start friendly - greet the student and ask them to describe what their code does in their own words
2. Go through the discussion topics naturally, not like a checklist
3. Listen for red flags - rehearsed answers, inability to explain basics, inconsistencies
4. Be encouraging but probe for genuine understanding
5. If they seem stuck, use the follow-up questions to help them
6. Keep track of time - aim to cover all major topics within 25-30 minutes
7. At the end, thank them and let them know the examiner will review the session

## Important Guidelines
- Be conversational and supportive, not interrogative
- Give them time to think before answering
- If they give a partial answer, ask follow-up questions to probe deeper
- Note any concerning patterns but don't accuse them of anything
- The goal is to assess understanding, not to trick them`;
}

/**
 * Get a signed URL for starting a conversation session.
 * Note: The conversation_id is NOT returned here - it's only available
 * after the WebSocket connection is established. The client receives it
 * in a 'conversation_initiated' message from the WebSocket.
 */
export async function createConversationSession(): Promise<ConversationSession> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }
  if (!ELEVENLABS_AGENT_ID) {
    throw new Error('ELEVENLABS_AGENT_ID is not configured');
  }

  const url = new URL(`${ELEVENLABS_API_URL}/convai/conversation/get-signed-url`);
  url.searchParams.set('agent_id', ELEVENLABS_AGENT_ID);

  console.log(`Creating ElevenLabs conversation session for agent: ${ELEVENLABS_AGENT_ID}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`ElevenLabs API error (${response.status}):`, error);
    throw new Error(`Failed to create conversation session: ${error}`);
  }

  const data = await response.json();

  if (!data.signed_url) {
    console.error('ElevenLabs response missing signed_url:', data);
    throw new Error('ElevenLabs API did not return a signed URL');
  }

  console.log('ElevenLabs signed URL obtained successfully');

  return {
    signed_url: data.signed_url,
    expires_at: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
}

/**
 * Get conversation status and details
 */
export async function getConversationStatus(conversationId: string): Promise<ConversationStatus> {
  const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversations/${conversationId}`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get conversation status: ${error}`);
  }

  const data = await response.json();

  return {
    conversation_id: data.conversation_id,
    status: data.status,
    duration_seconds: data.metadata?.duration_seconds,
    transcript: data.transcript,
  };
}

/**
 * Get full transcript for a conversation
 */
export async function getConversationTranscript(conversationId: string): Promise<TranscriptEntry[]> {
  const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversations/${conversationId}/transcript`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get transcript: ${error}`);
  }

  const data = await response.json();

  return data.transcript || [];
}

/**
 * Get audio recording URL for a conversation
 */
export async function getConversationAudioUrl(conversationId: string): Promise<string | null> {
  const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversations/${conversationId}/audio`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    // Audio might not be available for all conversations
    return null;
  }

  const data = await response.json();
  return data.audio_url || null;
}

/**
 * Download audio recording as buffer
 */
export async function downloadConversationAudio(conversationId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  const audioUrl = await getConversationAudioUrl(conversationId);

  if (!audioUrl) {
    return null;
  }

  const response = await fetch(audioUrl);

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'audio/webm';

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
  };
}

/**
 * Validate webhook signature using HMAC-SHA256
 *
 * ElevenLabs sends signatures in the format: sha256=<hex-encoded-hmac>
 * If no secret is configured, validation is skipped (returns true).
 * If secret is configured but no signature received, validation fails.
 */
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  // No secret configured - skip validation (dev/test mode)
  if (!secret) {
    return true;
  }

  // Secret configured but no signature received - reject
  if (!signature) {
    return false;
  }

  // Compute expected signature
  const expectedSignature = 'sha256=' + createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Lengths don't match
    return false;
  }
}

/**
 * Check if ElevenLabs API is configured and accessible
 */
export async function checkHealth(): Promise<boolean> {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return false;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/agents/${ELEVENLABS_AGENT_ID}`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
