import { NextRequest, NextResponse } from 'next/server';
import { completeSeminar } from '@/services/seminar';
import { validateWebhookSignature, type WebhookPayload } from '@/lib/elevenlabs';

const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  // Get raw body for signature validation
  const rawBody = await request.text();

  // Validate signature (if configured)
  const signature = request.headers.get('x-elevenlabs-signature');

  if (WEBHOOK_SECRET && !validateWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: WebhookPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log(`ElevenLabs webhook: ${payload.event_type} for conversation ${payload.conversation_id}`);
  console.log('Webhook payload data:', JSON.stringify(payload.data, null, 2));

  try {
    if (payload.event_type === 'conversation.started') {
      // Log conversation start
      console.log(`Conversation started: ${payload.conversation_id}`);
    } else if (payload.event_type === 'conversation.ended') {
      // Handle conversation end
      const status = payload.data.status || 'completed';
      const durationSeconds = payload.data.duration_seconds;
      const errorCode = payload.data.error_code;
      const errorMessage = payload.data.error_message;

      if (errorCode || errorMessage) {
        console.error(`Conversation error: code=${errorCode}, message=${errorMessage}`);
      }

      await completeSeminar(payload.conversation_id, status, durationSeconds);

      console.log(`Conversation ended: ${payload.conversation_id}, status: ${status}, duration: ${durationSeconds}s`);
    } else if (payload.event_type === 'transcript.updated') {
      // We handle transcript at the end, but could do real-time updates here
      console.log(`Transcript updated for: ${payload.conversation_id}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// Allow unauthenticated access to webhook endpoint
export const dynamic = 'force-dynamic';
