'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useFocusSessions } from '@/hooks/use-studio';
import { useProject } from '@/hooks/use-projects';
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
import { DraftSelector, getEffectiveDraftId } from '@/components/shared/draft-selector';
import { HistoricalDraftBanner } from '@/components/shared/historical-draft-banner';
import type { Draft } from '@/types';

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
  const currentProject = useAppStore((s) => s.currentProject);
  const currentDraft = useAppStore((s) => s.currentDraft);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const focusViewingDraftId = useAppStore((s) => s.focusViewingDraftId);
  const setFocusViewingDraft = useAppStore((s) => s.setFocusViewingDraft);

  // Fetch project with all drafts
  const { data: projectWithDrafts } = useProject(currentProject?.id ?? null);

  // Convert API drafts to our Draft type for the selector
  const drafts: Draft[] = useMemo(() => {
    if (!projectWithDrafts?.drafts) return [];
    return projectWithDrafts.drafts.map((d) => ({
      id: d.id,
      projectId: projectWithDrafts.id,
      draftNumber: d.draftNumber,
      scriptUrl: '',
      pageCount: d.pageCount ?? undefined,
      status: d.status as Draft['status'],
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
    }));
  }, [projectWithDrafts]);

  // Determine which draft to fetch data for
  const effectiveDraftId = useMemo(() => {
    return getEffectiveDraftId(drafts, currentDraft?.id ?? null, focusViewingDraftId);
  }, [drafts, currentDraft?.id, focusViewingDraftId]);

  // Fetch focus sessions for the effective draft
  const { data: sessions, isLoading, error } = useFocusSessions(effectiveDraftId);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Derive selected session - auto-clears if session no longer exists in data
  const selectedSession = (selectedSessionId && sessions?.find((s) => s.id === selectedSessionId)) ?? null;

  // Determine if we're viewing historical data
  const isViewingHistorical = Boolean(effectiveDraftId && currentDraft?.id && effectiveDraftId !== currentDraft.id);
  const viewingDraft = drafts.find((d) => d.id === effectiveDraftId);
  const currentDraftInfo = drafts.find((d) => d.id === currentDraft?.id);

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
    return (
      <EmptyState
        onGoToScout={() => setActiveTab('scout')}
        drafts={drafts}
        currentDraftId={currentDraft?.id ?? null}
        focusViewingDraftId={focusViewingDraftId}
        onSelectDraft={setFocusViewingDraft}
        isViewingHistorical={isViewingHistorical}
        viewingDraft={viewingDraft}
        currentDraftInfo={currentDraftInfo}
      />
    );
  }

  if (selectedSession) {
    return (
      <SessionTranscript
        session={selectedSession}
        onBack={() => setSelectedSessionId(null)}
        drafts={drafts}
        currentDraftId={currentDraft?.id ?? null}
        focusViewingDraftId={focusViewingDraftId}
        onSelectDraft={setFocusViewingDraft}
        isViewingHistorical={isViewingHistorical}
        viewingDraft={viewingDraft}
        currentDraftInfo={currentDraftInfo}
      />
    );
  }

  return (
    <SessionList
      sessions={sessions}
      onSelect={setSelectedSessionId}
      drafts={drafts}
      currentDraftId={currentDraft?.id ?? null}
      focusViewingDraftId={focusViewingDraftId}
      onSelectDraft={setFocusViewingDraft}
      isViewingHistorical={isViewingHistorical}
      viewingDraft={viewingDraft}
      currentDraftInfo={currentDraftInfo}
    />
  );
}

// ============================================
// SESSION LIST
// ============================================

interface DraftVersioningProps {
  drafts: Draft[];
  currentDraftId: string | null;
  focusViewingDraftId: string | null;
  onSelectDraft: (draftId: string | null) => void;
  isViewingHistorical: boolean;
  viewingDraft: Draft | undefined;
  currentDraftInfo: Draft | undefined;
}

function SessionList({
  sessions,
  onSelect,
  drafts,
  currentDraftId,
  focusViewingDraftId,
  onSelectDraft,
  isViewingHistorical,
  viewingDraft,
  currentDraftInfo,
}: {
  sessions: FocusSession[];
  onSelect: (id: string) => void;
} & DraftVersioningProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-6 border-b border-border flex items-center bg-surface">
        <Users className="w-5 h-5 text-primary mr-3" />
        <h2 className="font-semibold">Focus Groups</h2>
        <span className="ml-2 text-sm text-muted-foreground">
          ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
        </span>
        {/* Draft selector in header */}
        {drafts.length > 1 && (
          <div className="ml-auto">
            <DraftSelector
              drafts={drafts}
              currentDraftId={currentDraftId}
              selectedDraftId={focusViewingDraftId}
              onSelectDraft={onSelectDraft}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Historical draft banner */}
          {isViewingHistorical && viewingDraft && currentDraftInfo && (
            <HistoricalDraftBanner
              viewingDraftNumber={viewingDraft.draftNumber}
              currentDraftNumber={currentDraftInfo.draftNumber}
              onViewCurrent={() => onSelectDraft(null)}
              className="mb-3"
            />
          )}

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
  drafts,
  currentDraftId,
  focusViewingDraftId,
  onSelectDraft,
  isViewingHistorical,
  viewingDraft,
  currentDraftInfo,
}: {
  session: FocusSession;
  onBack: () => void;
} & DraftVersioningProps) {
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
        {/* Draft selector in header */}
        {drafts.length > 1 && (
          <DraftSelector
            drafts={drafts}
            currentDraftId={currentDraftId}
            selectedDraftId={focusViewingDraftId}
            onSelectDraft={onSelectDraft}
          />
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Historical draft banner */}
          {isViewingHistorical && viewingDraft && currentDraftInfo && (
            <HistoricalDraftBanner
              viewingDraftNumber={viewingDraft.draftNumber}
              currentDraftNumber={currentDraftInfo.draftNumber}
              onViewCurrent={() => onSelectDraft(null)}
              className="mb-3"
            />
          )}

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

function EmptyState({
  onGoToScout,
  drafts,
  currentDraftId,
  focusViewingDraftId,
  onSelectDraft,
  isViewingHistorical,
  viewingDraft,
  currentDraftInfo,
}: {
  onGoToScout: () => void;
} & DraftVersioningProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header with draft selector if multiple drafts */}
      {drafts.length > 1 && (
        <div className="h-16 px-6 border-b border-border flex items-center bg-surface">
          <Users className="w-5 h-5 text-primary mr-3" />
          <h2 className="font-semibold">Focus Groups</h2>
          <div className="ml-auto">
            <DraftSelector
              drafts={drafts}
              currentDraftId={currentDraftId}
              selectedDraftId={focusViewingDraftId}
              onSelectDraft={onSelectDraft}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Historical draft banner */}
        {isViewingHistorical && viewingDraft && currentDraftInfo && (
          <div className="max-w-md w-full mb-6">
            <HistoricalDraftBanner
              viewingDraftNumber={viewingDraft.draftNumber}
              currentDraftNumber={currentDraftInfo.draftNumber}
              onViewCurrent={() => onSelectDraft(null)}
            />
          </div>
        )}

        <div className="text-center max-w-md">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Focus Groups Yet</h2>
          <p className="text-muted-foreground mb-6">
            {isViewingHistorical
              ? `No focus groups were run for Draft ${viewingDraft?.draftNumber ?? '?'}. Try viewing a different draft or run a focus group from Scout.`
              : 'Start a focus group from Scout to watch your readers debate and discuss your screenplay.'}
          </p>
          <Button onClick={onGoToScout} variant="outline">
            Go to Scout &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
}
