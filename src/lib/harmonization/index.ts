// BULLSEYE Harmonization Engine
// Synthesizes multiple reader analyses into unified coverage

import type {
  ReaderPerspective,
  ReaderScores,
  HarmonizedScores,
  CoverageReport,
  IntakeReport,
  ScoutAnalysis,
  Divergence,
  Rating,
  Recommendation,
  StudioCalibration,
} from '@/types';
import { RATING_VALUES } from '@/types';
import type { ReaderAnalysisOutput } from '../agents/types';
import { getReaderById } from '../agents/reader-personas';
import { PercentileCalculator, type StudioIntelligenceData } from '../studio-intelligence';

// ============================================
// SCORE HARMONIZATION
// ============================================

export function harmonizeScores(
  perspectives: ReaderPerspective[],
  studioIntelligence?: StudioIntelligenceData
): HarmonizedScores {
  if (perspectives.length === 0) {
    throw new Error('No perspectives to harmonize');
  }

  // Calculate weighted averages based on evidence strength
  const totalWeight = perspectives.reduce((sum, p) => sum + p.evidenceStrength, 0);

  const dimensions = ['premise', 'character', 'dialogue', 'structure', 'commerciality', 'overall'] as const;

  const result: Record<string, { rating: Rating; numeric: number; percentile: number }> = {};

  for (const dim of dimensions) {
    const numericKey = `${dim}Numeric` as keyof ReaderScores;

    // Weighted average of numeric scores
    let weightedSum = 0;
    for (const p of perspectives) {
      const numericValue = p.scores[numericKey] as number;
      weightedSum += numericValue * p.evidenceStrength;
    }
    const avgNumeric = Math.round(weightedSum / totalWeight);

    // Convert to rating
    const rating = numericToRating(avgNumeric);

    // Calculate percentile if studio intelligence available
    let percentile = 50;
    if (studioIntelligence) {
      const calculator = new PercentileCalculator(studioIntelligence.scoreDistributions);
      const dimKey = `${dim}Percentiles` as keyof typeof studioIntelligence.scoreDistributions;
      percentile = calculator.calculatePercentile(dimKey, avgNumeric);
    }

    result[dim] = { rating, numeric: avgNumeric, percentile };
  }

  return result as unknown as HarmonizedScores;
}

// ============================================
// DIVERGENCE DETECTION
// ============================================

export function detectDivergence(perspectives: ReaderPerspective[]): Divergence[] {
  const divergences: Divergence[] = [];
  const dimensions = ['premise', 'character', 'dialogue', 'structure', 'commerciality', 'overall'] as const;

  for (const dim of dimensions) {
    const numericKey = `${dim}Numeric` as keyof ReaderScores;
    const scores = perspectives.map((p) => ({
      readerId: p.readerId,
      readerName: p.readerName,
      score: p.scores[numericKey] as number,
      rating: p.scores[dim] as Rating,
    }));

    // Check if there's significant divergence (>15 point spread)
    const minScore = Math.min(...scores.map((s) => s.score));
    const maxScore = Math.max(...scores.map((s) => s.score));

    if (maxScore - minScore >= 15) {
      const positions = scores.map((s) => ({
        readerId: s.readerId,
        readerName: s.readerName,
        position: `Rated ${dim} as "${s.rating}" (${s.score}/100)`,
      }));

      divergences.push({
        topic: capitalizeFirst(dim),
        positions,
        scoutTake: generateDivergenceTake(dim, scores),
      });
    }
  }

  // Also check for recommendation divergence
  const recommendations = perspectives.map((p) => ({
    readerId: p.readerId,
    readerName: p.readerName,
    recommendation: p.recommendation,
  }));

  const uniqueRecs = new Set(recommendations.map((r) => r.recommendation));
  if (uniqueRecs.size > 1) {
    divergences.push({
      topic: 'Recommendation',
      positions: recommendations.map((r) => ({
        readerId: r.readerId,
        readerName: r.readerName,
        position: `Recommends "${r.recommendation.toUpperCase()}"`,
      })),
      scoutTake: 'Readers disagree on the overall recommendation, suggesting the script has both notable strengths and significant concerns.',
    });
  }

  return divergences;
}

