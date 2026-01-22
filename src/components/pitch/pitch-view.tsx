'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Presentation,
  Play,
  ThumbsUp,
  ThumbsDown,
  Building2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { DEFAULT_EXECUTIVES } from '@/lib/executive';
import type { ExecutiveEvaluationResult, ExecutiveVerdict } from '@/types';

export function PitchView() {
  const {
    currentDeliverable,
    evaluations,
    isEvaluating,
    currentExecutive,
    startEvaluation,
    addEvaluation,
    setCurrentExecutive,
    clearEvaluations,
    endEvaluation,
  } = useAppStore();

  const [selectedExecutives, setSelectedExecutives] = useState<string[]>([]);

  const handleToggleExecutive = (execId: string) => {
    setSelectedExecutives((prev) =>
      prev.includes(execId)
        ? prev.filter((id) => id !== execId)
        : [...prev, execId]
    );
  };

  const handleRunSimulation = async () => {
    if (selectedExecutives.length === 0) return;

    startEvaluation();
    clearEvaluations();

    // Simulate evaluations
    for (const execId of selectedExecutives) {
      setCurrentExecutive(execId);
      await delay(2000);

      const exec = DEFAULT_EXECUTIVES.find((e) => e.id === execId);
      if (!exec) continue;

      // Generate mock evaluation
      const verdict: ExecutiveVerdict = Math.random() > 0.4 ? 'pursue' : 'pass';
      const evaluation: ExecutiveEvaluationResult = {
        executiveId: exec.id,
        executiveName: exec.name,
        executiveTitle: exec.title,
        company: exec.company,
        verdict,
        confidence: Math.floor(60 + Math.random() * 35),
        rationale:
          verdict === 'pursue'
            ? `This project aligns well with our current slate strategy. The character work is exceptional, and I see strong potential for ${exec.priorityFactors[0].toLowerCase()}. The structural concerns raised in the coverage are addressable in development.`
            : `While the premise is intriguing, I have concerns about market positioning. The structural issues would require significant development investment, and given our current priorities around ${exec.priorityFactors[0].toLowerCase()}, this isn't the right fit for us at this time.`,
        keyFactors: exec.priorityFactors.slice(0, 3),
        concerns: exec.dealBreakers.slice(0, 2),
        groundedInCoverage: true,
        citedElements: ['Character analysis', 'Commerciality assessment', 'Structure concerns'],
      };

      addEvaluation(evaluation);
    }

    endEvaluation();
  };

  if (!currentDeliverable) {
    return <EmptyState />;
  }

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Presentation className="w-7 h-7 text-primary" />
                Executive Pitch Simulation
              </h1>
              <p className="text-muted-foreground mt-1">
                Simulate how industry executives would evaluate this project
              </p>
            </div>
          </div>

          {/* Executive selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Executives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DEFAULT_EXECUTIVES.map((exec) => {
                  const isSelected = selectedExecutives.includes(exec.id);
                  const hasEvaluation = evaluations.find((e) => e.executiveId === exec.id);
                  const isCurrentlyEvaluating = currentExecutive === exec.id;

                  return (
                    <div
                      key={exec.id}
                      className={cn(
                        'relative p-4 rounded-lg border-2 transition-all cursor-pointer',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50',
                        hasEvaluation && 'opacity-80'
                      )}
                      onClick={() => !isEvaluating && handleToggleExecutive(exec.id)}
                    >
                      {isCurrentlyEvaluating && (
                        <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}

                      {hasEvaluation && (
                        <div className="absolute top-2 right-2">
                          {hasEvaluation.verdict === 'pursue' ? (
                            <ThumbsUp className="w-5 h-5 text-success" />
                          ) : (
                            <ThumbsDown className="w-5 h-5 text-danger" />
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          className="mt-1"
                          disabled={isEvaluating}
                        />
                        <div>
                          <h4 className="font-semibold">{exec.name}</h4>
                          <p className="text-sm text-muted-foreground">{exec.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Building2 className="w-3 h-3" />
                            {exec.company}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedExecutives.length} executive(s) selected
                </span>
                <Button
                  onClick={handleRunSimulation}
                  disabled={selectedExecutives.length === 0 || isEvaluating}
                  className="gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Simulation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Evaluation results */}
          {evaluations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Evaluation Results</h2>

              {/* Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-success">
                        {evaluations.filter((e) => e.verdict === 'pursue').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Pursue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-danger">
                        {evaluations.filter((e) => e.verdict === 'pass').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Pass</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-2">
                        Success Rate
                      </div>
                      <Progress
                        value={
                          (evaluations.filter((e) => e.verdict === 'pursue').length /
                            evaluations.length) *
                          100
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual evaluations */}
              <AnimatePresence>
                {evaluations.map((evaluation, index) => (
                  <motion.div
                    key={evaluation.executiveId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ExecutiveEvaluationCard evaluation={evaluation} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Executive evaluation card
function ExecutiveEvaluationCard({ evaluation }: { evaluation: ExecutiveEvaluationResult }) {
  const isPursue = evaluation.verdict === 'pursue';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={isPursue ? 'bg-success/20' : 'bg-danger/20'}>
                {evaluation.executiveName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{evaluation.executiveName}</h3>
              <p className="text-sm text-muted-foreground">
                {evaluation.executiveTitle}, {evaluation.company}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={isPursue ? 'default' : 'destructive'}
              className="text-lg px-4 py-1 gap-2"
            >
              {isPursue ? (
                <ThumbsUp className="w-4 h-4" />
              ) : (
                <ThumbsDown className="w-4 h-4" />
              )}
              {evaluation.verdict.toUpperCase()}
            </Badge>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <p className="font-bold">{evaluation.confidence}%</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rationale */}
        <div className="p-4 rounded-lg bg-elevated">
          <p className="text-sm leading-relaxed">{evaluation.rationale}</p>
        </div>

        {/* Key factors and concerns */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 text-success">Key Factors</h4>
            <ul className="space-y-1">
              {evaluation.keyFactors.map((factor, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 text-danger">Concerns</h4>
            <ul className="space-y-1">
              {evaluation.concerns.map((concern, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-danger">-</span>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Cited elements */}
        {evaluation.groundedInCoverage && (
          <div className="pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Grounded in: {evaluation.citedElements.join(', ')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <Presentation className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Coverage Available</h2>
        <p className="text-muted-foreground mb-4">
          Run a script analysis first to enable executive pitch simulations.
        </p>
        <Button variant="outline">Go to Scout</Button>
      </div>
    </div>
  );
}

// Helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
