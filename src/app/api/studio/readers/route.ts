import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const readers = await db.readerPersona.findMany({
    where: { studioId: user.studioId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(readers);
}