function generateDivergenceTake(dimension: string, scores: Array<{ readerName: string; score: number }>): string {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  return `${highest.readerName} rated ${dimension} highest (${highest.score}), while ${lowest.readerName} was most critical (${lowest.score}). This ${Math.abs(highest.score - lowest.score)}-point spread suggests ${dimension} is a debatable element that warrants discussion.`;
}

// ============================================
// CONSENSUS DETECTION
// ============================================

export function detectConsensus(perspectives: ReaderPerspective[]): string[] {
  const consensus: string[] = [];
  const dimensions = ['premise', 'character', 'dialogue', 'structure', 'commerciality'] as const;

  for (const dim of dimensions) {
    const ratings = perspectives.map((p) => p.scores[dim]);
    const uniqueRatings = new Set(ratings);

    // If all readers gave the same rating
    if (uniqueRatings.size === 1) {
      const rating = ratings[0];
      consensus.push(`All readers rated ${dim} as "${rating}"`);
    }
    // If all readers are within one tier
    else if (ratingsWithinOneTier(ratings)) {
      const avgRating = getMajorityRating(ratings);
      consensus.push(`All readers generally agree ${dim} is "${avgRating}" tier`);
    }
  }

  // Check for consensus on strengths
  const allStrengths = perspectives.flatMap((p) => p.keyStrengths);
  const strengthCounts = countOccurrences(allStrengths);
  for (const [strength, count] of Object.entries(strengthCounts)) {
    if (count >= perspectives.length - 1) {
      consensus.push(`Most readers praised: "${strength}"`);
    }
  }

  // Check for consensus on concerns
  const allConcerns = perspectives.flatMap((p) => p.keyConcerns);
  const concernCounts = countOccurrences(allConcerns);
  for (const [concern, count] of Object.entries(concernCounts)) {
    if (count >= perspectives.length - 1) {
      consensus.push(`Most readers noted concern: "${concern}"`);
    }
  }

  return consensus;
}

// ============================================
// COVERAGE SYNTHESIS
// ============================================

export function synthesizeCoverage(
  perspectives: ReaderPerspective[],
  readerAnalyses: Map<string, ReaderAnalysisOutput>,
  metadata: {
    title: string;
    author: string;
    genre: string;
    format: string;
    pageCount: number;
  }
): CoverageReport {
  // Get analyses from all readers
  const analyses = Array.from(readerAnalyses.values());

  // Synthesize each section by combining perspectives
  const premiseAnalysis = synthesizeSection(
    'premise',
    perspectives,
    analyses.map((a) => a.premiseAnalysis)
  );

  const characterAnalysis = synthesizeSection(
    'character',
    perspectives,
    analyses.map((a) => a.characterAnalysis)
  );

  const dialogueAnalysis = synthesizeSection(
    'dialogue',
    perspectives,
    analyses.map((a) => a.dialogueAnalysis)
  );

  const structureAnalysis = synthesizeSection(
    'structure',
    perspectives,
    analyses.map((a) => a.structureAnalysis)
  );

  const commercialityAnalysis = synthesizeSection(
    'commerciality',
    perspectives,
    analyses.map((a) => a.commercialityAnalysis)
  );

  // Collect and deduplicate strengths/weaknesses
  const allStrengths = perspectives.flatMap((p) => p.keyStrengths);
  const allWeaknesses = perspectives.flatMap((p) => p.keyConcerns);

  const strengths = deduplicateStrings(allStrengths);
  const weaknesses = deduplicateStrings(allWeaknesses);

  // Synthesize logline (take the most concise compelling one)
  const logline = synthesizeLogline(analyses);

  // Synthesize synopsis
  const synopsis = synthsizeSynopsis(analyses);

  // Overall assessment
  const overallAssessment = synthesizeOverall(perspectives, analyses);

  return {
    title: metadata.title,
    author: metadata.author,
    genre: metadata.genre,
    format: metadata.format,
    pageCount: metadata.pageCount,
    coverageDate: new Date().toISOString().split('T')[0],

    logline,
    synopsis,

    premiseAnalysis,
    characterAnalysis,
    dialogueAnalysis,
    structureAnalysis,
    commercialityAnalysis,

    strengths,
    weaknesses,

    overallAssessment,
  };
}

