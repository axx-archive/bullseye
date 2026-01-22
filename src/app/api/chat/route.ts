// BULLSEYE Chat API Route
// Handles streaming chat with Scout and reader agents

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SCOUT_SYSTEM_PROMPT } from '@/lib/agents';
import { getReaderById } from '@/lib/agents/reader-personas';
import { requireUser } from '@/lib/auth';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const user = await requireUser();

    const { messages, agentType, readerId, projectContext } = await req.json();

    // Build system prompt based on agent type
    let systemPrompt = SCOUT_SYSTEM_PROMPT;

    if (agentType === 'reader' && readerId) {
      const reader = getReaderById(readerId);
      if (reader) {
        systemPrompt = reader.systemPromptBase;
      }
    }

    // Add project context if available
    if (projectContext) {
      systemPrompt += `\n\nPROJECT CONTEXT:\n${JSON.stringify(projectContext, null, 2)}`;
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
