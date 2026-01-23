'use client';

import { useQuery } from '@tanstack/react-query';
import { draftKeys } from './use-drafts';

// ============================================
// QUERY KEYS
// ============================================

export const studioKeys = {
  studio: ['studio'] as const,
  readers: ['studio', 'readers'] as const,
  executives: ['studio', 'executives'] as const,
  intelligence: ['studio', 'intelligence'] as const,
};

// ============================================
// API RESPONSE TYPES
// ============================================

interface DeliverableResponse {
  id: string;
  draftId: string;
  harmonizedCoverage: unknown;
  harmonizedIntake: unknown;
  harmonizedScores: unknown;
  readerPerspectives: unknown;
  scoutAnalysis: unknown;
  studioCalibration: unknown;
  createdAt: string;
  updatedAt: string;
}

interface FocusSessionMessage {
  id: string;
  sessionId: string;
  speakerType: 'MODERATOR' | 'READER' | 'USER';
  readerId: string | null;
  content: string;
  topic: string | null;
  sentiment: string | null;
  sequenceNumber: number;
  createdAt: string;
}

interface FocusSessionResponse {
  id: string;
  draftId: string;
  topic: string | null;
  status: string;
  moderatorPrompt: string | null;
  questions: string[];
  summary: string | null;
  consensusPoints: string[];
  divergencePoints: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: FocusSessionMessage[];
}

interface ExecutiveProfileData {
  id: string;
  studioId: string;
  name: string;
  title: string;
  company: string;
  avatar: string | null;
  filmography: string[];
  trackRecordSummary: string;
  recentTradeContext: string[];
  tradeContextUpdatedAt: string | null;
  evaluationStyle: string;
  priorityFactors: string[];
  dealBreakers: string[];
  createdAt: string;
  updatedAt: string;
}

interface EvaluationResponse {
  id: string;
  draftId: string;
  executiveId: string;
  verdict: 'PURSUE' | 'PASS';
  confidence: number;
  rationale: string;
  keyFactors: string[];
  concerns: string[];
  groundedInCoverage: boolean;
  citedElements: string[];
  createdAt: string;
  executive: ExecutiveProfileData;
}

interface StudioResponse {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  pov: string | null;
  pillars: string[];
  beliefs: string[];
  mandates: string[];
  createdAt: string;
  updatedAt: string;
  _count: {
    readerPersonas: number;
    projects: number;
  };
}

interface ReaderPersonaResponse {
  id: string;
  studioId: string;
  name: string;
  displayName: string;
  avatar: string | null;
  background: string;
  favoriteFilms: string[];
  voiceDescription: string;
  analyticalFocus: string[];
  premiseWeight: number;
  characterWeight: number;
  dialogueWeight: number;
  structureWeight: number;
  commercialityWeight: number;
  systemPromptBase: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface StudioIntelligenceResponse {
  id: string;
  studioId: string;
  projectSummaries: unknown;
  totalProjectsAnalyzed: number;
  scoreDistributions: unknown;
  recommendationBreakdown: unknown;
  averagesByGenre: unknown;
  topPerformerIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// DRAFT-RELATED HOOKS
// ============================================

export function useDeliverable(draftId: string | null) {
  return useQuery<DeliverableResponse | null>({
    queryKey: draftKeys.deliverable(draftId!),
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/deliverable`);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch deliverable');
      }
      return res.json();
    },
    enabled: !!draftId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFocusSessions(draftId: string | null) {
  return useQuery<FocusSessionResponse[]>({
    queryKey: draftKeys.focusSessions(draftId!),
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/focus-sessions`);
      if (!res.ok) {
        throw new Error('Failed to fetch focus sessions');
      }
      return res.json();
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useEvaluations(draftId: string | null) {
  return useQuery<EvaluationResponse[]>({
    queryKey: draftKeys.evaluations(draftId!),
    queryFn: async () => {
      const res = await fetch(`/api/drafts/${draftId}/evaluations`);
      if (!res.ok) {
        throw new Error('Failed to fetch evaluations');
      }
      return res.json();
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

// ============================================
// STUDIO HOOKS
// ============================================

export function useStudio() {
  return useQuery<StudioResponse>({
    queryKey: studioKeys.studio,
    queryFn: async () => {
      const res = await fetch('/api/studio');
      if (!res.ok) {
        throw new Error('Failed to fetch studio');
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useReaderPersonas() {
  return useQuery<ReaderPersonaResponse[]>({
    queryKey: studioKeys.readers,
    queryFn: async () => {
      const res = await fetch('/api/studio/readers');
      if (!res.ok) {
        throw new Error('Failed to fetch reader personas');
      }
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

export function useExecutiveProfiles() {
  return useQuery<ExecutiveProfileData[]>({
    queryKey: studioKeys.executives,
    queryFn: async () => {
      const res = await fetch('/api/studio/executives');
      if (!res.ok) {
        throw new Error('Failed to fetch executive profiles');
      }
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

export function useStudioIntelligence() {
  return useQuery<StudioIntelligenceResponse | null>({
    queryKey: studioKeys.intelligence,
    queryFn: async () => {
      const res = await fetch('/api/studio/intelligence');
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch studio intelligence');
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
