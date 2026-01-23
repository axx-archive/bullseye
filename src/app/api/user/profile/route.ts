import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    displayName: user.name ?? null,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { displayName, avatarUrl } = body as {
    displayName?: string;
    avatarUrl?: string;
  };

  // Validate displayName if provided
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (trimmed.length === 0 || trimmed.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be between 1 and 50 characters' },
        { status: 400 }
      );
    }
  }

  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      ...(displayName !== undefined && { name: displayName.trim() }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
  });

  return NextResponse.json({
    displayName: updatedUser.name ?? null,
    email: updatedUser.email,
    avatarUrl: updatedUser.avatarUrl ?? null,
  });
}
