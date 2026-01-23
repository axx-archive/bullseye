// BULLSEYE Agent SDK Event Types
// Defines the SSE event protocol between server and client

export type ScoutEventSource = 'scout' | 'reader_maya' | 'reader_colton' | 'reader_devon' | 'focus_group' | 'reader_chat' | 'executive' | 'system';

export type ScoutEventType =
  | 'text_delta'
  | 'text_complete'
  | 'analysis_start'
  | 'analysis_stream'
  | 'analysis_complete'
  | 'deliverable_ready'
  | 'phase_change'
  | 'tool_start'
  | 'tool_end'
  | 'focus_group_message'
  | 'focus_group_typing'
  | 'focus_group_complete'
  | 'reader_chat_typing'
  | 'reader_chat_message'
  | 'executive_start'
  | 'executive_complete'
  | 'error'
  | 'result';

export interface ScoutSSEEvent {
  source: ScoutEventSource;
  type: ScoutEventType;
  text?: string;
  data?: unknown;
  phase?: RightPanelPhase;
  tool?: string;
  speaker?: string;
  speakerType?: 'moderator' | 'reader';
  readerId?: string;
  executiveId?: string;
  executiveName?: string;
  error?: string;
  totalCostUsd?: number;
}

export type RightPanelPhase = 'idle' | 'analysis' | 'focus_group' | 'reader_chat' | 'executive';

export interface ReaderStreamState {
  readerId: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  progress?: number; // 0-100 progress during analysis
  scores?: {
    premise?: number;
    character?: number;
    dialogue?: number;
    structure?: number;
    commerciality?: number;
    overall?: number;
  };
  recommendation?: string;
  keyStrengths?: string[];
  keyConcerns?: string[];
  standoutQuote?: string;
  error?: string;
}

export interface FocusGroupUIMessage {
  id: string;
  speaker: string;
  speakerType: 'moderator' | 'reader';
  readerId?: string;
  readerColor?: string;
  content: string;
  topic?: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ExecutiveStreamState {
  executiveId: string;
  executiveName: string;
  status: 'evaluating' | 'complete';
  verdict?: 'pursue' | 'pass';
  confidence?: number;
  rationale?: string;
  keyFactors?: string[];
  concerns?: string[];
}

export interface ScoutSessionState {
  sessionId: string;
  projectId?: string;
  draftId?: string;
  rightPanelMode: RightPanelPhase;
  readerStates: Map<string, ReaderStreamState>;
  focusGroupMessages: FocusGroupUIMessage[];
  scriptIngested: boolean;
  analysisComplete: boolean;
}
