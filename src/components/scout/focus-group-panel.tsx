'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { Target, Send } from 'lucide-react';
import { createSSEConnection, type EventRouterCallbacks } from '@/lib/agent-sdk/event-router';
import type { FocusGroupUIMessage } from '@/lib/agent-sdk/types';
import { v4 as uuidv4 } from 'uuid';

const READER_COLORS: Record<string, string> = {
  'reader-maya': '#30D5C8',
  'reader-colton': '#FF7F7F',
  'reader-devon': '#B8A9C9',
};

const READER_NAMES: Record<string, string> = {
  'reader-maya': 'Maya Chen',
  'reader-colton': 'Colton Rivers',
  'reader-devon': 'Devon Park',
};

export function FocusGroupPanel() {
  const { focusGroupMessages, focusGroupTypingSpeaker, isStreaming, chatMessages, addChatMessage, setStreaming } = useAppStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [followUpInput, setFollowUpInput] = useState('');

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [focusGroupMessages, focusGroupTypingSpeaker]);

  const handleSendFollowUp = useCallback(() => {
    const trimmed = followUpInput.trim();
    if (!trimmed || isStreaming) return;

    const userMessage = {
      id: uuidv4(),
      role: 'user' as const,
      content: trimmed,
      timestamp: new Date(),
    };
    addChatMessage(userMessage);
    setFollowUpInput('');

    setStreaming(true);
    const assistantId = uuidv4();
    addChatMessage({
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      agentType: 'SCOUT',
      timestamp: new Date(),
      isStreaming: true,
    });

    const allMessages = [...chatMessages.filter(m => m.role !== 'system' || !m.content.startsWith('__error__')), userMessage].map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let streamingText = '';

    const callbacks: EventRouterCallbacks = {
      onScoutTextDelta: (text) => {
        streamingText += text;
        useAppStore.getState().updateChatMessage(assistantId, { content: streamingText });
      },
      onScoutTextComplete: () => {
        useAppStore.getState().updateChatMessage(assistantId, { isStreaming: false });
      },
      onReaderStart: () => {},
      onReaderProgress: () => {},
      onReaderComplete: () => {},
      onReaderError: () => {},
      onDeliverableReady: () => {},
      onExecutiveStart: () => {},
      onExecutiveComplete: () => {},
      onFocusGroupMessage: (message) => {
        useAppStore.getState().addFocusGroupMessage(message);
      },
      onFocusGroupTyping: (speaker) => {
        useAppStore.getState().setFocusGroupTyping(speaker, 'reader');
      },
      onFocusGroupComplete: () => {
        useAppStore.getState().setFocusGroupTyping(null, 'moderator');
      },
      onPhaseChange: () => {},
      onToolStart: () => {},
      onToolEnd: () => {},
      onResult: () => {
        useAppStore.getState().setStreaming(false);
        useAppStore.getState().updateChatMessage(assistantId, { isStreaming: false });
      },
      onError: (error) => {
        useAppStore.getState().setStreaming(false);
        useAppStore.getState().updateChatMessage(assistantId, {
          content: `Error: ${error}`,
          isStreaming: false,
        });
      },
    };

    createSSEConnection('/api/scout', { messages: allMessages }, callbacks);
  }, [followUpInput, isStreaming, chatMessages, addChatMessage, setStreaming]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendFollowUp();
    }
  }, [handleSendFollowUp]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Focus Group — Live
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <AnimatePresence initial={false}>
            {focusGroupMessages.map((message) => (
              <FocusGroupBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {focusGroupTypingSpeaker && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <TypingIndicator speaker={focusGroupTypingSpeaker} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Follow-up input */}
      <div className="px-4 py-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={followUpInput}
            onChange={(e) => setFollowUpInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            disabled={isStreaming}
            className={cn(
              'flex-1 bg-elevated rounded-lg px-3 py-2 text-sm',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-1 focus:ring-bullseye-gold/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <button
            onClick={handleSendFollowUp}
            disabled={isStreaming || !followUpInput.trim()}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'bg-bullseye-gold/10 text-bullseye-gold',
              'hover:bg-bullseye-gold/20 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const SENTIMENT_CONFIG: Record<string, { label: string; colorClass: string }> = {
  agrees: { label: 'agrees', colorClass: 'text-green-400 bg-green-400/10' },
  disagrees: { label: 'disagrees', colorClass: 'text-red-400/80 bg-red-400/10' },
  builds_on: { label: 'builds on', colorClass: 'text-blue-400 bg-blue-400/10' },
};

function FocusGroupBubble({ message }: { message: FocusGroupUIMessage }) {
  const isModerator = message.speakerType === 'moderator';
  const isReaction = !!message.replyToReaderId;
  const color = isModerator
    ? '#D4A84B'
    : message.readerId
      ? READER_COLORS[message.readerId] || '#8E8E93'
      : '#8E8E93';

  const name = isModerator
    ? 'Scout'
    : message.readerId
      ? READER_NAMES[message.readerId] || message.speaker
      : message.speaker;

  const sentimentConfig = message.reactionSentiment
    ? SENTIMENT_CONFIG[message.reactionSentiment]
    : null;

  // Threaded reply: indented with left border in the replying reader's color
  if (isReaction) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="ml-6 pl-3 border-l-2"
        style={{ borderLeftColor: color }}
      >
        <div className="flex gap-2.5">
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${color}15` }}
          >
            <span className="text-[8px] font-bold" style={{ color }}>
              {name.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[11px] font-semibold" style={{ color }}>
                {name}
              </span>
              <span className="text-[9px] text-muted-foreground/50">
                replying to {message.replyToReaderName || 'reader'}
              </span>
              {sentimentConfig && (
                <span className={cn(
                  'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                  sentimentConfig.colorClass
                )}>
                  {sentimentConfig.label}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-current animate-pulse" />
              )}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-2.5',
        isModerator && 'pl-2 border-l-2'
      )}
      style={isModerator ? { borderLeftColor: '#D4A84B' } : undefined}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
        style={{ backgroundColor: `${color}15` }}
      >
        {isModerator ? (
          <Target className="w-3.5 h-3.5" style={{ color }} />
        ) : (
          <span className="text-[9px] font-bold" style={{ color }}>
            {name.split(' ').map((n) => n[0]).join('')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span
            className="text-[11px] font-semibold"
            style={{ color }}
          >
            {name}
          </span>
          {message.topic && (
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
              {message.topic}
            </span>
          )}
        </div>
        <p className={cn(
          'text-sm leading-relaxed',
          isModerator ? 'text-foreground/80 italic' : 'text-foreground/90'
        )}>
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-current animate-pulse" />
          )}
        </p>
      </div>
    </motion.div>
  );
}

function TypingIndicator({ speaker }: { speaker: string }) {
  const readerId = Object.entries(READER_NAMES).find(([, name]) => name === speaker)?.[0];
  const color = readerId ? READER_COLORS[readerId] : '#D4A84B';

  return (
    <div className="flex items-center gap-2 pl-9">
      <span className="text-[11px] font-medium" style={{ color }}>
        {speaker}
      </span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
