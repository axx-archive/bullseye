import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';

const DEFAULT_STUDIO_ID = 'default-studio-id';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { supabaseAuthId: user.id },
  });

  if (existingUser) {
    return NextResponse.json({ user: existingUser });
  }

  // Create new user linked to default studio
  const newUser = await db.user.create({
    data: {
      supabaseAuthId: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name || null,
      studioId: DEFAULT_STUDIO_ID,
      role: 'MEMBER',
    },
  });

  return NextResponse.json({ user: newUser }, { status: 201 });
}
