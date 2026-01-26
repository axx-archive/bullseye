// Agent Type Definitions for Claude Agent SDK Integration
import { z } from 'zod';

// ============================================
// AGENT DEFINITIONS
// ============================================

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  model: 'sonnet' | 'haiku' | 'opus';
  systemPrompt: string;
  tools?: string[];
  outputSchema?: z.ZodSchema;
}

// ============================================
// READER ANALYSIS OUTPUT SCHEMA
// ============================================

// Helper to convert numeric score (0-100) to enum rating
function numericToRating(value: unknown): 'excellent' | 'very_good' | 'good' | 'so_so' | 'not_good' {
  // If already a valid string, return it
  if (typeof value === 'string') {
    const validRatings = ['excellent', 'very_good', 'good', 'so_so', 'not_good'] as const;
    if (validRatings.includes(value as typeof validRatings[number])) {
      return value as typeof validRatings[number];
    }
  }
  // Convert numeric to rating
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 'good'; // Default fallback
  if (num >= 85) return 'excellent';
  if (num >= 70) return 'very_good';
  if (num >= 55) return 'good';
  if (num >= 40) return 'so_so';
  return 'not_good';
}

// Preprocessor that coerces numeric values to enum strings
const ratingSchema = z.preprocess(
  numericToRating,
  z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good'])
);

export const ReaderAnalysisSchema = z.object({
  scores: z.object({
    premise: ratingSchema,
    character: ratingSchema,
    dialogue: ratingSchema,
    structure: ratingSchema,
    commerciality: ratingSchema,
    overall: ratingSchema,
    premiseNumeric: z.number().min(0).max(100),
    characterNumeric: z.number().min(0).max(100),
    dialogueNumeric: z.number().min(0).max(100),
    structureNumeric: z.number().min(0).max(100),
    commercialityNumeric: z.number().min(0).max(100),
    overallNumeric: z.number().min(0).max(100),
  }),
  recommendation: z.enum(['recommend', 'consider', 'low_consider', 'pass']),
  keyStrengths: z.array(z.string()).min(2).max(4),
  keyConcerns: z.array(z.string()).min(2).max(4),
  standoutQuote: z.string(),
  evidenceStrength: z.number().min(0).max(100),

  // Full analysis sections for harmonization
  premiseAnalysis: z.string(),
  characterAnalysis: z.string(),
  dialogueAnalysis: z.string(),
  structureAnalysis: z.string(),
  commercialityAnalysis: z.string(),
  overallAssessment: z.string(),
});

export type ReaderAnalysisOutput = z.infer<typeof ReaderAnalysisSchema>;

// ============================================
// HARMONIZATION OUTPUT SCHEMA
// ============================================

export const HarmonizationSchema = z.object({
  harmonizedScores: z.object({
    premise: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
    character: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
    dialogue: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
    structure: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
    commerciality: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
    overall: z.object({
      rating: z.enum(['excellent', 'very_good', 'good', 'so_so', 'not_good']),
      numeric: z.number(),
      percentile: z.number(),
    }),
  }),

  coverage: z.object({
    logline: z.string(),
    synopsis: z.string(),
    premiseAnalysis: z.string(),
    characterAnalysis: z.string(),
    dialogueAnalysis: z.string(),
    structureAnalysis: z.string(),
    commercialityAnalysis: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    overallAssessment: z.string(),
  }),

  scoutAnalysis: z.object({
    consensusPoints: z.array(z.string()),
    divergencePoints: z.array(z.object({
      topic: z.string(),
      positions: z.array(z.object({
        readerId: z.string(),
        readerName: z.string(),
        position: z.string(),
      })),
      scoutTake: z.string(),
    })),
    synthesisNarrative: z.string(),
    confidenceLevel: z.enum(['high', 'medium', 'low']),
    watchOuts: z.array(z.string()),
  }),
});

export type HarmonizationOutput = z.infer<typeof HarmonizationSchema>;

// ============================================
// EXECUTIVE EVALUATION SCHEMA
// ============================================

export const ExecutiveEvaluationSchema = z.object({
  verdict: z.enum(['pursue', 'pass']),
  confidence: z.number().min(0).max(100),
  rationale: z.string(),
  keyFactors: z.array(z.string()),
  concerns: z.array(z.string()),
  citedElements: z.array(z.string()),
});

export type ExecutiveEvaluationOutput = z.infer<typeof ExecutiveEvaluationSchema>;

// ============================================
// FOCUS GROUP MESSAGE SCHEMA
// ============================================

export const FocusGroupTurnSchema = z.object({
  speaker: z.string(),
  speakerType: z.enum(['moderator', 'reader']),
  readerId: z.string().optional(),
  content: z.string(),
  topic: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
});

export type FocusGroupTurn = z.infer<typeof FocusGroupTurnSchema>;

// ============================================
// MEMORY NARRATIVE SCHEMA
// ============================================

export const MemoryNarrativeSchema = z.object({
  narrativeSummary: z.string(),
  evolutionNotes: z.string().optional(),
});

export type MemoryNarrativeOutput = z.infer<typeof MemoryNarrativeSchema>;
