import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service role key.
 * Use for server-side operations that bypass RLS (e.g., storage uploads).
 * Never expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
