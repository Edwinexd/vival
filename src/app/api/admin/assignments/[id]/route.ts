import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getSubmissionsByAssignment,
} from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const assignment = await getAssignmentById(id);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ assignment });
  } catch (err) {
    console.error('Failed to fetch assignment:', err);
    return NextResponse.json(
      { error: 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, reviewPrompt, seminarPrompt, dueDate } = body;

    const existing = await getAssignmentById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const assignment = await updateAssignment(id, {
      name: name || undefined,
      description: description || undefined,
      review_prompt: reviewPrompt || undefined,
      seminar_prompt: seminarPrompt || undefined,
      due_date: dueDate ? new Date(dueDate) : undefined,
    });

    return NextResponse.json({ assignment });
  } catch (err) {
    console.error('Failed to update assignment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if assignment has submissions
    const submissions = await getSubmissionsByAssignment(id);
    if (submissions.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete assignment with ${submissions.length} submissions` },
        { status: 400 }
      );
    }

    const deleted = await deleteAssignment(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete assignment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
