// BULLSEYE Focus Group API Route
// Handles streaming focus group conversations

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { focusGroupEngine, type FocusGroupConfig } from '@/lib/focus-group';
import type { ReaderPerspective, FocusGroupMessage, Divergence } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { draftId, topic, questions, readerPerspectives, divergencePoints } = await req.json();

    if (!readerPerspectives || readerPerspectives.length === 0) {
      return NextResponse.json(
        { error: 'Missing reader perspectives' },
        { status: 400 }
      );
    }

    const config: FocusGroupConfig = {
      draftId: draftId || 'unknown',
      topic: topic || 'General script discussion',
      questions: questions || [
        'What are the key strengths of this script?',
        'What are your main concerns?',
        'How would you rate the commercial potential?',
      ],
      readerPerspectives: readerPerspectives as ReaderPerspective[],
      readerMemories: new Map(), // In production, load from database
      divergencePoints: (divergencePoints as Divergence[]) || [],
    };

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of focusGroupEngine.streamFocusGroup(config)) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Focus group streaming error:', error);
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
    console.error('Focus group API error:', error);
    return NextResponse.json(
      { error: 'Failed to start focus group' },
      { status: 500 }
    );
  }
}

// Non-streaming version for complete sessions
export async function PUT(req: NextRequest) {
  try {
    const { draftId, topic, questions, readerPerspectives, divergencePoints } = await req.json();

    if (!readerPerspectives || readerPerspectives.length === 0) {
      return NextResponse.json(
        { error: 'Missing reader perspectives' },
        { status: 400 }
      );
    }

    const config: FocusGroupConfig = {
      draftId: draftId || 'unknown',
      topic: topic || 'General script discussion',
      questions: questions || [
        'What are the key strengths of this script?',
        'What are your main concerns?',
      ],
      readerPerspectives: readerPerspectives as ReaderPerspective[],
      readerMemories: new Map(),
      divergencePoints: (divergencePoints as Divergence[]) || [],
    };

    const messages: FocusGroupMessage[] = [];

    await focusGroupEngine.runFocusGroup(config, (event) => {
      if (event.type === 'message' && event.content) {
        messages.push({
          id: `msg-${messages.length}`,
          speakerType: event.speakerType!,
          readerId: event.readerId,
          readerName: event.speaker,
          content: event.content,
          timestamp: new Date(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Focus group API error:', error);
    return NextResponse.json(
      { error: 'Failed to run focus group' },
      { status: 500 }
    );
  }
}
