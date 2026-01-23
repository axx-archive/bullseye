// Executive Evaluation Tool
// Runs executive pitch simulations against coverage
// Persists results to ExecutiveEvaluation table

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { executiveEvaluationEngine } from '@/lib/executive';
import { getLastDeliverable } from './analysis';
import { db } from '@/lib/db';
import type { EventEmitter } from './readers';

export function createExecutiveEvalTool(emitEvent: EventEmitter) {
  return tool(
    'run_executive_eval',
    'Simulate executive pitch evaluations. Executives evaluate based on their track records and priorities. Available executives: Alexandra Sterling (streaming), Marcus Chen (studio), Samira Okonkwo (indie).',
    {
      executiveIds: z.array(z.string()).min(1).max(3).describe(
        'IDs of executives to evaluate. Options: exec-streaming-chief, exec-studio-producer, exec-indie-producer'
      ),
    },
    async ({ executiveIds }) => {
      const deliverable = getLastDeliverable();

      if (!deliverable) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No analysis deliverable available. Run harmonize_analyses first.' }) }],
          isError: true,
        };
      }

      // Emit phase change
      emitEvent({
        source: 'system',
        type: 'phase_change',
        phase: 'executive',
      });

      const results = await executiveEvaluationEngine.evaluateForMultipleExecutives(
        deliverable.harmonizedCoverage,
        deliverable.harmonizedScores,
        executiveIds
      );

      // Persist evaluations to database
      const draftId = deliverable.draftId;
      let evaluationsPersisted = 0;

      if (draftId && !draftId.startsWith('draft-')) {
        for (const r of results) {
          try {
            // Emit executive_start event for UI
            emitEvent({
              source: 'executive',
              type: 'executive_start',
              executiveId: r.executiveId,
              executiveName: r.executiveName,
            });

            await db.executiveEvaluation.create({
              data: {
                draftId,
                executiveId: r.executiveId,
                verdict: r.verdict.toUpperCase() === 'PURSUE' ? 'PURSUE' : 'PASS',
                confidence: r.confidence,
                rationale: r.rationale,
                keyFactors: r.keyFactors,
                concerns: r.concerns,
                groundedInCoverage: r.groundedInCoverage,
                citedElements: r.citedElements,
              },
            });
            evaluationsPersisted++;

            // Emit executive_complete event for UI
            emitEvent({
              source: 'executive',
              type: 'executive_complete',
              executiveId: r.executiveId,
              executiveName: r.executiveName,
              data: {
                executiveId: r.executiveId,
                executiveName: r.executiveName,
                status: 'complete' as const,
                verdict: r.verdict.toLowerCase() as 'pursue' | 'pass',
                confidence: r.confidence,
                rationale: r.rationale,
                keyFactors: r.keyFactors,
                concerns: r.concerns,
              },
            });
          } catch (error) {
            console.error(`Failed to persist evaluation for ${r.executiveId}:`, error);
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            evaluationsPersisted,
            draftId,
            evaluations: results.map((r) => ({
              executiveId: r.executiveId,
              executiveName: r.executiveName,
              title: r.executiveTitle,
              company: r.company,
              verdict: r.verdict,
              confidence: r.confidence,
              rationale: r.rationale,
              keyFactors: r.keyFactors,
              concerns: r.concerns,
            })),
            summary: results.map((r) =>
              `${r.executiveName} (${r.company}): ${r.verdict.toUpperCase()} (${r.confidence}% confidence)`
            ).join('; '),
          }),
        }],
      };
    }
  );
}
