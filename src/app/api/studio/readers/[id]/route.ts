import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify reader exists and belongs to user's studio
  const reader = await db.readerPersona.findUnique({
    where: { id },
  });

  if (!reader) {
    return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
  }

  if (reader.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
  }

  const body = await request.json();

  const updatedReader = await db.readerPersona.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.background !== undefined && { background: body.background }),
      ...(body.voiceDescription !== undefined && { voiceDescription: body.voiceDescription }),
      ...(body.analyticalFocus !== undefined && { analyticalFocus: body.analyticalFocus }),
      ...(body.favoriteFilms !== undefined && { favoriteFilms: body.favoriteFilms }),
      ...(body.systemPromptBase !== undefined && { systemPromptBase: body.systemPromptBase }),
      ...(body.premiseWeight !== undefined && { premiseWeight: body.premiseWeight }),
      ...(body.characterWeight !== undefined && { characterWeight: body.characterWeight }),
      ...(body.dialogueWeight !== undefined && { dialogueWeight: body.dialogueWeight }),
      ...(body.structureWeight !== undefined && { structureWeight: body.structureWeight }),
      ...(body.commercialityWeight !== undefined && { commercialityWeight: body.commercialityWeight }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(updatedReader);
}
