import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';

const DEFAULT_STUDIO_ID = 'default-studio-id';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Provision user record if first login
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const existingUser = await db.user.findUnique({
          where: { supabaseAuthId: user.id },
        });
        if (!existingUser) {
          await db.user.create({
            data: {
              supabaseAuthId: user.id,
              email: user.email!,
              name: user.user_metadata?.full_name || null,
              studioId: DEFAULT_STUDIO_ID,
              role: 'MEMBER',
            },
          });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
