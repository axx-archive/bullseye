// Studio Intelligence Tools
// Provides calibration context and institutional knowledge
// Now backed by Prisma DB instead of in-memory store

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { db } from '@/lib/db';
import {
  calibrationContextBuilder,
  studioIntelligenceService,
  type StudioIntelligenceData,
  type GenreAverages,
} from '@/lib/studio-intelligence';
import type { ScoreDistributions } from '@/types';

// In-memory cache for studio intelligence (hydrated from DB)
const studioCache = new Map<string, StudioIntelligenceData>();

async function getOrLoadIntelligence(studioId: string): Promise<StudioIntelligenceData> {
  const cached = studioCache.get(studioId);
  if (cached) return cached;

  // Try loading from database
  try {
    const dbRecord = await db.studioIntelligence.findUnique({
      where: { studioId },
    });

    if (dbRecord) {
      // DB stores JSON — cast through unknown to our typed interfaces
      const intelligence: StudioIntelligenceData = {
        studioId: dbRecord.studioId,
        projectSummaries: [],
        totalProjectsAnalyzed: dbRecord.totalProjectsAnalyzed,
        recommendationBreakdown: (dbRecord.recommendationBreakdown as unknown as Record<string, number>) || {},
        averagesByGenre: (dbRecord.averagesByGenre as unknown as Record<string, GenreAverages>) || {},
        scoreDistributions: (dbRecord.scoreDistributions as unknown as ScoreDistributions) || {
          premisePercentiles: [],
          characterPercentiles: [],
          dialoguePercentiles: [],
          structurePercentiles: [],
          commercialityPercentiles: [],
          overallPercentiles: [],
        },
        topPerformerIds: dbRecord.topPerformerIds || [],
        institutionalNarrative: dbRecord.institutionalNarrative || undefined,
        genreNarratives: {},
      };
      studioCache.set(studioId, intelligence);
      return intelligence;
    }
  } catch (error) {
    console.error('Failed to load studio intelligence from DB:', error);
  }

  // Initialize new studio if not found
  const intelligence = studioIntelligenceService.initializeStudioIntelligence(studioId);
  studioCache.set(studioId, intelligence);
  return intelligence;
}