function synthesizeSection(
  dimension: string,
  perspectives: ReaderPerspective[],
  analyses: string[]
): string {
  // Combine analyses with attribution
  const combined = perspectives.map((p, i) => {
    const analysis = analyses[i] || '';
    return `From ${p.readerName} (${p.voiceTag}): ${analysis}`;
  });

  // For now, join with clear attribution
  // In production, you'd use LLM to synthesize naturally
  return combined.join('\n\n');
}

function synthesizeLogline(analyses: ReaderAnalysisOutput[]): string {
  // Use the first available logline or generate a placeholder
  // In production, this would be LLM-synthesized
  return 'A compelling story that explores themes of identity and redemption through the lens of [genre-specific elements].';
}

function synthsizeSynopsis(analyses: ReaderAnalysisOutput[]): string {
  // Placeholder - would be LLM synthesized in production
  return 'Synopsis would be generated by synthesizing reader analyses into a cohesive narrative summary.';
}

function synthesizeOverall(
  perspectives: ReaderPerspective[],
  analyses: ReaderAnalysisOutput[]
): string {
  const assessments = analyses.map((a, i) => {
    const p = perspectives[i];
    return `${p?.readerName || 'Reader'} (${p?.voiceTag || 'Unknown'}): ${a.overallAssessment}`;
  });

  return assessments.join('\n\n');
}

// ============================================
// INTAKE SYNTHESIS
// ============================================

export function synthesizeIntake(
  coverage: CoverageReport,
  harmonizedScores: HarmonizedScores,
  perspectives: ReaderPerspective[]
): IntakeReport {
  // Determine consensus recommendation
  const recommendations = perspectives.map((p) => p.recommendation);
  const recommendationCounts = countOccurrences(recommendations);
  const topRec = Object.entries(recommendationCounts).sort((a, b) => b[1] - a[1])[0][0] as Recommendation;

  return {
    title: coverage.title,
    writtenBy: coverage.author,
    submittedBy: 'Via BULLSEYE Analysis',
    format: coverage.format,
    genre: coverage.genre,
    pageCount: coverage.pageCount,

    logline: coverage.logline,
    compTitles: [], // Would be generated by LLM

    targetAudience: inferTargetAudience(coverage.genre, harmonizedScores),
    marketPotential: inferMarketPotential(harmonizedScores),
    budgetRange: inferBudgetRange(coverage.format),

    whatWorks: coverage.strengths.slice(0, 3),
    whatNeeds: coverage.weaknesses.slice(0, 3),

    recommendationRationale: generateRecommendationRationale(topRec, perspectives),
  };
}

function inferTargetAudience(genre: string, scores: HarmonizedScores): string {
  const commercial = scores.commerciality.numeric;

  if (commercial >= 80) {
    return `Broad mainstream audience with strong ${genre.toLowerCase()} appeal`;
  } else if (commercial >= 65) {
    return `Core ${genre.toLowerCase()} fans with crossover potential`;
  } else {
    return `Niche ${genre.toLowerCase()} enthusiasts and festival audiences`;
  }
}

function inferMarketPotential(scores: HarmonizedScores): string {
  const overall = scores.overall.numeric;

  if (overall >= 85) {
    return 'High - Strong commercial and critical potential';
  } else if (overall >= 70) {
    return 'Moderate to High - Solid foundation with room for development';
  } else if (overall >= 55) {
    return 'Moderate - Requires significant development to reach potential';
  } else {
    return 'Limited - Fundamental challenges need addressing';
  }
}

function inferBudgetRange(format: string): string {
  switch (format.toUpperCase()) {
    case 'FEATURE':
      return '$15M - $50M (Mid-budget feature)';
    case 'TV_PILOT':
      return '$3M - $8M per episode (Premium cable/streaming)';
    case 'LIMITED_SERIES':
      return '$20M - $60M total (6-8 episodes)';
    default:
      return 'TBD based on creative execution';
  }
}

