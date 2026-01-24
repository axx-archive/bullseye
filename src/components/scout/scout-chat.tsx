'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import type { ToolCallStatus } from '@/stores/app-store';
import { ChatInterface, QuickActions, type ChatMessage, type FileAttachment } from '@/components/chat/chat-interface';
import { createSSEConnection, type EventRouterCallbacks } from '@/lib/agent-sdk/event-router';
import { draftKeys } from '@/hooks/use-drafts';
import { studioKeys } from '@/hooks/use-studio';
import { Target } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function persistChatMessage(projectId: string, data: {
  role: string;
  content: string;
  agentType?: string;
  toolCalls?: ToolCallStatus[];
  attachmentName?: string;
  attachmentSize?: number;
}) {
  fetch(`/api/projects/${projectId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(console.error);
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'ingest_script': 'Ingesting script...',
  'spawn_readers': 'Analyzing with readers...',
  'harmonize_analyses': 'Synthesizing coverage...',
  'run_focus_group': 'Running focus group...',
  'focus_group': 'Running focus group...',
  'run_executive_eval': 'Evaluating with executives...',
  'executive_eval': 'Evaluating with executives...',
  'get_calibration_context': 'Loading studio context...',
  'get_studio_intelligence': 'Loading studio intelligence...',
  'memory_read': 'Reading memory...',
  'memory_write': 'Saving memory...',
  'memory_read_all': 'Loading all memories...',
  'generate_focus_questions': 'Generating questions...',
  'reader_chat': 'Chatting with reader...',
};

function getToolDisplayName(toolName: string): string {
  // Handle MCP-prefixed names like "mcp__bullseye-tools__ingest_script"
  const baseName = toolName.includes('__') ? toolName.split('__').pop()! : toolName;
  return TOOL_DISPLAY_NAMES[baseName] || baseName.replace(/_/g, ' ');
}

export function ScoutChat() {
  const {
    chatMessages,
    isStreaming,
    addChatMessage,
    updateChatMessage,
    setStreaming,
    setRightPanelMode,
    setReaderState,
    setDeliverable,
    setActiveTab,
    addFocusGroupMessage,
    setFocusGroupTyping,
    clearFocusGroupMessages,
    setExecutiveState,
    pendingScoutAttachment,
    setPendingScoutAttachment,
  } = useAppStore();

  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const streamingTextRef = useRef('');
  const connectionRef = useRef<{ abort: () => void } | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const toolCallsRef = useRef<ToolCallStatus[]>([]);
  const turnCompleteRef = useRef(false);
  const lastRequestRef = useRef<{
    content: string;
    attachment?: FileAttachment;
  } | null>(null);
  const processingAttachmentRef = useRef(false);
  const handleSendMessageRef = useRef<(content: string, attachment?: FileAttachment) => void>(() => {});

  const sendMessageToScout = useCallback((
    content: string,
    attachment: FileAttachment | undefined,
    existingMessages: ChatMessage[],
    userMessage: ChatMessage,
    assistantId: string,
  ) => {
    streamingTextRef.current = '';
    currentAssistantIdRef.current = assistantId;
    toolCallsRef.current = [];
    turnCompleteRef.current = false;

    // Build message history for context
    const allMessages = [...existingMessages, userMessage].map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build the request payload, including attachment content if present
    const projectId = useAppStore.getState().currentProject?.id;
    const requestPayload: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      attachment?: { filename: string; content: string; mimeType: string };
      projectId?: string;
    } = { messages: allMessages, projectId };

    if (attachment?.status === 'ready' && attachment.content) {
      requestPayload.attachment = {
        filename: attachment.name,
        content: attachment.content,
        mimeType: attachment.type,
      };
    }

    // Create event router callbacks
    const callbacks: EventRouterCallbacks = {
      onScoutTextDelta: (text) => {
        // Detect turn boundary: if the previous turn completed, start a new message
        if (turnCompleteRef.current) {
          turnCompleteRef.current = false;
          streamingTextRef.current = '';
          const newAssistantId = uuidv4();
          currentAssistantIdRef.current = newAssistantId;
          toolCallsRef.current = [];
          const newMessage: ChatMessage = {
            id: newAssistantId,
            role: 'assistant',
            content: '',
            agentType: 'SCOUT',
            timestamp: new Date(),
            isStreaming: true,
          };
          addChatMessage(newMessage);
        }
        streamingTextRef.current += text;
        if (currentAssistantIdRef.current) {
          updateChatMessage(currentAssistantIdRef.current, { content: streamingTextRef.current });
        }
      },
      onScoutTextComplete: () => {
        turnCompleteRef.current = true;
        if (currentAssistantIdRef.current) {
          updateChatMessage(currentAssistantIdRef.current, { isStreaming: false });
        }
        // Persist assistant turn (fire-and-forget)
        const pid = useAppStore.getState().currentProject?.id;
        if (pid && streamingTextRef.current) {
          persistChatMessage(pid, {
            role: 'assistant',
            content: streamingTextRef.current,
            agentType: 'SCOUT',
          });
        }
      },
      onReaderStart: (readerId) => {
        setReaderState(readerId, { readerId, status: 'streaming', progress: 0 });
      },
      onReaderProgress: (readerId, progress) => {
        setReaderState(readerId, { progress });
      },
      onReaderComplete: (readerId, data) => {
        setReaderState(readerId, {
          readerId,
          status: 'complete',
          scores: data.scores,
          recommendation: data.recommendation as string | undefined,
          keyStrengths: data.keyStrengths,
          keyConcerns: data.keyConcerns,
          standoutQuote: data.standoutQuote,
        });
      },
      onReaderError: (readerId, error) => {
        setReaderState(readerId, { readerId, status: 'error', error });
      },
      onDeliverableReady: (deliverable) => {
        setDeliverable(deliverable);
        setActiveTab('coverage');
      },
      onFocusGroupMessage: (message) => {
        addFocusGroupMessage(message);
      },
      onFocusGroupTyping: (speaker, speakerType, readerId) => {
        setFocusGroupTyping(speaker, speakerType, readerId);
      },
      onFocusGroupComplete: () => {
        setFocusGroupTyping(null, 'moderator');
      },
      onExecutiveStart: (executiveId, executiveName) => {
        setExecutiveState(executiveId, { executiveId, executiveName, status: 'evaluating' });
      },
      onExecutiveComplete: (executiveId, data) => {
        setExecutiveState(executiveId, {
          status: 'complete',
          verdict: data.verdict,
          confidence: data.confidence,
          rationale: data.rationale,
          keyFactors: data.keyFactors,
          concerns: data.concerns,
        });
      },
      onPhaseChange: (phase) => {
        const currentMode = useAppStore.getState().rightPanelMode;
        if (currentMode !== phase) {
          setRightPanelMode(phase);
          if (phase === 'focus_group') {
            clearFocusGroupMessages();
          }
        }
      },
      onToolStart: (tool) => {
        setActiveTool(tool);
        const baseName = tool.includes('__') ? tool.split('__').pop()! : tool;
        const displayName = getToolDisplayName(tool);
        const toolCall: ToolCallStatus = {
          id: uuidv4(),
          name: baseName,
          displayName,
          status: 'running',
        };
        toolCallsRef.current = [...toolCallsRef.current, toolCall];
        if (currentAssistantIdRef.current) {
          updateChatMessage(currentAssistantIdRef.current, {
            toolCalls: [...toolCallsRef.current],
          });
        }
      },
      onToolEnd: (tool) => {
        setActiveTool(null);
        const baseName = tool.includes('__') ? tool.split('__').pop()! : tool;
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.name === baseName && tc.status === 'running'
            ? { ...tc, status: 'complete' as const }
            : tc
        );
        if (currentAssistantIdRef.current) {
          updateChatMessage(currentAssistantIdRef.current, {
            toolCalls: [...toolCallsRef.current],
          });
        }
      },
      onResult: () => {
        setStreaming(false);
        setActiveTool(null);
        // Mark any remaining running tools as complete on the current assistant message
        const finalAssistantId = currentAssistantIdRef.current || assistantId;
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.status === 'running' ? { ...tc, status: 'complete' as const } : tc
        );
        updateChatMessage(finalAssistantId, {
          isStreaming: false,
          toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined,
        });

        // Persist final assistant state with toolCalls if any (fire-and-forget)
        // Note: text content was already persisted by onScoutTextComplete, so only persist here if toolCalls exist
        const pid = useAppStore.getState().currentProject?.id;
        if (pid && toolCallsRef.current.length > 0 && streamingTextRef.current) {
          persistChatMessage(pid, {
            role: 'assistant',
            content: streamingTextRef.current,
            agentType: 'SCOUT',
            toolCalls: toolCallsRef.current,
          });
        }

        currentAssistantIdRef.current = null;

        // Invalidate React Query caches for data that may have been persisted
        const draftId = useAppStore.getState().currentDraft?.id;
        if (draftId) {
          queryClient.invalidateQueries({ queryKey: draftKeys.deliverable(draftId) });
          queryClient.invalidateQueries({ queryKey: draftKeys.evaluations(draftId) });
          queryClient.invalidateQueries({ queryKey: draftKeys.focusSessions(draftId) });
        }
        queryClient.invalidateQueries({ queryKey: studioKeys.intelligence });
      },
      onError: (error) => {
        setStreaming(false);
        setActiveTool(null);
        const errorAssistantId = currentAssistantIdRef.current || assistantId;
        currentAssistantIdRef.current = null;
        // If we have partial text, keep it and append error
        const errorContent = streamingTextRef.current
          ? streamingTextRef.current
          : `Connection error: ${error}`;
        updateChatMessage(errorAssistantId, {
          content: errorContent,
          isStreaming: false,
          role: streamingTextRef.current ? 'assistant' : 'system',
        });
        // Add a retry system message if there was no partial content
        if (!streamingTextRef.current) {
          const retryMessage: ChatMessage = {
            id: uuidv4(),
            role: 'system',
            content: `__error__:${error}`,
            timestamp: new Date(),
          };
          addChatMessage(retryMessage);
        }
      },
    };

    // Start SSE connection
    connectionRef.current = createSSEConnection(
      '/api/scout',
      requestPayload,
      callbacks
    );
  }, [updateChatMessage, setReaderState, setDeliverable, setActiveTab, addFocusGroupMessage, setFocusGroupTyping, clearFocusGroupMessages, setRightPanelMode, setStreaming, addChatMessage, setExecutiveState, queryClient]);

  const handleSendMessage = useCallback((content: string, attachment?: FileAttachment) => {
    // Build the user-facing message content
    let displayContent = content;
    if (attachment?.status === 'ready' && !content) {
      displayContent = `Analyze this script: ${attachment.name}`;
    }

    // Store last request for retry
    lastRequestRef.current = { content, attachment };

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
      attachment: attachment ? { name: attachment.name, size: attachment.size } : undefined,
    };
    addChatMessage(userMessage);

    // Persist user message (fire-and-forget)
    const projectId = useAppStore.getState().currentProject?.id;
    if (projectId) {
      persistChatMessage(projectId, {
        role: 'user',
        content: displayContent,
        attachmentName: attachment?.name,
        attachmentSize: attachment?.size,
      });
    }

    setStreaming(true);

    // Add a streaming assistant message placeholder
    const assistantId = uuidv4();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      agentType: 'SCOUT',
      timestamp: new Date(),
      isStreaming: true,
    };
    addChatMessage(assistantMessage);

    // Get current messages (before adding user + assistant) for context
    const existingMessages = chatMessages.filter((m) => m.role !== 'system' || !m.content.startsWith('__error__'));

    sendMessageToScout(content, attachment, existingMessages, userMessage, assistantId);
  }, [chatMessages, addChatMessage, setStreaming, sendMessageToScout]);

  const handleRetry = useCallback(() => {
    if (!lastRequestRef.current) return;

    // Remove the error system message(s) and the failed assistant message
    const { chatMessages: currentMessages } = useAppStore.getState();

    // Find and remove error messages from the end
    const cleanedMessages = currentMessages.filter((m) => {
      if (m.role === 'system' && m.content.startsWith('__error__')) return false;
      return true;
    });

    // Remove the last assistant message if it was an error
    const lastAssistant = [...cleanedMessages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant && (lastAssistant.content.startsWith('Connection error:') || lastAssistant.content === '')) {
      const filtered = cleanedMessages.filter((m) => m.id !== lastAssistant.id);
      // Reset store messages to cleaned state
      useAppStore.setState({ chatMessages: filtered });
    } else {
      useAppStore.setState({ chatMessages: cleanedMessages });
    }

    // Re-send the last request
    const { content, attachment } = lastRequestRef.current;
    handleSendMessage(content, attachment);
  }, [handleSendMessage]);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'analyze':
        handleSendMessage('I want to analyze a new script');
        break;
      case 'focus-group':
        handleSendMessage('Start a focus group discussion about the key divergence points');
        break;
      case 'executive':
        handleSendMessage('Run executive pitch simulations with all three executives');
        break;
      case 'compare':
        handleSendMessage('Compare this analysis to the previous draft');
        break;
    }
  }, [handleSendMessage]);

  // Keep handleSendMessage ref current to avoid re-triggering effects
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Auto-send when a pending attachment arrives (e.g., after draft upload)
  useEffect(() => {
    if (pendingScoutAttachment && !isStreaming && !processingAttachmentRef.current) {
      processingAttachmentRef.current = true;
      const attachment: FileAttachment = {
        file: new File([], pendingScoutAttachment.filename),
        name: pendingScoutAttachment.filename,
        size: pendingScoutAttachment.content.length,
        type: 'application/pdf',
        content: pendingScoutAttachment.content,
        status: 'ready',
      };
      setPendingScoutAttachment(null);
      handleSendMessageRef.current('Analyze this script', attachment);
      processingAttachmentRef.current = false;
    }
  }, [pendingScoutAttachment, isStreaming, setPendingScoutAttachment]);

  // Filter out internal error markers for display
  const displayMessages: ChatMessage[] = chatMessages.map((m) => {
    if (m.role === 'system' && m.content.startsWith('__error__')) {
      const errorText = m.content.replace('__error__:', '');
      if (errorText.includes('API key in Settings')) {
        return {
          ...m,
          content: `${errorText} — Go to the Settings tab (gear icon) to add your key.`,
        };
      }
      return {
        ...m,
        content: `Error: ${errorText} — Click Retry below to try again.`,
      };
    }
    return m;
  });

  const hasMessages = chatMessages.length > 0;

  return (
    <div className="h-full flex flex-col">
      {!hasMessages ? (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
            <Target className="w-[300px] h-[300px] text-bullseye-gold" strokeWidth={0.5} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center relative z-10 max-w-md px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="w-12 h-12 rounded-2xl bg-bullseye-gold/10 flex items-center justify-center mx-auto mb-6"
            >
              <Target className="w-6 h-6 text-bullseye-gold" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-xl font-semibold tracking-tight mb-3"
            >
              What would you like to analyze?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-sm text-muted-foreground leading-relaxed mb-8"
            >
              Upload a script or paste text and Scout will coordinate three readers,
              then deliver harmonized coverage in real-time.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <QuickActions onAction={handleQuickAction} disabled={isStreaming} />
            </motion.div>
          </motion.div>

          <div className="absolute bottom-0 left-0 right-0">
            <ChatInterface
              messages={[]}
              onSendMessage={handleSendMessage}
              isLoading={isStreaming}
              activityStatus={activeTool ? getToolDisplayName(activeTool) : null}
              placeholder="Upload a script or paste text..."
              className="h-auto"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <ChatInterface
            messages={displayMessages}
            onSendMessage={handleSendMessage}
            isLoading={isStreaming}
            activityStatus={activeTool ? getToolDisplayName(activeTool) : null}
            placeholder="Message Scout..."
            agentName="Scout"
            agentColor="#D4A84B"
          />
          {/* Retry button when last message is an error */}
          {!isStreaming && chatMessages.some((m) => m.role === 'system' && m.content.startsWith('__error__')) && (
            <div className="flex justify-center gap-2 pb-2">
              {chatMessages.some((m) => m.role === 'system' && m.content.includes('API key in Settings')) ? (
                <button
                  onClick={() => router.push('/settings')}
                  className="px-4 py-2 rounded-full text-xs font-medium text-bullseye-gold bg-bullseye-gold/10 border border-bullseye-gold/30 hover:bg-bullseye-gold/20 transition-colors"
                >
                  Go to Settings
                </button>
              ) : (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 rounded-full text-xs font-medium text-danger bg-danger/10 border border-danger/30 hover:bg-danger/20 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {!isStreaming && !chatMessages.some((m) => m.role === 'system' && m.content.startsWith('__error__')) && (
            <QuickActions onAction={handleQuickAction} disabled={isStreaming} />
          )}
        </div>
      )}
    </div>
  );
}
