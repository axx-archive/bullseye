// BULLSEYE Agent SDK Client
// Lightweight Anthropic client for internal one-shot LLM calls
// Used by: memory narrative evolution, focus group reader turns, studio intelligence

import Anthropic from '@anthropic-ai/sdk';

const MODELS = {
  sonnet: 'claude-opus-4-5-20251101',
  haiku: 'claude-haiku-4-20250514',
  opus: 'claude-opus-4-20250514',
} as const;

type ModelKey = keyof typeof MODELS;

let clientInstance: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic();
  }
  return clientInstance;
}

export async function oneShot(params: {
  model?: ModelKey;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await getClient().messages.create({
    model: MODELS[params.model ?? 'sonnet'],
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: 'user', content: params.prompt }],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

export async function oneShotJSON<T>(params: {
  model?: ModelKey;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const text = await oneShot(params);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from LLM response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

export async function* streamOneShot(params: {
  model?: ModelKey;
  system: string;
  prompt: string;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const stream = await getClient().messages.stream({
    model: MODELS[params.model ?? 'sonnet'],
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: 'user', content: params.prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export { MODELS };
