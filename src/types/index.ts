// BULLSEYE Type Definitions
// Core types for the Agentic Script Intelligence Platform

// ============================================
// RATING & RECOMMENDATION TYPES
// ============================================

export type Rating = 'excellent' | 'very_good' | 'good' | 'so_so' | 'not_good';
export type Recommendation = 'recommend' | 'consider' | 'low_consider' | 'pass';
export type ExecutiveVerdict = 'pursue' | 'pass';

export const RATING_VALUES: Record<Rating, number> = {
  excellent: 95,
  very_good: 80,
  good: 65,
  so_so: 50,
  not_good: 35,
};

export const RATING_LABELS: Record<Rating, string> = {
  excellent: 'Excellent',
  very_good: 'Very Good',
  good: 'Good',
  so_so: 'So-So',
  not_good: 'Not Good',
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  recommend: 'RECOMMEND',
  consider: 'CONSIDER',
  low_consider: 'LOW CONSIDER',
  pass: 'PASS',
};

// ============================================
// READER SCORES
// ============================================

export interface ReaderScores {
  premise: Rating;
  character: Rating;
  dialogue: Rating;
  structure: Rating;
  commerciality: Rating;
  overall: Rating;

  // Numeric for averaging (0-100)
  premiseNumeric: number;
  characterNumeric: number;
  dialogueNumeric: number;
  structureNumeric: number;
  commercialityNumeric: number;
  overallNumeric: number;
}

export interface HarmonizedScores {
  premise: { rating: Rating; numeric: number; percentile: number };
  character: { rating: Rating; numeric: number; percentile: number };
  dialogue: { rating: Rating; numeric: number; percentile: number };
  structure: { rating: Rating; numeric: number; percentile: number };
  commerciality: { rating: Rating; numeric: number; percentile: number };
  overall: { rating: Rating; numeric: number; percentile: number };
}

// ============================================
// READER PERSPECTIVE
// ============================================

export interface ReaderPerspective {
  readerId: string;
  readerName: string;
  voiceTag: string; // "The Optimist", "The Skeptic", "The Craftsman"
  color: string; // Reader color for UI

  scores: ReaderScores;
  recommendation: Recommendation;

  // Concise POV
  keyStrengths: string[]; // 2-3 bullets
  keyConcerns: string[]; // 2-3 bullets
  standoutQuote: string; // One memorable line from their take

  evidenceStrength: number; // 0-100
}

// ============================================
// COVERAGE & INTAKE REPORTS
// ============================================

export interface CoverageReport {
  // Header
  title: string;
  author: string;
  genre: string;
  format: string;
  pageCount: number;
  coverageDate: string;

  // Logline
  logline: string;

  // Synopsis
  synopsis: string;

  // Analysis sections
  premiseAnalysis: string;
  characterAnalysis: string;
  dialogueAnalysis: string;
  structureAnalysis: string;
  commercialityAnalysis: string;

  // Strengths & Weaknesses
  strengths: string[];
  weaknesses: string[];

  // Overall assessment
  overallAssessment: string;
}

export interface IntakeReport {
  // Basic info
  title: string;
  writtenBy: string;
  submittedBy: string;
  format: string;
  genre: string;
  pageCount: number;

  // Concept
  logline: string;
  compTitles: string[];

  // Market positioning
  targetAudience: string;
  marketPotential: string;
  budgetRange: string;

  // Quick takes
  whatWorks: string[];
  whatNeeds: string[];

  // Recommendation context
  recommendationRationale: string;
}

// ============================================
// SCOUT ANALYSIS
// ============================================

export interface ScoutAnalysis {
  consensusPoints: string[]; // "All three readers praised..."
  divergencePoints: Divergence[]; // Where they disagreed
  synthesisNarrative: string; // Scout's meta-commentary
  confidenceLevel: 'high' | 'medium' | 'low';
  watchOuts: string[]; // Red flags that emerged
}

export interface Divergence {
  topic: string;
  positions: { readerId: string; readerName: string; position: string }[];
  scoutTake: string;
}

// ============================================
// STUDIO CALIBRATION
// ============================================

export interface StudioCalibration {
  premisePercentile: number;
  characterPercentile: number;
  dialoguePercentile: number;
  structurePercentile: number;
  commercialityPercentile: number;
  overallPercentile: number;

  comparisonNarrative: string;
  similarProjects: string[];
  genreContext: string;
}

export interface ScoreDistributions {
  premisePercentiles: number[];
  characterPercentiles: number[];
  dialoguePercentiles: number[];
  structurePercentiles: number[];
  commercialityPercentiles: number[];
  overallPercentiles: number[];
}

export interface ProjectSummary {
  projectId: string;
  title: string;
  genre: string;
  format: string;
  analyzedAt: Date;

  harmonizedScores: ReaderScores;
  recommendation: Recommendation;

  status?: 'passed' | 'pursued' | 'produced';
  userOverride?: boolean;

  keyStrengths: string[];
  keyRisks: string[];
  executiveVerdicts?: ExecVerdictSummary[];
}

export interface ExecVerdictSummary {
  executiveId: string;
  executiveName: string;
  verdict: ExecutiveVerdict;
}

// ============================================
// EXECUTIVE EVALUATION
// ============================================

