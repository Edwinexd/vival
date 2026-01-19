import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getAllAssignments,
  createAssignment,
  getAllCourses,
  createCourse,
} from '@/lib/db/queries';
import { generateIds } from '@/lib/id';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [assignments, courses] = await Promise.all([
      getAllAssignments(),
      getAllCourses(),
    ]);
    return NextResponse.json({ assignments, courses });
  } catch (err) {
    console.error('Failed to fetch assignments:', err);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, reviewPrompt, seminarPrompt, dueDate, courseId, newCourse, targetTimeMinutes, maxTimeMinutes } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Assignment name is required' }, { status: 400 });
    }

    let finalCourseId = courseId;

    // Create new course if provided
    if (newCourse && newCourse.code && newCourse.name) {
      const [courseIdGen] = await generateIds(1);
      const course = await createCourse(
        courseIdGen,
        newCourse.code,
        newCourse.name,
        newCourse.semester || null
      );
      finalCourseId = course.id;
    }

    if (!finalCourseId) {
      return NextResponse.json({ error: 'Course is required' }, { status: 400 });
    }

    const [assignmentId] = await generateIds(1);
    const assignment = await createAssignment(
      assignmentId,
      finalCourseId,
      name.trim(),
      description || undefined,
      reviewPrompt || undefined,
      seminarPrompt || undefined,
      dueDate ? new Date(dueDate) : undefined,
      targetTimeMinutes || undefined,
      maxTimeMinutes || undefined
    );

    return NextResponse.json({ assignment });
  } catch (err) {
    console.error('Failed to create assignment:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
