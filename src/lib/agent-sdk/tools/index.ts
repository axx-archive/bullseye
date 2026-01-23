// BULLSEYE Tool Server
// Aggregates all Scout tools into a single MCP server instance

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { ingestScriptTool } from './ingest';
import { createSpawnReadersTool } from './readers';
import { createHarmonizeAnalysesTool } from './analysis';
import { createFocusGroupTool } from './focus-group';
import { createExecutiveEvalTool } from './executive';
import { memoryReadTool, memoryWriteTool, memoryReadAllTool } from './memory';
import { getCalibrationContextTool, getStudioIntelligenceTool } from './studio-intelligence';
import { generateFocusQuestionsTool } from './focus-questions';
import { createReaderChatTool } from './reader-chat';
import type { ScoutSSEEvent } from '../types';

export type { EventEmitter } from './readers';

export function createBullseyeToolServer(emitEvent: (event: ScoutSSEEvent) => void) {
  return createSdkMcpServer({
    name: 'bullseye-tools',
    version: '1.0.0',
    tools: [
      ingestScriptTool,
      createSpawnReadersTool(emitEvent),
      createHarmonizeAnalysesTool(emitEvent),
      generateFocusQuestionsTool,
      createFocusGroupTool(emitEvent),
      createReaderChatTool(emitEvent),
      createExecutiveEvalTool(emitEvent),
      memoryReadTool,
      memoryWriteTool,
      memoryReadAllTool,
      getCalibrationContextTool,
      getStudioIntelligenceTool,
    ],
  });
}
