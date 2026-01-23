// PDF text extraction endpoint
// POST /api/upload - accepts multipart form data with a PDF file, returns extracted text

import { NextResponse } from 'next/server';

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 10MB limit' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are processed server-side. Text files can be read client-side.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = await extractTextFromPDF(new Uint8Array(buffer));

    if (text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful text from this PDF. It may be image-based or password-protected. Try uploading as .txt or .fountain instead.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      content: text,
      filename: file.name,
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
      { status: 500 }
    );
  }
}

async function extractTextFromPDF(data: Uint8Array): Promise<string> {
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

  return pages.join('\n\n');
}
