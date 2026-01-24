// BULLSEYE Memory Architecture
// Three-Layer Memory System: Resources (L1), Items (L2), Narratives (L3)

import type Anthropic from '@anthropic-ai/sdk';
import type { MemoryItem, FocusGroupItem, ChatHighlight, ScoreDelta, Rating } from '@/types';

function getAnthropicClient(): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnthropicSDK = require('@anthropic-ai/sdk').default;
  return new AnthropicSDK();
}

// ============================================
// MEMORY TYPES
// ============================================

export interface SubAgentMemory {
  readerId: string;
  projectId: string;
  draftId: string;

  // LAYER 3: Narrative (injected into prompts)
  narrativeSummary: string;
  evolutionNotes?: string;

  // LAYER 2: Items (queryable facts)
  scores: {
    premise: Rating;
    character: Rating;
    dialogue: Rating;
    structure: Rating;
    commerciality: Rating;
    overall: Rating;
    premiseNumeric: number;
    characterNumeric: number;
    dialogueNumeric: number;
    structureNumeric: number;
    commercialityNumeric: number;
    overallNumeric: number;
  };
  recommendation: string;
  keyStrengths: string[];
  keyConcerns: string[];
  evidenceStrength: number;

  focusGroupStatements: FocusGroupItem[];
  chatHighlights: ChatHighlight[];
  scoreDeltas?: ScoreDelta[];

  // LAYER 1: Resource references (archive)
  coverageResourceId?: string;
  focusGroupResourceId?: string;
  chatResourceId?: string;

  // Cross-draft continuity
  priorDraftMemory?: SubAgentMemory;
  lastUpdated: Date;
}

export type MemoryEventType = 'coverage' | 'focus_group' | 'chat';

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// MEMORY WRITE ENGINE
// ============================================

export class MemoryWriteEngine {
  /**
   * Process a new event and update reader memory
   */
  async memorize(
    readerId: string,
    projectId: string,
    draftId: string,
    event: MemoryEvent,
    existingMemory?: SubAgentMemory
  ): Promise<SubAgentMemory> {
    // STAGE 1: Extract Items (L2)
    const newItems = await this.extractItems(event);

    // STAGE 2: Build or update memory structure
    const updatedMemory = this.updateMemoryItems(existingMemory, newItems, event.type);

    // STAGE 3: Evolve Narrative (L3)
    const evolvedNarrative = await this.evolveNarrative(
      existingMemory?.narrativeSummary,
      newItems,
      {
        readerId,
        projectId,
        draftId,
        priorDraftSummary: existingMemory?.priorDraftMemory?.narrativeSummary,
      }
    );

    const defaultScores = {
      premise: 'CONSIDER' as Rating,
      character: 'CONSIDER' as Rating,
      dialogue: 'CONSIDER' as Rating,
      structure: 'CONSIDER' as Rating,
      commerciality: 'CONSIDER' as Rating,
      overall: 'CONSIDER' as Rating,
      premiseNumeric: 50,
      characterNumeric: 50,
      dialogueNumeric: 50,
      structureNumeric: 50,
      commercialityNumeric: 50,
      overallNumeric: 50,
    };

    return {
      readerId,
      projectId,
      draftId,
      narrativeSummary: evolvedNarrative.narrativeSummary,
      evolutionNotes: evolvedNarrative.evolutionNotes,
      scores: updatedMemory.scores ?? defaultScores,
      recommendation: updatedMemory.recommendation ?? 'CONSIDER',
      keyStrengths: updatedMemory.keyStrengths ?? [],
      keyConcerns: updatedMemory.keyConcerns ?? [],
      evidenceStrength: updatedMemory.evidenceStrength ?? 0,
      focusGroupStatements: updatedMemory.focusGroupStatements ?? [],
      chatHighlights: updatedMemory.chatHighlights ?? [],
      scoreDeltas: updatedMemory.scoreDeltas,
      priorDraftMemory: existingMemory?.priorDraftMemory,
      lastUpdated: new Date(),
    };
  }

