// BULLSEYE Focus Group System
// Live streaming multi-agent conversations

import type Anthropic from '@anthropic-ai/sdk';
import { getReaderById, DEFAULT_READERS } from '../agents/reader-personas';
import { memoryReadEngine } from '../memory';
import type { SubAgentMemory } from '../memory';
import type { FocusGroupMessage, ReaderPerspective, Divergence, CoverageReport } from '@/types';

function getAnthropicClient(apiKey?: string): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AnthropicSDK = require('@anthropic-ai/sdk').default;
  return apiKey ? new AnthropicSDK({ apiKey }) : new AnthropicSDK();
}

// ============================================
// FOCUS GROUP TYPES
// ============================================

export interface FocusGroupConfig {
  draftId: string;
  topic?: string;
  questions: string[];
  readerPerspectives: ReaderPerspective[];
  readerMemories: Map<string, SubAgentMemory>;
  divergencePoints: Divergence[];
  scriptContext?: CoverageReport;
  apiKey?: string;
}

export interface FocusGroupStreamEvent {
  type: 'message' | 'typing' | 'complete' | 'error';
  speaker?: string;
  speakerType?: 'moderator' | 'reader';
  readerId?: string;
  content?: string;
  partial?: string;
  error?: string;
}

// ============================================
// FOCUS GROUP MODERATOR
// ============================================

const MODERATOR_SYSTEM_PROMPT = `You are Scout, moderating a focus group discussion between script readers.

YOUR ROLE:
- Facilitate natural, engaging conversation between the readers
- Surface points of divergence where readers disagreed
- Keep the discussion focused on the script
- Ask follow-up questions to deepen the analysis
- Summarize key insights as they emerge

CONVERSATION STYLE:
- Open with context about what you noticed in their analyses
- Direct questions to specific readers by name
- Encourage respectful debate when positions differ
- Keep the pace moving—don't let any one reader dominate
- Close each topic with a brief synthesis

You are speaking to: Maya Chen (The Optimist), Colton Rivers (The Skeptic), and Devon Park (The Craftsman).`;

// ============================================
// FOCUS GROUP ENGINE
// ============================================

export class FocusGroupEngine {
  private apiKey?: string;
  private scriptContext?: CoverageReport;

  /**
   * Run a complete focus group session
   */
  async runFocusGroup(
    config: FocusGroupConfig,
    onEvent: (event: FocusGroupStreamEvent) => void
  ): Promise<FocusGroupMessage[]> {
    this.apiKey = config.apiKey;
    this.scriptContext = config.scriptContext;
    const messages: FocusGroupMessage[] = [];
    let sequenceNumber = 0;

    // Build conversation context
    const context = this.buildConversationContext(config);

    // Generate moderator opening
    const opening = await this.generateModeratorTurn(
      context,
      'opening',
      config.questions[0]
    );

    const openingMessage: FocusGroupMessage = {
      id: `msg-${sequenceNumber}`,
      speakerType: 'moderator',
      content: opening,
      timestamp: new Date(),
    };
    messages.push(openingMessage);
    onEvent({ type: 'message', speaker: 'Scout', speakerType: 'moderator', content: opening });
    sequenceNumber++;

    // Determine conversation order based on divergence
    const speakingOrder = this.determineSpeakingOrder(config);

    // Process each question
    for (const question of config.questions) {
      // Each reader responds
      for (const readerId of speakingOrder) {
        const reader = getReaderById(readerId);
        if (!reader) continue;

        const perspective = config.readerPerspectives.find((p) => p.readerId === readerId);
        const memory = config.readerMemories.get(readerId);

        // Signal typing
        onEvent({
          type: 'typing',
          speaker: reader.name,
          speakerType: 'reader',
          readerId,
        });

        // Generate reader response
        const response = await this.generateReaderTurn(
          reader,
          perspective,
          memory,
          messages,
          question
        );

        const readerMessage: FocusGroupMessage = {
          id: `msg-${sequenceNumber}`,
          speakerType: 'reader',
          readerId,
          readerName: reader.name,
          readerColor: reader.color,
          content: response,
          topic: question,
          timestamp: new Date(),
        };
        messages.push(readerMessage);
        onEvent({
          type: 'message',
          speaker: reader.name,
          speakerType: 'reader',
          readerId,
          content: response,
        });
        sequenceNumber++;

        // Small delay for natural pacing
        await this.delay(500);
      }

      // Moderator synthesis after each question round
      const synthesis = await this.generateModeratorTurn(
        context,
        'synthesis',
        question,
        messages.slice(-speakingOrder.length)
      );

      const synthesisMessage: FocusGroupMessage = {
        id: `msg-${sequenceNumber}`,
        speakerType: 'moderator',
        content: synthesis,
        topic: question,
        timestamp: new Date(),
      };
      messages.push(synthesisMessage);
      onEvent({ type: 'message', speaker: 'Scout', speakerType: 'moderator', content: synthesis });
      sequenceNumber++;
    }

    // Closing summary
    const closing = await this.generateModeratorTurn(context, 'closing', '', messages);
    const closingMessage: FocusGroupMessage = {
      id: `msg-${sequenceNumber}`,
      speakerType: 'moderator',
      content: closing,
      timestamp: new Date(),
    };
    messages.push(closingMessage);
    onEvent({ type: 'message', speaker: 'Scout', speakerType: 'moderator', content: closing });

    onEvent({ type: 'complete' });
    return messages;
  }

