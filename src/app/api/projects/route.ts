import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { studioId: user.studioId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { drafts: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, logline, genre, format } = body;

  // Validate required fields
  if (!title || !genre || !format) {
    return NextResponse.json(
      { error: 'Missing required fields: title, genre, and format are required' },
      { status: 400 }
    );
  }

  const project = await db.project.create({
    data: {
      title,
      logline: logline || null,
      genre,
      format,
      studioId: user.studioId,
      createdByUserId: user.id,
    },
    include: {
      _count: { select: { drafts: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
