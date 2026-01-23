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
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const studio = await db.studio.update({
    where: { id: user.studioId },
    data: { name: name.trim() },
  });

  return NextResponse.json(studio);
}
