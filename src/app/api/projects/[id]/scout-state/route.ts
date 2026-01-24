import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

interface ReaderStateInput {
  readerId: string;
  status: string;
  progress?: number;
  scores?: Record<string, number> | null;
  recommendation?: string | null;
  keyStrengths?: string[];
  keyConcerns?: string[];
  standoutQuote?: string | null;
  error?: string | null;
}

interface PutRequestBody {
  readerStates?: ReaderStateInput[];
  scoutPhase?: string | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project access
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { studioId: true },
  });

  if (!project || project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body: PutRequestBody = await request.json();

  // Handle readerStates upserts
  if (body.readerStates && body.readerStates.length > 0) {
    // Get the latest draft for this project
    const latestDraft = await db.draft.findFirst({
      where: { projectId },
      orderBy: { draftNumber: 'desc' },
      select: { id: true },
    });

    if (!latestDraft) {
      return NextResponse.json({ error: 'No draft found for project' }, { status: 400 });
    }

    // Upsert all reader states in a transaction
    await db.$transaction(
      body.readerStates.map((rs) =>
        db.readerAnalysisState.upsert({
          where: {
            draftId_readerId: {
              draftId: latestDraft.id,
              readerId: rs.readerId,
            },
          },
          create: {
            draftId: latestDraft.id,
            readerId: rs.readerId,
            status: rs.status,
            progress: rs.progress ?? 0,
            scores: rs.scores === null ? Prisma.JsonNull : rs.scores ?? undefined,
            recommendation: rs.recommendation ?? undefined,
            keyStrengths: rs.keyStrengths ?? [],
            keyConcerns: rs.keyConcerns ?? [],
            standoutQuote: rs.standoutQuote ?? undefined,
            error: rs.error ?? undefined,
          },
          update: {
            status: rs.status,
            progress: rs.progress ?? undefined,
            ...(rs.scores !== undefined && { scores: rs.scores === null ? Prisma.JsonNull : rs.scores }),
            ...(rs.recommendation !== undefined && { recommendation: rs.recommendation }),
            ...(rs.keyStrengths !== undefined && { keyStrengths: rs.keyStrengths }),
            ...(rs.keyConcerns !== undefined && { keyConcerns: rs.keyConcerns }),
            ...(rs.standoutQuote !== undefined && { standoutQuote: rs.standoutQuote }),
            ...(rs.error !== undefined && { error: rs.error }),
          },
        })
      )
    );
  }

  // Handle scoutPhase update
  if (body.scoutPhase !== undefined) {
    await db.chatSession.upsert({
      where: { projectId },
      create: {
        projectId,
        scoutPhase: body.scoutPhase,
      },
      update: {
        scoutPhase: body.scoutPhase,
      },
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project access
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { studioId: true },
  });

  if (!project || project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get the latest draft for this project
  const latestDraft = await db.draft.findFirst({
    where: { projectId },
    orderBy: { draftNumber: 'desc' },
    select: { id: true },
  });

  if (!latestDraft) {
    // No drafts — return empty state
    return NextResponse.json({
      readerStates: [],
      focusGroupMessages: [],
      executiveEvals: [],
      scoutPhase: null,
    });
  }

  // Fetch all state in parallel
  const [readerStates, focusSession, executiveEvals, chatSession] = await Promise.all([
    // Reader analysis states for the latest draft
    db.readerAnalysisState.findMany({
      where: { draftId: latestDraft.id },
      select: {
        id: true,
        readerId: true,
        status: true,
        progress: true,
        scores: true,
        recommendation: true,
        keyStrengths: true,
        keyConcerns: true,
        standoutQuote: true,
        error: true,
        updatedAt: true,
      },
    }),

    // Most recent focus session for the latest draft (with messages)
    db.focusSession.findFirst({
      where: { draftId: latestDraft.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messages: {
          orderBy: { sequenceNumber: 'asc' },
          select: {
            id: true,
            speakerType: true,
            readerId: true,
            content: true,
            topic: true,
            sentiment: true,
            replyToReaderId: true,
            reactionSentiment: true,
            sequenceNumber: true,
            createdAt: true,
          },
        },
      },
    }),

    // Executive evaluations for the latest draft
    db.executiveEvaluation.findMany({
      where: { draftId: latestDraft.id },
      select: {
        id: true,
        executiveId: true,
        verdict: true,
        confidence: true,
        rationale: true,
        keyFactors: true,
        concerns: true,
        groundedInCoverage: true,
        citedElements: true,
        createdAt: true,
      },
    }),

    // Scout phase from chat session
    db.chatSession.findUnique({
      where: { projectId },
      select: { scoutPhase: true },
    }),
  ]);

  return NextResponse.json({
    readerStates,
    focusGroupMessages: focusSession?.messages ?? [],
    executiveEvals,
    scoutPhase: chatSession?.scoutPhase ?? null,
  });
}
