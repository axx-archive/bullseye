// Focus Group Tool
// Streaming variant that emits events as readers discuss
// Now with memory injection for consistent reader voices

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { FocusGroupEngine } from '@/lib/focus-group';
import { getLastReaderPerspectives, getLastProjectContext } from './readers';
import { getLastDeliverable } from './analysis';
import { db } from '@/lib/db';
import { memoryReadEngine } from '@/lib/memory';
import type { SubAgentMemory } from '@/lib/memory';
import type { Divergence, Rating } from '@/types';
import type { ScoutSSEEvent } from '../types';
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

export function createFocusGroupTool(emitEvent: EventEmitter) {
  return tool(
    'run_focus_group',
    'Run a live focus group discussion between the readers. They will debate divergence points and answer specific questions. Events stream to the right panel in real-time. Automatically injects reader memories for consistent voices.',
    {
      topic: z.string().optional().describe('Overall topic for the focus group (e.g., "Character development concerns")'),
      questions: z.array(z.string()).min(1).max(5).describe('Specific questions for the readers to discuss (use generate_focus_questions to create these)'),
      divergenceTopics: z.array(z.string()).optional().describe('Topics where readers diverged (auto-detected if omitted)'),
      projectId: z.string().optional().describe('Project ID for memory lookup'),
      draftId: z.string().optional().describe('Draft ID for memory lookup'),
    },
    async ({ topic, questions, divergenceTopics, projectId, draftId }) => {
      // Primary source: the harmonized deliverable (set by harmonize_analyses)
      const deliverable = getLastDeliverable();
      // Fallback: raw reader perspectives (fragile module-level state)
      const perspectives = deliverable?.readerPerspectives || getLastReaderPerspectives();

      if (perspectives.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No reader perspectives available. You must run spawn_readers and then harmonize_analyses before running a focus group.' }) }],
          isError: true,
        };
      }

      // Get project context from deliverable, readers, or params
      const projectContext = getLastProjectContext();
      const effectiveProjectId = projectId || deliverable?.projectId || projectContext.projectId;
      const effectiveDraftId = draftId || deliverable?.draftId || projectContext.draftId;

      // Emit phase change
      emitEvent({
        source: 'system',
        type: 'phase_change',
        phase: 'focus_group',
      });

      // Build divergence points from topics or auto-detect
      const divergencePoints: Divergence[] = (divergenceTopics || []).map((t) => ({
        topic: t,
        positions: perspectives.map((p) => ({
          readerId: p.readerId,
          readerName: p.readerName,
          position: `Rated overall as ${p.scores.overall} (${p.scores.overallNumeric}/100)`,
        })),
        scoutTake: `Readers showed divergence on ${t}`,
      }));

      // Fetch reader memories from database
      const readerMemories = new Map<string, SubAgentMemory>();

      if (effectiveDraftId) {
        try {
          const memories = await db.readerMemory.findMany({
            where: { draftId: effectiveDraftId },
          });

          for (const mem of memories) {
            readerMemories.set(mem.readerId, prismaToSubAgentMemory(mem));
          }

          // If no current memories, check prior draft
          if (memories.length === 0 && effectiveProjectId) {
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
                  readerMemories.set(mem.readerId, prismaToSubAgentMemory(mem));
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch reader memories for focus group:', error);
        }
      }

      const engine = new FocusGroupEngine();
      const messages = await engine.runFocusGroup(
        {
          draftId: effectiveDraftId || `draft-${Date.now()}`,
          topic,
          questions,
          readerPerspectives: perspectives,
          readerMemories,
          divergencePoints,
        },
        (event) => {
          // Forward focus group events to SSE stream
          if (event.type === 'message') {
            emitEvent({
              source: 'focus_group',
              type: 'focus_group_message',
              speaker: event.speaker,
              speakerType: event.speakerType,
              readerId: event.readerId,
              text: event.content,
            });
          } else if (event.type === 'typing') {
            emitEvent({
              source: 'focus_group',
              type: 'focus_group_typing',
              speaker: event.speaker,
              speakerType: event.speakerType,
              readerId: event.readerId,
            });
          } else if (event.type === 'complete') {
            emitEvent({
              source: 'focus_group',
              type: 'focus_group_complete',
            });
          }
        }
      );

      // Persist focus group messages to reader memories AND FocusSession table
      let sessionId: string | null = null;
      if (effectiveDraftId && effectiveProjectId) {
        try {
          // Group messages by reader for memory updates
          const readerMessages = new Map<string, string[]>();
          for (const msg of messages) {
            if (msg.speakerType === 'reader' && msg.readerId) {
              const existing = readerMessages.get(msg.readerId) || [];
              existing.push(msg.content);
              readerMessages.set(msg.readerId, existing);
            }
          }

          // Update each reader's memory with their focus group statements
          for (const [readerId, statements] of readerMessages) {
            const existingMemory = await db.readerMemory.findUnique({
              where: {
                draftId_readerId: { draftId: effectiveDraftId, readerId },
              },
            });

            if (existingMemory) {
              const existingItems = (existingMemory.focusGroupItems as unknown as Array<{
                statement: string;
                topic: string;
                sentiment: string;
                timestamp: Date;
              }>) || [];

              const newItems = statements.map((stmt) => ({
                statement: stmt,
                topic: topic || 'general',
                sentiment: 'neutral',
                timestamp: new Date(),
              }));

              await db.readerMemory.update({
                where: { id: existingMemory.id },
                data: {
                  focusGroupItems: [...existingItems, ...newItems],
                },
              });
            }
          }

          // Persist to FocusSession + FocusGroupMessage tables
          if (!effectiveDraftId.startsWith('draft-')) {
            // Detect consensus/divergence from messages
            const readerPositions = new Map<string, string[]>();
            for (const msg of messages) {
              if (msg.speakerType === 'reader' && msg.readerId) {
                const existing = readerPositions.get(msg.readerId) || [];
                existing.push(msg.content.slice(0, 200));
                readerPositions.set(msg.readerId, existing);
              }
            }

            const session = await db.focusSession.create({
              data: {
                draftId: effectiveDraftId,
                topic: topic || 'General discussion',
                status: 'COMPLETED',
                questions,
                summary: `Focus group with ${messages.length} messages across ${questions.length} questions.`,
                consensusPoints: [],
                startedAt: new Date(Date.now() - messages.length * 2000), // Approximate
                completedAt: new Date(),
              },
            });
            sessionId = session.id;

            // Create FocusGroupMessage records
            const messageData = messages.map((msg, index) => ({
              sessionId: session.id,
              speakerType: msg.speakerType === 'moderator' ? 'MODERATOR' as const
                : msg.speakerType === 'reader' ? 'READER' as const
                : 'USER' as const,
              readerId: msg.readerId || null,
              content: msg.content,
              topic: msg.topic || topic || null,
              sentiment: msg.sentiment === 'positive' ? 'POSITIVE' as const
                : msg.sentiment === 'negative' ? 'NEGATIVE' as const
                : msg.sentiment === 'neutral' ? 'NEUTRAL' as const
                : null,
              sequenceNumber: index,
            }));

            await db.focusGroupMessage.createMany({
              data: messageData,
            });
          }
        } catch (error) {
          console.error('Failed to persist focus group messages:', error);
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            messageCount: messages.length,
            topic: topic || 'General discussion',
            questions,
            readersWithMemory: readerMemories.size,
            projectId: effectiveProjectId,
            draftId: effectiveDraftId,
            sessionId,
            summary: `Focus group completed with ${messages.length} messages across ${questions.length} questions. ${readerMemories.size} readers had memory context.`,
            keyExchanges: messages
              .filter((m) => m.speakerType === 'reader')
              .slice(0, 6)
              .map((m) => ({
                speaker: m.readerName,
                excerpt: m.content.slice(0, 150) + (m.content.length > 150 ? '...' : ''),
                topic: m.topic,
              })),
          }),
        }],
      };
    }
  );
}
