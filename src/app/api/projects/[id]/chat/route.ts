import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project exists and belongs to user's studio
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { studioId: true },
  });

  if (!project || project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Load chat session and messages for this project
  const session = await db.chatSession.findUnique({
    where: { projectId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          agentType: true,
          toolCalls: true,
          attachmentName: true,
          attachmentSize: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    messages: session?.messages ?? [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project exists and belongs to user's studio
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { studioId: true },
  });

  if (!project || project.studioId !== user.studioId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const { role, content, agentType, toolCalls, attachmentName, attachmentSize } = body;

  if (!role || !content) {
    return NextResponse.json(
      { error: 'role and content are required' },
      { status: 400 }
    );
  }

  if (!['user', 'assistant', 'system'].includes(role)) {
    return NextResponse.json(
      { error: 'role must be user, assistant, or system' },
      { status: 400 }
    );
  }

  // Upsert the ChatSession (create on first message if it doesn't exist)
  const session = await db.chatSession.upsert({
    where: { projectId },
    create: { projectId },
    update: { updatedAt: new Date() },
  });

  // Create the message
  const message = await db.chatSessionMessage.create({
    data: {
      sessionId: session.id,
      role,
      content,
      agentType: agentType ?? null,
      toolCalls: toolCalls ?? null,
      attachmentName: attachmentName ?? null,
      attachmentSize: attachmentSize ?? null,
    },
    select: {
      id: true,
      role: true,
      content: true,
      agentType: true,
      toolCalls: true,
      attachmentName: true,
      attachmentSize: true,
      createdAt: true,
    },
  });

  return NextResponse.json(message, { status: 201 });
}
