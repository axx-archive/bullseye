// BULLSEYE Application State Store
// Using Zustand for global state management

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Studio,
  Project,
  Draft,
  DraftDeliverable,
  ReaderPerspective,
  FocusGroupMessage,
  ExecutiveEvaluationResult,
  AnalysisProgress,
} from '@/types';

// ============================================
// TAB STATE
// ============================================

export type TabId = 'home' | 'scout' | 'coverage' | 'focus' | 'revisions' | 'pitch' | 'settings';

interface TabState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

// ============================================
// PROJECT STATE
// ============================================

interface ProjectState {
  currentProject: Project | null;
  currentDraft: Draft | null;
  projects: Project[];

  setCurrentProject: (project: Project | null) => void;
  setCurrentDraft: (draft: Draft | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addDraftToProject: (projectId: string, draft: Draft) => void;
  resetProjectState: () => void;
}

// ============================================
// STUDIO STATE
// ============================================

interface StudioState {
  currentStudio: Studio | null;
  studios: Studio[];

  setCurrentStudio: (studio: Studio | null) => void;
  setStudios: (studios: Studio[]) => void;
  addStudio: (studio: Studio) => void;
  updateStudio: (id: string, updates: Partial<Studio>) => void;
  removeStudio: (id: string) => void;
}

// ============================================
// ANALYSIS STATE
// ============================================

interface AnalysisState {
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  currentDeliverable: DraftDeliverable | null;
  readerPerspectives: ReaderPerspective[];

  startAnalysis: () => void;
  updateProgress: (progress: AnalysisProgress) => void;
  setDeliverable: (deliverable: DraftDeliverable) => void;
  setReaderPerspectives: (perspectives: ReaderPerspective[]) => void;
  resetAnalysis: () => void;
}

// ============================================
// FOCUS GROUP STATE
// ============================================

interface FocusGroupState {
  isLive: boolean;
  focusMessages: FocusGroupMessage[];
  currentSpeaker: string | null;
  isTyping: boolean;

  startFocusGroup: () => void;
  endFocusGroup: () => void;
  addFocusMessage: (message: FocusGroupMessage) => void;
  setTyping: (speaker: string | null) => void;
  clearFocusMessages: () => void;
}

// ============================================
// EXECUTIVE STATE
// ============================================

interface ExecutiveState {
  evaluations: ExecutiveEvaluationResult[];
  isEvaluating: boolean;
  currentExecutive: string | null;

  startEvaluation: () => void;
  addEvaluation: (evaluation: ExecutiveEvaluationResult) => void;
  setCurrentExecutive: (execId: string | null) => void;
  clearEvaluations: () => void;
  endEvaluation: () => void;
}

// ============================================
// CHAT STATE
// ============================================

export interface ToolCallStatus {
  id: string;
  name: string;
  displayName: string;
  status: 'running' | 'complete';
}

export interface StoreChatMessage {
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

interface PendingScoutAttachment {
  filename: string;
  content: string;
}

interface ChatState {
  chatMessages: StoreChatMessage[];
  isStreaming: boolean;
  activeAgent: 'scout' | 'reader' | null;
  activeReaderId: string | null;
  pendingScoutAttachment: PendingScoutAttachment | null;

  addChatMessage: (message: StoreChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<StoreChatMessage>) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setActiveAgent: (agent: 'scout' | 'reader' | null, readerId?: string) => void;
  clearChat: () => void;
  setPendingScoutAttachment: (attachment: PendingScoutAttachment | null) => void;
}

// ============================================
// SCOUT SESSION STATE (Split-Screen UI)
// ============================================

import type { RightPanelPhase, ReaderStreamState, FocusGroupUIMessage, ExecutiveStreamState } from '@/lib/agent-sdk/types';

export interface ReaderChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface ScoutSessionState {
  sessionId: string | null;
  rightPanelMode: RightPanelPhase;
  userSelectedPanel: RightPanelPhase | null; // null = follow SCOUT's recommendations
  scoutRecommendedPanel: RightPanelPhase; // What SCOUT last set via phase_change
  readerStates: Map<string, ReaderStreamState>;
  focusGroupMessages: FocusGroupUIMessage[];
  focusGroupTypingSpeaker: string | null;
  activeReaderChatId: string | null; // For 1:1 reader chat
  readerChatMessages: Record<string, ReaderChatMessage[]>; // Keyed by readerId
  executiveStates: Map<string, ExecutiveStreamState>; // Live executive eval states
  isHydratingScoutState: boolean; // True while fetching scout-state from DB

