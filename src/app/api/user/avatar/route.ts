import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Only jpg, jpeg, png, webp, and gif are accepted.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 2MB limit' },
      { status: 400 }
    );
  }

  const ext = TYPE_TO_EXT[file.type] || 'jpg';
  const storagePath = `${user.id}.${ext}`;
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, uint8, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Avatar upload error:', uploadError);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  const avatarUrl = urlData.publicUrl;

  await db.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl });
}
