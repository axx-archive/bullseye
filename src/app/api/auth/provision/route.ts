import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { studio: true },
  });

  if (existingUser) {
    return NextResponse.json({
      user: existingUser,
      hasStudio: !!existingUser.studio,
    });
  }

  // User doesn't exist yet — they need to create a studio first via POST /api/studio
  // Return a response indicating no user/studio exists
  return NextResponse.json({
    user: null,
    hasStudio: false,
    needsStudio: true,
  });
}
