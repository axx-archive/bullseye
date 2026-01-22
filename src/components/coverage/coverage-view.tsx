'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { HarmonizedScoresDisplay } from '@/components/shared/score-indicator';
import { ReaderComparison } from '@/components/shared/reader-card';
import type { DraftDeliverable, ReaderPerspective } from '@/types';

export function CoverageView() {
  const {
    currentDeliverable,
    readerPerspectives,
    showCalibration,
    toggleCalibration,
    expandedReaders,
    toggleReaderExpanded,
    expandAllReaders,
    collapseAllReaders,
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<'coverage' | 'intake'>('coverage');

  // If no deliverable, show empty state
  if (!currentDeliverable) {
    return <EmptyState />;
  }

  const { harmonizedCoverage, harmonizedScores, scoutAnalysis, studioCalibration } =
    currentDeliverable;

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{harmonizedCoverage.title}</h1>
              <p className="text-muted-foreground">
                {harmonizedCoverage.genre} | {harmonizedCoverage.format} |{' '}
                {harmonizedCoverage.pageCount} pages
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCalibration}
                className="gap-2"
              >
                {showCalibration ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showCalibration ? 'Hide' : 'Show'} Calibration
              </Button>
            </div>
          </div>

          {/* Main scores card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Harmonized Scores</CardTitle>
                {showCalibration && (
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {studioCalibration.overallPercentile}th percentile
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <HarmonizedScoresDisplay
                scores={harmonizedScores}
                showCalibration={showCalibration}
              />
            </CardContent>
          </Card>

          {/* Reader perspectives */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Reader Perspectives
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAllReaders}>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAllReaders}>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReaderComparison
                perspectives={readerPerspectives}
                expandedReaders={expandedReaders}
                onExpandReader={toggleReaderExpanded}
              />
            </CardContent>
          </Card>

          {/* Scout analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scout Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Confidence indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <Badge
                  variant={
                    scoutAnalysis.confidenceLevel === 'high'
                      ? 'default'
                      : scoutAnalysis.confidenceLevel === 'medium'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {scoutAnalysis.confidenceLevel.toUpperCase()}
                </Badge>
              </div>

              {/* Synthesis narrative */}
              <div className="p-4 rounded-lg bg-elevated">
                <p className="text-sm leading-relaxed">{scoutAnalysis.synthesisNarrative}</p>
              </div>

              {/* Consensus points */}
              {scoutAnalysis.consensusPoints.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-success">
                    Consensus Points
                  </h4>
                  <ul className="space-y-1">
                    {scoutAnalysis.consensusPoints.map((point, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-success">+</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Divergence points */}
              {scoutAnalysis.divergencePoints.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-warning">
                    Divergence Points
                  </h4>
                  <div className="space-y-3">
                    {scoutAnalysis.divergencePoints.map((div, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-elevated border-l-2 border-warning"
                      >
                        <h5 className="font-medium mb-1">{div.topic}</h5>
                        <div className="space-y-1 mb-2">
                          {div.positions.map((pos, j) => (
                            <p key={j} className="text-sm text-muted-foreground">
                              <span className="font-medium">{pos.readerName}:</span>{' '}
                              {pos.position}
                            </p>
                          ))}
                        </div>
                        <p className="text-sm italic">{div.scoutTake}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Watch-outs */}
              {scoutAnalysis.watchOuts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-danger">
                    <AlertTriangle className="w-4 h-4" />
                    Watch-Outs
                  </h4>
                  <ul className="space-y-1">
                    {scoutAnalysis.watchOuts.map((watchOut, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-danger">!</span>
                        {watchOut}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coverage/Intake tabs */}
          <Card>
            <CardHeader>
              <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as 'coverage' | 'intake')}>
                <TabsList>
                  <TabsTrigger value="coverage" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Full Coverage
                  </TabsTrigger>
                  <TabsTrigger value="intake" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Intake Report
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {activeSection === 'coverage' ? (
                <CoverageContent coverage={harmonizedCoverage} />
              ) : (
                <IntakeContent intake={currentDeliverable.harmonizedIntake} />
              )}
            </CardContent>
          </Card>

          {/* Calibration context */}
          {showCalibration && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Studio Calibration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-4">
                  {studioCalibration.comparisonNarrative}
                </p>
                {studioCalibration.genreContext && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Genre context:</strong> {studioCalibration.genreContext}
                  </p>
                )}
                {studioCalibration.similarProjects.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Similar Projects</h4>
                    <div className="flex flex-wrap gap-2">
                      {studioCalibration.similarProjects.map((project, i) => (
                        <Badge key={i} variant="outline">
                          {project}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Coverage content sections
function CoverageContent({ coverage }: { coverage: DraftDeliverable['harmonizedCoverage'] }) {
  return (
    <div className="space-y-6">
      {/* Logline */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">LOGLINE</h3>
        <p className="text-lg font-medium">{coverage.logline}</p>
      </section>

      <Separator />

      {/* Synopsis */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">SYNOPSIS</h3>
        <p className="text-sm leading-relaxed">{coverage.synopsis}</p>
      </section>

      <Separator />

      {/* Analysis sections */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">ANALYSIS</h3>

        <div className="space-y-4">
          <AnalysisSection title="Premise" content={coverage.premiseAnalysis} />
          <AnalysisSection title="Character" content={coverage.characterAnalysis} />
          <AnalysisSection title="Dialogue" content={coverage.dialogueAnalysis} />
          <AnalysisSection title="Structure" content={coverage.structureAnalysis} />
          <AnalysisSection title="Commerciality" content={coverage.commercialityAnalysis} />
        </div>
      </section>

      <Separator />

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="text-sm font-semibold text-success mb-2">STRENGTHS</h3>
          <ul className="space-y-2">
            {coverage.strengths.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-success">+</span>
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-danger mb-2">WEAKNESSES</h3>
          <ul className="space-y-2">
            {coverage.weaknesses.map((w, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-danger">-</span>
                {w}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Separator />

      {/* Overall assessment */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          OVERALL ASSESSMENT
        </h3>
        <p className="text-sm leading-relaxed">{coverage.overallAssessment}</p>
      </section>
    </div>
  );
}

function AnalysisSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="p-4 rounded-lg bg-elevated">
      <h4 className="font-medium mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
    </div>
  );
}

// Intake content
function IntakeContent({ intake }: { intake: DraftDeliverable['harmonizedIntake'] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Format:</span>
          <p className="font-medium">{intake.format}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Genre:</span>
          <p className="font-medium">{intake.genre}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Target Audience:</span>
          <p className="font-medium">{intake.targetAudience}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Market Potential:</span>
          <p className="font-medium">{intake.marketPotential}</p>
        </div>
        <div className="col-span-2">
          <span className="text-sm text-muted-foreground">Budget Range:</span>
          <p className="font-medium">{intake.budgetRange}</p>
        </div>
      </div>

      <Separator />

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">LOGLINE</h3>
        <p>{intake.logline}</p>
      </section>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="text-sm font-semibold text-success mb-2">WHAT WORKS</h3>
          <ul className="space-y-2">
            {intake.whatWorks.map((w, i) => (
              <li key={i} className="text-sm">{w}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-warning mb-2">WHAT NEEDS WORK</h3>
          <ul className="space-y-2">
            {intake.whatNeeds.map((n, i) => (
              <li key={i} className="text-sm">{n}</li>
            ))}
          </ul>
        </section>
      </div>

      <Separator />

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          RECOMMENDATION RATIONALE
        </h3>
        <p className="text-sm leading-relaxed">{intake.recommendationRationale}</p>
      </section>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Coverage Yet</h2>
        <p className="text-muted-foreground mb-4">
          Upload a script and run analysis to generate coverage with harmonized scores from
          our reader panel.
        </p>
        <Button className="gap-2">
          <FileText className="w-4 h-4" />
          Upload Script
        </Button>
      </div>
    </div>
  );
}
