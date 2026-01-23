// Harmonization Tool
// Synthesizes reader analyses into unified coverage
// Now with automatic memory persistence

import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { harmonizeScores, detectDivergence, synthesizeCoverage, synthesizeIntake, generateScoutAnalysis } from '@/lib/harmonization';
import { getLastReaderResults, getLastReaderPerspectives, getLastProjectContext } from './readers';
import { getCurrentScript } from './ingest';
import { db } from '@/lib/db';
import { memoryWriteEngine } from '@/lib/memory';
import { v4 as uuidv4 } from 'uuid';
import type { ReaderAnalysisOutput } from '@/lib/agents/types';
import { updateStudioIntelligence } from './studio-intelligence';
import type { DraftDeliverable, StudioCalibration } from '@/types';
import type { StudioIntelligenceData } from '@/lib/studio-intelligence';
import type { EventEmitter } from './readers';

// Session-scoped storage for deliverable
let lastDeliverable: DraftDeliverable | null = null;

export function getLastDeliverable(): DraftDeliverable | null {
  return lastDeliverable;
}

export function createHarmonizeAnalysesTool(emitEvent: EventEmitter) {
  return tool(
  'harmonize_analyses',
  'After reader analyses complete, synthesize their perspectives into unified coverage with harmonized scores, consensus/divergence detection, and calibration percentiles. Automatically persists reader memories and delivers the Coverage/Intake to the project. MUST be called before run_focus_group or generate_focus_questions.',
  {
    studioIntelligenceJson: z.string().optional().describe('Optional JSON string of StudioIntelligenceData for percentile calculation'),
    projectId: z.string().optional().describe('Project ID for memory persistence'),
    draftId: z.string().optional().describe('Draft ID for memory persistence'),
  },
  async ({ studioIntelligenceJson, projectId, draftId }) => {
    const script = getCurrentScript();
    const readerResults = getLastReaderResults();
    const perspectives = getLastReaderPerspectives();
    const projectContext = getLastProjectContext();

    // Use provided IDs or fall back to context/script
    const effectiveProjectId = projectId || projectContext.projectId || script?.projectId;
    const effectiveDraftId = draftId || projectContext.draftId || script?.draftId;

    if (!script) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No script ingested.' }) }],
        isError: true,
      };
    }

    if (readerResults.size === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No reader results available. Run spawn_readers first.' }) }],
        isError: true,
      };
    }

    let studioIntelligence: StudioIntelligenceData | undefined;
    if (studioIntelligenceJson) {
      try {
        studioIntelligence = JSON.parse(studioIntelligenceJson);
      } catch {
        // Ignore parse errors, proceed without calibration
      }
    }

    const metadata = {
      title: script.title,
      author: script.author,
      genre: script.genre,
      format: script.format,
      pageCount: script.pageCount,
    };

    // Harmonize scores with percentile calculation
    const harmonizedScores = harmonizeScores(perspectives, studioIntelligence);

    // Detect divergence and consensus
    const divergencePoints = detectDivergence(perspectives);

    // Synthesize coverage report
    const coverage = synthesizeCoverage(
      perspectives,
      readerResults as Map<string, ReaderAnalysisOutput>,
      metadata
    );

    // Synthesize intake report
    const intake = synthesizeIntake(coverage, harmonizedScores, perspectives);

    // Generate Scout's analysis
    const scoutAnalysis = generateScoutAnalysis(perspectives, harmonizedScores);

    // Build calibration (simplified without full studio data)
    const calibration: StudioCalibration = {
      premisePercentile: harmonizedScores.premise.percentile,
      characterPercentile: harmonizedScores.character.percentile,
      dialoguePercentile: harmonizedScores.dialogue.percentile,
      structurePercentile: harmonizedScores.structure.percentile,
      commercialityPercentile: harmonizedScores.commerciality.percentile,
      overallPercentile: harmonizedScores.overall.percentile,
      comparisonNarrative: '',
      similarProjects: [],
      genreContext: script.genre,
    };

    // Build the deliverable
    lastDeliverable = {
      id: `deliverable-${Date.now()}`,
      draftId: effectiveDraftId || `draft-${Date.now()}`,
      projectId: effectiveProjectId || `project-${Date.now()}`,
      createdAt: new Date(),
      harmonizedCoverage: coverage,
      harmonizedIntake: intake,
      harmonizedScores,
      readerPerspectives: perspectives,
      scoutAnalysis,
      studioCalibration: calibration,
    };

    // Persist reader memories for each reader
    let memoriesPersisted = 0;
    if (effectiveDraftId && effectiveProjectId) {
      for (const [readerId, analysis] of readerResults.entries()) {
        try {
          // Build coverage content for memory
          const coverageContent = `
READER COVERAGE ANALYSIS
========================
Script: "${script.title}" by ${script.author}
Genre: ${script.genre}, Format: ${script.format}

SCORES:
- Premise: ${analysis.scores.premise} (${analysis.scores.premiseNumeric}/100)
- Character: ${analysis.scores.character} (${analysis.scores.characterNumeric}/100)
- Dialogue: ${analysis.scores.dialogue} (${analysis.scores.dialogueNumeric}/100)
- Structure: ${analysis.scores.structure} (${analysis.scores.structureNumeric}/100)
- Commerciality: ${analysis.scores.commerciality} (${analysis.scores.commercialityNumeric}/100)
- Overall: ${analysis.scores.overall} (${analysis.scores.overallNumeric}/100)

RECOMMENDATION: ${analysis.recommendation}

KEY STRENGTHS:
${analysis.keyStrengths.map((s) => `- ${s}`).join('\n')}

KEY CONCERNS:
${analysis.keyConcerns.map((c) => `- ${c}`).join('\n')}

STANDOUT QUOTE: "${analysis.standoutQuote}"

DETAILED ANALYSIS:
Premise: ${analysis.premiseAnalysis}
Character: ${analysis.characterAnalysis}
Dialogue: ${analysis.dialogueAnalysis}
Structure: ${analysis.structureAnalysis}
Commerciality: ${analysis.commercialityAnalysis}
Overall: ${analysis.overallAssessment}
`;

          // Use memory write engine to process
          const event = {
            id: uuidv4(),
            type: 'coverage' as const,
            content: coverageContent,
            timestamp: new Date(),
          };

          const updatedMemory = await memoryWriteEngine.memorize(
            readerId,
            effectiveProjectId,
            effectiveDraftId,
            event,
            undefined
          );

          // Persist to database
          await db.readerMemory.upsert({
            where: {
              draftId_readerId: { draftId: effectiveDraftId, readerId },
            },
            create: {
              draftId: effectiveDraftId,
              readerId,
              projectId: effectiveProjectId,
              narrativeSummary: updatedMemory.narrativeSummary,
              evolutionNotes: updatedMemory.evolutionNotes,
              scores: analysis.scores,
              recommendation: analysis.recommendation,
              keyStrengths: analysis.keyStrengths,
              keyConcerns: analysis.keyConcerns,
              standoutQuote: analysis.standoutQuote,
              evidenceStrength: analysis.evidenceStrength,
              focusGroupItems: [],
              chatHighlights: [],
            },
            update: {
              narrativeSummary: updatedMemory.narrativeSummary,
              scores: analysis.scores,
              recommendation: analysis.recommendation,
              keyStrengths: analysis.keyStrengths,
              keyConcerns: analysis.keyConcerns,
              standoutQuote: analysis.standoutQuote,
              evidenceStrength: analysis.evidenceStrength,
            },
          });

          memoriesPersisted++;
        } catch (error) {
          console.error(`Failed to persist memory for ${readerId}:`, error);
        }
      }
    }

    // Persist deliverable to database if we have a real draft context
    if (effectiveDraftId && effectiveProjectId && !effectiveDraftId.startsWith('draft-')) {
      try {
        // Serialize to plain JSON for Prisma's Json fields
        const coverageJson = JSON.parse(JSON.stringify(coverage));
        const intakeJson = JSON.parse(JSON.stringify(intake));
        const scoresJson = JSON.parse(JSON.stringify(harmonizedScores));
        const perspectivesJson = JSON.parse(JSON.stringify(perspectives));
        const scoutJson = JSON.parse(JSON.stringify(scoutAnalysis));
        const calibrationJson = JSON.parse(JSON.stringify(calibration));

        await db.draftDeliverable.upsert({
          where: { draftId: effectiveDraftId },
          create: {
            draftId: effectiveDraftId,
            harmonizedCoverage: coverageJson,
            harmonizedIntake: intakeJson,
            harmonizedScores: scoresJson,
            readerPerspectives: perspectivesJson,
            scoutAnalysis: scoutJson,
            studioCalibration: calibrationJson,
          },
          update: {
            harmonizedCoverage: coverageJson,
            harmonizedIntake: intakeJson,
            harmonizedScores: scoresJson,
            readerPerspectives: perspectivesJson,
            scoutAnalysis: scoutJson,
            studioCalibration: calibrationJson,
          },
        });
      } catch (error) {
        console.error('Failed to persist deliverable:', error);
      }
    }

    // Update StudioIntelligence with new score data
    if (effectiveProjectId && !effectiveProjectId.startsWith('project-')) {
      try {
        // Get studioId from project
        const project = await db.project.findUnique({
          where: { id: effectiveProjectId },
          select: { studioId: true },
        });

        if (project?.studioId) {
          // Determine overall recommendation from perspectives
          const recommendations = perspectives.map((p) => p.recommendation.toLowerCase());
          const overallRecommendation = recommendations.some((r) => r.includes('recommend'))
            ? 'recommend'
            : recommendations.some((r) => r.includes('consider'))
            ? 'consider'
            : 'pass';

          await updateStudioIntelligence(
            project.studioId,
            harmonizedScores,
            overallRecommendation,
            script.genre,
            effectiveProjectId,
          );
        }
      } catch (error) {
        console.error('Failed to update studio intelligence:', error);
      }
    }

    // Emit the deliverable to the client via SSE
    emitEvent({
      source: 'system',
      type: 'deliverable_ready',
      data: lastDeliverable,
    });

    // Switch to coverage phase so the UI shows the Coverage tab
    emitEvent({
      source: 'system',
      type: 'phase_change',
      phase: 'idle', // Reset panel — coverage is shown in main tab
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          memoriesPersisted,
          projectId: effectiveProjectId,
          draftId: effectiveDraftId,
          harmonizedScores: {
            overall: harmonizedScores.overall,
            premise: harmonizedScores.premise,
            character: harmonizedScores.character,
            dialogue: harmonizedScores.dialogue,
            structure: harmonizedScores.structure,
            commerciality: harmonizedScores.commerciality,
          },
          scoutAnalysis: {
            consensusPoints: scoutAnalysis.consensusPoints,
            divergencePoints: scoutAnalysis.divergencePoints.map((d) => ({
              topic: d.topic,
              positions: d.positions,
              scoutTake: d.scoutTake,
            })),
            synthesisNarrative: scoutAnalysis.synthesisNarrative,
            confidenceLevel: scoutAnalysis.confidenceLevel,
            watchOuts: scoutAnalysis.watchOuts,
          },
          coverage: {
            logline: coverage.logline,
            strengths: coverage.strengths.slice(0, 5),
            weaknesses: coverage.weaknesses.slice(0, 5),
            overallAssessment: coverage.overallAssessment,
          },
          intake: {
            recommendation: intake.recommendationRationale,
            targetAudience: intake.targetAudience,
            marketPotential: intake.marketPotential,
          },
        }),
      }],
    };
  }
  );
}
