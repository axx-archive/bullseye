// BULLSEYE Studio Intelligence
// Calibration engine for contextualizing scores against studio history

import type Anthropic from '@anthropic-ai/sdk';
import type {
  ReaderScores,
  Recommendation,
  StudioCalibration,
  ScoreDistributions,
  ProjectSummary,
  HarmonizedScores
} from '@/types';

function getAnthropicClient(): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnthropicSDK = require('@anthropic-ai/sdk').default;
  return new AnthropicSDK();
}

// ============================================
// STUDIO INTELLIGENCE SERVICE
// ============================================

export interface StudioIntelligenceData {
  studioId: string;
  projectSummaries: ProjectSummary[];
  totalProjectsAnalyzed: number;
  scoreDistributions: ScoreDistributions;
  recommendationBreakdown: Record<Recommendation, number>;
  averagesByGenre: Record<string, GenreAverages>;
  topPerformerIds: string[];
  recentTrends?: TrendAnalysis;
  institutionalNarrative?: string;
  genreNarratives: Record<string, string>;
}

export interface GenreAverages {
  premise: number;
  character: number;
  dialogue: number;
  structure: number;
  commerciality: number;
  overall: number;
  projectCount: number;
}

export interface TrendAnalysis {
  period: string;
  insights: string[];
  genreTrends: Record<string, { direction: 'up' | 'down' | 'stable'; change: number }>;
}

// ============================================
// PERCENTILE CALCULATOR
// ============================================

export class PercentileCalculator {
  private distributions: ScoreDistributions;

  constructor(distributions: ScoreDistributions) {
    this.distributions = distributions;
  }

  /**
   * Calculate percentile for a given score in a dimension
   */
  calculatePercentile(dimension: keyof ScoreDistributions, score: number): number {
    const values = this.distributions[dimension];
    if (!values || values.length === 0) return 50; // Default to median if no data

    // Sort values
    const sorted = [...values].sort((a, b) => a - b);

    // Count how many values are below the given score
    const belowCount = sorted.filter((v) => v < score).length;

    // Calculate percentile
    return Math.round((belowCount / sorted.length) * 100);
  }

  /**
   * Calculate all percentiles for harmonized scores
   */
  calculateAllPercentiles(scores: ReaderScores): StudioCalibration {
    return {
      premisePercentile: this.calculatePercentile('premisePercentiles', scores.premiseNumeric),
      characterPercentile: this.calculatePercentile('characterPercentiles', scores.characterNumeric),
      dialoguePercentile: this.calculatePercentile('dialoguePercentiles', scores.dialogueNumeric),
      structurePercentile: this.calculatePercentile('structurePercentiles', scores.structureNumeric),
      commercialityPercentile: this.calculatePercentile('commercialityPercentiles', scores.commercialityNumeric),
      overallPercentile: this.calculatePercentile('overallPercentiles', scores.overallNumeric),
      comparisonNarrative: '',
      similarProjects: [],
      genreContext: '',
    };
  }

  /**
   * Get percentile thresholds for display
   */
  getThresholds(): { top10: number; top25: number; median: number; bottom25: number } {
    const overall = this.distributions.overallPercentiles;
    if (!overall || overall.length === 0) {
      return { top10: 82, top25: 74, median: 65, bottom25: 58 };
    }

    const sorted = [...overall].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      top10: sorted[Math.floor(len * 0.9)] || 82,
      top25: sorted[Math.floor(len * 0.75)] || 74,
      median: sorted[Math.floor(len * 0.5)] || 65,
      bottom25: sorted[Math.floor(len * 0.25)] || 58,
    };
  }
}

// ============================================
// CALIBRATION CONTEXT BUILDER
// ============================================

