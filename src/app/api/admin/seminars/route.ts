import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllSeminarsForAdmin, markExpiredSeminarsNoShow } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Automatically mark expired seminars as no-show
    const markedCount = await markExpiredSeminarsNoShow();
    if (markedCount > 0) {
      console.log(`Marked ${markedCount} expired seminars as no-show`);
    }

    const seminars = await getAllSeminarsForAdmin();
    return NextResponse.json({ seminars });
  } catch (err) {
    console.error("Failed to fetch seminars:", err);
    return NextResponse.json(
      { error: "Failed to fetch seminars" },
      { status: 500 }
    );
  }
}
