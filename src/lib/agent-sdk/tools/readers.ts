// Reader Spawning Tool
// Runs all three reader analyses in parallel, emitting events for each
// Now with memory injection for cross-draft continuity

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { runReaderAnalysis, analysisToReaderPerspective } from '@/lib/agents';
import { getCurrentScript } from './ingest';
import { db } from '@/lib/db';
import { memoryReadEngine } from '@/lib/memory';
import type { ReaderAnalysisOutput } from '@/lib/agents/types';
import type { ReaderPerspective, Rating } from '@/types';
import type { ScoutSSEEvent } from '../types';
import type { SubAgentMemory } from '@/lib/memory';

export type EventEmitter = (event: ScoutSSEEvent) => void;

// Session-scoped storage for reader results
let lastReaderResults: Map<string, ReaderAnalysisOutput> = new Map();
let lastReaderPerspectives: ReaderPerspective[] = [];
let lastProjectId: string | null = null;
let lastDraftId: string | null = null;

export function getLastReaderResults(): Map<string, ReaderAnalysisOutput> {
  return lastReaderResults;
}

export function getLastReaderPerspectives(): ReaderPerspective[] {
  return lastReaderPerspectives;
}

export function getLastProjectContext(): { projectId: string | null; draftId: string | null } {
  return { projectId: lastProjectId, draftId: lastDraftId };
}

// Convert Prisma memory to SubAgentMemory
function prismaToSubAgentMemory(prismaMemory: {
  readerId: string;
  projectId: string;
  draftId: string;
  narrativeSummary: string;
  evolutionNotes: string | null;
  scores: unknown;
  recommendation: string;
  keyStrengths: string[];
  keyConcerns: string[];
  evidenceStrength: number;
  focusGroupItems: unknown;
  chatHighlights: unknown;
  scoreDeltas: unknown;
  updatedAt: Date;
}): SubAgentMemory {
  const scores = prismaMemory.scores as {
    premise: Rating;
    character: Rating;
    dialogue: Rating;
    structure: Rating;
    commerciality: Rating;
    overall: Rating;
    premiseNumeric: number;
    characterNumeric: number;
    dialogueNumeric: number;
    structureNumeric: number;
    commercialityNumeric: number;
    overallNumeric: number;
  };

  return {
    readerId: prismaMemory.readerId,
    projectId: prismaMemory.projectId,
    draftId: prismaMemory.draftId,
    narrativeSummary: prismaMemory.narrativeSummary,
    evolutionNotes: prismaMemory.evolutionNotes ?? undefined,
    scores,
    recommendation: prismaMemory.recommendation,
    keyStrengths: prismaMemory.keyStrengths,
    keyConcerns: prismaMemory.keyConcerns,
    evidenceStrength: prismaMemory.evidenceStrength,
    focusGroupStatements: (prismaMemory.focusGroupItems as Array<{
      statement: string;
      topic: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      timestamp: Date;
    }>) || [],
    chatHighlights: (prismaMemory.chatHighlights as Array<{
      exchange: string;
      topic: string;
      importance: 'high' | 'medium' | 'low';
      timestamp: Date;
    }>) || [],
    scoreDeltas: prismaMemory.scoreDeltas as Array<{
      dimension: string;
      previousNumeric: number;
      currentNumeric: number;
      previousRating: string;
      currentRating: string;
      reason: string;
    }> | undefined,
    lastUpdated: prismaMemory.updatedAt,
  };
}

