// BULLSEYE Reader Chat API Route
// Direct 1:1 conversations with individual readers
// POST /api/reader-chat - SSE stream of reader response

import { getReaderById } from '@/lib/agents/reader-personas';
import { db } from '@/lib/db';
import { memoryReadEngine } from '@/lib/memory';
import type { SubAgentMemory } from '@/lib/memory';
import type { Rating } from '@/types';
import { getCurrentUser, getUserApiKey } from '@/lib/auth';

export const maxDuration = 60; // 1 minute timeout

interface ReaderChatRequest {
  readerId: 'reader-maya' | 'reader-colton' | 'reader-devon';
  message: string;
  projectId?: string;
  draftId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

export async function POST(req: Request) {
  const body = (await req.json()) as ReaderChatRequest;
  const { readerId, message, projectId, draftId, conversationHistory } = body;

  // Authenticate and retrieve API key
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = await getUserApiKey(user.id);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Please add your Claude API key in Settings' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate reader
  const reader = getReaderById(readerId);
  if (!reader) {
    return new Response(JSON.stringify({ error: `Unknown reader: ${readerId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'No message provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get reader memory if draft context available
  let memoryContext = '';
  let projectContext: { title?: string; genre?: string } | null = null;

  if (draftId) {
    try {
      const memory = await db.readerMemory.findUnique({
        where: {
          draftId_readerId: { draftId, readerId },
        },
      });

      if (memory) {
        const subAgentMemory = prismaToSubAgentMemory(memory);
        memoryContext = memoryReadEngine.getMemoryContext(subAgentMemory);
      }

      // Get project context
      if (projectId) {
        const project = await db.project.findUnique({
          where: { id: projectId },
          select: { title: true, genre: true },
        });
        if (project) {
          projectContext = project;
        }
      }
    } catch (error) {
      console.error('Failed to fetch reader context:', error);
    }
  }

  // Build system prompt with context
  let systemPrompt = reader.systemPromptBase;

  if (projectContext) {
    systemPrompt += `\n\nCURRENT PROJECT CONTEXT:\nTitle: "${projectContext.title}"\nGenre: ${projectContext.genre}\n`;
  }

  if (memoryContext) {
    systemPrompt += `\n\n${memoryContext}`;
  }

  systemPrompt += `\n\nCONVERSATION MODE:
You are having a direct conversation with a user who wants to discuss the script. Respond naturally in your voice as ${reader.displayName}. Be conversational but maintain your perspective and analytical focus. Reference specific elements from the script and your analysis when relevant.

Keep responses focused and engaging—aim for 2-4 paragraphs unless a longer response is warranted.`;

  // Build messages array
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  if (conversationHistory && conversationHistory.length > 0) {
    // Include conversation history
    messages.push(...conversationHistory);
  }
  
  // Add current message
  messages.push({ role: 'user', content: message });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Import Anthropic SDK with user's API key
        const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
        const client = new AnthropicSDK({ apiKey });

        // Stream the response
        const response = await client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        let fullResponse = '';

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullResponse += text;
            
            // Send SSE event
            const data = JSON.stringify({
              type: 'text_delta',
              readerId,
              readerName: reader.name,
              displayName: reader.displayName,
              text,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        // Send completion event
        const completeData = JSON.stringify({
          type: 'text_complete',
          readerId,
          readerName: reader.name,
          displayName: reader.displayName,
          text: fullResponse,
        });
        controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));

        // Persist chat exchange to memory if context available
        if (draftId && projectId) {
          try {
            const existingMemory = await db.readerMemory.findUnique({
              where: {
                draftId_readerId: { draftId, readerId },
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
                exchange: `User: ${message.slice(0, 150)}... → ${reader.name}: ${fullResponse.slice(0, 150)}...`,
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

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const errorData = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
