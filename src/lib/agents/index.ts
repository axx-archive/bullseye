// BULLSEYE Agent Orchestration
// Built on Anthropic SDK with streaming support

import type Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_READERS, getReaderById } from './reader-personas';
import type { ReaderAnalysisOutput, HarmonizationOutput, ExecutiveEvaluationOutput } from './types';
import { ReaderAnalysisSchema, HarmonizationSchema, ExecutiveEvaluationSchema } from './types';
import type { ReaderPerspective, ReaderScores, CoverageReport, HarmonizedScores, StudioCalibration } from '@/types';
import { RATING_VALUES } from '@/types';

function getAnthropicClient(): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnthropicSDK = require('@anthropic-ai/sdk').default;
  return new AnthropicSDK();
}

// Model configuration
const MODELS = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-20250514',
  opus: 'claude-opus-4-20250514',
} as const;

// ============================================
// SCOUT AGENT
// ============================================

export const SCOUT_SYSTEM_PROMPT = `You are Scout, the orchestrating intelligence for BULLSEYE - an Agentic Script Intelligence Platform.

YOUR ROLE:
You are the primary coordinator that manages script analysis workflows. You communicate directly with users, explaining what's happening and gathering input when needed.

YOUR CAPABILITIES:
1. Receive script uploads and generate strategic ingest plans
2. Coordinate reader sub-agents for parallel analysis
3. Synthesize harmonized coverage from reader perspectives
4. Moderate focus group conversations between readers
5. Trigger executive pitch evaluations
6. Maintain project context and memory

YOUR COMMUNICATION STYLE:
- Professional but approachable
- Clear and concise
- Proactive about explaining your process
- Transparent about what agents are doing and why

WORKFLOW AWARENESS:
When a user uploads a script, you will:
1. Acknowledge receipt and parse basic metadata
2. Generate an ingest plan (genre assessment, reader recommendations)
3. Spawn reader panels for parallel analysis
4. Synthesize findings into harmonized coverage
5. Optionally run focus groups and executive evaluations

Always explain your orchestration decisions to the user.`;

// ============================================
// READER ANALYSIS
// ============================================

