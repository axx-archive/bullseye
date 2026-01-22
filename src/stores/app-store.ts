// BULLSEYE Application State Store
// Using Zustand for global state management

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
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

export type TabId = 'scout' | 'coverage' | 'focus' | 'revisions' | 'pitch' | 'studio';

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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentType?: 'SCOUT' | 'READER';
  readerId?: string;
  timestamp: Date;
}

interface ChatState {
  chatMessages: ChatMessage[];
  isStreaming: boolean;
  activeAgent: 'scout' | 'reader' | null;
  activeReaderId: string | null;

  addChatMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setActiveAgent: (agent: 'scout' | 'reader' | null, readerId?: string) => void;
  clearChat: () => void;
}

// ============================================
// UI STATE
// ============================================

interface UIState {
  sidebarOpen: boolean;
  expandedReaders: string[];
  showCalibration: boolean;

  toggleSidebar: () => void;
  toggleReaderExpanded: (readerId: string) => void;
  toggleCalibration: () => void;
  expandAllReaders: () => void;
  collapseAllReaders: () => void;
}

// ============================================
// COMBINED STORE
// ============================================

interface AppStore extends TabState, ProjectState, AnalysisState, FocusGroupState, ExecutiveState, ChatState, UIState {}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ============ TAB STATE ============
        activeTab: 'scout' as TabId,
        setActiveTab: (tab) => set({ activeTab: tab }),

        // ============ PROJECT STATE ============
        currentProject: null,
        currentDraft: null,
        projects: [],

        setCurrentProject: (project) => set({ currentProject: project }),
        setCurrentDraft: (draft) => set({ currentDraft: draft }),
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

        // ============ UI STATE ============
        sidebarOpen: true,
        expandedReaders: [],
        showCalibration: true,

        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),
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
      }),
      {
        name: 'bullseye-storage',
        partialize: (state) => ({
          // Only persist certain state
          projects: state.projects,
          activeTab: state.activeTab,
          sidebarOpen: state.sidebarOpen,
          showCalibration: state.showCalibration,
        }),
      }
    )
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectCurrentProject = (state: AppStore) => state.currentProject;
export const selectCurrentDraft = (state: AppStore) => state.currentDraft;
export const selectIsAnalyzing = (state: AppStore) => state.isAnalyzing;
export const selectAnalysisProgress = (state: AppStore) => state.analysisProgress;
export const selectDeliverable = (state: AppStore) => state.currentDeliverable;
export const selectReaderPerspectives = (state: AppStore) => state.readerPerspectives;
export const selectFocusGroupMessages = (state: AppStore) => state.focusMessages;
export const selectExecutiveEvaluations = (state: AppStore) => state.evaluations;
