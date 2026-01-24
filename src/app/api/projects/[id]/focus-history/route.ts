// Focus Group History API
// GET /api/projects/[id]/focus-history
// Returns prior focus group sessions with key statements for the project

import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: projectId } = await params;

  try {
    // Fetch completed focus sessions for this project across all drafts
    const focusSessions = await db.focusSession.findMany({
      where: {
        draft: { projectId },
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        topic: true,
        completedAt: true,
        draftId: true,
      },
    });

    if (focusSessions.length === 0) {
      return Response.json({ sessions: [] });
    }

    // For each session, fetch key structured memory items
    const sessionIds = focusSessions.map((s) => s.id);
    const memoryItems = await db.focusGroupMemoryItem.findMany({
      where: {
        sessionId: { in: sessionIds },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        sessionId: true,
        readerId: true,
        statement: true,
        topic: true,
        sentiment: true,
      },
    });

    // Group statements by session
    const statementsBySession = new Map<string, typeof memoryItems>();
    for (const item of memoryItems) {
      const existing = statementsBySession.get(item.sessionId) || [];
      existing.push(item);
      statementsBySession.set(item.sessionId, existing);
    }

    const sessions = focusSessions.map((session) => ({
      id: session.id,
      topic: session.topic || 'General discussion',
      completedAt: session.completedAt?.toISOString() || '',
      statements: (statementsBySession.get(session.id) || []).map((s) => ({
        readerId: s.readerId,
        statement: s.statement.slice(0, 200),
        topic: s.topic,
        sentiment: s.sentiment,
      })),
    }));

    return Response.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch focus history:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch focus history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
