// Focus Questions Generator Tool
// Scout generates 5 questions based on his reading + divergence points

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { getCurrentScript } from './ingest';
import { getLastReaderPerspectives } from './readers';
import { getLastDeliverable } from './analysis';

export const generateFocusQuestionsTool = tool(
  'generate_focus_questions',
  'Generate 5 provocative questions for focus group discussion based on Scout\'s reading of the script and the divergence points from reader analyses. These questions are designed to elicit interesting debate and surface deeper insights.',
  {
    harmonizedSummary: z.string().optional().describe('Summary of the harmonized analysis (consensus/divergence points)'),
    divergenceTopics: z.array(z.string()).optional().describe('Specific topics where readers diverged'),
    focusAreas: z.array(z.string()).optional().describe('Specific areas to focus questions on (e.g., "protagonist motivation", "third act resolution")'),
  },
  async ({ harmonizedSummary, divergenceTopics, focusAreas }) => {
    const script = getCurrentScript();
    const deliverable = getLastDeliverable();
    const perspectives = deliverable?.readerPerspectives || getLastReaderPerspectives();

    if (!script) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: 'No script ingested. Call ingest_script first.' }),
        }],
        isError: true,
      };
    }

    // Build context for question generation
    let context = `SCRIPT: "${script.title}" by ${script.author}\nGenre: ${script.genre}, Format: ${script.format}\n\n`;

    if (perspectives.length > 0) {
      context += 'READER POSITIONS:\n';
      for (const p of perspectives) {
        context += `- ${p.readerName} (${p.voiceTag}): ${p.recommendation}, Overall ${p.scores.overallNumeric}/100\n`;
        context += `  Strengths: ${p.keyStrengths.slice(0, 2).join('; ')}\n`;
        context += `  Concerns: ${p.keyConcerns.slice(0, 2).join('; ')}\n`;
      }
      context += '\n';
    }

    if (harmonizedSummary) {
      context += `HARMONIZED ANALYSIS:\n${harmonizedSummary}\n\n`;
    }

    if (divergenceTopics && divergenceTopics.length > 0) {
      context += `DIVERGENCE POINTS:\n${divergenceTopics.map(t => `- ${t}`).join('\n')}\n\n`;
    }

    if (focusAreas && focusAreas.length > 0) {
      context += `FOCUS AREAS:\n${focusAreas.map(a => `- ${a}`).join('\n')}\n\n`;
    }

    // Use Claude to generate questions
    const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
    const client = new AnthropicSDK();

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are Scout, the orchestrating intelligence for BULLSEYE. Your task is to generate 5 provocative, discussion-worthy questions for a focus group between three script readers.

GUIDELINES:
1. Questions should probe areas of divergence or tension
2. Questions should be open-ended and invite debate
3. Questions should reference specific script elements when possible
4. At least one question should challenge the majority position
5. At least one question should explore commercial/market implications
6. Questions should be ordered by importance/interest level

OUTPUT FORMAT:
Return a JSON array of 5 question objects:
[
  {
    "question": "The full question text",
    "rationale": "Brief explanation of why this question matters",
    "targetReader": "maya" | "colton" | "devon" | "all",
    "topic": "character" | "structure" | "dialogue" | "premise" | "commerciality" | "general"
  }
]`,
        messages: [{
          role: 'user',
          content: `Generate 5 focus group questions based on this context:\n\n${context}\n\nReturn JSON only.`,
        }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Failed to generate questions' }),
          }],
          isError: true,
        };
      }

      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Could not parse questions from response' }),
          }],
          isError: true,
        };
      }

      const questions = JSON.parse(jsonMatch[0]) as Array<{
        question: string;
        rationale: string;
        targetReader: string;
        topic: string;
      }>;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            scriptTitle: script.title,
            questionCount: questions.length,
            questions: questions.map((q, i) => ({
              order: i + 1,
              ...q,
            })),
            questionTexts: questions.map(q => q.question),
            message: `Generated ${questions.length} focus group questions for "${script.title}".`,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to generate questions',
          }),
        }],
        isError: true,
      };
    }
  }
);
