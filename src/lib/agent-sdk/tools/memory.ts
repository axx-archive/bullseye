// Memory Read/Write Tools (Prisma-backed)
// Provides cross-draft continuity for reader perspectives

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { db } from '@/lib/db';
import { memoryWriteEngine, memoryReadEngine } from '@/lib/memory';
import { v4 as uuidv4 } from 'uuid';
import type { SubAgentMemory, MemoryEvent } from '@/lib/memory';
import type { Rating } from '@/types';

// Convert Prisma ReaderMemory to SubAgentMemory format
function prismaToSubAgentMemory(prismaMemory: {
  id: string;
  readerId: string;
  projectId: string;
  draftId: string;
  narrativeSummary: string;
  evolutionNotes: string | null;
  scores: unknown;
  recommendation: string;
  keyStrengths: string[];
  keyConcerns: string[];
  standoutQuote: string | null;
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

export const memoryReadTool = tool(
  'memory_read',
  'Read a reader\'s memory for a specific project/draft. Returns their narrative summary, prior focus group statements, chat highlights, and score history. Essential for maintaining continuity across sessions and drafts.',
  {
    readerId: z.string().describe('Reader ID (reader-maya, reader-colton, reader-devon)'),
    projectId: z.string().describe('Project ID'),
    draftId: z.string().describe('Draft ID'),
    topic: z.string().optional().describe('Optional topic filter (character, structure, dialogue, etc.)'),
    includePriorDraft: z.boolean().optional().describe('Whether to include prior draft memory for evolution tracking'),
  },
  async ({ readerId, projectId, draftId, topic, includePriorDraft }) => {
    try {
      // Fetch memory from database
      const prismaMemory = await db.readerMemory.findUnique({
        where: {
          draftId_readerId: { draftId, readerId },
        },
        include: {
          items: topic ? {
            where: { topic },
            orderBy: { createdAt: 'desc' },
            take: 20,
          } : {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          priorMemory: includePriorDraft ? {
            include: {
              items: {
                where: { importance: 'high' },
                take: 10,
              },
            },
          } : false,
        },
      });

      if (!prismaMemory) {
        // Check if there's a prior draft memory we can reference
        const draft = await db.draft.findUnique({
          where: { id: draftId },
          select: { projectId: true, draftNumber: true },
        });

        if (draft && draft.draftNumber > 1) {
          const priorDraft = await db.draft.findFirst({
            where: {
              projectId: draft.projectId,
              draftNumber: draft.draftNumber - 1,
            },
          });

          if (priorDraft) {
            const priorMemory = await db.readerMemory.findUnique({
              where: {
                draftId_readerId: { draftId: priorDraft.id, readerId },
              },
            });

            if (priorMemory) {
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    found: false,
                    hasPriorDraftMemory: true,
                    priorDraftId: priorDraft.id,
                    priorDraftNumber: draft.draftNumber - 1,
                    priorNarrative: priorMemory.narrativeSummary,
                    message: `No memory for draft ${draftId}, but found memory from prior draft ${priorDraft.id}.`,
                  }),
                }],
              };
            }
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              found: false,
              message: `No memory found for ${readerId} on project ${projectId}, draft ${draftId}.`,
            }),
          }],
        };
      }

      const memory = prismaToSubAgentMemory(prismaMemory);
      const context = memoryReadEngine.getMemoryContext(memory);

      // Build topic items from L2 MemoryItems
      const topicItems = prismaMemory.items.map((item) => ({
        content: item.content,
        topic: item.topic,
        source: item.source,
        importance: item.importance,
        pageReference: item.pageReference,
      }));

      // Include prior draft context if available
      let priorDraftContext = null;
      if (prismaMemory.priorMemory) {
        priorDraftContext = {
          narrativeSummary: prismaMemory.priorMemory.narrativeSummary,
          scores: prismaMemory.priorMemory.scores,
          recommendation: prismaMemory.priorMemory.recommendation,
          keyItems: (prismaMemory.priorMemory as unknown as { items?: Array<{ content: string; topic: string }> }).items?.map((i: { content: string; topic: string }) => ({
            content: i.content,
            topic: i.topic,
          })) || [],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            found: true,
            readerId,
            projectId,
            draftId,
            narrativeSummary: memory.narrativeSummary,
            evolutionNotes: memory.evolutionNotes,
            scores: memory.scores,
            recommendation: memory.recommendation,
            keyStrengths: memory.keyStrengths,
            keyConcerns: memory.keyConcerns,
            focusGroupStatementCount: memory.focusGroupStatements.length,
            chatHighlightCount: memory.chatHighlights.length,
            scoreDeltas: memory.scoreDeltas,
            contextForPrompt: context,
            topicItems,
            priorDraftContext,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            found: false,
            error: error instanceof Error ? error.message : 'Database error',
          }),
        }],
        isError: true,
      };
    }
  }
);

