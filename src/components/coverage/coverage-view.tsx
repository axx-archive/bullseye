'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useDeliverable } from '@/hooks/use-studio';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { HarmonizedScoresDisplay } from '@/components/shared/score-indicator';
import { ReaderComparison } from '@/components/shared/reader-card';
import type { DraftDeliverable, ReaderPerspective, HarmonizedScores, ScoutAnalysis, StudioCalibration, CoverageReport, IntakeReport } from '@/types';

export function CoverageView() {
  const {
    currentDraft,
    currentDeliverable: zustandDeliverable,
    readerPerspectives: zustandPerspectives,
    showCalibration,
    toggleCalibration,
    expandedReaders,
    toggleReaderExpanded,
    expandAllReaders,
    collapseAllReaders,
    setActiveTab,
  } = useAppStore();

  const { data: fetchedDeliverable, isLoading } = useDeliverable(currentDraft?.id ?? null);

  const [activeSection, setActiveSection] = useState<'coverage' | 'intake'>('coverage');

  // Prefer Zustand deliverable (live/streaming data) over fetched API data
  const deliverable: DraftDeliverable | null = zustandDeliverable ?? (fetchedDeliverable ? {
    id: fetchedDeliverable.id,
    draftId: fetchedDeliverable.draftId,
    projectId: '',
    createdAt: new Date(fetchedDeliverable.createdAt),
    harmonizedCoverage: fetchedDeliverable.harmonizedCoverage as CoverageReport,
    harmonizedIntake: fetchedDeliverable.harmonizedIntake as IntakeReport,
    harmonizedScores: fetchedDeliverable.harmonizedScores as HarmonizedScores,
    readerPerspectives: fetchedDeliverable.readerPerspectives as ReaderPerspective[],
    scoutAnalysis: fetchedDeliverable.scoutAnalysis as ScoutAnalysis,
    studioCalibration: fetchedDeliverable.studioCalibration as StudioCalibration,
  } : null);

  const readerPerspectives: ReaderPerspective[] = zustandPerspectives.length > 0
    ? zustandPerspectives
    : (deliverable?.readerPerspectives ?? []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!deliverable) {
    return <EmptyState onGoToScout={() => setActiveTab('scout')} />;
  }

  const { harmonizedCoverage, harmonizedScores, scoutAnalysis, studioCalibration } = deliverable;

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="max-w-4xl mx-auto space-y-6 py-4">
          {/* Title section */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{harmonizedCoverage.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {harmonizedCoverage.genre} / {harmonizedCoverage.format} / {harmonizedCoverage.pageCount}p
              </p>
            </div>
            <button
              onClick={toggleCalibration}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground bg-surface border border-border/50 hover:border-border transition-colors"
            >
              {showCalibration ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showCalibration ? 'Hide' : 'Show'} Calibration
            </button>
          </div>

          {/* Scores */}
          <div className="rounded-2xl bg-surface border border-border/50 p-6">
            <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-5">
              Harmonized Scores
            </h3>
            <HarmonizedScoresDisplay
              scores={harmonizedScores}
              showCalibration={showCalibration}
            />
          </div>

          {/* Reader perspectives */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Reader Perspectives
              </h3>
              <div className="flex gap-1">
                <button onClick={expandAllReaders} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={collapseAllReaders} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <ReaderComparison
              perspectives={readerPerspectives}
              expandedReaders={expandedReaders}
              onExpandReader={toggleReaderExpanded}
            />
          </div>

          {/* Scout analysis */}
          <div className="rounded-2xl bg-surface border border-border/50 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Scout Analysis
              </h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-elevated text-muted-foreground uppercase">
                {scoutAnalysis.confidenceLevel}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-foreground/85">
              {scoutAnalysis.synthesisNarrative}
            </p>

            {scoutAnalysis.consensusPoints.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold tracking-wider text-success uppercase mb-2">
                  Consensus
                </h4>
                <ul className="space-y-1.5">
                  {scoutAnalysis.consensusPoints.map((point, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                      <span className="text-success mt-0.5">+</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scoutAnalysis.divergencePoints.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold tracking-wider text-warning uppercase mb-2">
                  Divergence
                </h4>
                <div className="space-y-3">
                  {scoutAnalysis.divergencePoints.map((div, i) => (
                    <div key={i} className="p-4 rounded-xl bg-elevated/60">
                      <h5 className="text-xs font-medium mb-2">{div.topic}</h5>
                      <div className="space-y-1 mb-2">
                        {div.positions.map((pos, j) => (
                          <p key={j} className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/70">{pos.readerName}:</span>{' '}
                            {pos.position}
                          </p>
                        ))}
                      </div>
                      <p className="text-[11px] italic text-foreground/60">{div.scoutTake}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scoutAnalysis.watchOuts.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold tracking-wider text-danger uppercase mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Watch-Outs
                </h4>
                <ul className="space-y-1.5">
                  {scoutAnalysis.watchOuts.map((w, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                      <span className="text-danger mt-0.5">!</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Coverage / Intake toggle */}
          <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden">
            {/* Tab header */}
            <div className="flex border-b border-border/50">
              <button
                onClick={() => setActiveSection('coverage')}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${
                  activeSection === 'coverage'
                    ? 'text-foreground border-b-2 border-bullseye-gold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Full Coverage
              </button>
              <button
                onClick={() => setActiveSection('intake')}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${
                  activeSection === 'intake'
                    ? 'text-foreground border-b-2 border-bullseye-gold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Intake Report
              </button>
            </div>

            <div className="p-6">
              {activeSection === 'coverage' ? (
                <CoverageContent coverage={harmonizedCoverage} />
              ) : (
                <IntakeContent intake={deliverable.harmonizedIntake} />
              )}
            </div>
          </div>

          {/* Calibration */}
          {showCalibration && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface border border-border/50 p-6 space-y-4"
            >
              <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Studio Calibration
              </h3>
              <p className="text-sm leading-relaxed text-foreground/85">
                {studioCalibration.comparisonNarrative}
              </p>
              {studioCalibration.genreContext && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Genre:</span> {studioCalibration.genreContext}
                </p>
              )}
              {studioCalibration.similarProjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {studioCalibration.similarProjects.map((project, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-elevated text-muted-foreground">
                      {project}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CoverageContent({ coverage }: { coverage: CoverageReport }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Logline</h3>
        <p className="text-sm font-medium leading-relaxed">{coverage.logline}</p>
      </section>

      <div className="h-px bg-border/50" />

      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Synopsis</h3>
        <p className="text-sm leading-relaxed text-foreground/85">{coverage.synopsis}</p>
      </section>

      <div className="h-px bg-border/50" />

      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">Analysis</h3>
        <AnalysisBlock title="Premise" content={coverage.premiseAnalysis} />
        <AnalysisBlock title="Character" content={coverage.characterAnalysis} />
        <AnalysisBlock title="Dialogue" content={coverage.dialogueAnalysis} />
        <AnalysisBlock title="Structure" content={coverage.structureAnalysis} />
        <AnalysisBlock title="Commerciality" content={coverage.commercialityAnalysis} />
      </section>

      <div className="h-px bg-border/50" />

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="text-[10px] font-semibold tracking-wider text-success uppercase mb-2">Strengths</h3>
          <ul className="space-y-1.5">
            {coverage.strengths.map((s, i) => (
              <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                <span className="text-success">+</span>{s}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[10px] font-semibold tracking-wider text-danger uppercase mb-2">Weaknesses</h3>
          <ul className="space-y-1.5">
            {coverage.weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                <span className="text-danger">-</span>{w}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="h-px bg-border/50" />

      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Assessment</h3>
        <p className="text-sm leading-relaxed text-foreground/85">{coverage.overallAssessment}</p>
      </section>
    </div>
  );
}

function AnalysisBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="p-4 rounded-xl bg-elevated/50">
      <h4 className="text-xs font-medium mb-1.5">{title}</h4>
      <p className="text-xs leading-relaxed text-foreground/70">{content}</p>
    </div>
  );
}

function IntakeContent({ intake }: { intake: IntakeReport }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Format', value: intake.format },
          { label: 'Genre', value: intake.genre },
          { label: 'Target Audience', value: intake.targetAudience },
          { label: 'Market Potential', value: intake.marketPotential },
        ].map(({ label, value }) => (
          <div key={label}>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ))}
        <div className="col-span-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget Range</span>
          <p className="text-sm font-medium mt-0.5">{intake.budgetRange}</p>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Logline</h3>
        <p className="text-sm leading-relaxed">{intake.logline}</p>
      </section>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="text-[10px] font-semibold tracking-wider text-success uppercase mb-2">What Works</h3>
          <ul className="space-y-1.5">
            {intake.whatWorks.map((w, i) => (
              <li key={i} className="text-xs text-foreground/80">{w}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[10px] font-semibold tracking-wider text-warning uppercase mb-2">Needs Work</h3>
          <ul className="space-y-1.5">
            {intake.whatNeeds.map((n, i) => (
              <li key={i} className="text-xs text-foreground/80">{n}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="h-px bg-border/50" />

      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Recommendation</h3>
        <p className="text-sm leading-relaxed text-foreground/85">{intake.recommendationRationale}</p>
      </section>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto space-y-6 py-4 px-4">
        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-48 bg-elevated rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-elevated rounded-lg animate-pulse" />
        </div>

        {/* Score bar skeletons */}
        <div className="rounded-2xl bg-surface border border-border/50 p-6 space-y-4">
          <div className="h-3 w-32 bg-elevated rounded animate-pulse" />
          <div className="p-5 rounded-2xl bg-elevated/60 border border-border/50">
            <div className="h-5 w-full bg-elevated rounded animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-24 bg-elevated rounded animate-pulse" />
              <div className="flex gap-[2px]">
                {[...Array(10)].map((_, j) => (
                  <div key={j} className="w-2 h-4 bg-elevated rounded-[2px] animate-pulse" />
                ))}
              </div>
              <div className="h-3 w-16 bg-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Reader card skeletons */}
        <div className="space-y-4">
          <div className="h-4 w-36 bg-elevated rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface border border-border/50 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-elevated animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 bg-elevated rounded animate-pulse" />
                    <div className="h-3 w-16 bg-elevated rounded animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="h-2.5 w-14 bg-elevated rounded animate-pulse" />
                      <div className="flex gap-[1px]">
                        {[...Array(5)].map((_, k) => (
                          <div key={k} className="w-1.5 h-3 bg-elevated rounded-[1px] animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-12 bg-elevated rounded animate-pulse" />
                  <div className="flex-1 h-1 bg-elevated rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onGoToScout }: { onGoToScout: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-sm"
      >
        <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-5">
          <BarChart3 className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight mb-2">No Coverage Yet</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Run analysis from Scout to see coverage
        </p>
        <button
          onClick={onGoToScout}
          className="text-sm font-medium text-bullseye-gold hover:text-bullseye-gold/80 transition-colors"
        >
          Go to Scout →
        </button>
      </motion.div>
    </div>
  );
}