  setSessionId: (id: string | null) => void;
  setRightPanelMode: (mode: RightPanelPhase) => void;
  setUserSelectedPanel: (mode: RightPanelPhase | null) => void;
  setScoutRecommendedPanel: (mode: RightPanelPhase) => void;
  setReaderState: (readerId: string, state: Partial<ReaderStreamState>) => void;
  clearReaderStates: () => void;
  addFocusGroupMessage: (message: FocusGroupUIMessage) => void;
  setFocusGroupTyping: (speaker: string | null, speakerType: 'moderator' | 'reader', readerId?: string) => void;
  clearFocusGroupMessages: () => void;
  setActiveReaderChatId: (readerId: string | null) => void;
  addReaderChatMessage: (readerId: string, message: ReaderChatMessage) => void;
  updateReaderChatMessage: (readerId: string, messageId: string, updates: Partial<ReaderChatMessage>) => void;
  setExecutiveState: (executiveId: string, state: Partial<ExecutiveStreamState>) => void;
  clearExecutiveStates: () => void;
  setHydratingScoutState: (hydrating: boolean) => void;
}

// ============================================
// UI STATE
// ============================================

interface UIState {
  sidebarOpen: boolean;
  expandedReaders: string[];
  showCalibration: boolean;
  isStudioConfigOpen: boolean;
  previousTab: TabId | null;
  // US-003: Session-level preference to skip project switch confirmation modal.
  // Intentionally NOT persisted to localStorage - resets on page refresh.
  skipProjectSwitchConfirm: boolean;

  toggleSidebar: () => void;
  toggleReaderExpanded: (readerId: string) => void;
  toggleCalibration: () => void;
  expandAllReaders: () => void;
  collapseAllReaders: () => void;
  openStudioConfig: () => void;
  closeStudioConfig: () => void;
  setSkipProjectSwitchConfirm: (skip: boolean) => void;
}

// ============================================
// DRAFT VERSIONING STATE
// ============================================

interface DraftVersioningState {
  // null = auto (most recent draft with data)
  coverageViewingDraftId: string | null;
  focusViewingDraftId: string | null;

  setCoverageViewingDraft: (draftId: string | null) => void;
  setFocusViewingDraft: (draftId: string | null) => void;
}

// ============================================
// COMBINED STORE
// ============================================

interface AppStore extends TabState, StudioState, ProjectState, AnalysisState, FocusGroupState, ExecutiveState, ChatState, ScoutSessionState, UIState, DraftVersioningState {}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ============ TAB STATE ============
        activeTab: 'home' as TabId,
        // IMPORTANT: setActiveTab MUST NOT clear any SCOUT-related state (FR-10).
        // Only setCurrentProject (when project ID changes) should reset Scout state.
        // Tab switching preserves all in-memory Zustand state including:
        // readerStates, focusGroupMessages, executiveStates, rightPanelMode,
        // chatMessages, currentDraft, etc.
        setActiveTab: (tab) => set({ activeTab: tab }),

        // ============ STUDIO STATE ============
        currentStudio: null,
        studios: [],

        setCurrentStudio: (studio) => set({ currentStudio: studio }),
        setStudios: (studios) => set({ studios }),
        addStudio: (studio) =>
          set((state) => ({ studios: [...state.studios, studio] })),
        updateStudio: (id, updates) =>
          set((state) => ({
            studios: state.studios.map((s) =>
              s.id === id ? { ...s, ...updates } : s
            ),
            currentStudio:
              state.currentStudio?.id === id
                ? { ...state.currentStudio, ...updates }
                : state.currentStudio,
          })),
        removeStudio: (id) =>
          set((state) => ({
            studios: state.studios.filter((s) => s.id !== id),
            currentStudio:
              state.currentStudio?.id === id ? null : state.currentStudio,
          })),

        // ============ PROJECT STATE ============
        currentProject: null,
        currentDraft: null,
        projects: [],