export const memoryWriteTool = tool(
  'memory_write',
  'Write new memory events for a reader. Use after coverage, focus groups, or significant chat exchanges to maintain continuity across sessions. Automatically extracts L2 items and evolves L3 narrative.',
  {
    readerId: z.string().describe('Reader ID'),
    projectId: z.string().describe('Project ID'),
    draftId: z.string().describe('Draft ID'),
    eventType: z.enum(['coverage', 'focus_group', 'chat']).describe('Type of event to memorize'),
    content: z.string().describe('The content to memorize (analysis text, focus group statement, chat exchange)'),
    scores: z.object({
      premise: z.string(),
      character: z.string(),
      dialogue: z.string(),
      structure: z.string(),
      commerciality: z.string(),
      overall: z.string(),
      premiseNumeric: z.number(),
      characterNumeric: z.number(),
      dialogueNumeric: z.number(),
      structureNumeric: z.number(),
      commercialityNumeric: z.number(),
      overallNumeric: z.number(),
    }).optional().describe('Reader scores (required for coverage events)'),
    recommendation: z.string().optional().describe('Reader recommendation'),
    keyStrengths: z.array(z.string()).optional().describe('Key strengths identified'),
    keyConcerns: z.array(z.string()).optional().describe('Key concerns identified'),
  },
  async ({ readerId, projectId, draftId, eventType, content, scores, recommendation, keyStrengths, keyConcerns }) => {
    try {
      // Check if memory exists
      const existingMemory = await db.readerMemory.findUnique({
        where: {
          draftId_readerId: { draftId, readerId },
        },
      });

      // Get prior draft memory for evolution tracking
      let priorMemoryId: string | null = null;
      let priorNarrative: string | undefined;

      const draft = await db.draft.findUnique({
        where: { id: draftId },
        select: { projectId: true, draftNumber: true },
      });

      if (draft && draft.draftNumber > 1) {
        const priorDraft = await db.draft.findFirst({
          where: {
            projectId: draft.projectId,
            draftNumber: draft.draftNumber - 1,
          },
        });

        if (priorDraft) {
          const priorMemory = await db.readerMemory.findUnique({
            where: {
              draftId_readerId: { draftId: priorDraft.id, readerId },
            },
          });

          if (priorMemory) {
            priorMemoryId = priorMemory.id;
            priorNarrative = priorMemory.narrativeSummary;
          }
        }
      }

      // Create memory event for processing
      const event: MemoryEvent = {
        id: uuidv4(),
        type: eventType,
        content,
        timestamp: new Date(),
      };

      // Use memory engine to process the event
      const existingSubAgentMemory = existingMemory ? prismaToSubAgentMemory(existingMemory) : undefined;
      const updatedMemory = await memoryWriteEngine.memorize(
        readerId,
        projectId,
        draftId,
        event,
        existingSubAgentMemory
      );

      // Merge with provided scores if available (for coverage events)
      const finalScores = scores || updatedMemory.scores;
      const finalRecommendation = recommendation || updatedMemory.recommendation;
      const finalStrengths = keyStrengths || updatedMemory.keyStrengths;
      const finalConcerns = keyConcerns || updatedMemory.keyConcerns;

      // Calculate score deltas if prior memory exists
      let scoreDeltas = null;
      if (priorNarrative && scores && existingSubAgentMemory?.scores) {
        const priorScores = existingSubAgentMemory.scores;
        scoreDeltas = [
          { dimension: 'premise', previousNumeric: priorScores.premiseNumeric, currentNumeric: scores.premiseNumeric, previousRating: priorScores.premise, currentRating: scores.premise, reason: '' },
          { dimension: 'character', previousNumeric: priorScores.characterNumeric, currentNumeric: scores.characterNumeric, previousRating: priorScores.character, currentRating: scores.character, reason: '' },
          { dimension: 'dialogue', previousNumeric: priorScores.dialogueNumeric, currentNumeric: scores.dialogueNumeric, previousRating: priorScores.dialogue, currentRating: scores.dialogue, reason: '' },
          { dimension: 'structure', previousNumeric: priorScores.structureNumeric, currentNumeric: scores.structureNumeric, previousRating: priorScores.structure, currentRating: scores.structure, reason: '' },
          { dimension: 'commerciality', previousNumeric: priorScores.commercialityNumeric, currentNumeric: scores.commercialityNumeric, previousRating: priorScores.commerciality, currentRating: scores.commerciality, reason: '' },
          { dimension: 'overall', previousNumeric: priorScores.overallNumeric, currentNumeric: scores.overallNumeric, previousRating: priorScores.overall, currentRating: scores.overall, reason: '' },
        ].filter(d => d.previousNumeric !== d.currentNumeric);
      }

      // Upsert the memory record
      const savedMemory = await db.readerMemory.upsert({
        where: {
          draftId_readerId: { draftId, readerId },
        },
        create: {
          draftId,
          readerId,
          projectId,
          narrativeSummary: updatedMemory.narrativeSummary,
          evolutionNotes: updatedMemory.evolutionNotes,
          scores: finalScores,
          recommendation: finalRecommendation,
          keyStrengths: finalStrengths,
          keyConcerns: finalConcerns,
          evidenceStrength: updatedMemory.evidenceStrength,
          focusGroupItems: JSON.parse(JSON.stringify(updatedMemory.focusGroupStatements ?? [])),
          chatHighlights: JSON.parse(JSON.stringify(updatedMemory.chatHighlights ?? [])),
          scoreDeltas: scoreDeltas ? JSON.parse(JSON.stringify(scoreDeltas)) : undefined,
          priorMemoryId,
        },
        update: {
          narrativeSummary: updatedMemory.narrativeSummary,
          evolutionNotes: updatedMemory.evolutionNotes,
          scores: finalScores,
          recommendation: finalRecommendation,
          keyStrengths: finalStrengths,
          keyConcerns: finalConcerns,
          evidenceStrength: updatedMemory.evidenceStrength,
          focusGroupItems: JSON.parse(JSON.stringify(updatedMemory.focusGroupStatements ?? [])),
          chatHighlights: JSON.parse(JSON.stringify(updatedMemory.chatHighlights ?? [])),
          scoreDeltas: scoreDeltas ? JSON.parse(JSON.stringify(scoreDeltas)) : undefined,
        },
      });

      // Extract and store L2 memory items
      const items = await extractMemoryItems(content, eventType);
      if (items.length > 0) {
        await db.memoryItem.createMany({
          data: items.map((item) => ({
            memoryId: savedMemory.id,
            content: item.content,
            topic: item.topic,
            source: eventType,
            importance: item.importance,
            pageReference: item.pageReference,
          })),
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            memoryId: savedMemory.id,
            readerId,
            eventType,
            narrativeSummary: updatedMemory.narrativeSummary,
            evolutionNotes: updatedMemory.evolutionNotes,
            itemsExtracted: items.length,
            hasScoreDeltas: !!scoreDeltas && scoreDeltas.length > 0,
            message: `Memory updated for ${readerId}. Narrative evolved. ${items.length} items extracted.`,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Database error',
          }),
        }],
        isError: true,
      };
    }
  }
);