  /**
   * Extract atomic facts from an event
   */
  private async extractItems(event: MemoryEvent): Promise<MemoryItem[]> {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 2048,
      system: `You are a Memory Item Extractor. Extract atomic facts from the provided content.

OUTPUT FORMAT: JSON array of items:
[
  {
    "content": "The specific fact or observation",
    "topic": "character" | "structure" | "dialogue" | "premise" | "commerciality" | "general",
    "importance": "high" | "medium" | "low"
  }
]

RULES:
- Extract only factual statements, not opinions
- Each item should be self-contained and understandable in isolation
- Prioritize items that represent scoring decisions or specific critiques
- Include page references when available`,
      messages: [
        {
          role: 'user',
          content: `Extract memory items from this ${event.type} event:

${event.content}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    try {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const items = JSON.parse(jsonMatch[0]) as Array<{
        content: string;
        topic: string;
        importance: 'high' | 'medium' | 'low';
      }>;

      return items.map((item, index) => ({
        id: `${event.id}-${index}`,
        content: item.content,
        topic: item.topic,
        source: event.type,
        importance: item.importance,
        timestamp: event.timestamp,
      }));
    } catch {
      console.error('Failed to parse memory items');
      return [];
    }
  }

  /**
   * Update memory items based on event type
   */
  private updateMemoryItems(
    existing: SubAgentMemory | undefined,
    newItems: MemoryItem[],
    eventType: MemoryEventType
  ): Partial<SubAgentMemory> {
    const base: Partial<SubAgentMemory> = existing
      ? { ...existing }
      : {
          scores: {
            premise: 'good',
            character: 'good',
            dialogue: 'good',
            structure: 'good',
            commerciality: 'good',
            overall: 'good',
            premiseNumeric: 65,
            characterNumeric: 65,
            dialogueNumeric: 65,
            structureNumeric: 65,
            commercialityNumeric: 65,
            overallNumeric: 65,
          },
          recommendation: 'consider',
          keyStrengths: [],
          keyConcerns: [],
          evidenceStrength: 50,
          focusGroupStatements: [],
          chatHighlights: [],
        };

    if (eventType === 'focus_group') {
      const newStatements: FocusGroupItem[] = newItems.map((item) => ({
        statement: item.content,
        topic: item.topic,
        sentiment: this.inferSentiment(item.content),
        timestamp: item.timestamp,
      }));
      base.focusGroupStatements = [...(base.focusGroupStatements || []), ...newStatements];
    }

    if (eventType === 'chat') {
      const newHighlights: ChatHighlight[] = newItems
        .filter((item) => item.importance === 'high' || item.importance === 'medium')
        .map((item) => ({
          exchange: item.content,
          topic: item.topic,
          importance: item.importance,
          timestamp: item.timestamp,
        }));
      base.chatHighlights = [...(base.chatHighlights || []), ...newHighlights];
    }

    return base;
  }

  /**
   * Evolve the narrative summary based on new information
   */
  private async evolveNarrative(
    existing: string | undefined,
    newItems: MemoryItem[],
    context: {
      readerId: string;
      projectId: string;
      draftId: string;
      priorDraftSummary?: string;
    }
  ): Promise<{ narrativeSummary: string; evolutionNotes?: string }> {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      system: `You are a Memory Narrative Synthesizer. Update the reader's narrative based on new information.

RULES:
1. UPDATE: If new items conflict with existing narrative, overwrite old facts
2. EVOLVE: If this is a new draft, acknowledge what changed from prior position
3. ADD: If items are new, weave them into the narrative logically
4. MAINTAIN VOICE: Keep it personal and in first person

OUTPUT FORMAT:
{
  "narrativeSummary": "2-4 sentences summarizing this reader's current perspective on the project",
  "evolutionNotes": "Optional: note if position changed significantly from prior draft"
}`,
      messages: [
        {
          role: 'user',
          content: `Evolve the narrative for reader ${context.readerId}.

EXISTING NARRATIVE:
${existing || 'No existing narrative.'}

${context.priorDraftSummary ? `PRIOR DRAFT CONTEXT:\n${context.priorDraftSummary}` : ''}

NEW INFORMATION:
${newItems.map((i) => `- [${i.topic}] ${i.content}`).join('\n')}

Return JSON only.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        narrativeSummary: existing || 'No narrative available.',
      };
    }

    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { narrativeSummary: existing || 'No narrative available.' };
      }
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { narrativeSummary: existing || 'No narrative available.' };
    }
  }

  /**
   * Infer sentiment from content
   */
  private inferSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    const lowerContent = content.toLowerCase();
    const positiveWords = ['excellent', 'strong', 'compelling', 'effective', 'praise', 'works', 'good'];
    const negativeWords = ['weak', 'problem', 'issue', 'concern', 'fails', 'doesn\'t work', 'bad'];

    const positiveCount = positiveWords.filter((w) => lowerContent.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerContent.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}

