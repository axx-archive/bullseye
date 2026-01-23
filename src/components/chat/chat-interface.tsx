'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUp, Target, Paperclip, X, FileText, Loader2, CheckCircle2 } from 'lucide-react';

export interface FileAttachment {
  file: File;
  name: string;
  size: number;
  type: string;
  content?: string; // Extracted text content
  status: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
}

export interface ToolCallStatus {
  id: string;
  name: string;
  displayName: string;
  status: 'running' | 'complete';
}

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
  attachment?: { name: string; size: number };
  toolCalls?: ToolCallStatus[];
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, attachment?: FileAttachment) => void;
  isLoading?: boolean;
  activityStatus?: string | null;
  placeholder?: string;
  agentName?: string;
  agentColor?: string;
  className?: string;
}

const ACCEPTED_TYPES = ['.pdf', '.txt', '.fountain', '.fdx'];
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/x-fountain',
  'application/xml',
  'text/xml',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  activityStatus,
  placeholder = 'Message Scout...',
  agentName = 'Scout',
  agentColor = '#D4A84B',
  className,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages]);

  const processFile = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setAttachment({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'error',
        error: 'File exceeds 10MB limit',
      });
      return;
    }

    // Validate file type
    if (!isAcceptedFile(file)) {
      setAttachment({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'error',
        error: `Unsupported format. Accepted: ${ACCEPTED_TYPES.join(', ')}`,
      });
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();

    setAttachment({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'processing',
    });

    try {
      let content: string;

      if (ext === 'pdf') {
        // PDF needs server-side parsing
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to parse PDF');
        }
        const data = await res.json();
        content = data.content;
      } else {
        // .txt, .fountain, .fdx - read as text client-side
        content = await file.text();

        // For .fdx (Final Draft XML), extract dialogue/action text
        if (ext === 'fdx') {
          content = parseFDX(content);
        }
      }

      setAttachment({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        content,
        status: 'ready',
      });
    } catch (err) {
      setAttachment({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to process file',
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const removeAttachment = useCallback(() => {
    setAttachment(null);
  }, []);

  const handleSend = () => {
    const hasContent = input.trim();
    const hasReadyAttachment = attachment?.status === 'ready';

    if ((hasContent || hasReadyAttachment) && !isLoading) {
      onSendMessage(input.trim(), attachment || undefined);
      setInput('');
      setAttachment(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  const canSend = (input.trim() || attachment?.status === 'ready') && !isLoading;

  return (
    <div
      className={cn('flex flex-col h-full relative', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-bullseye-gold/50 rounded-2xl"
          >
            <div className="text-center">
              <FileText className="w-10 h-10 text-bullseye-gold mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Drop your script here</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, TXT, Fountain, or Final Draft</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        <div className="space-y-5 max-w-2xl mx-auto px-4">
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

          {/* Activity indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 pl-1"
            >
              <div className="w-7 h-7 rounded-lg bg-bullseye-gold/10 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-bullseye-gold animate-target-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {activityStatus && (
                    <motion.span
                      key={activityStatus}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      className="text-xs text-muted-foreground"
                    >
                      {activityStatus}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          {/* File attachment chip */}
          <AnimatePresence>
            {attachment && (
              <motion.div
                initial={{ opacity: 0, y: 4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 4, height: 0 }}
                className="mb-2"
              >
                <div
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border',
                    attachment.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : attachment.status === 'processing'
                        ? 'bg-bullseye-gold/10 border-bullseye-gold/30 text-bullseye-gold'
                        : 'bg-surface border-border text-foreground'
                  )}
                >
                  {attachment.status === 'processing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium max-w-[200px] truncate">{attachment.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
                  {attachment.status === 'error' && (
                    <span className="text-red-400">{attachment.error}</span>
                  )}
                  <button
                    onClick={removeAttachment}
                    className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input row */}
          <div className="relative flex items-end bg-surface rounded-2xl border border-border/80 focus-within:border-bullseye-gold/30 focus-within:ring-1 focus-within:ring-bullseye-gold/20 transition-all">
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0 p-3 pl-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Attach script file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none py-3.5 pr-12 focus:outline-none min-h-[48px] max-h-[160px]"
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                canSend
                  ? 'bg-gradient-gold text-primary-foreground shadow-sm'
                  : 'bg-elevated text-muted-foreground'
              )}
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, agentName, agentColor }: { message: ChatMessage; agentName: string; agentColor: string }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-xs text-muted-foreground py-2"
      >
        {message.content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${message.readerColor || agentColor}15` }}
        >
          {message.readerName ? (
            <span className="text-[10px] font-semibold" style={{ color: message.readerColor || agentColor }}>
              {message.readerName.split(' ').map((n) => n[0]).join('')}
            </span>
          ) : (
            <Target className="w-3.5 h-3.5" style={{ color: agentColor }} />
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn('flex-1', isUser ? 'max-w-[75%] ml-auto' : 'max-w-[85%]')}>
        {!isUser && (
          <span
            className="text-[11px] font-medium mb-1 block"
            style={{ color: message.readerColor || agentColor }}
          >
            {message.readerName || agentName}
          </span>
        )}

        <div
          className={cn(
            'text-sm leading-relaxed',
            isUser
              ? 'bg-surface px-4 py-3 rounded-2xl rounded-tr-md text-foreground'
              : 'text-foreground/90'
          )}
        >
          {/* File attachment indicator */}
          {message.attachment && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 pb-2 border-b border-border/50">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-medium">{message.attachment.name}</span>
              <span>{formatFileSize(message.attachment.size)}</span>
            </div>
          )}
          {/* Tool call status pills */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {message.toolCalls.map((tool) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                    tool.status === 'running'
                      ? 'bg-bullseye-gold/10 border-bullseye-gold/30 text-bullseye-gold'
                      : 'bg-success/10 border-success/30 text-success'
                  )}
                >
                  {tool.status === 'running' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  <span>{tool.displayName}</span>
                </motion.div>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 bg-bullseye-gold animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Parse Final Draft XML (.fdx) to extract screenplay text
function parseFDX(xml: string): string {
  const lines: string[] = [];
  // Simple regex-based extraction of paragraph text from FDX
  const paragraphRegex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/g;
  const textRegex = /<Text[^>]*>([\s\S]*?)<\/Text>/g;

  let match;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const type = match[1];
    const content = match[2];
    const texts: string[] = [];

    let textMatch;
    const localTextRegex = new RegExp(textRegex.source, textRegex.flags);
    while ((textMatch = localTextRegex.exec(content)) !== null) {
      texts.push(textMatch[1].replace(/<[^>]*>/g, '').trim());
    }

    if (texts.length > 0) {
      const text = texts.join('');
      switch (type) {
        case 'Scene Heading':
          lines.push(`\n${text}\n`);
          break;
        case 'Character':
          lines.push(`\n\t\t\t${text}`);
          break;
        case 'Dialogue':
          lines.push(`\t\t${text}`);
          break;
        case 'Parenthetical':
          lines.push(`\t\t\t(${text})`);
          break;
        case 'Action':
          lines.push(`\n${text}`);
          break;
        case 'Transition':
          lines.push(`\n\t\t\t\t\t${text}\n`);
          break;
        default:
          lines.push(text);
      }
    }
  }

  return lines.join('\n').trim() || xml; // Fallback to raw XML if parsing fails
}

// Quick actions — minimal pill buttons
interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  const actions = [
    { id: 'analyze', label: 'Analyze Script' },
    { id: 'focus-group', label: 'Focus Group' },
    { id: 'executive', label: 'Executive Sim' },
    { id: 'compare', label: 'Compare Drafts' },
  ];

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2 max-w-2xl mx-auto">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className="px-4 py-2 rounded-full text-xs font-medium text-muted-foreground bg-surface border border-border hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