// Update studio intelligence after analysis — called from analysis.ts
export async function updateStudioIntelligence(
  studioId: string,
  harmonizedScores: { overall: { numeric: number }; premise: { numeric: number }; character: { numeric: number }; dialogue: { numeric: number }; structure: { numeric: number }; commerciality: { numeric: number } },
  recommendation: string,
  genre?: string,
  projectId?: string,
): Promise<void> {
  try {
    const intelligence = await getOrLoadIntelligence(studioId);

    // Update totals
    intelligence.totalProjectsAnalyzed += 1;

    // Update recommendation breakdown
    const recKey = recommendation.toLowerCase().includes('recommend') ? 'recommend'
      : recommendation.toLowerCase().includes('consider') ? 'consider'
      : 'pass';
    (intelligence.recommendationBreakdown as Record<string, number>)[recKey] =
      ((intelligence.recommendationBreakdown as Record<string, number>)[recKey] || 0) + 1;

    // Update score distributions (add new scores to percentile arrays)
    intelligence.scoreDistributions.overallPercentiles.push(harmonizedScores.overall.numeric);
    intelligence.scoreDistributions.premisePercentiles.push(harmonizedScores.premise.numeric);
    intelligence.scoreDistributions.characterPercentiles.push(harmonizedScores.character.numeric);
    intelligence.scoreDistributions.dialoguePercentiles.push(harmonizedScores.dialogue.numeric);
    intelligence.scoreDistributions.structurePercentiles.push(harmonizedScores.structure.numeric);
    intelligence.scoreDistributions.commercialityPercentiles.push(harmonizedScores.commerciality.numeric);

    // Update genre averages
    if (genre) {
      const current = intelligence.averagesByGenre[genre] || {
        premise: 0, character: 0, dialogue: 0, structure: 0,
        commerciality: 0, overall: 0, projectCount: 0,
      };
      const count = current.projectCount + 1;
      const updated: GenreAverages = {
        overall: ((current.overall || 0) * current.projectCount + harmonizedScores.overall.numeric) / count,
        premise: ((current.premise || 0) * current.projectCount + harmonizedScores.premise.numeric) / count,
        character: ((current.character || 0) * current.projectCount + harmonizedScores.character.numeric) / count,
        dialogue: ((current.dialogue || 0) * current.projectCount + harmonizedScores.dialogue.numeric) / count,
        structure: ((current.structure || 0) * current.projectCount + harmonizedScores.structure.numeric) / count,
        commerciality: ((current.commerciality || 0) * current.projectCount + harmonizedScores.commerciality.numeric) / count,
        projectCount: count,
      };
      intelligence.averagesByGenre[genre] = updated;
    }

    // Update top performers
    if (projectId && harmonizedScores.overall.numeric >= 75) {
      if (!intelligence.topPerformerIds.includes(projectId)) {
        intelligence.topPerformerIds.push(projectId);
      }
    }

    // Update cache
    studioCache.set(studioId, intelligence);

    // Persist to database — serialize to plain JSON for Prisma's Json fields
    const scoreDistJson = JSON.parse(JSON.stringify(intelligence.scoreDistributions));
    const genreJson = JSON.parse(JSON.stringify(intelligence.averagesByGenre));
    const recJson = JSON.parse(JSON.stringify(intelligence.recommendationBreakdown));

    await db.studioIntelligence.upsert({
      where: { studioId },
      create: {
        studioId,
        totalProjectsAnalyzed: intelligence.totalProjectsAnalyzed,
        recommendationBreakdown: recJson,
        averagesByGenre: genreJson,
        scoreDistributions: scoreDistJson,
        topPerformerIds: intelligence.topPerformerIds,
      },
      update: {
        totalProjectsAnalyzed: intelligence.totalProjectsAnalyzed,
        recommendationBreakdown: recJson,
        averagesByGenre: genreJson,
        scoreDistributions: scoreDistJson,
        topPerformerIds: intelligence.topPerformerIds,
      },
    });
  } catch (error) {
    console.error('Failed to update studio intelligence:', error);
  }
}

export const getCalibrationContextTool = tool(
  'get_calibration_context',
  'Get the studio\'s historical scoring context and percentile benchmarks. Inject this into reader prompts so they can calibrate their scores against the studio\'s track record.',
  {
    studioId: z.string().describe('Studio ID to get calibration for'),
    genre: z.string().optional().describe('Optional genre to get genre-specific benchmarks'),
  },
  async ({ studioId, genre }) => {
    const intelligence = await getOrLoadIntelligence(studioId);
    const context = calibrationContextBuilder.buildCalibrationContext(intelligence, genre);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          studioId,
          totalProjectsAnalyzed: intelligence.totalProjectsAnalyzed,
          calibrationContext: context,
          hasGenreData: genre ? !!intelligence.averagesByGenre[genre] : false,
          recommendationBreakdown: intelligence.recommendationBreakdown,
        }),
      }],
    };
  }
);

export const getStudioIntelligenceTool = tool(
  'get_studio_intelligence',
  'Get the full studio intelligence profile including all historical data, score distributions, genre averages, and top performers.',
  {
    studioId: z.string().describe('Studio ID'),
  },
  async ({ studioId }) => {
    const intelligence = await getOrLoadIntelligence(studioId);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          studioId: intelligence.studioId,
          totalProjectsAnalyzed: intelligence.totalProjectsAnalyzed,
          recommendationBreakdown: intelligence.recommendationBreakdown,
          genres: Object.keys(intelligence.averagesByGenre),
          topPerformerCount: intelligence.topPerformerIds.length,
          institutionalNarrative: intelligence.institutionalNarrative || 'Not enough data yet.',
          hasRecentTrends: !!intelligence.recentTrends,
        }),
      }],
    };
  }
);