export class CalibrationContextBuilder {
  /**
   * Build calibration context for reader prompts
   */
  buildCalibrationContext(intelligence: StudioIntelligenceData, genre?: string): string {
    const thresholds = new PercentileCalculator(intelligence.scoreDistributions).getThresholds();

    let context = `STUDIO CALIBRATION CONTEXT:
This studio has analyzed ${intelligence.totalProjectsAnalyzed} projects to date.

Score distribution thresholds (percentile benchmarks):
- Top 10%: Overall score >= ${thresholds.top10}
- Top 25%: Overall score >= ${thresholds.top25}
- Median: Overall score = ${thresholds.median}
- Bottom 25%: Overall score <= ${thresholds.bottom25}

Recommendation breakdown:
- RECOMMEND: ${intelligence.recommendationBreakdown.recommend || 0} projects (${Math.round(((intelligence.recommendationBreakdown.recommend || 0) / intelligence.totalProjectsAnalyzed) * 100)}%)
- CONSIDER: ${intelligence.recommendationBreakdown.consider || 0} projects
- LOW CONSIDER: ${intelligence.recommendationBreakdown.low_consider || 0} projects
- PASS: ${intelligence.recommendationBreakdown.pass || 0} projects
`;

    if (genre && intelligence.averagesByGenre[genre]) {
      const genreAvg = intelligence.averagesByGenre[genre];
      context += `
Genre "${genre}" specific context (${genreAvg.projectCount} projects):
- Average premise score: ${genreAvg.premise.toFixed(1)}
- Average character score: ${genreAvg.character.toFixed(1)}
- Average dialogue score: ${genreAvg.dialogue.toFixed(1)}
- Average structure score: ${genreAvg.structure.toFixed(1)}
- Average commerciality score: ${genreAvg.commerciality.toFixed(1)}
- Average overall score: ${genreAvg.overall.toFixed(1)}
`;
    }

    if (intelligence.recentTrends) {
      context += `
Recent trends (${intelligence.recentTrends.period}):
${intelligence.recentTrends.insights.map((i) => `- ${i}`).join('\n')}
`;
    }

    context += `
SCORING GUIDANCE:
When generating scores, calibrate against these benchmarks.
- "excellent" should place this in the top 10% historically
- "very_good" should place this in the top 10-25%
- "good" should be around median performance
- "so_so" should be below median but not bottom quartile
- "not_good" should be bottom quartile
`;

    return context;
  }

