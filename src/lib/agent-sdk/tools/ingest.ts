// Script Ingestion Tool
// Stores script text and metadata for analysis

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';

export interface IngestedScript {
  id: string;
  title: string;
  author: string;
  genre: string;
  format: string;
  pageCount: number;
  scriptText: string;
  ingestedAt: Date;
  // Memory tracking
  projectId?: string;
  draftId?: string;
  draftNumber?: number;
}

// In-memory store for the current session
let currentScript: IngestedScript | null = null;

export function getCurrentScript(): IngestedScript | null {
  return currentScript;
}

export function setCurrentScript(script: IngestedScript): void {
  currentScript = script;
}

export function clearCurrentScript(): void {
  currentScript = null;
}

/**
 * Extract metadata (title, writer, genre, format) from script text using an LLM call.
 * Reads the first ~15000 chars (approx 5 pages) to identify metadata.
 * Returns extracted values or null if extraction fails.
 */
export async function extractScriptMetadata(
  scriptText: string
): Promise<{ title: string; writer: string; genre: string; format: string } | null> {
  const excerpt = scriptText.slice(0, 15000);

  try {
    const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
    const client = new AnthropicSDK();

    const response = await client.messages.create({
      model: 'claude-haiku-4-20250414',
      max_tokens: 256,
      system: `You are a script metadata extractor. Given the opening pages of a screenplay, extract the title, writer, genre, and format. Return ONLY valid JSON with no extra text.

OUTPUT FORMAT:
{
  "title": "The script title as written on the title page",
  "writer": "The writer/author name as credited",
  "genre": "Primary genre (e.g., Action, Comedy, Drama, Thriller, Sci-Fi, Horror, Romance, Action/Thriller)",
  "format": "FEATURE" | "TV_PILOT" | "TV_EPISODE" | "SHORT" | "LIMITED_SERIES" | "DOCUMENTARY"
}

RULES:
- Extract title from the title page if present, otherwise infer from content
- Extract writer from "Written by", "Screenplay by", or similar credits
- If writer cannot be determined, use "Unknown"
- Infer genre from tone, setting, and content of the opening pages
- Infer format from page count context and structure (acts, cold opens, etc.)
- If uncertain about any field, make your best educated guess rather than leaving blank`,
      messages: [{
        role: 'user',
        content: `Extract metadata from this script excerpt:\n\n${excerpt}`,
      }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields exist
    if (!parsed.title || !parsed.writer || !parsed.genre || !parsed.format) {
      return null;
    }

    // Normalize format to valid enum value
    const validFormats = ['FEATURE', 'TV_PILOT', 'TV_EPISODE', 'SHORT', 'LIMITED_SERIES', 'DOCUMENTARY'];
    const normalizedFormat = parsed.format.toUpperCase().replace(/[\s-]/g, '_');
    const format = validFormats.includes(normalizedFormat) ? normalizedFormat : null;

    return {
      title: parsed.title,
      writer: parsed.writer,
      genre: parsed.genre,
      format: format || parsed.format,
    };
  } catch {
    // Extraction failed — caller should keep existing defaults
    return null;
  }
}

export const ingestScriptTool = tool(
  'ingest_script',
  'Ingest and store a script for analysis. Call this when the user provides script text. Extracts and validates metadata. Include projectId and draftId for memory continuity across sessions.',
  {
    scriptText: z.string().describe('The full text of the script'),
    title: z.string().describe('Title of the script'),
    author: z.string().describe('Author/writer of the script'),
    genre: z.string().describe('Genre (e.g., Drama, Thriller, Comedy, Sci-Fi, Horror)'),
    format: z.string().describe('Format: FEATURE, TV_PILOT, TV_EPISODE, SHORT, LIMITED_SERIES, DOCUMENTARY'),
    pageCount: z.number().describe('Approximate page count of the script'),
    projectId: z.string().optional().describe('Project ID for memory tracking'),
    draftId: z.string().optional().describe('Draft ID for memory tracking'),
    draftNumber: z.number().optional().describe('Draft number (1, 2, 3, etc.) for evolution tracking'),
  },
  async ({ scriptText, title, author, genre, format, pageCount, projectId, draftId, draftNumber }) => {
    const id = `script-${Date.now()}`;

    currentScript = {
      id,
      title,
      author,
      genre,
      format,
      pageCount,
      scriptText,
      ingestedAt: new Date(),
      projectId,
      draftId,
      draftNumber,
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          scriptId: id,
          title,
          author,
          genre,
          format,
          pageCount,
          characterCount: scriptText.length,
          projectId: projectId || null,
          draftId: draftId || null,
          draftNumber: draftNumber || null,
          message: `Script "${title}" by ${author} ingested successfully. ${pageCount} pages, ${genre} ${format}. ${projectId ? `Project: ${projectId}, Draft: ${draftNumber || 1}. Memory tracking enabled.` : 'Ready for reader analysis.'}`,
        }),
      }],
    };
  }
);
