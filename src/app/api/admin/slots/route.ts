import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getUserByUsername } from '@/lib/db/queries';
import { generateId, generateIds } from '@/lib/id';

interface SlotWithDetails {
  id: string;
  assignment_id: string;
  assignment_name: string;
  course_code: string;
  window_start: Date;
  window_end: Date;
  max_concurrent: number;
  booked_count: number;
  created_at: Date;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('assignmentId');

  try {
    const sql = getDb();
    let slots: SlotWithDetails[];

    if (assignmentId) {
      slots = await sql<SlotWithDetails[]>`
        SELECT
          ss.id,
          ss.assignment_id,
          a.name as assignment_name,
          c.code as course_code,
          ss.window_start,
          ss.window_end,
          ss.max_concurrent,
          ss.created_at,
          COALESCE((SELECT COUNT(*)::int FROM seminars s WHERE s.slot_id = ss.id AND s.status NOT IN ('failed', 'no_show')), 0) as booked_count
        FROM seminar_slots ss
        JOIN assignments a ON a.id = ss.assignment_id
        JOIN courses c ON c.id = a.course_id
        WHERE ss.assignment_id = ${assignmentId}
        ORDER BY ss.window_start ASC
      `;
    } else {
      slots = await sql<SlotWithDetails[]>`
        SELECT
          ss.id,
          ss.assignment_id,
          a.name as assignment_name,
          c.code as course_code,
          ss.window_start,
          ss.window_end,
          ss.max_concurrent,
          ss.created_at,
          COALESCE((SELECT COUNT(*)::int FROM seminars s WHERE s.slot_id = ss.id AND s.status NOT IN ('failed', 'no_show')), 0) as booked_count
        FROM seminar_slots ss
        JOIN assignments a ON a.id = ss.assignment_id
        JOIN courses c ON c.id = a.course_id
        ORDER BY ss.window_start ASC
      `;
    }

    return NextResponse.json({ slots });
  } catch (err) {
    console.error('Failed to fetch slots:', err);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await getUserByUsername(session.username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sql = getDb();

    // Support batch creation
    if (body.slots && Array.isArray(body.slots)) {
      const slots = body.slots;
      if (slots.length === 0) {
        return NextResponse.json({ error: 'No slots provided' }, { status: 400 });
      }
      if (slots.length > 100) {
        return NextResponse.json({ error: 'Max 100 slots per request' }, { status: 400 });
      }

      const ids = await generateIds(slots.length);
      let created = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const { assignmentId, windowStart, windowEnd, maxConcurrent } = slot;
        if (!assignmentId || !windowStart || !windowEnd) continue;

        await sql`
          INSERT INTO seminar_slots (id, assignment_id, window_start, window_end, max_concurrent, created_by)
          VALUES (${ids[i]}, ${assignmentId}, ${new Date(windowStart)}, ${new Date(windowEnd)}, ${maxConcurrent || 8}, ${user.id})
        `;
        created++;
      }

      return NextResponse.json({ created });
    }

    // Single slot creation (legacy)
    const { assignmentId, windowStart, windowEnd, maxConcurrent } = body;
    if (!assignmentId || !windowStart || !windowEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = await generateId();
    const result = await sql`
      INSERT INTO seminar_slots (id, assignment_id, window_start, window_end, max_concurrent, created_by)
      VALUES (${id}, ${assignmentId}, ${new Date(windowStart)}, ${new Date(windowEnd)}, ${maxConcurrent || 8}, ${user.id})
      RETURNING *
    `;

    return NextResponse.json({ slot: result[0], created: 1 });
  } catch (err) {
    console.error('Failed to create slot:', err);
    return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const slotId = searchParams.get('id');

  if (!slotId) {
    return NextResponse.json({ error: 'Slot ID required' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // Check if slot has bookings
    const bookings = await sql`
      SELECT COUNT(*) as count FROM seminars WHERE slot_id = ${slotId} AND status NOT IN ('failed', 'no_show')
    `;

    if (parseInt(bookings[0].count) > 0) {
      return NextResponse.json({ error: 'Cannot delete slot with active bookings' }, { status: 400 });
    }

    await sql`DELETE FROM seminar_slots WHERE id = ${slotId}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete slot:', err);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
