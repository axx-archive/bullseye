import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

async function main() {
  console.log('=== Clear All Studios Migration ===\n');

  // --- Database Setup ---
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // --- Step 1: Count existing studios ---
  const studioCount = await prisma.studio.count();
  console.log(`Found ${studioCount} studio(s) in database.`);

  if (studioCount === 0) {
    console.log('No studios to delete. Database is already clean.');
  } else {
    // --- Step 2: Delete all studios ---
    // onDelete: Cascade on Studio relations handles:
    // - Projects (and their Drafts, DraftDeliverables, FocusSessions, ChatMessages, etc.)
    // - ReaderPersonas (and their ReaderMemories, MemoryItems, FocusGroupMessages)
    // - ExecutiveProfiles (and their ExecutiveEvaluations)
    // - StudioIntelligence
    // - Users (ActiveStudio relation has onDelete: Cascade)
    const deleteResult = await prisma.studio.deleteMany({});
    console.log(`Deleted ${deleteResult.count} studio(s) and all related records (cascade).`);

    // Verify users were cascade-deleted
    const remainingUsers = await prisma.user.count();
    console.log(`Remaining users after cascade: ${remainingUsers}`);
  }

  // --- Step 3: Clean up Supabase Storage ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    console.log('\nCleaning up Supabase Storage...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: files, error: listError } = await supabase.storage
      .from('scripts')
      .list('', { limit: 1000 });

    if (listError) {
      console.warn(`Warning: Could not list storage files: ${listError.message}`);
    } else if (!files || files.length === 0) {
      console.log('No files in "scripts" bucket. Storage is already clean.');
    } else {
      const filePaths = files.map((f) => f.name);
      const { error: removeError } = await supabase.storage
        .from('scripts')
        .remove(filePaths);

      if (removeError) {
        console.warn(`Warning: Could not remove storage files: ${removeError.message}`);
      } else {
        console.log(`Removed ${filePaths.length} file(s) from "scripts" bucket.`);
      }
    }
  } else {
    console.warn(
      'Warning: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Skipping storage cleanup.'
    );
  }

  // --- Step 4: Clean up orphaned records ---
  // ResourceArchive records are not FK-linked to studios, clean them up too
  const archiveCount = await prisma.resourceArchive.deleteMany({});
  if (archiveCount.count > 0) {
    console.log(`\nDeleted ${archiveCount.count} orphaned ResourceArchive record(s).`);
  }

  // --- Summary ---
  console.log('\n=== Migration Complete ===');
  console.log('All studios and related data have been cleared.');
  console.log('Users will be re-provisioned on next login via /api/auth/provision.');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
