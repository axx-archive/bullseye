// BULLSEYE Analysis API Route
// Orchestrates full script analysis with reader panel

import { NextRequest, NextResponse } from 'next/server';
import {
  runParallelReaderAnalysis,
  analysisToReaderPerspective,
} from '@/lib/agents';
import {
  harmonizeScores,
  synthesizeCoverage,
  synthesizeIntake,
  generateScoutAnalysis,
} from '@/lib/harmonization';
import {
  studioIntelligenceService,
  calibrationContextBuilder,
  PercentileCalculator,
} from '@/lib/studio-intelligence';
import type { StudioIntelligenceData } from '@/lib/studio-intelligence';
import type {
  DraftDeliverable,
  ReaderPerspective,
  StudioCalibration,
} from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { scriptText, metadata, readerIds, studioId } = await req.json();

    if (!scriptText || !metadata) {
      return NextResponse.json(
        { error: 'Missing script text or metadata' },
        { status: 400 }
      );
    }

    // Default readers if not specified
    const readers = readerIds || ['reader-maya', 'reader-colton', 'reader-devon'];

    // Initialize or get studio intelligence
    let studioIntelligence: StudioIntelligenceData;
    if (studioId) {
      // In production, fetch from database
      studioIntelligence = studioIntelligenceService.initializeStudioIntelligence(studioId);
    } else {
      studioIntelligence = studioIntelligenceService.initializeStudioIntelligence('default');
    }

    // Build calibration context
    const calibrationContext = calibrationContextBuilder.buildCalibrationContext(
      studioIntelligence,
      metadata.genre
    );

    // Run parallel reader analysis
    const readerAnalyses = await runParallelReaderAnalysis(
      scriptText,
      readers,
      calibrationContext
    );

    if (readerAnalyses.size === 0) {
      return NextResponse.json(
        { error: 'All reader analyses failed' },
        { status: 500 }
      );
    }

    // Convert to reader perspectives
    const perspectives: ReaderPerspective[] = [];
    for (const [readerId, analysis] of readerAnalyses) {
      perspectives.push(analysisToReaderPerspective(readerId, analysis));
    }

    // Harmonize scores
    const harmonizedScores = harmonizeScores(perspectives, studioIntelligence);

    // Calculate percentiles and build calibration
    const percentileCalculator = new PercentileCalculator(studioIntelligence.scoreDistributions);
    const studioCalibration: StudioCalibration = {
      ...percentileCalculator.calculateAllPercentiles({
        premise: harmonizedScores.premise.rating,
        character: harmonizedScores.character.rating,
        dialogue: harmonizedScores.dialogue.rating,
        structure: harmonizedScores.structure.rating,
        commerciality: harmonizedScores.commerciality.rating,
        overall: harmonizedScores.overall.rating,
        premiseNumeric: harmonizedScores.premise.numeric,
        characterNumeric: harmonizedScores.character.numeric,
        dialogueNumeric: harmonizedScores.dialogue.numeric,
        structureNumeric: harmonizedScores.structure.numeric,
        commercialityNumeric: harmonizedScores.commerciality.numeric,
        overallNumeric: harmonizedScores.overall.numeric,
      }),
      comparisonNarrative: await calibrationContextBuilder.generateComparisonNarrative(
        harmonizedScores,
        metadata.genre,
        studioIntelligence
      ),
      similarProjects: [],
      genreContext: studioIntelligence.genreNarratives[metadata.genre] || '',
    };

    // Synthesize coverage
    const harmonizedCoverage = synthesizeCoverage(perspectives, readerAnalyses, {
      title: metadata.title,
      author: metadata.author || 'Unknown',
      genre: metadata.genre,
      format: metadata.format,
      pageCount: metadata.pageCount || 100,
    });

    // Synthesize intake
    const harmonizedIntake = synthesizeIntake(
      harmonizedCoverage,
      harmonizedScores,
      perspectives
    );

    // Generate Scout analysis
    const scoutAnalysis = generateScoutAnalysis(perspectives, harmonizedScores);

    // Build deliverable
    const deliverable: DraftDeliverable = {
      id: `deliverable-${Date.now()}`,
      draftId: metadata.draftId || `draft-${Date.now()}`,
      projectId: metadata.projectId || `project-${Date.now()}`,
      createdAt: new Date(),

      harmonizedCoverage,
      harmonizedIntake,
      harmonizedScores,

      readerPerspectives: perspectives,
      scoutAnalysis,
      studioCalibration,
    };

    return NextResponse.json({
      success: true,
      deliverable,
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze script', details: String(error) },
      { status: 500 }
    );
  }
}
