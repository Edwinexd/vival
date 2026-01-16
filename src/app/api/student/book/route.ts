import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getUserByUsername,
  getSubmissionById,
  getSeminarSlotById,
  getSeminarBySubmission,
  countSeminarsInSlot,
  createSeminar,
  updateSubmissionStatus,
} from '@/lib/db/queries';
import { generateId } from '@/lib/id';

export async function POST(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const user = await getUserByUsername(session.username);
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  let body: { submissionId?: string; slotId?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { submissionId, slotId, language } = body;

  if (!submissionId || !slotId) {
    return NextResponse.json(
      { error: 'Missing required fields: submissionId, slotId' },
      { status: 400 }
    );
  }

  // Validate language
  const validLanguages = ['en', 'sv'];
  const selectedLanguage = language && validLanguages.includes(language) ? language : 'en';

  // Verify submission exists and belongs to student
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return NextResponse.json(
      { error: 'Submission not found' },
      { status: 404 }
    );
  }

  if (submission.student_id !== user.id) {
    return NextResponse.json(
      { error: 'This submission does not belong to you' },
      { status: 403 }
    );
  }

  // Check submission is in reviewed status
  if (submission.status !== 'reviewed') {
    return NextResponse.json(
      { error: 'Submission must be reviewed before booking a seminar' },
      { status: 400 }
    );
  }

  // Check if already booked
  const existingSeminar = await getSeminarBySubmission(submissionId);
  if (existingSeminar && !['failed', 'no_show'].includes(existingSeminar.status)) {
    return NextResponse.json(
      { error: 'A seminar has already been booked for this submission' },
      { status: 400 }
    );
  }

  // Verify slot exists and has capacity
  const slot = await getSeminarSlotById(slotId);
  if (!slot) {
    return NextResponse.json(
      { error: 'Seminar slot not found' },
      { status: 404 }
    );
  }

  // Check slot belongs to same assignment
  if (slot.assignment_id !== submission.assignment_id) {
    return NextResponse.json(
      { error: 'This slot is not for your assignment' },
      { status: 400 }
    );
  }

  // Check slot is still in future
  if (new Date(slot.window_end) <= new Date()) {
    return NextResponse.json(
      { error: 'This time slot has already passed' },
      { status: 400 }
    );
  }

  // Check capacity
  const currentCount = await countSeminarsInSlot(slotId);
  if (currentCount >= slot.max_concurrent) {
    return NextResponse.json(
      { error: 'This time slot is fully booked' },
      { status: 400 }
    );
  }

  // Create the seminar booking
  const seminarId = await generateId();
  const seminar = await createSeminar(seminarId, submissionId, slotId, selectedLanguage);

  // Update submission status
  await updateSubmissionStatus(submissionId, 'seminar_pending');

  return NextResponse.json({
    message: 'Seminar booked successfully',
    seminar: {
      id: seminar.id,
      slotId: seminar.slot_id,
      language: seminar.language,
      status: seminar.status,
      bookedAt: seminar.booked_at,
      windowStart: slot.window_start,
      windowEnd: slot.window_end,
    },
  });
}
