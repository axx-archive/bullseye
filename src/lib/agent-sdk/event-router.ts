// BULLSEYE SSE Event Router
// Parses incoming SSE events and routes to appropriate store actions

import type { ScoutSSEEvent, ReaderStreamState, FocusGroupUIMessage, ExecutiveStreamState } from './types';
import type { DraftDeliverable } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface EventRouterCallbacks {
  // Scout chat
  onScoutTextDelta: (text: string) => void;
  onScoutTextComplete: (text: string) => void;

  // Reader analysis
  onReaderStart: (readerId: string) => void;
  onReaderProgress: (readerId: string, progress: number) => void;
  onReaderComplete: (readerId: string, data: Partial<ReaderStreamState>) => void;
  onReaderError: (readerId: string, error: string) => void;

  // Deliverable (harmonized coverage/intake)
  onDeliverableReady: (deliverable: DraftDeliverable) => void;

  // Focus group
  onFocusGroupMessage: (message: FocusGroupUIMessage) => void;
  onFocusGroupTyping: (speaker: string, speakerType: 'moderator' | 'reader', readerId?: string) => void;
  onFocusGroupComplete: () => void;

  // Executive evaluation
  onExecutiveStart: (executiveId: string, executiveName: string) => void;
  onExecutiveComplete: (executiveId: string, data: Partial<ExecutiveStreamState>) => void;

  // Phase changes
  onPhaseChange: (phase: 'idle' | 'analysis' | 'focus_group' | 'reader_chat' | 'executive') => void;

  // System
  onToolStart: (tool: string) => void;
  onToolEnd: (tool: string) => void;
  onResult: (data: { success: boolean; totalCostUsd?: number; numTurns?: number }) => void;
  onError: (error: string) => void;
}

const READER_COLORS: Record<string, string> = {
  'reader-maya': '#30D5C8',
  'reader-colton': '#FF7F7F',
  'reader-devon': '#B8A9C9',
};

export function routeEvent(event: ScoutSSEEvent, callbacks: EventRouterCallbacks): void {
  switch (event.source) {
    case 'scout':
      if (event.type === 'text_delta' && event.text) {
        callbacks.onScoutTextDelta(event.text);
      } else if (event.type === 'text_complete' && event.text) {
        callbacks.onScoutTextComplete(event.text);
      }
      break;

    case 'reader_maya':
    case 'reader_colton':
    case 'reader_devon': {
      const readerId = event.source.replace('_', '-');
      if (event.type === 'analysis_start') {
        callbacks.onPhaseChange('analysis');
        callbacks.onReaderStart(readerId);
      } else if (event.type === 'analysis_stream' && event.data) {
        const progress = (event.data as { progress?: number }).progress ?? 0;
        callbacks.onReaderProgress(readerId, progress);
      } else if (event.type === 'analysis_complete' && event.data) {
        callbacks.onReaderComplete(readerId, event.data as Partial<ReaderStreamState>);
      } else if (event.type === 'error') {
        callbacks.onReaderError(readerId, event.error || 'Unknown error');
      }
      break;
    }

    case 'focus_group':
      callbacks.onPhaseChange('focus_group');
      if (event.type === 'focus_group_message') {
        const readerId = event.readerId;
        callbacks.onFocusGroupMessage({
          id: uuidv4(),
          speaker: event.speaker || 'Unknown',
          speakerType: event.speakerType || 'reader',
          readerId,
          readerColor: readerId ? READER_COLORS[readerId] : undefined,
          content: event.text || '',
          topic: undefined,
          timestamp: new Date(),
          replyToReaderId: event.replyToReaderId,
          replyToReaderName: event.replyToReaderName,
          reactionSentiment: event.reactionSentiment,
        });
      } else if (event.type === 'focus_group_typing') {
        callbacks.onFocusGroupTyping(
          event.speaker || 'Unknown',
          event.speakerType || 'reader',
          event.readerId
        );
      } else if (event.type === 'focus_group_complete') {
        callbacks.onFocusGroupComplete();
      }
      break;

    case 'reader_chat':
      callbacks.onPhaseChange('reader_chat');
      break;

    case 'executive':
      callbacks.onPhaseChange('executive');
      if (event.type === 'executive_start' && event.executiveId) {
        callbacks.onExecutiveStart(event.executiveId, event.executiveName || 'Executive');
      } else if (event.type === 'executive_complete' && event.executiveId && event.data) {
        callbacks.onExecutiveComplete(event.executiveId, event.data as Partial<ExecutiveStreamState>);
      }
      break;

    case 'system':
      if (event.type === 'deliverable_ready' && event.data) {
        callbacks.onDeliverableReady(event.data as DraftDeliverable);
      } else if (event.type === 'phase_change' && event.phase) {
        callbacks.onPhaseChange(event.phase);
      } else if (event.type === 'tool_start' && event.tool) {
        callbacks.onToolStart(event.tool);
      } else if (event.type === 'tool_end' && event.tool) {
        callbacks.onToolEnd(event.tool);
      } else if (event.type === 'result') {
        callbacks.onResult(event.data as { success: boolean; totalCostUsd?: number; numTurns?: number });
      } else if (event.type === 'error') {
        callbacks.onError(event.error || 'Unknown error');
      }
      break;
  }
}

export function createSSEConnection(
  url: string,
  body: unknown,
  callbacks: EventRouterCallbacks
): { abort: () => void } {
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Use default error message
        }
        callbacks.onError(errorMessage);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }
            try {
              const event = JSON.parse(data) as ScoutSSEEvent;
              routeEvent(event, callbacks);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        callbacks.onError(error instanceof Error ? error.message : 'Connection failed');
      }
    }
  })();

  return {
    abort: () => abortController.abort(),
  };
}