// ============================================
// MEMORY READ ENGINE
// ============================================

export class MemoryReadEngine {
  /**
   * Get memory context for prompt injection
   */
  getMemoryContext(memory: SubAgentMemory): string {
    if (!memory) return '';

    let context = `YOUR MEMORY OF THIS PROJECT:

NARRATIVE SUMMARY:
${memory.narrativeSummary}
`;

    if (memory.evolutionNotes) {
      context += `\nEVOLUTION FROM PRIOR DRAFT:\n${memory.evolutionNotes}\n`;
    }

    if (memory.focusGroupStatements.length > 0) {
      const recentStatements = memory.focusGroupStatements.slice(-5);
      context += `\nYOUR RECENT FOCUS GROUP STATEMENTS:\n`;
      for (const stmt of recentStatements) {
        context += `- [${stmt.topic}] "${stmt.statement}"\n`;
      }
    }

    if (memory.chatHighlights.length > 0) {
      const recentHighlights = memory.chatHighlights.slice(-3);
      context += `\nRECENT CHAT HIGHLIGHTS:\n`;
      for (const hl of recentHighlights) {
        context += `- [${hl.topic}] ${hl.exchange}\n`;
      }
    }

    if (memory.scoreDeltas && memory.scoreDeltas.length > 0) {
      context += `\nSCORE CHANGES FROM PRIOR DRAFT:\n`;
      for (const delta of memory.scoreDeltas) {
        context += `- ${delta.dimension}: ${delta.previousRating} -> ${delta.currentRating} (${delta.reason})\n`;
      }
    }

    return context;
  }

  /**
   * Query memory for specific topics
   */
  queryByTopic(memory: SubAgentMemory, topic: string): MemoryItem[] {
    const items: MemoryItem[] = [];

    // Search focus group statements
    for (const stmt of memory.focusGroupStatements) {
      if (stmt.topic === topic) {
        items.push({
          id: `fg-${items.length}`,
          content: stmt.statement,
          topic: stmt.topic,
          source: 'focus_group',
          importance: 'medium',
          timestamp: stmt.timestamp,
        });
      }
    }

    // Search chat highlights
    for (const hl of memory.chatHighlights) {
      if (hl.topic === topic) {
        items.push({
          id: `chat-${items.length}`,
          content: hl.exchange,
          topic: hl.topic,
          source: 'chat',
          importance: hl.importance,
          timestamp: hl.timestamp,
        });
      }
    }

    return items;
  }
}

// ============================================
// CONSISTENCY CHECKER
// ============================================

