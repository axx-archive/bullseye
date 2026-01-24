// Context Budget Utility for Scout Prompts
// Assembles Scout's context within the 200K token budget for Opus 4.5

import Anthropic from '@anthropic-ai/sdk';

// Token budget allocation (in estimated tokens):
// - System prompt: 4K
// - Script text: up to 80K
// - Conversation summary: up to 3K (replaces truncated history)
// - Chat history: up to 47K (most recent first)
// - Reader memories: up to 20K
// - Focus group highlights: up to 10K
// Total: 164K max (leaving 36K for output + tools)

const BUDGET = {
  systemPrompt: 4_000,
  scriptText: 80_000,
  conversationSummary: 3_000,
  chatHistory: 47_000,
  readerMemories: 20_000,
  focusGroupHighlights: 10_000,
} as const;

const TOTAL_BUDGET = 164_000;
const CHARS_PER_TOKEN = 4;

// Minimum number of new messages since last summary to trigger regeneration
const SUMMARY_REGEN_THRESHOLD = 5;

export interface ContextBudgetInput {
  systemPrompt: string;
  scriptText: string;
  chatHistory: string[];
  readerMemories: string;
  focusGroupHighlights: string;
  existingSummary?: string | null;
  summaryMessageCount?: number | null;
  apiKey?: string;
}

interface LayerTokens {
  system: number;
  script: number;
  summary: number;
  chat: number;
  memories: number;
  focus: number;
}

export interface ContextBudgetMetadata {
  totalEstimatedTokens: number;
  truncated: boolean;
  layers: LayerTokens;
  newSummary?: string;
  newSummaryMessageCount?: number;
}

export interface ContextBudgetResult {
  prompt: string;
  metadata: ContextBudgetMetadata;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateScript(scriptText: string): string {
  const maxChars = BUDGET.scriptText * CHARS_PER_TOKEN; // 320K chars
  if (scriptText.length <= maxChars) {
    return scriptText;
  }
  const keepStart = 40_000; // chars
  const keepEnd = 20_000; // chars
  const start = scriptText.slice(0, keepStart);
  const end = scriptText.slice(-keepEnd);
  return `${start}\n\n[...middle content truncated for context limits...]\n\n${end}`;
}

function truncateChatHistory(messages: string[], maxTokens: number): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  let usedTokens = 0;

  // Keep most recent messages first
  let cutoff = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i]);
    if (usedTokens + msgTokens > maxTokens) {
      cutoff = i + 1;
      break;
    }
    kept.unshift(messages[i]);
    usedTokens += msgTokens;
    if (i === 0) cutoff = 0;
  }

  const dropped = messages.slice(0, cutoff);
  return { kept, dropped };
}

/**
 * Summarize dropped messages using Claude Haiku.
 * Produces a 2-3 paragraph summary retaining key decisions, preferences,
 * analysis results, and standing instructions.
 */
async function summarizeDroppedMessages(
  droppedMessages: string[],
  apiKey: string,
  existingSummary?: string | null,
): Promise<string> {
  const messagesText = droppedMessages.join('\n\n');

  const contextPrefix = existingSummary
    ? `Previous conversation summary:\n${existingSummary}\n\nNew messages to incorporate:\n`
    : 'Messages to summarize:\n';

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250414',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${contextPrefix}${messagesText}

Summarize this conversation history in 2-3 concise paragraphs. Retain:
- Key decisions and preferences expressed by the user
- Analysis results (scores, recommendations, reader positions)
- Standing instructions or focus areas the user specified
- Important context about the script being analyzed

Write in third person, past tense. Be specific about numbers and names. Do not include filler or meta-commentary about summarization.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text || '';
}

