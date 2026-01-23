// BULLSEYE Focus Group System
// Live streaming multi-agent conversations

import type Anthropic from '@anthropic-ai/sdk';
import { getReaderById, DEFAULT_READERS } from '../agents/reader-personas';
import { memoryReadEngine } from '../memory';
import type { SubAgentMemory } from '../memory';
import type { FocusGroupMessage, ReaderPerspective, Divergence, CoverageReport, ReactionSentiment } from '@/types';

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
  // Reader-to-reader reaction fields
  replyToReaderId?: string;
  replyToReaderName?: string;
  reactionSentiment?: 'agrees' | 'disagrees' | 'builds_on';
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
      const roundMessages: FocusGroupMessage[] = [];
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
        roundMessages.push(readerMessage);
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

      // Reader-to-reader reaction turns (1-2 rounds)
      const reactionMessages: FocusGroupMessage[] = [];
      for (let reactionRound = 0; reactionRound < 2; reactionRound++) {
        let anyReacted = false;
        for (const readerId of speakingOrder) {
          const reader = getReaderById(readerId);
          if (!reader) continue;

          const perspective = config.readerPerspectives.find((p) => p.readerId === readerId);
          const otherMessages = roundMessages.filter((m) => m.readerId !== readerId);
          if (otherMessages.length === 0) continue;

          // Signal typing
          onEvent({
            type: 'typing',
            speaker: reader.name,
            speakerType: 'reader',
            readerId,
          });

          const reaction = await this.generateReactionTurn(
            reader,
            perspective,
            otherMessages,
            reactionMessages,
            question
          );

          if (!reaction) continue; // Reader passed

          anyReacted = true;
          const reactionMessage: FocusGroupMessage = {
            id: `msg-${sequenceNumber}`,
            speakerType: 'reader',
            readerId,
            readerName: reader.name,
            readerColor: reader.color,
            content: reaction.content,
            topic: question,
            replyToReaderId: reaction.replyToReaderId,
            replyToReaderName: reaction.replyToReaderName,
            reactionSentiment: reaction.sentiment,
            timestamp: new Date(),
          };
          messages.push(reactionMessage);
          reactionMessages.push(reactionMessage);
          onEvent({
            type: 'message',
            speaker: reader.name,
            speakerType: 'reader',
            readerId,
            content: reaction.content,
            replyToReaderId: reaction.replyToReaderId,
            replyToReaderName: reaction.replyToReaderName,
            reactionSentiment: reaction.sentiment,
          });
          sequenceNumber++;
          await this.delay(500);
        }

        // If no one reacted in this round, skip further rounds
        if (!anyReacted) break;
      }

      // Moderator synthesis after each question round (includes reactions)
      const allRoundMessages = [...roundMessages, ...reactionMessages];
      const synthesis = await this.generateModeratorTurn(
        context,
        'synthesis',
        question,
        allRoundMessages
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
      const roundMessages: FocusGroupMessage[] = [];
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
        const readerMsg: FocusGroupMessage = {
          id: `msg-${sequenceNumber++}`,
          speakerType: 'reader',
          readerId,
          readerName: reader.name,
          readerColor: reader.color,
          content: response,
          topic: question,
          timestamp: new Date(),
        };
        messages.push(readerMsg);
        roundMessages.push(readerMsg);
      }

      // Reader-to-reader reaction turns (1-2 rounds)
      const reactionMessages: FocusGroupMessage[] = [];
      for (let reactionRound = 0; reactionRound < 2; reactionRound++) {
        let anyReacted = false;
        for (const readerId of speakingOrder) {
          const reader = getReaderById(readerId);
          if (!reader) continue;

          const perspective = config.readerPerspectives.find((p) => p.readerId === readerId);
          const otherMessages = roundMessages.filter((m) => m.readerId !== readerId);
          if (otherMessages.length === 0) continue;

          yield { type: 'typing', speaker: reader.name, speakerType: 'reader', readerId };

          const reaction = await this.generateReactionTurn(
            reader,
            perspective,
            otherMessages,
            reactionMessages,
            question
          );

          if (!reaction) continue; // Reader passed

          anyReacted = true;
          const reactionMsg: FocusGroupMessage = {
            id: `msg-${sequenceNumber++}`,
            speakerType: 'reader',
            readerId,
            readerName: reader.name,
            readerColor: reader.color,
            content: reaction.content,
            topic: question,
            replyToReaderId: reaction.replyToReaderId,
            replyToReaderName: reaction.replyToReaderName,
            reactionSentiment: reaction.sentiment,
            timestamp: new Date(),
          };
          messages.push(reactionMsg);
          reactionMessages.push(reactionMsg);
          yield {
            type: 'message',
            speaker: reader.name,
            speakerType: 'reader',
            readerId,
            content: reaction.content,
            replyToReaderId: reaction.replyToReaderId,
            replyToReaderName: reaction.replyToReaderName,
            reactionSentiment: reaction.sentiment,
          };
        }

        if (!anyReacted) break;
      }

      // Synthesis (includes reactions)
      yield { type: 'typing', speaker: 'Scout', speakerType: 'moderator' };

      const allRoundMessages = [...roundMessages, ...reactionMessages];
      const synthStream = this.streamModeratorTurn(
        context,
        'synthesis',
        question,
        allRoundMessages
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
        ?.map((m) => {
          if (m.replyToReaderName && m.reactionSentiment) {
            return `${m.readerName} (${m.reactionSentiment} with ${m.replyToReaderName}): "${m.content}"`;
          }
          return `${m.readerName}: "${m.content}"`;
        })
        .join('\n\n');

      const hasReactions = recentMessages?.some((m) => m.replyToReaderId);

      prompt = `Synthesize what the readers just said:

${recentContent}

${hasReactions ? 'Note the reader-to-reader exchanges — acknowledge where they agreed, disagreed, or built on each other\'s points. ' : ''}Briefly summarize the key points of agreement and disagreement (1-2 sentences), then transition to a follow-up or the next topic.`;
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
        ?.map((m) => {
          if (m.replyToReaderName && m.reactionSentiment) {
            return `${m.readerName} (${m.reactionSentiment} with ${m.replyToReaderName}): "${m.content}"`;
          }
          return `${m.readerName}: "${m.content}"`;
        })
        .join('\n\n');

      const hasReactions = recentMessages?.some((m) => m.replyToReaderId);
      prompt = `Synthesize what the readers just said:\n\n${recentContent}\n\n${hasReactions ? 'Acknowledge the reader-to-reader exchanges. ' : ''}Briefly summarize, then transition.`;
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

  private async generateReactionTurn(
    reader: (typeof DEFAULT_READERS)[0],
    perspective: ReaderPerspective | undefined,
    otherMessages: FocusGroupMessage[],
    priorReactions: FocusGroupMessage[],
    question: string
  ): Promise<{ content: string; replyToReaderId: string; replyToReaderName: string; sentiment: ReactionSentiment } | null> {
    const otherResponses = otherMessages
      .map((m) => `${m.readerName}: "${m.content}"`)
      .join('\n\n');

    const priorReactionContext = priorReactions.length > 0
      ? `\nPrevious reactions in this round:\n${priorReactions.map((m) => `${m.readerName} (${m.reactionSentiment} with ${m.replyToReaderName}): "${m.content}"`).join('\n')}\n`
      : '';

    const targetReaderNames = otherMessages
      .map((m) => m.readerName)
      .filter(Boolean)
      .join(', ');

    const prompt = `You are in a focus group discussion about: "${question}"

The other readers just shared their thoughts:

${otherResponses}
${priorReactionContext}
If you feel strongly about what another reader said, respond directly to them. You may:
- AGREE with a specific point and add to it
- DISAGREE with a specific point and explain why
- BUILD ON a specific idea with new insight

If you have nothing compelling to add, respond with exactly: PASS

IMPORTANT FORMAT: If you DO respond, your first line must be exactly one of:
AGREES_WITH: [Reader Name]
DISAGREES_WITH: [Reader Name]
BUILDS_ON: [Reader Name]

Where [Reader Name] is one of: ${targetReaderNames}

Then write your reaction (2-3 sentences). Reference specific script details. Stay in character as ${reader.name} (${reader.displayName}).`;

    // Build system prompt with script context
    let systemPrompt = reader.systemPromptBase;
    if (this.scriptContext) {
      systemPrompt += `\n\nSCRIPT CONTEXT (for reference during discussion):
Title: "${this.scriptContext.title}" by ${this.scriptContext.author}
Logline: ${this.scriptContext.logline}
Synopsis: ${this.scriptContext.synopsis}`;
    }

    if (perspective) {
      systemPrompt += `\n\nYour perspective: Overall ${perspective.scores.overall} (${perspective.scores.overallNumeric}/100), recommend: ${perspective.recommendation}`;
    }

    const response = await getAnthropicClient(this.apiKey).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const text = textContent?.type === 'text' ? textContent.text.trim() : '';

    // Check for PASS
    if (!text || text === 'PASS' || text.startsWith('PASS')) {
      return null;
    }

    // Parse the reaction format
    const lines = text.split('\n');
    const firstLine = lines[0].trim();
    let sentiment: ReactionSentiment = 'builds_on';
    let targetReaderName = '';

    if (firstLine.startsWith('AGREES_WITH:')) {
      sentiment = 'agrees';
      targetReaderName = firstLine.replace('AGREES_WITH:', '').trim();
    } else if (firstLine.startsWith('DISAGREES_WITH:')) {
      sentiment = 'disagrees';
      targetReaderName = firstLine.replace('DISAGREES_WITH:', '').trim();
    } else if (firstLine.startsWith('BUILDS_ON:')) {
      sentiment = 'builds_on';
      targetReaderName = firstLine.replace('BUILDS_ON:', '').trim();
    } else {
      // If the reader didn't follow the format, treat as builds_on targeting the first other reader
      targetReaderName = otherMessages[0]?.readerName || '';
      // Use the full text as content
      const targetMessage = otherMessages.find((m) => m.readerName === targetReaderName);
      return {
        content: text,
        replyToReaderId: targetMessage?.readerId || otherMessages[0]?.readerId || '',
        replyToReaderName: targetReaderName,
        sentiment,
      };
    }

    // Get the content (everything after the first line)
    const content = lines.slice(1).join('\n').trim();
    if (!content) return null;

    // Find the target reader's message
    const targetMessage = otherMessages.find((m) =>
      m.readerName?.toLowerCase() === targetReaderName.toLowerCase()
    );
    const replyToReaderId = targetMessage?.readerId || otherMessages[0]?.readerId || '';
    const resolvedName = targetMessage?.readerName || targetReaderName;

    return {
      content,
      replyToReaderId,
      replyToReaderName: resolvedName,
      sentiment,
    };
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
