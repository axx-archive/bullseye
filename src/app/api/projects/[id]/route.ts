import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      drafts: {
        orderBy: { draftNumber: 'desc' },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Ensure user can only access projects in their studio
  if (project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Validate the project belongs to the user's studio
  const existing = await db.project.findUnique({
    where: { id },
    select: { studioId: true },
  });

  if (!existing || existing.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Build update data from allowed fields
  const updateData: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    updateData.title = body.title.trim();
  }

  if (body.evaluationStatus !== undefined) {
    const validStatuses = ['UNDER_CONSIDERATION', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(body.evaluationStatus)) {
      return NextResponse.json({ error: 'Invalid evaluation status' }, { status: 400 });
    }
    updateData.evaluationStatus = body.evaluationStatus;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await db.project.update({
    where: { id },
    data: updateData,
    include: {
      studio: { select: { id: true, name: true } },
      _count: { select: { drafts: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Validate the project belongs to the user's studio
  const existing = await db.project.findUnique({
    where: { id },
    select: { studioId: true },
  });

  if (!existing || existing.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Remove associated files from Supabase Storage (scripts/{projectId}/ folder)
  const supabase = createAdminClient();
  const { data: files } = await supabase.storage
    .from('scripts')
    .list(id);

  if (files && files.length > 0) {
    const filePaths = files.map((f) => `${id}/${f.name}`);
    await supabase.storage.from('scripts').remove(filePaths);
  }

  // Delete project — cascades to drafts, deliverables, chat messages, focus sessions, reader memories, executive evaluations
  await db.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
