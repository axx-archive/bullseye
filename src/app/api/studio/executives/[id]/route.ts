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

  // Verify executive exists and belongs to user's studio
  const executive = await db.executiveProfile.findUnique({
    where: { id },
  });

  if (!executive) {
    return NextResponse.json({ error: 'Executive not found' }, { status: 404 });
  }

  if (executive.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Executive not found' }, { status: 404 });
  }

  const body = await request.json();

  const updatedExecutive = await db.executiveProfile.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.evaluationStyle !== undefined && { evaluationStyle: body.evaluationStyle }),
      ...(body.priorityFactors !== undefined && { priorityFactors: body.priorityFactors }),
      ...(body.dealBreakers !== undefined && { dealBreakers: body.dealBreakers }),
      ...(body.filmography !== undefined && { filmography: body.filmography }),
      ...(body.trackRecordSummary !== undefined && { trackRecordSummary: body.trackRecordSummary }),
      ...(body.recentTradeContext !== undefined && { recentTradeContext: body.recentTradeContext }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(updatedExecutive);
}
