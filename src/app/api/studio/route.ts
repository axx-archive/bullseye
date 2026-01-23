import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_READERS, DEFAULT_EXECUTIVES } from '@/lib/defaults/studio-defaults';

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const name = body.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio';

  // Check if user already exists in DB
  const existingUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (existingUser) {
    // User exists — just create the studio and update their active studio
    const studio = await db.studio.create({
      data: {
        name,
        slug,
        ownerId: existingUser.id,
      },
    });

    await db.user.update({
      where: { id: existingUser.id },
      data: { studioId: studio.id },
    });

    // Seed default readers and executives
    await db.readerPersona.createMany({
      data: DEFAULT_READERS.map((reader) => ({
        ...reader,
        studioId: studio.id,
        favoriteFilms: [...reader.favoriteFilms],
        analyticalFocus: [...reader.analyticalFocus],
      })),
    });
    await db.executiveProfile.createMany({
      data: DEFAULT_EXECUTIVES.map((exec) => ({
        ...exec,
        studioId: studio.id,
        filmography: [...exec.filmography],
        recentTradeContext: [...exec.recentTradeContext],
        priorityFactors: [...exec.priorityFactors],
        dealBreakers: [...exec.dealBreakers],
      })),
    });

    return NextResponse.json(studio, { status: 201 });
  }

  // User doesn't exist (cascade-deleted with previous studio).
  // Circular FK: Studio needs ownerId (User.id), User needs studioId (Studio.id).
  // Use deferred constraints to create both in one transaction.
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');

    const studio = await tx.studio.create({
      data: {
        name,
        slug,
        ownerId: 'placeholder',
      },
    });

    const newUser = await tx.user.create({
      data: {
        supabaseAuthId: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        role: 'MEMBER',
        studioId: studio.id,
      },
    });

    const updatedStudio = await tx.studio.update({
      where: { id: studio.id },
      data: { ownerId: newUser.id },
    });

    // Seed default readers and executives
    await tx.readerPersona.createMany({
      data: DEFAULT_READERS.map((reader) => ({
        ...reader,
        studioId: studio.id,
        favoriteFilms: [...reader.favoriteFilms],
        analyticalFocus: [...reader.analyticalFocus],
      })),
    });
    await tx.executiveProfile.createMany({
      data: DEFAULT_EXECUTIVES.map((exec) => ({
        ...exec,
        studioId: studio.id,
        filmography: [...exec.filmography],
        recentTradeContext: [...exec.recentTradeContext],
        priorityFactors: [...exec.priorityFactors],
        dealBreakers: [...exec.dealBreakers],
      })),
    });

    return updatedStudio;
  });

  return NextResponse.json(result, { status: 201 });
}
