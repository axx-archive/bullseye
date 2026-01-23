import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

const DEFAULT_STUDIO_ID = 'default-studio-id';

/**
 * Get the current authenticated user from Supabase and ensure
 * they have a corresponding record in our database.
 * Returns the Prisma User (with studio) or null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  // Check if user exists in our database
  let user = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    include: { studio: true },
  });

  // If not, create them linked to the default seed studio
  if (!user) {
    user = await db.user.create({
      data: {
        supabaseAuthId: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        role: 'MEMBER',
        studioId: DEFAULT_STUDIO_ID,
      },
      include: { studio: true },
    });
  }

  return user;
}

/**
 * Get the current user or throw a 401-style error.
 * Use in API routes that require authentication.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Retrieve the decrypted Claude API key for a user.
 * Returns the plaintext key or null if not configured.
 */
export async function getUserApiKey(userId: string): Promise<string | null> {
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  if (!settings?.claudeApiKeyEncrypted || !settings?.claudeApiKeyIv) {
    return null;
  }

  return decrypt(settings.claudeApiKeyEncrypted, settings.claudeApiKeyIv);
}
