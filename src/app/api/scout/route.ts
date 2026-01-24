// BULLSEYE Unified Scout API Route
// Single SSE endpoint that coordinates the entire analysis workflow
// POST /api/scout - receives messages, returns tagged SSE stream

import { query } from '@anthropic-ai/claude-agent-sdk';
import { createBullseyeToolServer } from '@/lib/agent-sdk/tools';
import { setCurrentScript, getCurrentScript, extractScriptMetadata } from '@/lib/agent-sdk/tools/ingest';
import { SCOUT_AGENT_SYSTEM_PROMPT } from '@/lib/agent-sdk/prompts';
import { buildContextBudget } from '@/lib/agent-sdk/context-budget';
import type { ScoutSSEEvent } from '@/lib/agent-sdk/types';
import { getCurrentUser, getUserApiKey } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimiter } from '@/lib/rate-limiter';
import type { ProjectFormat } from '@/generated/prisma/client';

export const maxDuration = 300; // 5 minute timeout for long analysis runs

interface ScoutRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachment?: { filename: string; content: string; mimeType: string };
  sessionId?: string;
  projectId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ScoutRequest;
  const { messages, attachment, projectId } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  // Get the latest user message as the prompt
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  if (!lastUserMessage) {
    return new Response(JSON.stringify({ error: 'No user message found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build conversation context from prior messages
  const conversationContext = messages.length > 1
    ? messages.slice(0, -1).map((m) => `${m.role === 'user' ? 'User' : 'Scout'}: ${m.content}`).join('\n\n')
    : '';

  // Build prompt, injecting script content from file upload if present
  let prompt = conversationContext
    ? `CONVERSATION HISTORY:\n${conversationContext}\n\nCURRENT USER MESSAGE:\n${lastUserMessage.content}`
    : lastUserMessage.content;

  if (attachment?.content) {
    // Pre-ingest the script server-side so Scout doesn't need to echo
    // the full text back through ingest_script (which would be very slow)
    const titleFromFilename = attachment.filename
      .replace(/\.(pdf|txt|fountain|fdx)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    // Estimate page count from character length (~3000 chars per page for screenplays)
    const estimatedPages = Math.round(attachment.content.length / 3000);

    setCurrentScript({
      id: `script-${Date.now()}`,
      title: titleFromFilename,
      author: 'Unknown',
      genre: 'Drama',
      format: estimatedPages > 70 ? 'FEATURE' : estimatedPages > 25 ? 'TV_PILOT' : 'SHORT',
      pageCount: estimatedPages,
      scriptText: attachment.content,
      ingestedAt: new Date(),
    });

    // Auto-extract metadata from script text using LLM
    const extracted = await extractScriptMetadata(attachment.content);
    if (extracted) {
      const script = getCurrentScript()!;
      setCurrentScript({
        ...script,
        title: extracted.title || script.title,
        author: extracted.writer !== 'Unknown' ? extracted.writer : script.author,
        genre: extracted.genre || script.genre,
        format: extracted.format || script.format,
      });
    }

    const updatedScript = getCurrentScript()!;
    prompt += `\n\n[UPLOADED SCRIPT FILE: "${attachment.filename}"]\nThe script has been automatically ingested and is ready for analysis. Title: "${updatedScript.title}", Writer: "${updatedScript.author}", Genre: "${updatedScript.genre}", Format: "${updatedScript.format}", estimated ${estimatedPages} pages. Do NOT call ingest_script — the script is already loaded. Proceed directly to spawn_readers.`;

    // Persist extracted metadata to the Project record
    if (projectId && extracted) {
      try {
        const project = await db.project.findUnique({ where: { id: projectId } });
        if (project) {
          const validFormats: ProjectFormat[] = ['FEATURE', 'TV_PILOT', 'TV_EPISODE', 'SHORT', 'LIMITED_SERIES', 'DOCUMENTARY'];
          const updateData: { genre?: string; writer?: string; format?: ProjectFormat } = {};

          // Only update genre if project has default/empty genre and extraction found something meaningful
          if ((!project.genre || project.genre === 'Drama') && extracted.genre && extracted.genre !== 'Unclassified') {
            updateData.genre = extracted.genre;
          }

          // Only update writer if project doesn't already have one set
          if (!project.writer && extracted.writer && extracted.writer !== 'Unknown') {
            updateData.writer = extracted.writer;
          }

          // Only update format if extraction found a valid enum value
          const extractedFormat = extracted.format?.toUpperCase().replace(/[\s-]/g, '_') as ProjectFormat;
          if (validFormats.includes(extractedFormat)) {
            updateData.format = extractedFormat;
          }

          if (Object.keys(updateData).length > 0) {
            await db.project.update({ where: { id: projectId }, data: updateData });
          }
        }
      } catch {
        // Non-critical: metadata persistence failure shouldn't block analysis
      }
    }
  }

  // Build system prompt with optional user name context
  let systemPrompt = SCOUT_AGENT_SYSTEM_PROMPT;
  if (user?.name) {
    systemPrompt += `\n\nThe user you are working with is named ${user.name}. Address them by name occasionally in conversation — naturally, not forced.`;
  }

  // Load project context and build budget-aware prompt if projectId is provided
  if (projectId) {
    try {
      // Fetch latest draft, reader memories, and focus group highlights in parallel
      const latestDraft = await db.draft.findFirst({
        where: { projectId },
        orderBy: { draftNumber: 'desc' },
        select: { id: true, scriptText: true },
      });

      const [readerMemories, focusMessages] = await Promise.all([
        latestDraft
          ? db.readerMemory.findMany({
              where: { draftId: latestDraft.id },
              select: {
                readerId: true,
                narrativeSummary: true,
                recommendation: true,
                keyStrengths: true,
                keyConcerns: true,
              },
            })
          : Promise.resolve([]),
        latestDraft
          ? db.focusGroupMessage.findMany({
              where: { session: { draftId: latestDraft.id } },
              orderBy: { sequenceNumber: 'desc' },
              take: 20,
              select: {
                speakerType: true,
                readerId: true,
                content: true,
                topic: true,
              },
            }).then((msgs) => msgs.reverse()) // Reverse to get chronological order
          : Promise.resolve([]),
      ]);

      // Format reader memories into a readable text block
      const memoriesText = readerMemories.length > 0
        ? readerMemories.map((m) =>
            `[${m.readerId}] (${m.recommendation})\n${m.narrativeSummary}\nStrengths: ${m.keyStrengths.join(', ')}\nConcerns: ${m.keyConcerns.join(', ')}`
          ).join('\n\n')
        : '';

      // Format focus group messages
      const focusText = focusMessages.length > 0
        ? focusMessages.map((m) =>
            `${m.speakerType === 'MODERATOR' ? 'Scout' : m.readerId || 'Reader'}: ${m.content}`
          ).join('\n')
        : '';

      // Get script text from current script (already ingested) or from draft DB record
      const scriptText = getCurrentScript()?.scriptText || latestDraft?.scriptText || '';

      // Build chat history as string array for the context budget utility
      const chatHistoryStrings = messages.map((m) =>
        `${m.role === 'user' ? 'User' : 'Scout'}: ${m.content}`
      );

      // Assemble context within token budget
      const budgetResult = buildContextBudget({
        systemPrompt,
        scriptText,
        chatHistory: chatHistoryStrings,
        readerMemories: memoriesText,
        focusGroupHighlights: focusText,
      });

      if (budgetResult.metadata.truncated) {
        console.warn(
          `[Scout] Context truncated for project ${projectId}. ` +
          `Total tokens: ~${budgetResult.metadata.totalEstimatedTokens}. ` +
          `Layers: ${JSON.stringify(budgetResult.metadata.layers)}`
        );
      }

      // Use the budget-assembled system prompt and override the raw prompt
      // The budget result includes system prompt + script + memories + focus + chat history
      // We only need the latest user message as the actual query prompt
      systemPrompt = budgetResult.prompt;
      prompt = lastUserMessage.content;
    } catch (error) {
      // Non-critical: context loading failure shouldn't block the conversation
      console.error('[Scout] Failed to load project context:', error);
    }
  }

  // Create the SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ScoutSSEEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream may be closed
        }
      };

      try {
        // Create the MCP tool server with event emitter and user's API key
        const toolServer = createBullseyeToolServer(sendEvent, apiKey);

        // Acquire rate limiter capacity before starting the Scout query
        const estimatedInputTokens = Math.ceil((systemPrompt.length + prompt.length) / 4);
        await rateLimiter.acquire({
          estimatedInputTokens,
          onQueued: () => {
            sendEvent({
              source: 'system',
              type: 'queue_status',
              status: 'queued',
              message: 'Processing — requests queued to stay within rate limits...',
            });
          },
          onProcessing: () => {
            sendEvent({
              source: 'system',
              type: 'queue_status',
              status: 'processing',
            });
          },
        });

        // Start the Scout agent query
        const q = query({
          prompt,
          options: {
            systemPrompt,
            model: 'claude-opus-4-5-20251101',
            mcpServers: {
              'bullseye-tools': toolServer,
            },
            permissionMode: 'bypassPermissions',
            maxTurns: 20,
            maxBudgetUsd: 5.0,
            includePartialMessages: true,
            tools: [], // Only use MCP tools, no built-in tools
            disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task', 'WebFetch', 'WebSearch'],
            env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
          },
        });

        // Track current tool for status display
        let currentTool: string | null = null;

        const endCurrentTool = () => {
          if (currentTool) {
            sendEvent({ source: 'system', type: 'tool_end', tool: currentTool });
            currentTool = null;
          }
        };

        // Iterate the query's async generator
        for await (const message of q) {
          switch (message.type) {
            case 'stream_event': {
              const event = message.event;

              // Detect tool_use content block start → emit tool_start
              if (
                event.type === 'content_block_start' &&
                'content_block' in event &&
                event.content_block.type === 'tool_use' &&
                !message.parent_tool_use_id
              ) {
                endCurrentTool(); // End previous tool if still active
                const toolName = (event.content_block as { name?: string }).name || 'unknown';
                currentTool = toolName;
                sendEvent({
                  source: 'system',
                  type: 'tool_start',
                  tool: toolName,
                });
              }

              // Streaming text from Scout → tool must have completed
              if (
                event.type === 'content_block_delta' &&
                'delta' in event &&
                event.delta.type === 'text_delta'
              ) {
                if (!message.parent_tool_use_id) {
                  endCurrentTool();
                  sendEvent({
                    source: 'scout',
                    type: 'text_delta',
                    text: event.delta.text,
                  });
                }
              }
              break;
            }

            case 'assistant': {
              // Full assistant message (Scout finished a turn)
              if (!message.parent_tool_use_id) {
                endCurrentTool();
                const textBlocks = message.message.content
                  .filter((c: { type: string }) => c.type === 'text')
                  .map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '')
                  .join('');

                if (textBlocks) {
                  sendEvent({
                    source: 'scout',
                    type: 'text_complete',
                    text: textBlocks,
                  });
                }
              }
              break;
            }

            case 'result': {
              // Query completed — report actual usage to rate limiter
              // The Agent SDK manages multiple API calls internally;
              // we report the overall estimated usage for the initial prompt
              rateLimiter.report(estimatedInputTokens, 0);

              if (message.subtype === 'success') {
                sendEvent({
                  source: 'system',
                  type: 'result',
                  data: {
                    success: true,
                    numTurns: message.num_turns,
                    totalCostUsd: message.total_cost_usd,
                  },
                  totalCostUsd: message.total_cost_usd,
                });
              } else {
                sendEvent({
                  source: 'system',
                  type: 'error',
                  error: `Query ended: ${message.subtype}. ${message.errors?.join('; ') || ''}`,
                });
              }
              break;
            }

            default:
              break;
          }
        }
      } catch (error) {
        sendEvent({
          source: 'system',
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch {
          // Stream already closed
        }
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