  /**
   * Stream a focus group with real-time token streaming
   */
  async *streamFocusGroup(
    config: FocusGroupConfig
  ): AsyncGenerator<FocusGroupStreamEvent> {
    this.apiKey = config.apiKey;
    this.scriptContext = config.scriptContext;
    const messages: FocusGroupMessage[] = [];
    let sequenceNumber = 0;

    const context = this.buildConversationContext(config);

    // Opening
    yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator' };

    const openingStream = this.streamModeratorTurn(context, 'opening', config.questions[0]);
    let opening = '';
    for await (const chunk of openingStream) {
      opening += chunk;
      yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator', partial: chunk };
    }

    yield { type: 'message', speaker: 'Scout', speakerType: 'moderator', content: opening };
    messages.push({
      id: `msg-${sequenceNumber++}`,
      speakerType: 'moderator',
      content: opening,
      timestamp: new Date(),
    });

    const speakingOrder = this.determineSpeakingOrder(config);

    for (const question of config.questions) {
      for (const readerId of speakingOrder) {
        const reader = getReaderById(readerId);
        if (!reader) continue;

        const perspective = config.readerPerspectives.find((p) => p.readerId === readerId);
        const memory = config.readerMemories.get(readerId);

        yield { type: 'typing', speaker: reader.name, speakerType: 'reader', readerId };

        const responseStream = this.streamReaderTurn(
          reader,
          perspective,
          memory,
          messages,
          question
        );

        let response = '';
        for await (const chunk of responseStream) {
          response += chunk;
          yield {
            type: 'typing',
            speaker: reader.name,
            speakerType: 'reader',
            readerId,
            partial: chunk,
          };
        }

        yield {
          type: 'message',
          speaker: reader.name,
          speakerType: 'reader',
          readerId,
          content: response,
        };
        messages.push({
          id: `msg-${sequenceNumber++}`,
          speakerType: 'reader',
          readerId,
          readerName: reader.name,
          readerColor: reader.color,
          content: response,
          topic: question,
          timestamp: new Date(),
        });
      }

      // Synthesis
      yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator' };

      const synthStream = this.streamModeratorTurn(
        context,
        'synthesis',
        question,
        messages.slice(-speakingOrder.length)
      );

      let synthesis = '';
      for await (const chunk of synthStream) {
        synthesis += chunk;
        yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator', partial: chunk };
      }

      yield { type: 'message', speaker: 'Scout', speakerType: 'moderator', content: synthesis };
      messages.push({
        id: `msg-${sequenceNumber++}`,
        speakerType: 'moderator',
        content: synthesis,
        topic: question,
        timestamp: new Date(),
      });
    }

    // Closing
    yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator' };

    const closingStream = this.streamModeratorTurn(context, 'closing', '', messages);
    let closing = '';
    for await (const chunk of closingStream) {
      closing += chunk;
      yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator', partial: chunk };
    }

    yield { type: 'message', speaker: 'Scout', speakerType: 'moderator', content: closing };
    yield { type: 'complete' };
  }

