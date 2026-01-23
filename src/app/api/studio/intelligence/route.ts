import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const intelligence = await db.studioIntelligence.findUnique({
    where: { studioId: user.studioId },
  });

  if (!intelligence) {
    return NextResponse.json({ error: 'Studio intelligence not found' }, { status: 404 });
  }

  return NextResponse.json(intelligence);
}
