'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Users,
  Play,
  Square,
  MessageSquare,
  Target,
  Send,
  Loader2,
} from 'lucide-react';
import type { FocusGroupMessage, ReaderPerspective } from '@/types';
import { getReaderById } from '@/lib/agents/reader-personas';

export function FocusView() {
  const {
    isLive,
    focusMessages: messages,
    currentSpeaker,
    isTyping,
    readerPerspectives,
    startFocusGroup,
    endFocusGroup,
    addFocusMessage: addMessage,
    setTyping,
    clearFocusMessages: clearMessages,
  } = useAppStore();

  const [userInput, setUserInput] = useState('');
  const [selectedReader, setSelectedReader] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStartFocusGroup = async () => {
    startFocusGroup();
    // In production, this would call the focus group API
    simulateFocusGroup();
  };

  const handleStopFocusGroup = () => {
    endFocusGroup();
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const message: FocusGroupMessage = {
      id: `user-${Date.now()}`,
      speakerType: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    addMessage(message);
    setUserInput('');

    // In production, this would trigger agent responses
  };

  // Simulate focus group for demo purposes
  const simulateFocusGroup = async () => {
    const sampleMessages: Omit<FocusGroupMessage, 'id'>[] = [
      {
        speakerType: 'moderator',
        content:
          "Welcome to the focus group. I've reviewed your analyses and noticed some interesting divergence on structure. Maya, you rated it higher than Colton and Devon. Can you walk us through your thinking?",
        timestamp: new Date(),
      },
      {
        speakerType: 'reader',
        readerId: 'reader-maya',
        readerName: 'Maya Chen',
        readerColor: '#30D5C8',
        content:
          "Absolutely. While I acknowledge the second act sags a bit, I think the underlying architecture is solid. The setup on page 12 pays off beautifully on page 89—that's craft. The three-act structure is clean, even if the pacing needs work.",
        timestamp: new Date(),
      },
      {
        speakerType: 'reader',
        readerId: 'reader-colton',
        readerName: 'Colton Rivers',
        readerColor: '#FF7F7F',
        content:
          "I see the mechanics Maya's pointing to, but here's my concern: we're 18 pages into Act 2 before anything significant happens. In a thriller, that's a death sentence. Audiences today won't wait.",
        timestamp: new Date(),
      },
      {
        speakerType: 'reader',
        readerId: 'reader-devon',
        readerName: 'Devon Park',
        readerColor: '#B8A9C9',
        content:
          "I'm somewhere between you both. The bones are there—Maya's right about that setup/payoff. But Colton's pacing concern is valid from a market perspective. As a writer, I'd say the structure is salvageable with a focused rewrite of pages 35-55.",
        timestamp: new Date(),
      },
      {
        speakerType: 'moderator',
        content:
          "Interesting—so we have consensus that the structural foundation is solid, but execution in Act 2 needs work. Let's pivot to commerciality. Colton, you're typically our market-focused voice...",
        timestamp: new Date(),
      },
    ];

    for (let i = 0; i < sampleMessages.length; i++) {
      const msg = sampleMessages[i];

      // Show typing indicator
      setTyping(msg.speakerType === 'moderator' ? 'Scout' : msg.readerName || null);
      await delay(1500);

      // Add message
      addMessage({
        ...msg,
        id: `msg-${Date.now()}-${i}`,
      });

      setTyping(null);
      await delay(500);
    }

    endFocusGroup();
  };

  if (readerPerspectives.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="h-full flex">
      {/* Main focus group panel */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Focus Group</h2>
            {isLive && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-current" />
                LIVE
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLive ? (
              <Button onClick={handleStartFocusGroup} className="gap-2">
                <Play className="w-4 h-4" />
                Start Focus Group
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleStopFocusGroup} className="gap-2">
                <Square className="w-4 h-4" />
                End Session
              </Button>
            )}
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <FocusGroupMessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isTyping && currentSpeaker && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <Avatar className="h-8 w-8 bg-elevated">
                  <AvatarFallback>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {currentSpeaker} is typing...
                </span>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask a follow-up question..."
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!isLive}
            />
            <Button onClick={handleSendMessage} disabled={!isLive || !userInput.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Reader chat sidebar */}
      <div className="w-80 border-l border-border bg-surface">
        <div className="h-16 px-4 border-b border-border flex items-center">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            1:1 Reader Chat
          </h3>
        </div>

        <div className="p-4 space-y-2">
          {readerPerspectives.map((perspective) => (
            <ReaderChatButton
              key={perspective.readerId}
              perspective={perspective}
              selected={selectedReader === perspective.readerId}
              onClick={() => setSelectedReader(perspective.readerId)}
            />
          ))}
        </div>

        {selectedReader && (
          <>
            <Separator />
            <div className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                1:1 chat coming soon. Select a reader above to have a private conversation.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Message bubble component
function FocusGroupMessageBubble({ message }: { message: FocusGroupMessage }) {
  const isModerator = message.speakerType === 'moderator';
  const isUser = message.speakerType === 'user';

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
          message.readerColor
            ? { backgroundColor: `${message.readerColor}20` }
            : undefined
        }
      >
        <AvatarFallback
          style={message.readerColor ? { color: message.readerColor } : undefined}
          className={cn(isModerator && 'bg-primary/10 text-primary')}
        >
          {isUser ? (
            'You'
          ) : isModerator ? (
            <Target className="h-5 w-5" />
          ) : (
            message.readerName
              ?.split(' ')
              .map((n) => n[0])
              .join('')
          )}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex-1 max-w-[80%]', isUser && 'text-right')}>
        {!isUser && (
          <span
            className="text-sm font-medium mb-1 block"
            style={{ color: message.readerColor || (isModerator ? '#D4A84B' : undefined) }}
          >
            {isModerator ? 'Scout (Moderator)' : message.readerName}
          </span>
        )}

        <div
          className={cn(
            'p-4 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md ml-auto'
              : isModerator
                ? 'bg-primary/10 border border-primary/20 rounded-tl-md'
                : 'bg-elevated rounded-tl-md'
          )}
          style={
            !isUser && !isModerator && message.readerColor
              ? { borderLeft: `3px solid ${message.readerColor}` }
              : undefined
          }
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

// Reader chat button
function ReaderChatButton({
  perspective,
  selected,
  onClick,
}: {
  perspective: ReaderPerspective;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
        'hover:bg-elevated',
        selected && 'bg-elevated ring-1 ring-primary'
      )}
    >
      <Avatar
        className="h-10 w-10"
        style={{ backgroundColor: `${perspective.color}20` }}
      >
        <AvatarFallback style={{ color: perspective.color }}>
          {perspective.readerName
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </AvatarFallback>
      </Avatar>
      <div className="text-left">
        <p className="font-medium text-sm">{perspective.readerName}</p>
        <p className="text-xs text-muted-foreground">{perspective.voiceTag}</p>
      </div>
    </button>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Analysis Available</h2>
        <p className="text-muted-foreground mb-4">
          Run a script analysis first to enable focus group discussions between readers.
        </p>
        <Button variant="outline">Go to Scout</Button>
      </div>
    </div>
  );
}

// Helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