  private buildConversationContext(config: FocusGroupConfig): string {
    let context = `FOCUS GROUP CONTEXT:

TOPIC: ${config.topic || 'General script discussion'}

QUESTIONS TO COVER:
${config.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
`;

    // Include script context from harmonized coverage so readers can reference actual content
    if (config.scriptContext) {
      context += `
SCRIPT BEING DISCUSSED:
Title: "${config.scriptContext.title}" by ${config.scriptContext.author}
Genre: ${config.scriptContext.genre}, Format: ${config.scriptContext.format}
Logline: ${config.scriptContext.logline}

Synopsis: ${config.scriptContext.synopsis}

Key Strengths: ${config.scriptContext.strengths.join('; ')}
Key Weaknesses: ${config.scriptContext.weaknesses.join('; ')}

Premise Analysis: ${config.scriptContext.premiseAnalysis}
Character Analysis: ${config.scriptContext.characterAnalysis}
Dialogue Analysis: ${config.scriptContext.dialogueAnalysis}
Structure Analysis: ${config.scriptContext.structureAnalysis}
`;
    }

    context += `
READER PERSPECTIVES SUMMARY:
`;

    for (const perspective of config.readerPerspectives) {
      context += `
${perspective.readerName} (${perspective.voiceTag}):
- Overall: ${perspective.scores.overall} (${perspective.scores.overallNumeric}/100)
- Recommendation: ${perspective.recommendation}
- Key Strengths: ${perspective.keyStrengths.join('; ')}
- Key Concerns: ${perspective.keyConcerns.join('; ')}
`;
    }

    if (config.divergencePoints.length > 0) {
      context += `
DIVERGENCE POINTS TO EXPLORE:
`;
      for (const div of config.divergencePoints) {
        context += `- ${div.topic}: ${div.positions.map((p) => `${p.readerName}: "${p.position}"`).join(' vs ')}\n`;
      }
    }

    return context;
  }

  private determineSpeakingOrder(config: FocusGroupConfig): string[] {
    // If there are divergence points, start with the reader who diverged most
    if (config.divergencePoints.length > 0) {
      const firstDivergence = config.divergencePoints[0];
      const divergentReaders = firstDivergence.positions.map((p) => p.readerId);
      const otherReaders = config.readerPerspectives
        .map((p) => p.readerId)
        .filter((id) => !divergentReaders.includes(id));
      return [...divergentReaders, ...otherReaders];
    }

    // Default order
    return config.readerPerspectives.map((p) => p.readerId);
  }

  private async generateModeratorTurn(
    context: string,
    turnType: 'opening' | 'synthesis' | 'closing',
    question: string,
    recentMessages?: FocusGroupMessage[]
  ): Promise<string> {
    let prompt = '';

    if (turnType === 'opening') {
      prompt = `You are opening a focus group discussion. The first question is: "${question}"

Set the stage briefly, acknowledge the divergence points you noticed in their analyses, and pose the opening question to a specific reader.

Keep it concise (2-3 sentences max for the intro, then the question).`;
    } else if (turnType === 'synthesis') {
      const recentContent = recentMessages
        ?.map((m) => `${m.readerName}: "${m.content}"`)
        .join('\n\n');

      prompt = `Synthesize what the readers just said:

${recentContent}

Briefly summarize the key points of agreement and disagreement (1-2 sentences), then transition to a follow-up or the next topic.`;
    } else {
      prompt = `Close the focus group with a brief summary of the most important insights that emerged from the discussion. Thank the readers and indicate the session is complete.

Keep it to 2-3 sentences.`;
    }

    const response = await getAnthropicClient(this.apiKey).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: MODERATOR_SYSTEM_PROMPT + '\n\n' + context,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  }

