'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type ReaderChatMessage } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, X, ChevronLeft } from 'lucide-react';

const READER_CONFIG = {
  'reader-maya': {
    name: 'Maya Chen',
    voiceTag: 'The Optimist',
    color: '#30D5C8',
    initials: 'MC',
  },
  'reader-colton': {
    name: 'Colton Rivers',
    voiceTag: 'The Skeptic',
    color: '#FF7F7F',
    initials: 'CR',
  },
  'reader-devon': {
    name: 'Devon Park',
    voiceTag: 'The Craftsman',
    color: '#B8A9C9',
    initials: 'DP',
  },
} as const;

type ReaderId = keyof typeof READER_CONFIG;

export function ReaderChatPanel() {
  const {
    activeReaderChatId,
    setActiveReaderChatId,
    setRightPanelMode,
    currentProject,
    currentDraft,
    readerChatMessages,
    addReaderChatMessage,
    updateReaderChatMessage,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const readerId = activeReaderChatId as ReaderId | null;
  const reader = readerId ? READER_CONFIG[readerId] : null;
  const messages = useMemo(
    () => readerId ? (readerChatMessages[readerId] || []) : [],
    [readerId, readerChatMessages]
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleBack = useCallback(() => {
    setActiveReaderChatId(null);
  }, [setActiveReaderChatId]);

  const handleClose = useCallback(() => {
    setActiveReaderChatId(null);
    setRightPanelMode('idle');
  }, [setActiveReaderChatId, setRightPanelMode]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !readerId || isLoading) return;

    const userMessage: ReaderChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    addReaderChatMessage(readerId, userMessage);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    // Create placeholder for assistant message
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: ReaderChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    addReaderChatMessage(readerId, assistantMessage);

    try {
      // Build conversation history from Zustand (excluding the placeholder)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/reader-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId,
          message: userMessage.content,
          projectId: currentProject?.id,
          draftId: currentDraft?.id,
          conversationHistory: history,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const eventSource = response.body?.getReader();
      if (!eventSource) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await eventSource.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsTyping(false);
              continue;
            }

            try {
              const event = JSON.parse(data);

              if (event.type === 'text_delta' && event.text) {
                fullText += event.text;
                updateReaderChatMessage(readerId, assistantId, {
                  content: fullText,
                  isStreaming: true,
                });
              } else if (event.type === 'text_complete') {
                updateReaderChatMessage(readerId, assistantId, {
                  content: event.text || fullText,
                  isStreaming: false,
                });
              } else if (event.type === 'error') {
                throw new Error(event.error);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Failed to get response') {
                // Skip malformed JSON, but re-throw actual errors
                if (e.message && !e.message.includes('JSON')) throw e;
              }
            }
          }
        }
      }
    } catch (error) {
      updateReaderChatMessage(readerId, assistantId, {
        content: 'Sorry, I encountered an error. Please try again.',
        isStreaming: false,
      });
      if (error instanceof Error) {
        console.error('Reader chat error:', error.message);
      }
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [input, readerId, isLoading, currentProject?.id, currentDraft?.id, messages, addReaderChatMessage, updateReaderChatMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!reader || !readerId) {
    return (
      <ReaderSelector
        onSelect={(id) => {
          setActiveReaderChatId(id);
          setRightPanelMode('reader_chat');
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={handleBack}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${reader.color}15` }}
            >
              <span
                className="text-[10px] font-bold"
                style={{ color: reader.color }}
              >
                {reader.initials}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium block leading-tight">
                Chatting with {reader.name}
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: reader.color }}
              >
                {reader.voiceTag}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Start a conversation with {reader.name}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Ask about their analysis, specific concerns, or revision suggestions
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                reader={reader}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && messages[messages.length - 1]?.role === 'user' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 pl-10"
            >
              <span
                className="text-[11px] font-medium"
                style={{ color: reader.color }}
              >
                {reader.name}
              </span>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: reader.color }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/30">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${reader.name}...`}
            className="min-h-[44px] max-h-[120px] resize-none bg-elevated border-border/50"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
            style={{ backgroundColor: reader.color }}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  reader,
}: {
  message: ReaderChatMessage;
  reader: typeof READER_CONFIG[ReaderId];
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5',
          isUser ? 'bg-elevated' : ''
        )}
        style={isUser ? {} : { backgroundColor: `${reader.color}15` }}
      >
        {isUser ? (
          <span className="text-[9px] font-bold text-muted-foreground">You</span>
        ) : (
          <span className="text-[9px] font-bold" style={{ color: reader.color }}>
            {reader.initials}
          </span>
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block max-w-[85%] rounded-xl px-3 py-2',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-elevated'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
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

function ReaderSelector({
  onSelect,
}: {
  onSelect: (readerId: ReaderId) => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            1:1 Reader Chat
          </span>
        </div>
      </div>

      {/* Reader selection */}
      <div className="flex-1 p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Select a reader to start a conversation:
        </p>
        <div className="space-y-2">
          {(Object.entries(READER_CONFIG) as [ReaderId, typeof READER_CONFIG[ReaderId]][]).map(
            ([id, reader]) => (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border border-border/30',
                  'hover:bg-elevated hover:border-border/60 transition-all'
                )}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${reader.color}15` }}
                >
                  <span
                    className="text-xs font-bold"
                    style={{ color: reader.color }}
                  >
                    {reader.initials}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium block">
                    {reader.name}
                  </span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: reader.color }}
                  >
                    {reader.voiceTag}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