export interface ExecutiveEvaluationResult {
  executiveId: string;
  executiveName: string;
  executiveTitle: string;
  company: string;
  avatar?: string;

  verdict: ExecutiveVerdict;
  confidence: number; // 0-100

  rationale: string;
  keyFactors: string[];
  concerns: string[];

  groundedInCoverage: boolean;
  citedElements: string[];
}

// ============================================
// FOCUS GROUP
// ============================================

export type ReactionSentiment = 'agrees' | 'disagrees' | 'builds_on';

export interface FocusGroupMessage {
  id: string;
  speakerType: 'moderator' | 'reader' | 'user';
  readerId?: string;
  readerName?: string;
  readerColor?: string;

  content: string;
  topic?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';

  // Reader-to-reader reaction fields
  replyToReaderId?: string;
  replyToReaderName?: string;
  reactionSentiment?: ReactionSentiment;

  timestamp: Date;
  isStreaming?: boolean;
}

export interface FocusGroupSummary {
  sessionId: string;
  topic?: string;

  summary: string;
  consensusPoints: string[];
  divergencePoints: Divergence[];

  messageCount: number;
  duration: number; // seconds
}

// ============================================
// MEMORY TYPES
// ============================================

export interface MemoryItem {
  id: string;
  content: string;
  topic: string;
  source: 'coverage' | 'focus_group' | 'chat';
  importance: 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface FocusGroupItem {
  statement: string;
  topic: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
}

export interface ChatHighlight {
  exchange: string;
  topic: string;
  importance: 'high' | 'medium' | 'low';
  timestamp: Date;
}

export interface ScoreDelta {
  dimension: string;
  previousRating: string;
  currentRating: string;
  previousNumeric: number;
  currentNumeric: number;
  reason: string;
}

// ============================================
// READER PERSONA
// ============================================

export interface ReaderPersonaConfig {
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
  color: string;

  background: string;
  favoriteFilms: string[];
  voiceDescription: string;
  analyticalFocus: string[];

  weights: {
    premise: number;
    character: number;
    dialogue: number;
    structure: number;
    commerciality: number;
  };

  systemPromptBase: string;
}

// ============================================
// DRAFT DELIVERABLE (Complete Package)
// ============================================

export interface DraftDeliverable {
  id: string;
  draftId: string;
  projectId: string;
  createdAt: Date;

  // THE deliverable—one harmonized coverage
  harmonizedCoverage: CoverageReport;
  harmonizedIntake: IntakeReport;
  harmonizedScores: HarmonizedScores;

  // Individual perspectives (NOT full forms)
  readerPerspectives: ReaderPerspective[];

  // Scout's synthesis
  scoutAnalysis: ScoutAnalysis;

  // Calibration context
  studioCalibration: StudioCalibration;

  // Executive evaluations (if run)
  executiveEvaluations?: ExecutiveEvaluationResult[];
}

// ============================================
// STUDIO TYPES
// ============================================

export interface Studio {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  projects?: Project[];
}

// ============================================
// PROJECT & DRAFT TYPES
// ============================================

export type ProjectFormat =
  | 'FEATURE'
  | 'TV_PILOT'
  | 'TV_EPISODE'
  | 'SHORT'
  | 'LIMITED_SERIES'
  | 'DOCUMENTARY';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
export type EvaluationStatus = 'UNDER_CONSIDERATION' | 'APPROVED' | 'REJECTED';
export type DraftStatus = 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export interface Project {
  id: string;
  title: string;
  logline?: string;
  genre: string;
  format: ProjectFormat;
  status: ProjectStatus;
  evaluationStatus: EvaluationStatus;
  sortOrder: number;
  studioId: string;
  createdAt: Date;
  updatedAt: Date;
  drafts?: Draft[];
}

export interface Draft {
  id: string;
  projectId: string;
  draftNumber: number;
  scriptUrl: string;
  scriptText?: string;
  pageCount?: number;
  notes?: string;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
  deliverable?: DraftDeliverable;
}

// ============================================
// AGENT TYPES
// ============================================

export type AgentType = 'SCOUT' | 'READER' | 'EXECUTIVE' | 'MODERATOR';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentType?: AgentType;
  readerId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

// ============================================
// ANALYSIS FLOW
// ============================================

export interface AnalysisRequest {
  projectId: string;
  draftId: string;
  scriptText: string;
  readerIds: string[];
  runFocusGroup?: boolean;
  runExecutiveEval?: boolean;
  executiveIds?: string[];
}

export interface AnalysisProgress {
  stage: 'starting' | 'readers' | 'harmonizing' | 'focus_group' | 'executive' | 'complete' | 'failed';
  progress: number; // 0-100
  currentReader?: string;
  message?: string;
  error?: string;
}

// ============================================
// UI STATE TYPES
// ============================================

export interface TabState {
  activeTab: 'home' | 'scout' | 'coverage' | 'focus' | 'revisions' | 'pitch' | 'studio';
}

export interface CoverageViewState {
  expandedReaders: string[];
  showCalibration: boolean;
  compareMode: boolean;
}

export interface FocusViewState {
  activeSessionId?: string;
  selectedReaderId?: string; // For 1:1 chat
  isLive: boolean;
}
