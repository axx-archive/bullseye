// BULLSEYE Executive Evaluation API Route
// Handles executive pitch simulations

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  executiveEvaluationEngine,
  DEFAULT_EXECUTIVES,
  getExecutiveById,
} from '@/lib/executive';
import type { CoverageReport, HarmonizedScores, ExecutiveEvaluationResult } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { coverage, harmonizedScores, executiveIds } = await req.json();

    if (!coverage || !harmonizedScores) {
      return NextResponse.json(
        { error: 'Missing coverage or scores' },
        { status: 400 }
      );
    }

    // Default to all executives if not specified
    const execIds = executiveIds || DEFAULT_EXECUTIVES.map((e) => e.id);

    // Run evaluations
    const evaluations = await executiveEvaluationEngine.evaluateForMultipleExecutives(
      coverage as CoverageReport,
      harmonizedScores as HarmonizedScores,
      execIds
    );

    return NextResponse.json({
      success: true,
      evaluations,
    });
  } catch (error) {
    console.error('Executive evaluation API error:', error);
    return NextResponse.json(
      { error: 'Failed to run executive evaluations' },
      { status: 500 }
    );
  }
}

// Streaming evaluation for a single executive
export async function PUT(req: NextRequest) {
  try {
    const { coverage, harmonizedScores, executiveId } = await req.json();

    if (!coverage || !harmonizedScores || !executiveId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const executive = getExecutiveById(executiveId);
    if (!executive) {
      return NextResponse.json(
        { error: 'Executive not found' },
        { status: 404 }
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send executive metadata first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'start',
                executive: {
                  id: executive.id,
                  name: executive.name,
                  title: executive.title,
                  company: executive.company,
                },
              })}\n\n`
            )
          );

          // Stream the evaluation
          for await (const chunk of executiveEvaluationEngine.streamEvaluation(
            coverage as CoverageReport,
            harmonizedScores as HarmonizedScores,
            executive
          )) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Executive streaming error:', error);
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
    console.error('Executive evaluation API error:', error);
    return NextResponse.json(
      { error: 'Failed to stream executive evaluation' },
      { status: 500 }
    );
  }
}

// Get available executives
export async function GET() {
  return NextResponse.json({
    executives: DEFAULT_EXECUTIVES.map((e) => ({
      id: e.id,
      name: e.name,
      title: e.title,
      company: e.company,
      priorityFactors: e.priorityFactors,
      dealBreakers: e.dealBreakers,
    })),
  });
}