function generateRecommendationRationale(
  recommendation: Recommendation,
  perspectives: ReaderPerspective[]
): string {
  const supporting = perspectives.filter((p) => p.recommendation === recommendation);
  const dissenting = perspectives.filter((p) => p.recommendation !== recommendation);

  let rationale = `${supporting.length} of ${perspectives.length} readers recommend "${recommendation.toUpperCase()}". `;

  if (supporting.length > 0) {
    rationale += `Key factors: ${supporting[0].keyStrengths.slice(0, 2).join(', ')}. `;
  }

  if (dissenting.length > 0) {
    rationale += `Dissenting view from ${dissenting[0].readerName}: primary concern is ${dissenting[0].keyConcerns[0]}.`;
  }

  return rationale;
}

// ============================================
// SCOUT ANALYSIS GENERATION
// ============================================

export function generateScoutAnalysis(
  perspectives: ReaderPerspective[],
  harmonizedScores: HarmonizedScores
): ScoutAnalysis {
  const consensusPoints = detectConsensus(perspectives);
  const divergencePoints = detectDivergence(perspectives);

  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
  if (divergencePoints.length >= 3) {
    confidenceLevel = 'low';
  } else if (divergencePoints.length >= 1) {
    confidenceLevel = 'medium';
  }

  // Generate watch-outs
  const watchOuts: string[] = [];

  // Low structure score is always a watch-out
  if (harmonizedScores.structure.numeric < 60) {
    watchOuts.push('Structural issues may require significant revision');
  }

  // High divergence on commerciality
  const commercialDivergence = divergencePoints.find((d) => d.topic === 'Commerciality');
  if (commercialDivergence) {
    watchOuts.push('Readers disagree on commercial viability - validate with market research');
  }

  // If any reader gave a PASS
  const passVotes = perspectives.filter((p) => p.recommendation === 'pass');
  if (passVotes.length > 0) {
    watchOuts.push(`${passVotes[0].readerName} recommends PASS - review their specific concerns`);
  }

  const synthesisNarrative = generateSynthesisNarrative(
    perspectives,
    harmonizedScores,
    consensusPoints,
    divergencePoints
  );

  return {
    consensusPoints,
    divergencePoints,
    synthesisNarrative,
    confidenceLevel,
    watchOuts,
  };
}

function generateSynthesisNarrative(
  perspectives: ReaderPerspective[],
  scores: HarmonizedScores,
  consensus: string[],
  divergence: Divergence[]
): string {
  const overall = scores.overall;

  let narrative = `This script scored in the ${overall.percentile}th percentile overall (${overall.numeric}/100). `;

  if (consensus.length >= 3) {
    narrative += `The readers showed strong alignment, particularly on ${consensus.slice(0, 2).join(' and ')}. `;
  } else if (divergence.length >= 2) {
    narrative += `Notable disagreement emerged on ${divergence.map((d) => d.topic).join(' and ')}, suggesting these elements warrant further discussion. `;
  }

  // Highlight standout scores
  const dimensions = ['premise', 'character', 'dialogue', 'structure', 'commerciality'] as const;
  const standouts = dimensions
    .filter((d) => scores[d].percentile >= 75)
    .map((d) => `${d} (${scores[d].percentile}th percentile)`);

  if (standouts.length > 0) {
    narrative += `Standout areas: ${standouts.join(', ')}. `;
  }

  // Flag weak areas
  const weakAreas = dimensions
    .filter((d) => scores[d].percentile <= 25)
    .map((d) => d);

  if (weakAreas.length > 0) {
    narrative += `Areas needing attention: ${weakAreas.join(', ')}.`;
  }

  return narrative;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function numericToRating(numeric: number): Rating {
  if (numeric >= 90) return 'excellent';
  if (numeric >= 75) return 'very_good';
  if (numeric >= 60) return 'good';
  if (numeric >= 45) return 'so_so';
  return 'not_good';
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function ratingsWithinOneTier(ratings: Rating[]): boolean {
  const ratingOrder: Rating[] = ['not_good', 'so_so', 'good', 'very_good', 'excellent'];
  const indices = ratings.map((r) => ratingOrder.indexOf(r));
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return max - min <= 1;
}

function getMajorityRating(ratings: Rating[]): Rating {
  const counts = countOccurrences(ratings);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as Rating;
}

function countOccurrences<T extends string>(arr: T[]): Record<T, number> {
  return arr.reduce(
    (acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    },
    {} as Record<T, number>
  );
}

function deduplicateStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of arr) {
    const normalized = item.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(item);
    }
  }

  return result;
}
