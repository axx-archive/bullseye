// Reader Chat Tool
// 1:1 conversations with individual readers

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { getReaderById } from '@/lib/agents/reader-personas';
import { getCurrentScript } from './ingest';
import { getLastReaderPerspectives, getLastProjectContext } from './readers';
import { db } from '@/lib/db';
import { memoryReadEngine } from '@/lib/memory';
import type { SubAgentMemory } from '@/lib/memory';
import type { Rating } from '@/types';
import type { EventEmitter } from './readers';

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

export function createReaderChatTool(emitEvent: EventEmitter) {
  return tool(
    'reader_chat',
    'Send a message to a specific reader and get their response. Use this for 1:1 conversations with Maya, Colton, or Devon. The reader will respond in character with their full context and memory.',
    {
      readerId: z.enum(['reader-maya', 'reader-colton', 'reader-devon']).describe('Which reader to chat with'),
      message: z.string().describe('The message to send to the reader'),
      projectId: z.string().optional().describe('Project ID for context'),
      draftId: z.string().optional().describe('Draft ID for context'),
    },
    async ({ readerId, message, projectId, draftId }) => {
      const reader = getReaderById(readerId);
      if (!reader) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown reader: ${readerId}` }),
          }],
          isError: true,
        };
      }

      const script = getCurrentScript();
      const perspectives = getLastReaderPerspectives();
      const projectContext = getLastProjectContext();
      
      const effectiveProjectId = projectId || projectContext.projectId;
      const effectiveDraftId = draftId || projectContext.draftId;

      // Emit typing indicator
      const source = readerId.replace('-', '_') as 'reader_maya' | 'reader_colton' | 'reader_devon';
      emitEvent({
        source,
        type: 'reader_chat_typing',
        readerId,
      });

      // Get reader's perspective if available
      const readerPerspective = perspectives.find((p) => p.readerId === readerId);

      // Get reader's memory if available
      let memoryContext = '';
      if (effectiveDraftId) {
        try {
          const memory = await db.readerMemory.findUnique({
            where: {
              draftId_readerId: { draftId: effectiveDraftId, readerId },
            },
          });

          if (memory) {
            const subAgentMemory = prismaToSubAgentMemory(memory);
            memoryContext = memoryReadEngine.getMemoryContext(subAgentMemory);
          }
        } catch (error) {
          console.error('Failed to fetch reader memory:', error);
        }
      }

      // Build context for the reader
      let contextBlock = '';
      
      if (script) {
        contextBlock += `SCRIPT CONTEXT:\nTitle: "${script.title}" by ${script.author}\nGenre: ${script.genre}, Format: ${script.format}\n\n`;
      }

      if (readerPerspective) {
        contextBlock += `YOUR ANALYSIS:\n`;
        contextBlock += `Overall: ${readerPerspective.scores.overall} (${readerPerspective.scores.overallNumeric}/100)\n`;
        contextBlock += `Recommendation: ${readerPerspective.recommendation}\n`;
        contextBlock += `Key Strengths: ${readerPerspective.keyStrengths.join('; ')}\n`;
        contextBlock += `Key Concerns: ${readerPerspective.keyConcerns.join('; ')}\n\n`;
      }

      if (memoryContext) {
        contextBlock += memoryContext + '\n\n';
      }

      // Generate reader response
      const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
      const client = new AnthropicSDK();

      try {
        const response = await client.messages.create({
          model: 'claude-opus-4-5-20251101',
          max_tokens: 1024,
          system: `${reader.systemPromptBase}

${contextBlock}

CONVERSATION MODE:
You are having a direct conversation with a user who wants to discuss the script. Respond naturally in your voice as ${reader.displayName}. Be conversational but maintain your perspective and analytical focus. Reference specific elements from the script and your analysis when relevant.

Keep responses focused and engaging—aim for 2-4 paragraphs unless a longer response is warranted.`,
          messages: [{
            role: 'user',
            content: message,
          }],
        });

        const textContent = response.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: 'No response from reader' }),
            }],
            isError: true,
          };
        }

        const readerResponse = textContent.text;

        // Emit the response
        emitEvent({
          source,
          type: 'reader_chat_message',
          readerId,
          text: readerResponse,
        });

        // Persist the chat exchange to memory
        if (effectiveDraftId && effectiveProjectId) {
          try {
            const existingMemory = await db.readerMemory.findUnique({
              where: {
                draftId_readerId: { draftId: effectiveDraftId, readerId },
              },
            });

            if (existingMemory) {
              const existingHighlights = (existingMemory.chatHighlights as unknown as Array<{
                exchange: string;
                topic: string;
                importance: string;
                timestamp: Date;
              }>) || [];

              const newHighlight = {
                exchange: `User: ${message.slice(0, 200)}... → ${reader.name}: ${readerResponse.slice(0, 200)}...`,
                topic: 'general',
                importance: 'medium',
                timestamp: new Date(),
              };

              await db.readerMemory.update({
                where: { id: existingMemory.id },
                data: {
                  chatHighlights: [...existingHighlights, newHighlight],
                },
              });
            }
          } catch (error) {
            console.error('Failed to persist chat exchange:', error);
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              readerId,
              readerName: reader.name,
              displayName: reader.displayName,
              response: readerResponse,
              hadMemoryContext: !!memoryContext,
              hadPerspective: !!readerPerspective,
            }),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to get reader response',
            }),
          }],
          isError: true,
        };
      }
    }
  );
}
