// BULLSEYE Executive Pitch Simulation
// Simulates executive evaluations based on coverage

import type Anthropic from '@anthropic-ai/sdk';
import type { ExecutiveEvaluationResult, CoverageReport, HarmonizedScores, ExecutiveVerdict } from '@/types';
import { ExecutiveEvaluationSchema } from '../agents/types';

function getAnthropicClient(): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnthropicSDK = require('@anthropic-ai/sdk').default;
  return new AnthropicSDK();
}

// ============================================
// EXECUTIVE PROFILES
// ============================================

export interface ExecutiveProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  avatar?: string;

  filmography: string[];
  trackRecordSummary: string;

  evaluationStyle: string;
  priorityFactors: string[];
  dealBreakers: string[];

  recentTradeContext?: string[];
}

// Default executive profiles
export const DEFAULT_EXECUTIVES: ExecutiveProfile[] = [
  {
    id: 'exec-streaming-chief',
    name: 'Alexandra Sterling',
    title: 'Head of Content',
    company: 'Major Streaming Platform',
    filmography: [
      'Oversaw acquisition of 200+ original films',
      'Launched award-winning limited series division',
      'Previously ran indie film division at major studio',
    ],
    trackRecordSummary: `Alexandra built the streaming platform's prestige film division from the ground up.
She's known for championing diverse voices and character-driven narratives. Her hits include
critically acclaimed dramas and unexpected genre crossovers. She's risk-tolerant on creative but
demands strong execution. Budget-conscious but will pay for talent packages that make sense.`,
    evaluationStyle: `Reads coverage thoroughly before meetings. Focuses on character depth and
social relevance. Values scripts that can generate awards buzz while still attracting mainstream
audiences. Quick to pass on generic genre fare but enthusiastic about elevated takes.`,
    priorityFactors: [
      'Character-driven narratives',
      'Diverse voices and perspectives',
      'Awards potential',
      'Strong dialogue and performances',
      'Social relevance or timeliness',
    ],
    dealBreakers: [
      'Generic genre execution',
      'Weak female characters',
      'Derivative premises',
      'Purely commercial without depth',
    ],
    recentTradeContext: [
      'Just greenlit three female-directed features',
      'Platform announced focus on "elevated genre" for 2024',
      'Recent hit: A24-style thriller that crossed over mainstream',
    ],
  },
  {
    id: 'exec-studio-producer',
    name: 'Marcus Chen',
    title: 'President of Production',
    company: 'Major Studio',
    filmography: [
      'Produced $2B+ in global box office',
      'Multiple franchise entries',
      'Oscar-winning drama producer',
    ],
    trackRecordSummary: `Marcus rose through development ranks to run production at a major studio.
He balances tentpoles with prestige fare, understanding that both serve the ecosystem.
Known for having strong story instincts and being direct but respectful in notes sessions.
Will champion projects he believes in through difficult development cycles.`,
    evaluationStyle: `Focuses on opening weekend potential first, then digs into execution.
Asks "Who's the audience?" and "What's the marketing hook?" early. Appreciates efficiency
in scripts—no wasted scenes. Values structure highly. Will engage deeply with creative
if the commercial case is solid.`,
    priorityFactors: [
      'Clear commercial hook',
      'Strong structure and pacing',
      'Four-quadrant potential or clear audience',
      'Castable lead roles',
      'Visual spectacle or unique world',
    ],
    dealBreakers: [
      'Unclear target audience',
      'Soft second act',
      'Protagonists without clear goals',
      'Budgets that don\'t match commercial potential',
    ],
    recentTradeContext: [
      'Studio seeking mid-budget originals ($30-60M)',
      'Looking for franchise starters in genre space',
      'Recent pivot toward theatrical-first releases',
    ],
  },
  {
    id: 'exec-indie-producer',
    name: 'Samira Okonkwo',
    title: 'Founder & Producer',
    company: 'Boutique Production Company',
    filmography: [
      'Multiple Sundance premieres',
      'Two Spirit Award winners',
      'First-look deal with major streamer',
    ],
    trackRecordSummary: `Samira built her company on discovering new voices and nurturing
writer-directors. She's produced breakout hits on micro-budgets and knows how to maximize
limited resources. Strong relationships with festival programmers and indie distributors.
Passionate advocate for underrepresented storytellers.`,
    evaluationStyle: `Looks for voice first—does the writer have something unique to say?
Then evaluates producibility at low budgets. Values authenticity and specificity over
broad appeal. Comfortable with ambiguity and challenging narratives. Will develop
promising writers even if specific script isn't ready.`,
    priorityFactors: [
      'Distinctive authorial voice',
      'Producible at low budget ($5M or under)',
      'Festival potential',
      'Authenticity and specificity',
      'First-time or emerging talent',
    ],
    dealBreakers: [
      'Generic voice or imitative style',
      'Requires major VFX or action',
      'Too commercial for indie, too niche for studio',
      'Underdeveloped thematic point of view',
    ],
    recentTradeContext: [
      'Just closed financing on horror feature',
      'Looking for elevated thriller for 2025',
      'Seeking diverse writer-director packages',
    ],
  },
];

// ============================================
// EXECUTIVE EVALUATION ENGINE
// ============================================

