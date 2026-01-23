import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

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
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Find or create the database user
  let dbUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  // Create studio and link user in a transaction
  const studio = await db.studio.create({
    data: {
      name,
      slug,
      ownerId: dbUser?.id || 'temp', // will be updated below
    },
  });

  if (dbUser) {
    // Update existing user to point to new studio
    await db.user.update({
      where: { id: dbUser.id },
      data: { studioId: studio.id },
    });
    // Fix ownerId if it was a temp placeholder
    if (studio.ownerId === 'temp') {
      await db.studio.update({
        where: { id: studio.id },
        data: { ownerId: dbUser.id },
      });
    }
  } else {
    // Create new user linked to the new studio
    dbUser = await db.user.create({
      data: {
        supabaseAuthId: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        role: 'MEMBER',
        studioId: studio.id,
      },
    });
    // Update studio owner to the new user
    await db.studio.update({
      where: { id: studio.id },
      data: { ownerId: dbUser.id },
    });
  }

  return NextResponse.json(studio, { status: 201 });
}
