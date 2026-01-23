import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project exists and belongs to user's studio
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const notes = formData.get('notes') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are supported' },
      { status: 400 }
    );
  }

  // Extract text from PDF
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  let scriptText: string;
  let pageCount: number;

  try {
    const result = await extractTextFromPDF(uint8);
    scriptText = result.text;
    pageCount = result.pageCount;
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
      { status: 400 }
    );
  }

  if (scriptText.trim().length < 50) {
    return NextResponse.json(
      { error: 'Could not extract meaningful text from this PDF. It may be image-based or password-protected.' },
      { status: 400 }
    );
  }

  // Determine next draft number
  const lastDraft = await db.draft.findFirst({
    where: { projectId },
    orderBy: { draftNumber: 'desc' },
    select: { draftNumber: true },
  });
  const draftNumber = (lastDraft?.draftNumber ?? 0) + 1;

  // Upload PDF to Supabase Storage
  const storagePath = `${projectId}/${draftNumber}.pdf`;
  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from('scripts')
    .upload(storagePath, uint8, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: 'Failed to upload file to storage' },
      { status: 500 }
    );
  }

  // Get the public URL for the stored file
  const { data: urlData } = supabase.storage
    .from('scripts')
    .getPublicUrl(storagePath);

  const scriptUrl = urlData.publicUrl;

  // Create Draft record
  const draft = await db.draft.create({
    data: {
      projectId,
      draftNumber,
      scriptUrl,
      scriptText,
      pageCount,
      notes: notes || null,
      status: 'PENDING',
    },
  });

  return NextResponse.json(
    {
      id: draft.id,
      draftNumber: draft.draftNumber,
      pageCount: draft.pageCount,
      status: draft.status,
      scriptUrl: draft.scriptUrl,
    },
    { status: 201 }
  );
}

async function extractTextFromPDF(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => 'str' in item && typeof (item as { str: string }).str === 'string')
      .map((item) => (item as { str: string }).str)
      .join(' ');
    pages.push(pageText);
  }

  return {
    text: pages.join('\n\n'),
    pageCount: pdf.numPages,
  };
}
