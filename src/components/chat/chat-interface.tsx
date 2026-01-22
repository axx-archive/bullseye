'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Send, Loader2, Target, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentType?: 'SCOUT' | 'READER';
  readerId?: string;
  readerName?: string;
  readerColor?: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  agentName?: string;
  agentColor?: string;
  className?: string;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = 'Message Scout...',
  agentName = 'Scout',
  agentColor = '#D4A84B',
  className,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle send
  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                agentName={agentName}
                agentColor={agentColor}
              />
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar className="h-8 w-8 bg-elevated">
                <AvatarFallback>
                  <Target className="h-4 w-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {agentName} is thinking...
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-4 bg-surface">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[44px] max-h-[200px] resize-none bg-elevated"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Individual message bubble
interface MessageBubbleProps {
  message: ChatMessage;
  agentName: string;
  agentColor: string;
}

function MessageBubble({ message, agentName, agentColor }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-sm text-muted-foreground py-2"
      >
        {message.content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <Avatar
        className={cn('h-8 w-8 flex-shrink-0', isUser ? 'bg-elevated' : '')}
        style={!isUser ? { backgroundColor: `${message.readerColor || agentColor}20` } : undefined}
      >
        <AvatarFallback
          style={!isUser ? { color: message.readerColor || agentColor } : undefined}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : message.readerName ? (
            message.readerName
              .split(' ')
              .map((n) => n[0])
              .join('')
          ) : (
            <Target className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div
        className={cn(
          'flex-1 max-w-[80%]',
          isUser && 'flex flex-col items-end'
        )}
      >
        {/* Sender name */}
        {!isUser && (
          <span
            className="text-xs font-medium mb-1"
            style={{ color: message.readerColor || agentColor }}
          >
            {message.readerName || agentName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md'
              : 'bg-elevated rounded-tl-md'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>

          {/* Streaming indicator */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>

        {/* Timestamp */}
        {message.timestamp && (
          <span className="text-xs text-muted-foreground mt-1">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Quick action buttons for common tasks
interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  const actions = [
    { id: 'analyze', label: 'Analyze Script', icon: '📄' },
    { id: 'focus-group', label: 'Start Focus Group', icon: '👥' },
    { id: 'executive', label: 'Run Executive Sim', icon: '💼' },
    { id: 'compare', label: 'Compare Drafts', icon: '🔄' },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-4 border-t border-border">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className="gap-2"
        >
          <span>{action.icon}</span>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