export class ConsistencyChecker {
  /**
   * Validate that a new utterance is consistent with prior statements
   */
  async validateUtterance(
    proposed: string,
    memory: SubAgentMemory,
    topic: string
  ): Promise<{ isConsistent: boolean; reframedContent?: string }> {
    const priorStatements = memory.focusGroupStatements
      .filter((s) => s.topic === topic)
      .map((s) => s.statement);

    if (priorStatements.length === 0) {
      return { isConsistent: true };
    }

    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      system: `You are a Consistency Checker. Determine if a proposed statement contradicts prior statements.

OUTPUT FORMAT:
{
  "contradicts": boolean,
  "acknowledgesChange": boolean,
  "reframedContent": "If contradicts and doesn't acknowledge, provide a reframed version that acknowledges the change"
}`,
      messages: [
        {
          role: 'user',
          content: `PRIOR STATEMENTS ON "${topic}":
${priorStatements.map((s) => `- "${s}"`).join('\n')}

PROPOSED NEW STATEMENT:
"${proposed}"

Check for consistency and return JSON.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { isConsistent: true };
    }

    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { isConsistent: true };

      const result = JSON.parse(jsonMatch[0]);

      if (result.contradicts && !result.acknowledgesChange) {
        return {
          isConsistent: false,
          reframedContent: result.reframedContent,
        };
      }

      return { isConsistent: true };
    } catch {
      return { isConsistent: true };
    }
  }
}

// ============================================
// FOCUS GROUP MEMORY EXTRACTION
// ============================================

export interface FocusGroupStatement {
  readerId: string;
  statement: string;
  topic: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  referencedConcern?: string;
}

/**
 * Extract structured memory items from focus group messages.
 * Called after a focus group session completes to persist key statements
 * as queryable, indexed memory items.
 */
export function extractFocusGroupStatements(
  messages: Array<{
    speakerType: string;
    readerId: string | null;
    content: string;
    topic: string | null;
  }>
): FocusGroupStatement[] {
  const statements: FocusGroupStatement[] = [];

  for (const msg of messages) {
    // Only extract reader statements (not moderator questions)
    if (msg.speakerType !== 'READER' || !msg.readerId) continue;

    const sentiment = inferSentiment(msg.content);
    const topic = msg.topic || inferTopic(msg.content);

    statements.push({
      readerId: msg.readerId,
      statement: msg.content,
      topic,
      sentiment,
      referencedConcern: extractConcern(msg.content),
    });
  }

  return statements;
}

function inferSentiment(content: string): 'positive' | 'negative' | 'neutral' {
  const lower = content.toLowerCase();
  const positiveWords = ['excellent', 'strong', 'compelling', 'effective', 'works', 'love', 'brilliant'];
  const negativeWords = ['weak', 'problem', 'issue', 'concern', 'fails', 'doesn\'t work', 'worried', 'unclear'];

  const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function inferTopic(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('character') || lower.includes('protagonist') || lower.includes('arc')) return 'character';
  if (lower.includes('structure') || lower.includes('act') || lower.includes('pacing')) return 'structure';
  if (lower.includes('dialogue') || lower.includes('voice') || lower.includes('subtext')) return 'dialogue';
  if (lower.includes('premise') || lower.includes('concept') || lower.includes('logline')) return 'premise';
  if (lower.includes('market') || lower.includes('commercial') || lower.includes('audience')) return 'commerciality';
  return 'general';
}

function extractConcern(content: string): string | undefined {
  // Extract the core concern from a statement if one exists
  const lower = content.toLowerCase();
  const concernPatterns = [
    /(?:my (?:main )?concern is|worried about|the (?:issue|problem) (?:is|with)) (.+?)(?:\.|$)/i,
    /(?:doesn't|doesn't) (?:work|land) (.+?)(?:\.|$)/i,
  ];
  for (const pattern of concernPatterns) {
    const match = content.match(pattern) || lower.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 200);
  }
  return undefined;
}

// Export singleton instances
export const memoryWriteEngine = new MemoryWriteEngine();
export const memoryReadEngine = new MemoryReadEngine();
export const consistencyChecker = new ConsistencyChecker();
