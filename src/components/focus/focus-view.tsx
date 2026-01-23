'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useFocusSessions } from '@/hooks/use-studio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  MessageSquare,
  Target,
  Calendar,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { DEFAULT_READERS } from '@/lib/agents/reader-personas';

// ============================================
// TYPES
// ============================================

interface FocusSessionMessage {
  id: string;
  sessionId: string;
  speakerType: 'MODERATOR' | 'READER' | 'USER';
  readerId: string | null;
  content: string;
  topic: string | null;
  sentiment: string | null;
  sequenceNumber: number;
  createdAt: string;
}

interface FocusSession {
  id: string;
  draftId: string;
  topic: string | null;
  status: string;
  moderatorPrompt: string | null;
  questions: string[];
  summary: string | null;
  consensusPoints: string[];
  divergencePoints: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: FocusSessionMessage[];
}

// ============================================
// HELPERS
// ============================================

function getReaderInfo(readerId: string | null) {
  if (!readerId) return { name: 'Unknown', color: '#8E8E93', initials: '?' };
  const reader = DEFAULT_READERS.find((r) => r.id === readerId);
  if (!reader) return { name: 'Unknown', color: '#8E8E93', initials: '?' };
  return {
    name: reader.name,
    color: reader.color,
    initials: reader.name
      .split(' ')
      .map((n) => n[0])
      .join(''),
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return { label: 'Completed', className: 'bg-success/20 text-success border-success/30' };
    case 'active':
    case 'in_progress':
      return { label: 'Active', className: 'bg-warning/20 text-warning border-warning/30' };
    default:
      return { label: status, className: 'bg-elevated text-muted-foreground border-border' };
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FocusView() {
  const currentDraft = useAppStore((s) => s.currentDraft);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const { data: sessions, isLoading, error } = useFocusSessions(currentDraft?.id ?? null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const selectedSession = sessions?.find((s) => s.id === selectedSessionId) ?? null;

  // Reset selection if sessions change
  useEffect(() => {
    if (selectedSessionId && sessions && !sessions.find((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(null);
    }
  }, [sessions, selectedSessionId]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="w-10 h-10 text-danger mb-3" />
        <p className="text-sm text-danger font-medium mb-1">Failed to load focus sessions</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return <EmptyState onGoToScout={() => setActiveTab('scout')} />;
  }

  if (selectedSession) {
    return (
      <SessionTranscript
        session={selectedSession}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  return <SessionList sessions={sessions} onSelect={setSelectedSessionId} />;
}

// ============================================
// SESSION LIST
// ============================================

function SessionList({
  sessions,
  onSelect,
}: {
  sessions: FocusSession[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-6 border-b border-border flex items-center bg-surface">
        <Users className="w-5 h-5 text-primary mr-3" />
        <h2 className="font-semibold">Focus Groups</h2>
        <span className="ml-2 text-sm text-muted-foreground">
          ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <AnimatePresence initial={false}>
            {sessions.map((session, index) => {
              const statusBadge = getStatusBadge(session.status);
              return (
                <motion.button
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelect(session.id)}
                  className="w-full text-left p-4 rounded-xl bg-elevated border border-border hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">
                      {session.topic || 'Focus Group Session'}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', statusBadge.className)}
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(session.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {session.summary && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {session.summary}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SESSION TRANSCRIPT
// ============================================

function SessionTranscript({
  session,
  onBack,
}: {
  session: FocusSession;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border flex items-center gap-3 bg-surface">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 -ml-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">
            {session.topic || 'Focus Group Session'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatDate(session.createdAt)} &middot; {session.messages.length} messages
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {session.messages.map((message) => (
              <TranscriptMessage key={message.id} message={message} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TRANSCRIPT MESSAGE
// ============================================

function TranscriptMessage({ message }: { message: FocusSessionMessage }) {
  const isModerator = message.speakerType === 'MODERATOR';
  const isUser = message.speakerType === 'USER';
  const readerInfo = getReaderInfo(message.readerId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <Avatar
        className="h-10 w-10 flex-shrink-0"
        style={
          !isModerator && !isUser
            ? { backgroundColor: `${readerInfo.color}20` }
            : undefined
        }
      >
        <AvatarFallback
          style={
            !isModerator && !isUser ? { color: readerInfo.color } : undefined
          }
          className={cn(isModerator && 'bg-primary/10 text-primary')}
        >
          {isUser ? (
            'You'
          ) : isModerator ? (
            <Target className="h-5 w-5" />
          ) : (
            readerInfo.initials
          )}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex-1 max-w-[80%]', isUser && 'text-right')}>
        {!isUser && (
          <span
            className="text-sm font-medium mb-1 block"
            style={{
              color: isModerator ? '#D4A84B' : readerInfo.color,
            }}
          >
            {isModerator ? 'Scout (Moderator)' : readerInfo.name}
          </span>
        )}

        <div
          className={cn(
            'p-4 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md ml-auto'
              : isModerator
                ? 'bg-primary/10 rounded-tl-md'
                : 'bg-elevated rounded-tl-md'
          )}
          style={
            isModerator
              ? { borderLeft: '2px solid #D4A84B' }
              : !isUser
                ? { borderLeft: `3px solid ${readerInfo.color}` }
                : undefined
          }
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-6 border-b border-border flex items-center bg-surface">
        <div className="h-5 w-5 rounded bg-elevated animate-pulse mr-3" />
        <div className="h-5 w-32 rounded bg-elevated animate-pulse" />
      </div>
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-elevated border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="h-4 w-48 rounded bg-surface animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-surface animate-pulse" />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="h-3 w-24 rounded bg-surface animate-pulse" />
                <div className="h-3 w-20 rounded bg-surface animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ onGoToScout }: { onGoToScout: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Focus Groups Yet</h2>
        <p className="text-muted-foreground mb-6">
          Start a focus group from Scout to watch your readers debate and discuss your screenplay.
        </p>
        <Button onClick={onGoToScout} variant="outline">
          Go to Scout &rarr;
        </Button>
      </div>
    </div>
  );
}
