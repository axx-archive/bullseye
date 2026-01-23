// Reader Agent Definitions for Claude Agent SDK
// Builds AgentDefinition objects from reader personas

import { DEFAULT_READERS } from './reader-personas';
import type { ReaderPersonaConfig } from '@/types';

export interface ReaderAgentDefinition {
  description: string;
  prompt: string;
  model: 'sonnet' | 'haiku' | 'opus' | 'inherit';
  maxTurns?: number;
}

function buildReaderAgentPrompt(reader: ReaderPersonaConfig): string {
  return `${reader.systemPromptBase}

OUTPUT FORMAT:
You must respond with valid JSON matching this exact structure:
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
  "premiseAnalysis": "Detailed premise analysis...",
  "characterAnalysis": "Detailed character analysis...",
  "dialogueAnalysis": "Detailed dialogue analysis...",
  "structureAnalysis": "Detailed structure analysis...",
  "commercialityAnalysis": "Detailed commerciality analysis...",
  "overallAssessment": "Overall synthesis..."
}

RULES:
- Respond with ONLY valid JSON. No markdown, no explanatory text.
- Ground all analysis in specific evidence from the script.
- Numeric scores should align with categorical ratings.
- Be honest and specific; vague praise or criticism is unhelpful.
- Write in your distinct voice as ${reader.displayName}.`;
}

export function buildReaderAgentDefinitions(): Record<string, ReaderAgentDefinition> {
  const definitions: Record<string, ReaderAgentDefinition> = {};

  for (const reader of DEFAULT_READERS) {
    const agentId = reader.id.replace('-', '_'); // reader_maya, reader_colton, reader_devon

    definitions[agentId] = {
      description: `${reader.name} (${reader.displayName}) - Script reader focused on ${reader.analyticalFocus[0].toLowerCase()}. ${reader.voiceDescription.split('.')[0]}.`,
      prompt: buildReaderAgentPrompt(reader),
      model: 'sonnet',
      maxTurns: 1, // Readers just do one analysis pass
    };
  }

  return definitions;
}

export function getReaderAgentId(readerId: string): string {
  return readerId.replace('-', '_');
}

export function getReaderIdFromAgentId(agentId: string): string {
  return agentId.replace('_', '-');
}
