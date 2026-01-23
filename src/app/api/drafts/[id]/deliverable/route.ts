import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify draft exists and belongs to user's studio
  const draft = await db.draft.findUnique({
    where: { id },
    include: { project: { select: { studioId: true } } },
  });

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const deliverable = await db.draftDeliverable.findUnique({
    where: { draftId: id },
  });

  if (!deliverable) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
  }

  return NextResponse.json(deliverable);
}
