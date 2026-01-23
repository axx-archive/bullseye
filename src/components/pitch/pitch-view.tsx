'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useExecutiveProfiles, useEvaluations } from '@/hooks/use-studio';
import { useDeliverable } from '@/hooks/use-studio';
import { createSSEConnection, type EventRouterCallbacks } from '@/lib/agent-sdk/event-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Briefcase,
  Play,
  ThumbsUp,
  ThumbsDown,
  Building2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function PitchView() {
  const {
    currentDraft,
    currentDeliverable,
    executiveStates,
    setExecutiveState,
    clearExecutiveStates,
    setRightPanelMode,
    setActiveTab,
  } = useAppStore();

  const connectionRef = useRef<{ abort: () => void } | null>(null);

  // Fetch real executive profiles from DB
  const { data: executives, isLoading: executivesLoading } = useExecutiveProfiles();

  // Fetch persisted evaluations for current draft
  const { data: evaluations, isLoading: evaluationsLoading } = useEvaluations(currentDraft?.id ?? null);

  // Fetch deliverable to know if coverage analysis has been run
  const { data: apiDeliverable, isLoading: deliverableLoading } = useDeliverable(currentDraft?.id ?? null);

  // Use Zustand currentDeliverable (live) or API fetched data
  const hasDeliverable = !!currentDeliverable || (apiDeliverable !== null && apiDeliverable !== undefined);

  // Check if currently evaluating (any executive in 'evaluating' state)
  const isEvaluating = Array.from(executiveStates.values()).some(
    (state) => state.status === 'evaluating'
  );

  const handleRunSimulation = () => {
    if (!currentDraft || !executives || executives.length === 0) return;

    clearExecutiveStates();

    // Build the SSE callbacks — only wire executive callbacks
    const callbacks: EventRouterCallbacks = {
      onScoutTextDelta: () => {},
      onScoutTextComplete: () => {},
      onReaderStart: () => {},
      onReaderProgress: () => {},
      onReaderComplete: () => {},
      onReaderError: () => {},
      onDeliverableReady: () => {},
      onFocusGroupMessage: () => {},
      onFocusGroupTyping: () => {},
      onFocusGroupComplete: () => {},
      onExecutiveStart: (executiveId, executiveName) => {
        setExecutiveState(executiveId, { executiveId, executiveName, status: 'evaluating' });
      },
      onExecutiveComplete: (executiveId, data) => {
        setExecutiveState(executiveId, {
          status: 'complete',
          verdict: data.verdict,
          confidence: data.confidence,
          rationale: data.rationale,
          keyFactors: data.keyFactors,
          concerns: data.concerns,
        });
      },
      onPhaseChange: (phase) => {
        if (phase === 'executive') {
          setRightPanelMode('executive');
        }
      },
      onToolStart: () => {},
      onToolEnd: () => {},
      onResult: () => {},
      onError: () => {},
    };

    // Send message to Scout requesting executive evaluation
    const requestPayload = {
      messages: [
        {
          role: 'user' as const,
          content: 'Run executive evaluation on the current draft.',
        },
      ],
    };

    connectionRef.current = createSSEConnection('/api/scout', requestPayload, callbacks);
  };

  // Loading state
  if (executivesLoading || evaluationsLoading || deliverableLoading) {
    return <LoadingSkeleton />;
  }

  // Empty state: no draft selected
  if (!currentDraft) {
    return (
      <EmptyState
        title="Select a Project"
        description="Choose a project and draft from Home to run executive evaluations."
        onAction={() => setActiveTab('home')}
        actionLabel="Go to Home"
      />
    );
  }

  // Empty state: no deliverable (coverage not run yet)
  if (!hasDeliverable) {
    return (
      <EmptyState
        title="No Evaluations Yet"
        description="Complete coverage analysis first, then run executive evaluations from here."
        onAction={() => setActiveTab('scout')}
        actionLabel="Go to Scout"
      />
    );
  }

  // Merge persisted evaluations with live streaming states
  const liveExecStates = Array.from(executiveStates.entries());
  const hasLiveResults = liveExecStates.some(([, state]) => state.status === 'complete');

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Briefcase className="w-7 h-7 text-primary" />
                Executive Pitch Simulation
              </h1>
              <p className="text-muted-foreground mt-1">
                Simulate how industry executives would evaluate this project
              </p>
            </div>
          </div>

          {/* Executive grid + Run button */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Executive Panel</h2>
                <Button
                  onClick={handleRunSimulation}
                  disabled={isEvaluating || !executives || executives.length === 0}
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
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {executives?.map((exec) => {
                  const liveState = executiveStates.get(exec.id);
                  const isCurrentlyEvaluating = liveState?.status === 'evaluating';

                  return (
                    <div
                      key={exec.id}
                      className="relative p-4 rounded-lg border border-border"
                    >
                      {isCurrentlyEvaluating && (
                        <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center z-10">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-elevated text-sm">
                            {exec.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
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
            </CardContent>
          </Card>

          {/* Live streaming results */}
          {hasLiveResults && (
            <LiveResults executiveStates={executiveStates} />
          )}

          {/* Persisted evaluation results */}
          {evaluations && evaluations.length > 0 && !hasLiveResults && (
            <PersistedResults evaluations={evaluations} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// LIVE RESULTS (from streaming executive states)
// ============================================

interface ExecutiveStreamState {
  executiveId: string;
  executiveName: string;
  status: 'evaluating' | 'complete';
  verdict?: string;
  confidence?: number;
  rationale?: string;
  keyFactors?: string[];
  concerns?: string[];
}

function LiveResults({ executiveStates }: { executiveStates: Map<string, ExecutiveStreamState> }) {
  const completedStates = Array.from(executiveStates.values()).filter(
    (s) => s.status === 'complete'
  );
  const pursueCount = completedStates.filter((s) => s.verdict === 'pursue' || s.verdict === 'PURSUE').length;
  const passCount = completedStates.filter((s) => s.verdict === 'pass' || s.verdict === 'PASS').length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Evaluation Results</h2>

      {completedStates.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">{pursueCount}</div>
                <div className="text-sm text-muted-foreground">Pursue</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-danger">{passCount}</div>
                <div className="text-sm text-muted-foreground">Pass</div>
              </div>
              {completedStates.length > 0 && (
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground mb-2">Success Rate</div>
                  <Progress value={(pursueCount / completedStates.length) * 100} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {completedStates.map((state, index) => (
          <motion.div
            key={state.executiveId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <LiveEvaluationCard state={state} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function LiveEvaluationCard({ state }: { state: ExecutiveStreamState }) {
  const isPursue = state.verdict === 'pursue' || state.verdict === 'PURSUE';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={isPursue ? 'bg-success/20' : 'bg-danger/20'}>
                {state.executiveName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{state.executiveName}</h3>
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
              {isPursue ? 'PURSUE' : 'PASS'}
            </Badge>
            {state.confidence !== undefined && (
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Confidence</span>
                <p className="font-bold">{state.confidence}%</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.rationale && (
          <div className="p-4 rounded-lg bg-elevated">
            <p className="text-sm leading-relaxed">{state.rationale}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {state.keyFactors && state.keyFactors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-success">Key Factors</h4>
              <ul className="space-y-1">
                {state.keyFactors.map((factor, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.concerns && state.concerns.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-danger">Concerns</h4>
              <ul className="space-y-1">
                {state.concerns.map((concern, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-danger">-</span>
                    {concern}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PERSISTED RESULTS (from API)
// ============================================

interface EvaluationData {
  id: string;
  draftId: string;
  executiveId: string;
  verdict: 'PURSUE' | 'PASS';
  confidence: number;
  rationale: string;
  keyFactors: string[];
  concerns: string[];
  groundedInCoverage: boolean;
  citedElements: string[];
  createdAt: string;
  executive: {
    id: string;
    name: string;
    title: string;
    company: string;
    avatar: string | null;
  };
}

function PersistedResults({ evaluations }: { evaluations: EvaluationData[] }) {
  const pursueCount = evaluations.filter((e) => e.verdict === 'PURSUE').length;
  const passCount = evaluations.filter((e) => e.verdict === 'PASS').length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Evaluation Results</h2>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">{pursueCount}</div>
              <div className="text-sm text-muted-foreground">Pursue</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-danger">{passCount}</div>
              <div className="text-sm text-muted-foreground">Pass</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">Success Rate</div>
              <Progress value={(pursueCount / evaluations.length) * 100} />
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {evaluations.map((evaluation, index) => (
          <motion.div
            key={evaluation.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <PersistedEvaluationCard evaluation={evaluation} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function PersistedEvaluationCard({ evaluation }: { evaluation: EvaluationData }) {
  const isPursue = evaluation.verdict === 'PURSUE';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={isPursue ? 'bg-success/20' : 'bg-danger/20'}>
                {evaluation.executive.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{evaluation.executive.name}</h3>
              <p className="text-sm text-muted-foreground">
                {evaluation.executive.title}, {evaluation.executive.company}
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
              {evaluation.verdict}
            </Badge>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <p className="font-bold">{evaluation.confidence}%</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-elevated">
          <p className="text-sm leading-relaxed">{evaluation.rationale}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {evaluation.keyFactors.length > 0 && (
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
          )}

          {evaluation.concerns.length > 0 && (
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
          )}
        </div>

        {evaluation.groundedInCoverage && evaluation.citedElements.length > 0 && (
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

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-72 rounded bg-elevated animate-pulse" />
          <div className="h-5 w-96 rounded bg-elevated animate-pulse" />
        </div>

        {/* Executive grid skeleton */}
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="h-6 w-40 rounded bg-elevated animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg border border-border space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-elevated animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 rounded bg-elevated animate-pulse" />
                    <div className="h-3 w-24 rounded bg-elevated animate-pulse" />
                    <div className="h-3 w-40 rounded bg-elevated animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-44 rounded bg-elevated animate-pulse" />
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-elevated animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-36 rounded bg-elevated animate-pulse" />
                    <div className="h-3 w-48 rounded bg-elevated animate-pulse" />
                  </div>
                </div>
                <div className="h-8 w-24 rounded bg-elevated animate-pulse" />
              </div>
              <div className="h-20 rounded bg-elevated animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({
  title,
  description,
  onAction,
  actionLabel,
}: {
  title: string;
  description: string;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-4">{description}</p>
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
