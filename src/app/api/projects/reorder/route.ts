import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { projectIds } = body;

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json({ error: 'projectIds must be a non-empty array' }, { status: 400 });
  }

  // Verify all projects belong to the user's studio
  const projects = await db.project.findMany({
    where: { id: { in: projectIds }, studioId: user.studioId },
    select: { id: true },
  });

  if (projects.length !== projectIds.length) {
    return NextResponse.json({ error: 'One or more projects not found' }, { status: 404 });
  }

  // Update sortOrder for each project based on position in the array
  await db.$transaction(
    projectIds.map((id: string, index: number) =>
      db.project.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ success: true });
}
