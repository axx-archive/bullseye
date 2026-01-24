// Context Budget Utility for Scout Prompts
// Assembles Scout's context within the 200K token budget for Opus 4.5

// Token budget allocation (in estimated tokens):
// - System prompt: 4K
// - Script text: up to 80K
// - Chat history: up to 50K (most recent first)
// - Reader memories: up to 20K
// - Focus group highlights: up to 10K
// Total: 164K max (leaving 36K for output + tools)

const BUDGET = {
  systemPrompt: 4_000,
  scriptText: 80_000,
  chatHistory: 50_000,
  readerMemories: 20_000,
  focusGroupHighlights: 10_000,
} as const;

const TOTAL_BUDGET = 164_000;
const CHARS_PER_TOKEN = 4;

interface ContextBudgetInput {
  systemPrompt: string;
  scriptText: string;
  chatHistory: string[];
  readerMemories: string;
  focusGroupHighlights: string;
}

interface LayerTokens {
  system: number;
  script: number;
  chat: number;
  memories: number;
  focus: number;
}

interface ContextBudgetMetadata {
  totalEstimatedTokens: number;
  truncated: boolean;
  layers: LayerTokens;
}

interface ContextBudgetResult {
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

function truncateChatHistory(messages: string[], maxTokens: number): string[] {
  const result: string[] = [];
  let usedTokens = 0;

  // Keep most recent messages first
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i]);
    if (usedTokens + msgTokens > maxTokens) {
      break;
    }
    result.unshift(messages[i]);
    usedTokens += msgTokens;
  }

  return result;
}

export function buildContextBudget(input: ContextBudgetInput): ContextBudgetResult {
  const { systemPrompt, scriptText, chatHistory, readerMemories, focusGroupHighlights } = input;

  // 1. System prompt (always included, capped at budget)
  const systemText = systemPrompt.slice(0, BUDGET.systemPrompt * CHARS_PER_TOKEN);

  // 2. Script text (truncate if exceeding 80K tokens)
  const processedScript = truncateScript(scriptText);

  // 3. Chat history (most recent first, within budget)
  const processedChat = truncateChatHistory(chatHistory, BUDGET.chatHistory);
  const chatTruncated = processedChat.length < chatHistory.length;

  // 4. Reader memories (cap at budget)
  const maxMemoryChars = BUDGET.readerMemories * CHARS_PER_TOKEN;
  const processedMemories = readerMemories.length > maxMemoryChars
    ? readerMemories.slice(0, maxMemoryChars)
    : readerMemories;

  // 5. Focus group highlights (cap at budget)
  const maxFocusChars = BUDGET.focusGroupHighlights * CHARS_PER_TOKEN;
  const processedFocus = focusGroupHighlights.length > maxFocusChars
    ? focusGroupHighlights.slice(0, maxFocusChars)
    : focusGroupHighlights;

  // Calculate layer tokens
  const layers: LayerTokens = {
    system: estimateTokens(systemText),
    script: estimateTokens(processedScript),
    chat: processedChat.reduce((sum, msg) => sum + estimateTokens(msg), 0),
    memories: estimateTokens(processedMemories),
    focus: estimateTokens(processedFocus),
  };

  const totalEstimatedTokens = layers.system + layers.script + layers.chat + layers.memories + layers.focus;

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
    const chatSection = chatTruncated
      ? `[Earlier conversation history truncated]\n\n${processedChat.join('\n\n')}`
      : processedChat.join('\n\n');
    parts.push(`\n\n## CONVERSATION HISTORY\n\n${chatSection}`);
  }

  return {
    prompt: parts.join(''),
    metadata: {
      totalEstimatedTokens,
      truncated,
      layers,
    },
  };
}
