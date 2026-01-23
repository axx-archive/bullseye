import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, draftId } = await params;

  // Verify the draft belongs to the user's project/studio
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: { project: { select: { studioId: true } } },
  });

  if (!draft || draft.projectId !== projectId || draft.project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const body = await request.json();
  const { notes } = body;

  if (typeof notes !== 'string') {
    return NextResponse.json({ error: 'Invalid notes field' }, { status: 400 });
  }

  const updated = await db.draft.update({
    where: { id: draftId },
    data: { notes: notes || null },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, draftId } = await params;

  // Verify the draft belongs to the user's project/studio
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: { project: { select: { studioId: true } } },
  });

  if (!draft || draft.projectId !== projectId || draft.project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  // Check this is not the only draft
  const draftCount = await db.draft.count({ where: { projectId } });
  if (draftCount <= 1) {
    return NextResponse.json(
      { error: 'Cannot delete the only remaining draft' },
      { status: 400 }
    );
  }

  // Remove associated PDF from Supabase Storage
  const supabase = createAdminClient();
  const storagePath = `${projectId}/${draft.draftNumber}.pdf`;
  await supabase.storage.from('scripts').remove([storagePath]);

  // Delete draft — cascades to deliverable, focus sessions, reader memories, executive evaluations
  await db.draft.delete({ where: { id: draftId } });

  return NextResponse.json({ success: true });
}