export async function buildContextBudget(input: ContextBudgetInput): Promise<ContextBudgetResult> {
  const {
    systemPrompt,
    scriptText,
    chatHistory,
    readerMemories,
    focusGroupHighlights,
    existingSummary,
    summaryMessageCount,
    apiKey,
  } = input;

  // 1. System prompt (always included, capped at budget)
  const systemText = systemPrompt.slice(0, BUDGET.systemPrompt * CHARS_PER_TOKEN);

  // 2. Script text (truncate if exceeding 80K tokens)
  const processedScript = truncateScript(scriptText);

  // 3. Chat history (most recent first, within budget)
  const { kept: processedChat, dropped: droppedMessages } = truncateChatHistory(chatHistory, BUDGET.chatHistory);
  const chatTruncated = processedChat.length < chatHistory.length;

  // 4. Conversation summary — generate or reuse
  let conversationSummary = '';
  let newSummary: string | undefined;
  let newSummaryMessageCount: number | undefined;

  if (chatTruncated && droppedMessages.length > 0) {
    const droppedCount = droppedMessages.length;
    const previousSummarizedCount = summaryMessageCount ?? 0;
    const newMessagesSinceLastSummary = droppedCount - previousSummarizedCount;

    if (existingSummary && newMessagesSinceLastSummary < SUMMARY_REGEN_THRESHOLD) {
      // Reuse existing summary — not enough new messages to justify regeneration
      conversationSummary = existingSummary;
    } else if (apiKey) {
      // Generate new summary
      try {
        conversationSummary = await summarizeDroppedMessages(droppedMessages, apiKey, existingSummary);
        newSummary = conversationSummary;
        newSummaryMessageCount = droppedCount;
      } catch (error) {
        console.error('[Scout] Failed to generate conversation summary:', error);
        // Fall back to existing summary or truncation marker
        conversationSummary = existingSummary || '';
      }
    } else if (existingSummary) {
      conversationSummary = existingSummary;
    }

    // Cap summary at budget
    const maxSummaryChars = BUDGET.conversationSummary * CHARS_PER_TOKEN;
    if (conversationSummary.length > maxSummaryChars) {
      conversationSummary = conversationSummary.slice(0, maxSummaryChars);
    }
  }

  // 5. Reader memories (cap at budget)
  const maxMemoryChars = BUDGET.readerMemories * CHARS_PER_TOKEN;
  const processedMemories = readerMemories.length > maxMemoryChars
    ? readerMemories.slice(0, maxMemoryChars)
    : readerMemories;

  // 6. Focus group highlights (cap at budget)
  const maxFocusChars = BUDGET.focusGroupHighlights * CHARS_PER_TOKEN;
  const processedFocus = focusGroupHighlights.length > maxFocusChars
    ? focusGroupHighlights.slice(0, maxFocusChars)
    : focusGroupHighlights;

  // Calculate layer tokens
  const layers: LayerTokens = {
    system: estimateTokens(systemText),
    script: estimateTokens(processedScript),
    summary: estimateTokens(conversationSummary),
    chat: processedChat.reduce((sum, msg) => sum + estimateTokens(msg), 0),
    memories: estimateTokens(processedMemories),
    focus: estimateTokens(processedFocus),
  };

  const totalEstimatedTokens = layers.system + layers.script + layers.summary + layers.chat + layers.memories + layers.focus;

  const scriptTruncated = scriptText.length > BUDGET.scriptText * CHARS_PER_TOKEN;
  const truncated = scriptTruncated || chatTruncated || totalEstimatedTokens > TOTAL_BUDGET;

  // Assemble the prompt
  const parts: string[] = [systemText];

  if (processedScript) {
    parts.push(`\n\n## SCRIPT\n\n${processedScript}`);
  }

  if (processedMemories) {
    parts.push(`\n\n## READER MEMORIES\n\n${processedMemories}`);
  }

  if (processedFocus) {
    parts.push(`\n\n## FOCUS GROUP HIGHLIGHTS\n\n${processedFocus}`);
  }

  if (processedChat.length > 0) {
    let chatSection = '';
    if (chatTruncated && conversationSummary) {
      chatSection = `## EARLIER CONVERSATION SUMMARY\n\n${conversationSummary}\n\n## RECENT CONVERSATION\n\n${processedChat.join('\n\n')}`;
    } else if (chatTruncated) {
      chatSection = `[Earlier conversation history truncated]\n\n${processedChat.join('\n\n')}`;
    } else {
      chatSection = processedChat.join('\n\n');
    }
    parts.push(`\n\n## CONVERSATION HISTORY\n\n${chatSection}`);
  }

  return {
    prompt: parts.join(''),
    metadata: {
      totalEstimatedTokens,
      truncated,
      layers,
      newSummary,
      newSummaryMessageCount,
    },
  };
}