  private async *streamModeratorTurn(
    context: string,
    turnType: 'opening' | 'synthesis' | 'closing',
    question: string,
    recentMessages?: FocusGroupMessage[]
  ): AsyncGenerator<string> {
    let prompt = '';

    if (turnType === 'opening') {
      prompt = `You are opening a focus group discussion. The first question is: "${question}"

Set the stage briefly, acknowledge the divergence points you noticed in their analyses, and pose the opening question to a specific reader. Keep it concise.`;
    } else if (turnType === 'synthesis') {
      const recentContent = recentMessages
        ?.map((m) => `${m.readerName}: "${m.content}"`)
        .join('\n\n');

      prompt = `Synthesize what the readers just said:\n\n${recentContent}\n\nBriefly summarize, then transition.`;
    } else {
      prompt = `Close the focus group with a brief summary. Keep it to 2-3 sentences.`;
    }

    const stream = await getAnthropicClient(this.apiKey).messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: MODERATOR_SYSTEM_PROMPT + '\n\n' + context,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private async generateReaderTurn(
    reader: (typeof DEFAULT_READERS)[0],
    perspective: ReaderPerspective | undefined,
    memory: SubAgentMemory | undefined,
    conversationHistory: FocusGroupMessage[],
    question: string
  ): Promise<string> {
    const memoryContext = memory ? memoryReadEngine.getMemoryContext(memory) : '';

    const recentMessages = conversationHistory.slice(-6);
    const conversationContext = recentMessages
      .map((m) =>
        m.speakerType === 'moderator'
          ? `Scout (Moderator): ${m.content}`
          : `${m.readerName}: ${m.content}`
      )
      .join('\n\n');

    const prompt = `You are in a focus group discussion. Here's the recent conversation:

${conversationContext}

The moderator just asked about: "${question}"

YOUR PERSPECTIVE ON THIS SCRIPT:
${perspective ? `
- Your overall score: ${perspective.scores.overall} (${perspective.scores.overallNumeric}/100)
- Your recommendation: ${perspective.recommendation}
- Your key strengths: ${perspective.keyStrengths.join('; ')}
- Your key concerns: ${perspective.keyConcerns.join('; ')}
` : 'No perspective data available.'}

${memoryContext}

Respond naturally as ${reader.name} (${reader.displayName}). Be conversational but substantive.
- Reference specific details from the script (characters, scenes, dialogue)
- Engage with what other readers said if relevant
- Stay true to your analytical perspective
- Keep your response focused (3-5 sentences)`;

    // Build system prompt with script context for grounded discussion
    let systemPrompt = reader.systemPromptBase;
    if (this.scriptContext) {
      systemPrompt += `\n\nSCRIPT CONTEXT (for reference during discussion):
Title: "${this.scriptContext.title}" by ${this.scriptContext.author}
Logline: ${this.scriptContext.logline}
Synopsis: ${this.scriptContext.synopsis}`;
    }

    const response = await getAnthropicClient(this.apiKey).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  }

  private async *streamReaderTurn(
    reader: (typeof DEFAULT_READERS)[0],
    perspective: ReaderPerspective | undefined,
    memory: SubAgentMemory | undefined,
    conversationHistory: FocusGroupMessage[],
    question: string
  ): AsyncGenerator<string> {
    const memoryContext = memory ? memoryReadEngine.getMemoryContext(memory) : '';

    const recentMessages = conversationHistory.slice(-6);
    const conversationContext = recentMessages
      .map((m) =>
        m.speakerType === 'moderator'
          ? `Scout (Moderator): ${m.content}`
          : `${m.readerName}: ${m.content}`
      )
      .join('\n\n');

    const prompt = `Focus group discussion. Recent conversation:

${conversationContext}

Question: "${question}"

Your perspective: ${perspective ? `Overall ${perspective.scores.overall}, recommend: ${perspective.recommendation}` : 'N/A'}

${memoryContext}

Respond naturally as ${reader.name}. Be conversational, reference specific script details, 3-5 sentences.`;

    // Build system prompt with script context for grounded discussion
    let systemPrompt = reader.systemPromptBase;
    if (this.scriptContext) {
      systemPrompt += `\n\nSCRIPT CONTEXT (for reference during discussion):
Title: "${this.scriptContext.title}" by ${this.scriptContext.author}
Logline: ${this.scriptContext.logline}
Synopsis: ${this.scriptContext.synopsis}`;
    }

    const stream = await getAnthropicClient(this.apiKey).messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const focusGroupEngine = new FocusGroupEngine();
