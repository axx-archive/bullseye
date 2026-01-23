import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studio = await db.studio.findUnique({
    where: { id: user.studioId },
    include: {
      _count: {
        select: {
          readerPersonas: true,
          projects: true,
        },
      },
    },
  });

  if (!studio) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  return NextResponse.json(studio);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate name if provided
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
  }

  const data = {
    ...(body.name !== undefined && { name: body.name.trim() }),
    ...(body.pov !== undefined && { pov: body.pov }),
    ...(body.pillars !== undefined && { pillars: body.pillars }),
    ...(body.beliefs !== undefined && { beliefs: body.beliefs }),
    ...(body.mandates !== undefined && { mandates: body.mandates }),
  };

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const studio = await db.studio.update({
    where: { id: user.studioId },
    data,
  });

  return NextResponse.json(studio);
}