export class ExecutiveEvaluationEngine {
  /**
   * Run evaluation for a single executive
   */
  async evaluateForExecutive(
    coverage: CoverageReport,
    scores: HarmonizedScores,
    executive: ExecutiveProfile
  ): Promise<ExecutiveEvaluationResult> {
    const systemPrompt = this.buildExecutiveSystemPrompt(executive);
    const evaluationPrompt = this.buildEvaluationPrompt(coverage, scores, executive);

    const response = await getAnthropicClient().messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: evaluationPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from executive evaluation');
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse executive evaluation JSON');
    }

    const parsed = ExecutiveEvaluationSchema.parse(JSON.parse(jsonMatch[0]));

    return {
      executiveId: executive.id,
      executiveName: executive.name,
      executiveTitle: executive.title,
      company: executive.company,
      avatar: executive.avatar,

      verdict: parsed.verdict as ExecutiveVerdict,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      keyFactors: parsed.keyFactors,
      concerns: parsed.concerns,
      groundedInCoverage: true,
      citedElements: parsed.citedElements,
    };
  }

  /**
   * Run evaluations for multiple executives in parallel
   */
  async evaluateForMultipleExecutives(
    coverage: CoverageReport,
    scores: HarmonizedScores,
    executiveIds: string[]
  ): Promise<ExecutiveEvaluationResult[]> {
    const executives = executiveIds
      .map((id) => DEFAULT_EXECUTIVES.find((e) => e.id === id))
      .filter((e): e is ExecutiveProfile => e !== undefined);

    const results = await Promise.all(
      executives.map((exec) => this.evaluateForExecutive(coverage, scores, exec))
    );

    return results;
  }

  /**
   * Stream executive evaluation with real-time output
   */
  async *streamEvaluation(
    coverage: CoverageReport,
    scores: HarmonizedScores,
    executive: ExecutiveProfile
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildExecutiveSystemPrompt(executive);
    const evaluationPrompt = this.buildEvaluationPrompt(coverage, scores, executive);

    const stream = await getAnthropicClient().messages.stream({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: evaluationPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private buildExecutiveSystemPrompt(executive: ExecutiveProfile): string {
    return `You are ${executive.name}, ${executive.title} at ${executive.company}.

YOUR TRACK RECORD:
${executive.trackRecordSummary}

YOUR FILMOGRAPHY HIGHLIGHTS:
${executive.filmography.map((f) => `- ${f}`).join('\n')}

YOUR EVALUATION STYLE:
${executive.evaluationStyle}

YOUR PRIORITIES (what you look for):
${executive.priorityFactors.map((f) => `- ${f}`).join('\n')}

YOUR DEAL BREAKERS (what makes you pass):
${executive.dealBreakers.map((d) => `- ${d}`).join('\n')}

${executive.recentTradeContext ? `CURRENT CONTEXT:\n${executive.recentTradeContext.map((c) => `- ${c}`).join('\n')}` : ''}

IMPORTANT RULES:
1. You can ONLY reference information from the coverage provided
2. Do NOT invent details about the script not in the analysis
3. Be specific about what from the coverage influenced your decision
4. Your verdict must be either "pursue" or "pass"
5. Confidence should reflect how strongly you feel (0-100)`;
  }

  private buildEvaluationPrompt(
    coverage: CoverageReport,
    scores: HarmonizedScores,
    _executive: ExecutiveProfile
  ): string {
    return `Evaluate this script for your slate.

TITLE: ${coverage.title}
AUTHOR: ${coverage.author}
GENRE: ${coverage.genre}
FORMAT: ${coverage.format}
PAGE COUNT: ${coverage.pageCount}

HARMONIZED SCORES:
- Overall: ${scores.overall.rating} (${scores.overall.numeric}/100, ${scores.overall.percentile}th percentile)
- Premise: ${scores.premise.rating} (${scores.premise.numeric}/100)
- Character: ${scores.character.rating} (${scores.character.numeric}/100)
- Dialogue: ${scores.dialogue.rating} (${scores.dialogue.numeric}/100)
- Structure: ${scores.structure.rating} (${scores.structure.numeric}/100)
- Commerciality: ${scores.commerciality.rating} (${scores.commerciality.numeric}/100)

LOGLINE:
${coverage.logline}

SYNOPSIS:
${coverage.synopsis}

PREMISE ANALYSIS:
${coverage.premiseAnalysis}

CHARACTER ANALYSIS:
${coverage.characterAnalysis}

DIALOGUE ANALYSIS:
${coverage.dialogueAnalysis}

STRUCTURE ANALYSIS:
${coverage.structureAnalysis}

COMMERCIALITY ANALYSIS:
${coverage.commercialityAnalysis}

STRENGTHS:
${coverage.strengths.map((s) => `- ${s}`).join('\n')}

WEAKNESSES:
${coverage.weaknesses.map((w) => `- ${w}`).join('\n')}

OVERALL ASSESSMENT:
${coverage.overallAssessment}

---

Based on this coverage, provide your evaluation as JSON:
{
  "verdict": "pursue" | "pass",
  "confidence": 0-100,
  "rationale": "2-3 paragraphs explaining your decision in your voice...",
  "keyFactors": ["What specifically made you decide this way...", ...],
  "concerns": ["What concerns you about the project...", ...],
  "citedElements": ["Specific elements from the coverage you referenced...", ...]
}`;
  }
}

// Export singleton
export const executiveEvaluationEngine = new ExecutiveEvaluationEngine();

// Helper to get executive by ID
export function getExecutiveById(id: string): ExecutiveProfile | undefined {
  return DEFAULT_EXECUTIVES.find((e) => e.id === id);
}
