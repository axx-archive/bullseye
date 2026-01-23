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
