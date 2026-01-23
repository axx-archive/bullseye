// BULLSEYE Unified Scout API Route
// Single SSE endpoint that coordinates the entire analysis workflow
// POST /api/scout - receives messages, returns tagged SSE stream

import { query } from '@anthropic-ai/claude-agent-sdk';
import { createBullseyeToolServer } from '@/lib/agent-sdk/tools';
import { setCurrentScript } from '@/lib/agent-sdk/tools/ingest';
import { SCOUT_AGENT_SYSTEM_PROMPT } from '@/lib/agent-sdk/prompts';
import type { ScoutSSEEvent } from '@/lib/agent-sdk/types';

export const maxDuration = 300; // 5 minute timeout for long analysis runs

interface ScoutRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachment?: { filename: string; content: string; mimeType: string };
  sessionId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ScoutRequest;
  const { messages, attachment } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
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

    prompt += `\n\n[UPLOADED SCRIPT FILE: "${attachment.filename}"]\nThe script has been automatically ingested and is ready for analysis. Title: "${titleFromFilename}", estimated ${estimatedPages} pages. Do NOT call ingest_script — the script is already loaded. Proceed directly to spawn_readers (ask the user about genre/format first if unclear, but do not block on it).`;
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
        // Create the MCP tool server with event emitter
        const toolServer = createBullseyeToolServer(sendEvent);

        // Start the Scout agent query
        const q = query({
          prompt,
          options: {
            systemPrompt: SCOUT_AGENT_SYSTEM_PROMPT,
            model: 'claude-sonnet-4-20250514',
            mcpServers: {
              'bullseye-tools': toolServer,
            },
            permissionMode: 'bypassPermissions',
            maxTurns: 20,
            maxBudgetUsd: 2.0,
            includePartialMessages: true,
            tools: [], // Only use MCP tools, no built-in tools
            disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task', 'WebFetch', 'WebSearch'],
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
              // Query completed
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
