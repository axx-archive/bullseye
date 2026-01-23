import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify the studio exists and user is the owner
  const studio = await db.studio.findUnique({
    where: { id },
    include: {
      projects: {
        select: { id: true },
      },
    },
  });

  if (!studio) {
    return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
  }

  if (studio.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check this is not the user's only studio
  const studioCount = await db.studio.count({
    where: { ownerId: user.id },
  });

  if (studioCount <= 1) {
    return NextResponse.json(
      { error: 'Cannot delete your only studio' },
      { status: 400 }
    );
  }

  const deletedProjects = studio.projects.length;

  // Clean up Supabase Storage files for each project
  if (deletedProjects > 0) {
    const supabase = createAdminClient();
    for (const project of studio.projects) {
      const { data: files } = await supabase.storage
        .from('scripts')
        .list(project.id);

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${project.id}/${f.name}`);
        await supabase.storage.from('scripts').remove(filePaths);
      }
    }
  }

  // Delete the studio (Prisma cascade handles all child records)
  await db.studio.delete({
    where: { id },
  });

  return NextResponse.json({ deletedProjects });
}