        setCurrentProject: (project) =>
          set((state) => {
            const prevId = state.currentProject?.id ?? null;
            const newId = project?.id ?? null;
            if (prevId !== newId) {
              // Reset all project-specific ephemeral state when switching projects
              return {
                currentProject: project,
                currentDraft: null,
                currentDeliverable: null,
                readerPerspectives: [],
                isAnalyzing: false,
                analysisProgress: null,
                focusMessages: [],
                isLive: false,
                currentSpeaker: null,
                isTyping: false,
                evaluations: [],
                isEvaluating: false,
                currentExecutive: null,
                rightPanelMode: 'idle' as RightPanelPhase,
                userSelectedPanel: null,
                scoutRecommendedPanel: 'idle' as RightPanelPhase,
                readerStates: new Map(),
                focusGroupMessages: [],
                focusGroupTypingSpeaker: null,
                activeReaderChatId: null,
                readerChatMessages: {},
                executiveStates: new Map(),
              };
            }
            return { currentProject: project };
          }),
        setCurrentDraft: (draft) =>
          set((state) => {
            const prevId = state.currentDraft?.id ?? null;
            const newId = draft?.id ?? null;
            // Reset draft versioning state when current draft changes
            if (prevId !== newId) {
              return {
                currentDraft: draft,
                coverageViewingDraftId: null,
                focusViewingDraftId: null,
              };
            }
            return { currentDraft: draft };
          }),
        addProject: (project) =>
          set((state) => ({ projects: [...state.projects, project] })),
        updateProject: (id, updates) =>
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates }
                : state.currentProject,
          })),
        addDraftToProject: (projectId, draft) =>
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === projectId
                ? { ...p, drafts: [...(p.drafts || []), draft] }
                : p
            ),
          })),
        resetProjectState: () =>
          set({
            currentDraft: null,
            currentDeliverable: null,
            readerPerspectives: [],
            isAnalyzing: false,
            analysisProgress: null,
            focusMessages: [],
            isLive: false,
            currentSpeaker: null,
            isTyping: false,
            evaluations: [],
            isEvaluating: false,
            currentExecutive: null,
            rightPanelMode: 'idle' as RightPanelPhase,
            userSelectedPanel: null,
            scoutRecommendedPanel: 'idle' as RightPanelPhase,
            readerStates: new Map(),
            focusGroupMessages: [],
            focusGroupTypingSpeaker: null,
            activeReaderChatId: null,
            readerChatMessages: {},
            executiveStates: new Map(),
          }),

        // ============ ANALYSIS STATE ============
        isAnalyzing: false,
        analysisProgress: null,
        currentDeliverable: null,
        readerPerspectives: [],

        startAnalysis: () =>
          set({
            isAnalyzing: true,
            analysisProgress: { stage: 'starting', progress: 0 },
          }),
        updateProgress: (progress) => set({ analysisProgress: progress }),
        setDeliverable: (deliverable) =>
          set({
            currentDeliverable: deliverable,
            readerPerspectives: deliverable.readerPerspectives,
          }),
        setReaderPerspectives: (perspectives) =>
          set({ readerPerspectives: perspectives }),
        resetAnalysis: () =>
          set({
            isAnalyzing: false,
            analysisProgress: null,
          }),

        // ============ FOCUS GROUP STATE ============
        isLive: false,
        focusMessages: [],
        currentSpeaker: null,
        isTyping: false,

        startFocusGroup: () =>
          set({ isLive: true, focusMessages: [], currentSpeaker: null }),
        endFocusGroup: () =>
          set({ isLive: false, currentSpeaker: null, isTyping: false }),
        addFocusMessage: (message) =>
          set((state) => ({ focusMessages: [...state.focusMessages, message] })),
        setTyping: (speaker) =>
          set({ currentSpeaker: speaker, isTyping: speaker !== null }),
        clearFocusMessages: () => set({ focusMessages: [] }),

        // ============ EXECUTIVE STATE ============
        evaluations: [],
        isEvaluating: false,
        currentExecutive: null,

        startEvaluation: () => set({ isEvaluating: true }),
        addEvaluation: (evaluation) =>
          set((state) => ({ evaluations: [...state.evaluations, evaluation] })),
        setCurrentExecutive: (execId) => set({ currentExecutive: execId }),
        clearEvaluations: () => set({ evaluations: [] }),
        endEvaluation: () =>
          set({ isEvaluating: false, currentExecutive: null }),

        // ============ CHAT STATE ============
        chatMessages: [],
        isStreaming: false,
        activeAgent: null,
        activeReaderId: null,

        addChatMessage: (message) =>
          set((state) => ({ chatMessages: [...state.chatMessages, message] })),
        updateChatMessage: (id, updates) =>
          set((state) => ({
            chatMessages: state.chatMessages.map((m) =>
              m.id === id ? { ...m, ...updates } : m
            ),
          })),
        updateLastMessage: (content) =>
          set((state) => {
            const chatMessages = [...state.chatMessages];
            if (chatMessages.length > 0) {
              chatMessages[chatMessages.length - 1] = {
                ...chatMessages[chatMessages.length - 1],
                content,
              };
            }
            return { chatMessages };
          }),
        setStreaming: (isStreaming) => set({ isStreaming }),
        setActiveAgent: (agent, readerId) =>
          set({ activeAgent: agent, activeReaderId: readerId || null }),
        clearChat: () =>
          set({ chatMessages: [], activeAgent: null, activeReaderId: null }),
        pendingScoutAttachment: null,
        setPendingScoutAttachment: (attachment) => set({ pendingScoutAttachment: attachment }),

        // ============ SCOUT SESSION STATE ============
        sessionId: null,
        rightPanelMode: 'idle' as RightPanelPhase,
        userSelectedPanel: null as RightPanelPhase | null,
        scoutRecommendedPanel: 'idle' as RightPanelPhase,
        readerStates: new Map<string, ReaderStreamState>(),
        focusGroupMessages: [] as FocusGroupUIMessage[],
        focusGroupTypingSpeaker: null,
        activeReaderChatId: null,
        readerChatMessages: {} as Record<string, ReaderChatMessage[]>,
        executiveStates: new Map<string, ExecutiveStreamState>(),
        isHydratingScoutState: false,

        setSessionId: (id) => set({ sessionId: id }),
        setRightPanelMode: (mode) => {
          set({ rightPanelMode: mode });
          // Persist scoutPhase to the database (fire-and-forget)
          const projectId = get().currentProject?.id;
          if (projectId) {
            const scoutPhase = mode === 'idle' ? null : mode;
            fetch(`/api/projects/${projectId}/scout-state`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scoutPhase }),
            }).catch((err) => {
              console.error('Failed to persist scoutPhase:', err);
            });
          }
        },
        setUserSelectedPanel: (mode) => {
          if (mode === null) {
            // User is returning to auto-follow mode — switch to SCOUT's recommended panel
            const recommended = get().scoutRecommendedPanel;
            set({ userSelectedPanel: null, rightPanelMode: recommended });
          } else {
            set({ userSelectedPanel: mode, rightPanelMode: mode });
          }
        },
        setScoutRecommendedPanel: (mode) => {
          set({ scoutRecommendedPanel: mode });
          // Only auto-switch if user hasn't manually selected a panel
          if (get().userSelectedPanel === null) {
            set({ rightPanelMode: mode });
            // Persist scoutPhase to the database (fire-and-forget)
            const projectId = get().currentProject?.id;
            if (projectId) {
              const scoutPhase = mode === 'idle' ? null : mode;
              fetch(`/api/projects/${projectId}/scout-state`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scoutPhase }),
              }).catch((err) => {
                console.error('Failed to persist scoutPhase:', err);
              });
            }
          }
        },
        setReaderState: (readerId, state) =>
          set((s) => {
            const newMap = new Map(s.readerStates);
            const existing = newMap.get(readerId) || { readerId, status: 'pending' as const };
            newMap.set(readerId, { ...existing, ...state } as ReaderStreamState);
            return { readerStates: newMap };
          }),
        clearReaderStates: () => set({ readerStates: new Map() }),
        addFocusGroupMessage: (message) =>
          set((s) => ({ focusGroupMessages: [...s.focusGroupMessages, message] })),
        setFocusGroupTyping: (speaker) =>
          set({ focusGroupTypingSpeaker: speaker }),
        clearFocusGroupMessages: () => set({ focusGroupMessages: [], focusGroupTypingSpeaker: null }),
        setActiveReaderChatId: (readerId) => set({ activeReaderChatId: readerId }),
        addReaderChatMessage: (readerId, message) =>
          set((s) => ({
            readerChatMessages: {
              ...s.readerChatMessages,
              [readerId]: [...(s.readerChatMessages[readerId] || []), message],
            },
          })),
        updateReaderChatMessage: (readerId, messageId, updates) =>
          set((s) => ({
            readerChatMessages: {
              ...s.readerChatMessages,
              [readerId]: (s.readerChatMessages[readerId] || []).map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
            },
          })),
        setExecutiveState: (executiveId, state) =>
          set((s) => {
            const newMap = new Map(s.executiveStates);
            const existing = newMap.get(executiveId) || { executiveId, executiveName: '', status: 'evaluating' as const };
            newMap.set(executiveId, { ...existing, ...state } as ExecutiveStreamState);
            return { executiveStates: newMap };
          }),
        clearExecutiveStates: () => set({ executiveStates: new Map() }),
        setHydratingScoutState: (hydrating) => set({ isHydratingScoutState: hydrating }),

        // ============ UI STATE ============
        sidebarOpen: true,
        expandedReaders: [],
        showCalibration: true,
        isStudioConfigOpen: false,
        previousTab: null,
        // US-003: Session preference - NOT persisted, resets on refresh
        skipProjectSwitchConfirm: false,

        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        openStudioConfig: () =>
          set((state) => ({
            isStudioConfigOpen: true,
            previousTab: state.activeTab,
          })),
        closeStudioConfig: () =>
          set((state) => ({
            isStudioConfigOpen: false,
            activeTab: state.previousTab || 'home',
            previousTab: null,
          })),
        toggleReaderExpanded: (readerId) =>
          set((state) => ({
            expandedReaders: state.expandedReaders.includes(readerId)
              ? state.expandedReaders.filter((id) => id !== readerId)
              : [...state.expandedReaders, readerId],
          })),
        toggleCalibration: () =>
          set((state) => ({ showCalibration: !state.showCalibration })),
        expandAllReaders: () =>
          set((state) => ({
            expandedReaders: state.readerPerspectives.map((p) => p.readerId),
          })),
        collapseAllReaders: () => set({ expandedReaders: [] }),
        setSkipProjectSwitchConfirm: (skip) => set({ skipProjectSwitchConfirm: skip }),

        // ============ DRAFT VERSIONING STATE ============
        coverageViewingDraftId: null,
        focusViewingDraftId: null,

        setCoverageViewingDraft: (draftId) => set({ coverageViewingDraftId: draftId }),
        setFocusViewingDraft: (draftId) => set({ focusViewingDraftId: draftId }),
      }),
      {
        name: 'bullseye-storage',
        partialize: (state) => ({
          // Only persist UI preferences to localStorage.
          // SCOUT analysis state (readerStates, focusGroupMessages, executiveStates,
          // rightPanelMode) is intentionally EXCLUDED — it is always hydrated fresh
          // from the database on project select (see scout-chat.tsx hydration effect)
          // to ensure multi-device access shows the latest state.
          studios: state.studios,
          currentStudio: state.currentStudio,
          projects: state.projects,
          activeTab: state.activeTab,
          showCalibration: state.showCalibration,
        }),
      }
    )
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectCurrentStudio = (state: AppStore) => state.currentStudio;
export const selectStudios = (state: AppStore) => state.studios;
export const selectStudioProjects = (state: AppStore) =>
  state.projects.filter((p) => p.studioId === state.currentStudio?.id);
export const selectCurrentProject = (state: AppStore) => state.currentProject;
export const selectCurrentDraft = (state: AppStore) => state.currentDraft;
export const selectIsAnalyzing = (state: AppStore) => state.isAnalyzing;
export const selectAnalysisProgress = (state: AppStore) => state.analysisProgress;
export const selectDeliverable = (state: AppStore) => state.currentDeliverable;
export const selectReaderPerspectives = (state: AppStore) => state.readerPerspectives;
export const selectFocusGroupMessages = (state: AppStore) => state.focusMessages;
export const selectExecutiveEvaluations = (state: AppStore) => state.evaluations;