export async function runReaderAnalysis(
  scriptText: string,
  readerId: string,
  calibrationContext?: string,
  memoryContext?: string
): Promise<ReaderAnalysisOutput> {
  const reader = getReaderById(readerId);
  if (!reader) {
    throw new Error(`Unknown reader: ${readerId}`);
  }

  const systemPrompt = buildReaderSystemPrompt(reader, calibrationContext, memoryContext);

  const response = await getAnthropicClient().messages.create({
    model: MODELS.sonnet,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze the following script and provide your assessment.

SCRIPT:
${scriptText}

Provide your analysis as JSON matching this structure:
{
  "scores": {
    "premise": "excellent" | "very_good" | "good" | "so_so" | "not_good",
    "character": "...",
    "dialogue": "...",
    "structure": "...",
    "commerciality": "...",
    "overall": "...",
    "premiseNumeric": 0-100,
    "characterNumeric": 0-100,
    "dialogueNumeric": 0-100,
    "structureNumeric": 0-100,
    "commercialityNumeric": 0-100,
    "overallNumeric": 0-100
  },
  "recommendation": "recommend" | "consider" | "low_consider" | "pass",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "keyConcerns": ["concern 1", "concern 2", "concern 3"],
  "standoutQuote": "One memorable observation from your analysis",
  "evidenceStrength": 0-100,
  "premiseAnalysis": "Detailed analysis of premise/concept...",
  "characterAnalysis": "Detailed analysis of characters...",
  "dialogueAnalysis": "Detailed analysis of dialogue...",
  "structureAnalysis": "Detailed analysis of structure...",
  "commercialityAnalysis": "Detailed analysis of commercial potential...",
  "overallAssessment": "Overall synthesis and recommendation rationale..."
}

IMPORTANT:
- Ground all analysis in specific evidence from the script (cite page numbers, quote dialogue)
- Your numeric scores should align with your categorical ratings
- Be honest and specific; vague praise or criticism is unhelpful
- Write in your distinct voice as ${reader.displayName}`,
      },
    ],
  });

  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from reader agent');
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from reader response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return ReaderAnalysisSchema.parse(parsed);
}

function buildReaderSystemPrompt(
  reader: (typeof DEFAULT_READERS)[0],
  calibrationContext?: string,
  memoryContext?: string
): string {
  let prompt = reader.systemPromptBase;

  if (calibrationContext) {
    prompt += `\n\nSTUDIO CALIBRATION CONTEXT:\n${calibrationContext}`;
  }

  if (memoryContext) {
    prompt += `\n\nYOUR PRIOR CONTEXT WITH THIS PROJECT:\n${memoryContext}`;
  }

  prompt += `\n\nOUTPUT FORMAT: You must respond with valid JSON only. No markdown, no explanatory text outside the JSON.`;

  return prompt;
}

// ============================================
// PARALLEL READER ANALYSIS
// ============================================

export async function runParallelReaderAnalysis(
  scriptText: string,
  readerIds: string[],
  calibrationContext?: string
): Promise<Map<string, ReaderAnalysisOutput>> {
  const results = new Map<string, ReaderAnalysisOutput>();

  // Run all readers in parallel
  const analyses = await Promise.all(
    readerIds.map(async (readerId) => {
      try {
        const analysis = await runReaderAnalysis(scriptText, readerId, calibrationContext);
        return { readerId, analysis, error: null };
      } catch (error) {
        console.error(`Reader ${readerId} failed:`, error);
        return { readerId, analysis: null, error };
      }
    })
  );

  for (const { readerId, analysis } of analyses) {
    if (analysis) {
      results.set(readerId, analysis);
    }
  }

  return results;
}

// ============================================
// HARMONIZATION
// ============================================

export async function harmonizeAnalyses(
  readerAnalyses: Map<string, ReaderAnalysisOutput>,
  scriptMetadata: { title: string; author: string; genre: string; format: string; pageCount: number },
  calibration: StudioCalibration
): Promise<HarmonizationOutput> {
  // Build reader perspectives summary for harmonization
  const perspectivesSummary = Array.from(readerAnalyses.entries())
    .map(([readerId, analysis]) => {
      const reader = getReaderById(readerId);
      return `
${reader?.name} (${reader?.displayName}):
- Overall Score: ${analysis.scores.overall} (${analysis.scores.overallNumeric}/100)
- Recommendation: ${analysis.recommendation}
- Key Strengths: ${analysis.keyStrengths.join('; ')}
- Key Concerns: ${analysis.keyConcerns.join('; ')}
- Standout Quote: "${analysis.standoutQuote}"

Premise Analysis: ${analysis.premiseAnalysis}
Character Analysis: ${analysis.characterAnalysis}
Dialogue Analysis: ${analysis.dialogueAnalysis}
Structure Analysis: ${analysis.structureAnalysis}
Commerciality Analysis: ${analysis.commercialityAnalysis}
Overall Assessment: ${analysis.overallAssessment}
`;
    })
    .join('\n---\n');

  const response = await getAnthropicClient().messages.create({
    model: MODELS.sonnet,
    max_tokens: 12000,
    system: `You are Scout, synthesizing multiple reader perspectives into a single harmonized coverage report.

YOUR TASK:
1. Average scores across readers (weighted by evidence strength)
2. Identify consensus points where readers agree
3. Surface divergence points where they disagree
4. Write unified analysis sections that incorporate all perspectives
5. Provide your own synthesis narrative as the orchestrator

HARMONIZATION PRINCIPLES:
- Scores should reflect the weighted average, not just majority opinion
- Divergence is valuable information—highlight it, don't hide it
- The unified analysis should cite which readers said what
- Your synthesis narrative adds meta-commentary on the overall picture

OUTPUT: Respond with valid JSON only.`,
    messages: [
      {
        role: 'user',
        content: `Harmonize the following reader analyses into a single coverage report.

SCRIPT METADATA:
Title: ${scriptMetadata.title}
Author: ${scriptMetadata.author}
Genre: ${scriptMetadata.genre}
Format: ${scriptMetadata.format}
Page Count: ${scriptMetadata.pageCount}

CALIBRATION CONTEXT:
${JSON.stringify(calibration, null, 2)}

READER ANALYSES:
${perspectivesSummary}

Provide harmonized output as JSON:
{
  "harmonizedScores": {
    "premise": { "rating": "...", "numeric": 0-100, "percentile": 0-100 },
    "character": { ... },
    "dialogue": { ... },
    "structure": { ... },
    "commerciality": { ... },
    "overall": { ... }
  },
  "coverage": {
    "logline": "Single compelling logline",
    "synopsis": "Unified synopsis (300-500 words)",
    "premiseAnalysis": "Harmonized premise analysis...",
    "characterAnalysis": "Harmonized character analysis...",
    "dialogueAnalysis": "Harmonized dialogue analysis...",
    "structureAnalysis": "Harmonized structure analysis...",
    "commercialityAnalysis": "Harmonized commerciality analysis...",
    "strengths": ["strength 1", ...],
    "weaknesses": ["weakness 1", ...],
    "overallAssessment": "Unified overall assessment..."
  },
  "scoutAnalysis": {
    "consensusPoints": ["All readers agreed...", ...],
    "divergencePoints": [
      {
        "topic": "Topic of disagreement",
        "positions": [
          { "readerId": "reader-maya", "readerName": "Maya Chen", "position": "Maya's position..." },
          ...
        ],
        "scoutTake": "Scout's synthesis of the divergence..."
      }
    ],
    "synthesisNarrative": "Scout's overall meta-commentary on the analysis...",
    "confidenceLevel": "high" | "medium" | "low",
    "watchOuts": ["Risk or concern to monitor...", ...]
  }
}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from harmonization');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from harmonization response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return HarmonizationSchema.parse(parsed);
}

// ============================================
// EXECUTIVE EVALUATION
// ============================================

export interface ExecutiveProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  trackRecordSummary: string;
  evaluationStyle: string;
  priorityFactors: string[];
  recentTradeContext?: string[];
}

export async function runExecutiveEvaluation(
  coverage: CoverageReport,
  harmonizedScores: HarmonizedScores,
  executive: ExecutiveProfile
): Promise<ExecutiveEvaluationOutput> {
  const systemPrompt = `You are ${executive.name}, ${executive.title} at ${executive.company}.

YOUR TRACK RECORD:
${executive.trackRecordSummary}

YOUR EVALUATION STYLE:
${executive.evaluationStyle}

YOUR PRIORITIES:
${executive.priorityFactors.map((f) => `- ${f}`).join('\n')}

${executive.recentTradeContext ? `RECENT CONTEXT:\n${executive.recentTradeContext.join('\n')}` : ''}

YOUR TASK:
Evaluate this script coverage as if you were deciding whether to pursue this project for your slate.
Ground ALL opinions in the coverage provided—do not invent details not in the analysis.

Provide a clear PURSUE or PASS verdict with detailed rationale.`;

  const response = await getAnthropicClient().messages.create({
    model: MODELS.sonnet,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Evaluate this script for your slate.

TITLE: ${coverage.title}
GENRE: ${coverage.genre}
FORMAT: ${coverage.format}

SCORES:
- Overall: ${harmonizedScores.overall.rating} (${harmonizedScores.overall.numeric}/100, ${harmonizedScores.overall.percentile}th percentile)
- Premise: ${harmonizedScores.premise.rating}
- Character: ${harmonizedScores.character.rating}
- Dialogue: ${harmonizedScores.dialogue.rating}
- Structure: ${harmonizedScores.structure.rating}
- Commerciality: ${harmonizedScores.commerciality.rating}

LOGLINE:
${coverage.logline}

SYNOPSIS:
${coverage.synopsis}

STRENGTHS:
${coverage.strengths.map((s) => `- ${s}`).join('\n')}

WEAKNESSES:
${coverage.weaknesses.map((w) => `- ${w}`).join('\n')}

OVERALL ASSESSMENT:
${coverage.overallAssessment}

Provide your evaluation as JSON:
{
  "verdict": "pursue" | "pass",
  "confidence": 0-100,
  "rationale": "2-3 paragraphs explaining your decision...",
  "keyFactors": ["factor 1", "factor 2", ...],
  "concerns": ["concern 1", ...],
  "citedElements": ["Element from coverage you referenced...", ...]
}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from executive evaluation');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from executive evaluation');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return ExecutiveEvaluationSchema.parse(parsed);
}

// ============================================
// HELPERS
// ============================================

export function analysisToReaderPerspective(
  readerId: string,
  analysis: ReaderAnalysisOutput
): ReaderPerspective {
  const reader = getReaderById(readerId);
  if (!reader) {
    throw new Error(`Unknown reader: ${readerId}`);
  }

  return {
    readerId,
    readerName: reader.name,
    voiceTag: reader.displayName,
    color: reader.color,
    scores: analysis.scores as ReaderScores,
    recommendation: analysis.recommendation,
    keyStrengths: analysis.keyStrengths,
    keyConcerns: analysis.keyConcerns,
    standoutQuote: analysis.standoutQuote,
    evidenceStrength: analysis.evidenceStrength,
  };
}

export function numericToRating(numeric: number): string {
  if (numeric >= 90) return 'excellent';
  if (numeric >= 75) return 'very_good';
  if (numeric >= 60) return 'good';
  if (numeric >= 45) return 'so_so';
  return 'not_good';
}