export function createSpawnReadersTool(emitEvent: EventEmitter) {
  return tool(
    'spawn_readers',
    'Spawn all three reader sub-agents (Maya, Colton, Devon) to analyze the ingested script in parallel. Automatically injects memory context from prior drafts if available. Returns their individual analyses with scores, recommendations, and detailed assessments.',
    {
      calibrationContext: z.string().optional().describe('Optional studio calibration context to inject into reader prompts'),
      projectId: z.string().optional().describe('Project ID for memory lookup (auto-detected from script if not provided)'),
      draftId: z.string().optional().describe('Draft ID for memory lookup (auto-detected from script if not provided)'),
    },
    async ({ calibrationContext, projectId, draftId }) => {
      const script = getCurrentScript();
      if (!script) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'No script ingested. Call ingest_script first.' }),
          }],
          isError: true,
        };
      }

      // Use provided IDs or fall back to script metadata
      const effectiveProjectId = projectId || script.projectId;
      const effectiveDraftId = draftId || script.draftId;

      // Store for later use
      lastProjectId = effectiveProjectId || null;
      lastDraftId = effectiveDraftId || null;

      // Emit phase change
      emitEvent({
        source: 'system',
        type: 'phase_change',
        phase: 'analysis',
      });

      const readerIds = ['reader-maya', 'reader-colton', 'reader-devon'] as const;

      // Fetch existing memories for all readers
      const readerMemories = new Map<string, string>();
      
      if (effectiveDraftId) {
        try {
          // First check current draft for memories
          const currentMemories = await db.readerMemory.findMany({
            where: { draftId: effectiveDraftId },
          });

          for (const mem of currentMemories) {
            const subAgentMem = prismaToSubAgentMemory(mem);
            readerMemories.set(mem.readerId, memoryReadEngine.getMemoryContext(subAgentMem));
          }

          // If no current memories, check for prior draft memories
          if (currentMemories.length === 0 && effectiveProjectId) {
            const draft = await db.draft.findUnique({
              where: { id: effectiveDraftId },
              select: { draftNumber: true },
            });

            if (draft && draft.draftNumber > 1) {
              const priorDraft = await db.draft.findFirst({
                where: {
                  projectId: effectiveProjectId,
                  draftNumber: draft.draftNumber - 1,
                },
              });

              if (priorDraft) {
                const priorMemories = await db.readerMemory.findMany({
                  where: { draftId: priorDraft.id },
                });

                for (const mem of priorMemories) {
                  const subAgentMem = prismaToSubAgentMemory(mem);
                  // Add evolution context
                  const evolutionContext = `\n\nPRIOR DRAFT CONTEXT (Draft ${draft.draftNumber - 1}):\nYou previously analyzed an earlier version of this script. Your position was:\n${mem.narrativeSummary}\n\nPay attention to what has changed and whether it addresses your prior concerns.`;
                  readerMemories.set(mem.readerId, memoryReadEngine.getMemoryContext(subAgentMem) + evolutionContext);
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch reader memories:', error);
          // Continue without memories
        }
      }

      // Signal analysis start for each reader
      for (const readerId of readerIds) {
        const hasMemory = readerMemories.has(readerId);
        emitEvent({
          source: readerId.replace('-', '_') as 'reader_maya' | 'reader_colton' | 'reader_devon',
          type: 'analysis_start',
          readerId,
          data: { hasMemoryContext: hasMemory },
        });
      }

      // Run all readers in parallel with memory injection
      const results = await Promise.all(
        readerIds.map(async (readerId) => {
          const source = readerId.replace('-', '_') as 'reader_maya' | 'reader_colton' | 'reader_devon';
          try {
            const memoryContext = readerMemories.get(readerId);
            
            const analysis = await runReaderAnalysis(
              script.scriptText,
              readerId,
              calibrationContext,
              memoryContext // Now injecting memory context
            );

            // Emit completion event with analysis data
            emitEvent({
              source,
              type: 'analysis_complete',
              readerId,
              data: {
                scores: analysis.scores,
                recommendation: analysis.recommendation,
                keyStrengths: analysis.keyStrengths,
                keyConcerns: analysis.keyConcerns,
                standoutQuote: analysis.standoutQuote,
                evidenceStrength: analysis.evidenceStrength,
                hadMemoryContext: !!memoryContext,
              },
            });

            return { readerId, analysis, error: null };
          } catch (error) {
            emitEvent({
              source,
              type: 'error',
              readerId,
              error: error instanceof Error ? error.message : 'Analysis failed',
            });
            return { readerId, analysis: null, error };
          }
        })
      );

      // Store results for harmonization
      lastReaderResults = new Map();
      lastReaderPerspectives = [];

      const perspectives: ReaderPerspective[] = [];
      const summaries: string[] = [];

      for (const { readerId, analysis } of results) {
        if (analysis) {
          lastReaderResults.set(readerId, analysis);
          const perspective = analysisToReaderPerspective(readerId, analysis);
          perspectives.push(perspective);
          summaries.push(
            `${perspective.readerName} (${perspective.voiceTag}): ` +
            `Overall ${analysis.scores.overall} (${analysis.scores.overallNumeric}/100), ` +
            `recommends ${analysis.recommendation}. ` +
            `Strengths: ${analysis.keyStrengths.join('; ')}. ` +
            `Concerns: ${analysis.keyConcerns.join('; ')}.`
          );
        }
      }

      lastReaderPerspectives = perspectives;

      const successCount = results.filter((r) => r.analysis !== null).length;
      const readersWithMemory = readerIds.filter((id) => readerMemories.has(id)).length;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            readersCompleted: successCount,
            totalReaders: readerIds.length,
            readersWithMemoryContext: readersWithMemory,
            projectId: effectiveProjectId,
            draftId: effectiveDraftId,
            perspectives: perspectives.map((p) => ({
              readerId: p.readerId,
              readerName: p.readerName,
              voiceTag: p.voiceTag,
              overallScore: p.scores.overallNumeric,
              overallRating: p.scores.overall,
              recommendation: p.recommendation,
              keyStrengths: p.keyStrengths,
              keyConcerns: p.keyConcerns,
              standoutQuote: p.standoutQuote,
            })),
            summaries,
          }),
        }],
      };
    }
  );
}