// Bulk memory read for all readers on a draft
export const memoryReadAllTool = tool(
  'memory_read_all',
  'Read memories for all three readers on a specific draft. Useful before spawning readers to inject prior context.',
  {
    projectId: z.string().describe('Project ID'),
    draftId: z.string().describe('Draft ID'),
  },
  async ({ projectId, draftId }) => {
    try {
      const memories = await db.readerMemory.findMany({
        where: { draftId },
        include: {
          items: {
            where: { importance: 'high' },
            take: 10,
          },
        },
      });

      if (memories.length === 0) {
        // Check for prior draft memories
        const draft = await db.draft.findUnique({
          where: { id: draftId },
          select: { projectId: true, draftNumber: true },
        });

        if (draft && draft.draftNumber > 1) {
          const priorDraft = await db.draft.findFirst({
            where: {
              projectId: draft.projectId,
              draftNumber: draft.draftNumber - 1,
            },
          });

          if (priorDraft) {
            const priorMemories = await db.readerMemory.findMany({
              where: { draftId: priorDraft.id },
            });

            if (priorMemories.length > 0) {
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    found: false,
                    hasPriorDraftMemories: true,
                    priorDraftId: priorDraft.id,
                    priorDraftNumber: draft.draftNumber - 1,
                    priorMemories: priorMemories.map((m) => ({
                      readerId: m.readerId,
                      narrative: m.narrativeSummary,
                      recommendation: m.recommendation,
                    })),
                    message: `No memories for current draft, but found ${priorMemories.length} reader memories from draft ${draft.draftNumber - 1}.`,
                  }),
                }],
              };
            }
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              found: false,
              message: `No memories found for draft ${draftId}.`,
            }),
          }],
        };
      }

      const readerContexts: Record<string, string> = {};
      const readerSummaries: Array<{
        readerId: string;
        narrative: string;
        recommendation: string;
        keyStrengths: string[];
        keyConcerns: string[];
      }> = [];

      for (const prismaMemory of memories) {
        const memory = prismaToSubAgentMemory(prismaMemory);
        readerContexts[prismaMemory.readerId] = memoryReadEngine.getMemoryContext(memory);
        readerSummaries.push({
          readerId: prismaMemory.readerId,
          narrative: memory.narrativeSummary,
          recommendation: memory.recommendation,
          keyStrengths: memory.keyStrengths,
          keyConcerns: memory.keyConcerns,
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            found: true,
            projectId,
            draftId,
            readerCount: memories.length,
            readerContexts,
            readerSummaries,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            found: false,
            error: error instanceof Error ? error.message : 'Database error',
          }),
        }],
        isError: true,
      };
    }
  }
);

// Helper function to extract L2 memory items from content
async function extractMemoryItems(
  content: string,
  source: string
): Promise<Array<{ content: string; topic: string; importance: string; pageReference?: string }>> {
  // Use Haiku to extract atomic facts
  const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
  const client = new AnthropicSDK();

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 2048,
      system: `Extract atomic facts from the provided content. Return a JSON array.

OUTPUT FORMAT:
[
  {
    "content": "The specific fact or observation",
    "topic": "character" | "structure" | "dialogue" | "premise" | "commerciality" | "general",
    "importance": "high" | "medium" | "low",
    "pageReference": "optional page number if mentioned"
  }
]

RULES:
- Extract only factual statements, not opinions
- Each item should be self-contained
- Prioritize items that represent scoring decisions or specific critiques
- Mark as "high" importance if it's a key strength, concern, or score justification
- Include page references when available
- Maximum 15 items`,
      messages: [{
        role: 'user',
        content: `Extract memory items from this ${source} content:\n\n${content.slice(0, 4000)}`,
      }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') return [];

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}