  /**
   * Generate comparison narrative for a specific project
   */
  async generateComparisonNarrative(
    scores: HarmonizedScores,
    genre: string,
    intelligence: StudioIntelligenceData
  ): Promise<string> {
    const percentileCalc = new PercentileCalculator(intelligence.scoreDistributions);
    const thresholds = percentileCalc.getThresholds();

    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 512,
      system: `You are a calibration analyst. Write a brief 2-3 sentence narrative comparing this script's scores to the studio's historical performance.`,
      messages: [
        {
          role: 'user',
          content: `Script scores and percentiles:
- Overall: ${scores.overall.numeric} (${scores.overall.percentile}th percentile)
- Premise: ${scores.premise.numeric} (${scores.premise.percentile}th percentile)
- Character: ${scores.character.numeric} (${scores.character.percentile}th percentile)
- Dialogue: ${scores.dialogue.numeric} (${scores.dialogue.percentile}th percentile)
- Structure: ${scores.structure.numeric} (${scores.structure.percentile}th percentile)
- Commerciality: ${scores.commerciality.numeric} (${scores.commerciality.percentile}th percentile)

Studio thresholds:
- Top 10%: ${thresholds.top10}
- Top 25%: ${thresholds.top25}
- Median: ${thresholds.median}

Genre: ${genre}
${intelligence.averagesByGenre[genre] ? `Genre average overall: ${intelligence.averagesByGenre[genre].overall.toFixed(1)}` : ''}

Write a concise comparison narrative (no JSON, just plain text).`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  }
}

// ============================================
// STUDIO INTELLIGENCE SERVICE
// ============================================

export class StudioIntelligenceService {
  /**
   * Update studio intelligence with a new project
   */
  updateWithProject(
    intelligence: StudioIntelligenceData,
    project: ProjectSummary
  ): StudioIntelligenceData {
    // Add to project summaries
    const updatedSummaries = [...intelligence.projectSummaries, project];

    // Update total count
    const totalProjectsAnalyzed = intelligence.totalProjectsAnalyzed + 1;

    // Update score distributions
    const scoreDistributions = this.updateDistributions(
      intelligence.scoreDistributions,
      project.harmonizedScores
    );

    // Update recommendation breakdown
    const recommendationBreakdown = { ...intelligence.recommendationBreakdown };
    recommendationBreakdown[project.recommendation] =
      (recommendationBreakdown[project.recommendation] || 0) + 1;

    // Update genre averages
    const averagesByGenre = this.updateGenreAverages(
      intelligence.averagesByGenre,
      project.genre,
      project.harmonizedScores
    );

    // Update top performers
    const topPerformerIds = this.updateTopPerformers(
      updatedSummaries,
      intelligence.topPerformerIds
    );

    return {
      ...intelligence,
      projectSummaries: updatedSummaries,
      totalProjectsAnalyzed,
      scoreDistributions,
      recommendationBreakdown,
      averagesByGenre,
      topPerformerIds,
    };
  }

  /**
   * Generate initial studio intelligence for a new studio
   */
  initializeStudioIntelligence(studioId: string): StudioIntelligenceData {
    return {
      studioId,
      projectSummaries: [],
      totalProjectsAnalyzed: 0,
      scoreDistributions: {
        premisePercentiles: [],
        characterPercentiles: [],
        dialoguePercentiles: [],
        structurePercentiles: [],
        commercialityPercentiles: [],
        overallPercentiles: [],
      },
      recommendationBreakdown: {
        recommend: 0,
        consider: 0,
        low_consider: 0,
        pass: 0,
      },
      averagesByGenre: {},
      topPerformerIds: [],
      genreNarratives: {},
    };
  }

  /**
   * Generate institutional narrative
   */
  async generateInstitutionalNarrative(
    intelligence: StudioIntelligenceData
  ): Promise<string> {
    if (intelligence.totalProjectsAnalyzed < 5) {
      return 'Insufficient data for institutional narrative. Analyze more projects to build calibration context.';
    }

    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      system: `You are a studio analyst. Write a concise institutional narrative summarizing the studio's script analysis history.`,
      messages: [
        {
          role: 'user',
          content: `Studio statistics:
- Total projects analyzed: ${intelligence.totalProjectsAnalyzed}
- Recommendations: ${JSON.stringify(intelligence.recommendationBreakdown)}
- Top genres: ${Object.entries(intelligence.averagesByGenre)
            .sort((a, b) => b[1].projectCount - a[1].projectCount)
            .slice(0, 5)
            .map(([genre, avg]) => `${genre} (${avg.projectCount} projects, avg ${avg.overall.toFixed(1)})`)
            .join(', ')}

Write a 3-4 sentence narrative about the studio's script portfolio and standards.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  }

  private updateDistributions(
    existing: ScoreDistributions,
    scores: ReaderScores
  ): ScoreDistributions {
    return {
      premisePercentiles: [...existing.premisePercentiles, scores.premiseNumeric],
      characterPercentiles: [...existing.characterPercentiles, scores.characterNumeric],
      dialoguePercentiles: [...existing.dialoguePercentiles, scores.dialogueNumeric],
      structurePercentiles: [...existing.structurePercentiles, scores.structureNumeric],
      commercialityPercentiles: [...existing.commercialityPercentiles, scores.commercialityNumeric],
      overallPercentiles: [...existing.overallPercentiles, scores.overallNumeric],
    };
  }

  private updateGenreAverages(
    existing: Record<string, GenreAverages>,
    genre: string,
    scores: ReaderScores
  ): Record<string, GenreAverages> {
    const current = existing[genre] || {
      premise: 0,
      character: 0,
      dialogue: 0,
      structure: 0,
      commerciality: 0,
      overall: 0,
      projectCount: 0,
    };

    const count = current.projectCount;
    const newCount = count + 1;

    return {
      ...existing,
      [genre]: {
        premise: (current.premise * count + scores.premiseNumeric) / newCount,
        character: (current.character * count + scores.characterNumeric) / newCount,
        dialogue: (current.dialogue * count + scores.dialogueNumeric) / newCount,
        structure: (current.structure * count + scores.structureNumeric) / newCount,
        commerciality: (current.commerciality * count + scores.commercialityNumeric) / newCount,
        overall: (current.overall * count + scores.overallNumeric) / newCount,
        projectCount: newCount,
      },
    };
  }

  private updateTopPerformers(
    summaries: ProjectSummary[],
    _existingTopIds: string[]
  ): string[] {
    // Sort by overall score and take top 10%
    const sorted = [...summaries].sort(
      (a, b) => b.harmonizedScores.overallNumeric - a.harmonizedScores.overallNumeric
    );
    const top10Percent = Math.max(1, Math.ceil(sorted.length * 0.1));
    return sorted.slice(0, top10Percent).map((p) => p.projectId);
  }
}

// Export singleton
export const studioIntelligenceService = new StudioIntelligenceService();
export const calibrationContextBuilder = new CalibrationContextBuilder();
