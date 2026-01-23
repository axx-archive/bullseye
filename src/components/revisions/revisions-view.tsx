'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useDrafts } from '@/hooks/use-drafts';
import { useDeliverable } from '@/hooks/use-studio';
import { DraftUploadModal } from '@/components/home/draft-upload-modal';
import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Upload,
} from 'lucide-react';

// Default readers for memory display
const DEFAULT_READERS: Record<string, { name: string; voiceTag: string; color: string }> = {
  'maya-chen': { name: 'Maya Chen', voiceTag: 'The Optimist', color: '#30D5C8' },
  'colton-rivers': { name: 'Colton Rivers', voiceTag: 'The Skeptic', color: '#FF7F7F' },
  'devon-park': { name: 'Devon Park', voiceTag: 'The Craftsman', color: '#B8A9C9' },
};

interface HarmonizedScores {
  premise?: { rating: string; numeric: number };
  character?: { rating: string; numeric: number };
  dialogue?: { rating: string; numeric: number };
  structure?: { rating: string; numeric: number };
  commerciality?: { rating: string; numeric: number };
  overall?: { rating: string; numeric: number };
  [key: string]: { rating: string; numeric: number } | undefined;
}

interface ReaderPerspective {
  readerId: string;
  readerName: string;
  voiceTag?: string;
  color?: string;
  recommendation?: string;
  scores?: Record<string, unknown>;
  keyStrengths?: string[];
  keyConcerns?: string[];
  standoutQuote?: string;
}

export function RevisionsView() {
  const { currentProject, setActiveTab } = useAppStore();
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDraftId, setCompareDraftId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: drafts, isLoading } = useDrafts(currentProject?.id ?? null);

  // Select the latest draft by default
  const effectiveDraftId = selectedDraftId ?? (drafts && drafts.length > 0 ? drafts[0]?.id : null);

  // Fetch deliverables for selected and comparison drafts
  const { data: selectedDeliverable, isLoading: isLoadingDeliverable } = useDeliverable(effectiveDraftId ?? null);
  const { data: compareDeliverable } = useDeliverable(compareMode ? compareDraftId : null);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!drafts || drafts.length === 0) {
    return (
      <>
        <EmptyState onUpload={() => setShowUploadModal(true)} />
        <DraftUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} />
      </>
    );
  }

  const currentDraft = drafts.find((d) => d.id === effectiveDraftId);
  const comparisonDraft = compareDraftId ? drafts.find((d) => d.id === compareDraftId) : null;

  // Parse deliverable scores
  const currentScores = selectedDeliverable
    ? (selectedDeliverable.harmonizedScores as HarmonizedScores | null)
    : null;
  const comparisonScores = compareDeliverable
    ? (compareDeliverable.harmonizedScores as HarmonizedScores | null)
    : null;

  // Parse reader perspectives for memory narratives
  const readerPerspectives = selectedDeliverable
    ? (selectedDeliverable.readerPerspectives as ReaderPerspective[] | null)
    : null;

  return (
    <>
      <div className="h-full flex">
        {/* Timeline sidebar */}
        <div className="w-64 border-r border-border bg-surface flex flex-col">
          <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Draft Timeline
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              {/* Upload new draft button */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors mb-4"
              >
                <Upload className="w-4 h-4" />
                Upload New Draft
              </button>

              {/* Draft timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {drafts
                  .slice()
                  .sort((a, b) => b.draftNumber - a.draftNumber)
                  .map((draft, index) => {
                    const isSelected = effectiveDraftId === draft.id;
                    const isComparison = compareDraftId === draft.id;

                    return (
                      <motion.button
                        key={draft.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          if (compareMode && effectiveDraftId !== draft.id) {
                            setCompareDraftId(draft.id);
                          } else {
                            setSelectedDraftId(draft.id);
                            setCompareDraftId(null);
                          }
                        }}
                        className={cn(
                          'relative w-full flex items-start gap-3 p-3 pl-8 rounded-lg text-left transition-colors',
                          'hover:bg-elevated',
                          isSelected && 'bg-elevated ring-1 ring-primary',
                          isComparison && 'bg-elevated ring-1 ring-info'
                        )}
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            'absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 bg-background',
                            isSelected
                              ? 'border-primary'
                              : isComparison
                                ? 'border-info'
                                : 'border-muted-foreground'
                          )}
                        />

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Draft {draft.draftNumber}</span>
                            {draft.status === 'COMPLETED' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                                Analyzed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(draft.createdAt).toLocaleDateString()}
                          </div>
                          {draft.pageCount && (
                            <div className="text-xs text-muted-foreground">
                              {draft.pageCount} pages
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  Draft {currentDraft?.draftNumber} {currentDraft?.status === 'COMPLETED' ? 'Analysis' : ''}
                </h1>
                {currentDraft && (
                  <p className="text-muted-foreground">
                    Uploaded {new Date(currentDraft.createdAt).toLocaleDateString()}
                    {currentDraft.pageCount ? ` · ${currentDraft.pageCount} pages` : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {drafts.length > 1 && (
                  <button
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (!compareMode) {
                        setCompareDraftId(null);
                      }
                    }}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium transition-all',
                      compareMode
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/50 text-muted-foreground hover:text-foreground hover:bg-elevated'
                    )}
                  >
                    {compareMode ? 'Exit Compare' : 'Compare Drafts'}
                  </button>
                )}
              </div>
            </div>

            {/* Compare mode instructions */}
            <AnimatePresence>
              {compareMode && !compareDraftId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl border border-info/30 bg-info/5">
                    <p className="text-sm text-center text-muted-foreground">
                      Select another draft from the timeline to compare
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Score comparison */}
            {isLoadingDeliverable ? (
              <ScoreTableSkeleton />
            ) : currentScores ? (
              <div className="rounded-xl border border-border/50 bg-surface overflow-hidden">
                <div className="px-6 py-4 border-b border-border/30">
                  <h3 className="text-lg font-semibold">
                    {compareMode && comparisonDraft
                      ? `Comparing Draft ${currentDraft?.draftNumber} vs Draft ${comparisonDraft.draftNumber}`
                      : 'Score Summary'}
                  </h3>
                </div>
                <div className="p-6">
                  <ScoreComparison
                    current={currentScores}
                    comparison={comparisonScores}
                    showComparison={compareMode && !!comparisonScores}
                  />
                </div>
              </div>
            ) : currentDraft?.status !== 'COMPLETED' ? (
              <div className="p-6 rounded-xl border border-border/30 bg-surface/50 text-center">
                <p className="text-sm text-muted-foreground">
                  This draft hasn&apos;t been analyzed yet. Run analysis from Scout to see scores.
                </p>
                <button
                  onClick={() => setActiveTab('scout')}
                  className="mt-3 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Go to Scout →
                </button>
              </div>
            ) : null}

            {/* Compare delta arrows */}
            <AnimatePresence>
              {compareMode && comparisonScores && currentScores && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="rounded-xl border border-border/50 bg-surface overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-border/30">
                    <h3 className="text-lg font-semibold">Score Changes</h3>
                  </div>
                  <div className="p-6">
                    <DeltaSummary current={currentScores} comparison={comparisonScores} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reader memory / perspectives */}
            {readerPerspectives && readerPerspectives.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-surface overflow-hidden">
                <div className="px-6 py-4 border-b border-border/30">
                  <h3 className="text-lg font-semibold">Reader Perspectives</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    What each reader noted about this draft.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {readerPerspectives.map((perspective) => {
                    const readerInfo = Object.values(DEFAULT_READERS).find(
                      (r) => r.name === perspective.readerName
                    ) || { name: perspective.readerName, voiceTag: perspective.voiceTag || '', color: perspective.color || '#888' };
                    return (
                      <ReaderMemoryCard
                        key={perspective.readerId}
                        name={readerInfo.name}
                        voiceTag={readerInfo.voiceTag}
                        color={readerInfo.color}
                        strengths={perspective.keyStrengths}
                        concerns={perspective.keyConcerns}
                        quote={perspective.standoutQuote}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DraftUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </>
  );
}

// Score comparison table
function ScoreComparison({
  current,
  comparison,
  showComparison,
}: {
  current: HarmonizedScores;
  comparison: HarmonizedScores | null;
  showComparison: boolean;
}) {
  const dimensions = [
    { key: 'premise', label: 'Premise' },
    { key: 'character', label: 'Character' },
    { key: 'dialogue', label: 'Dialogue' },
    { key: 'structure', label: 'Structure' },
    { key: 'commerciality', label: 'Commercial' },
    { key: 'overall', label: 'Overall' },
  ];

  return (
    <div className="space-y-3">
      {dimensions.map(({ key, label }) => {
        const currentScore = current[key];
        const comparisonScore = comparison?.[key];
        const numericValue = currentScore?.numeric ?? 0;
        const delta = showComparison && comparisonScore
          ? numericValue - (comparisonScore.numeric ?? 0)
          : 0;

        return (
          <div key={key} className="flex items-center gap-4">
            <span className="w-24 text-sm text-muted-foreground">{label}</span>

            {/* Current score bar */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${numericValue}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-bullseye-gold rounded-full"
                />
              </div>
              <span className="text-sm font-medium w-10 text-right">
                {numericValue}
              </span>
            </div>

            {/* Delta indicator */}
            {showComparison && (
              <div
                className={cn(
                  'flex items-center gap-1 w-16 text-sm',
                  delta > 0 && 'text-success',
                  delta < 0 && 'text-danger',
                  delta === 0 && 'text-muted-foreground'
                )}
              >
                {delta > 0 && <ArrowUp className="w-4 h-4" />}
                {delta < 0 && <ArrowDown className="w-4 h-4" />}
                {delta === 0 && <Minus className="w-4 h-4" />}
                {delta > 0 ? '+' : ''}
                {delta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Delta summary with directional arrows
function DeltaSummary({
  current,
  comparison,
}: {
  current: HarmonizedScores;
  comparison: HarmonizedScores;
}) {
  const dimensions = [
    { key: 'premise', label: 'Premise' },
    { key: 'character', label: 'Character' },
    { key: 'dialogue', label: 'Dialogue' },
    { key: 'structure', label: 'Structure' },
    { key: 'commerciality', label: 'Commercial' },
    { key: 'overall', label: 'Overall' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {dimensions.map(({ key, label }) => {
        const currentValue = current[key]?.numeric ?? 0;
        const comparisonValue = comparison[key]?.numeric ?? 0;
        const delta = currentValue - comparisonValue;

        return (
          <div key={key} className="flex items-center gap-2 p-3 rounded-lg bg-elevated">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                delta > 0 && 'bg-success/10',
                delta < 0 && 'bg-danger/10',
                delta === 0 && 'bg-muted/10'
              )}
            >
              {delta > 0 && <ArrowUp className="w-4 h-4 text-success" />}
              {delta < 0 && <ArrowDown className="w-4 h-4 text-danger" />}
              {delta === 0 && <Minus className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn(
                'text-sm font-semibold',
                delta > 0 && 'text-success',
                delta < 0 && 'text-danger',
                delta === 0 && 'text-muted-foreground'
              )}>
                {delta > 0 ? '+' : ''}{delta}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reader memory card
function ReaderMemoryCard({
  name,
  voiceTag,
  color,
  strengths,
  concerns,
  quote,
}: {
  name: string;
  voiceTag: string;
  color: string;
  strengths?: string[];
  concerns?: string[];
  quote?: string;
}) {
  return (
    <div
      className="p-4 rounded-lg bg-elevated"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium" style={{ color }}>
          {name}
        </span>
        {voiceTag && (
          <span className="text-xs text-muted-foreground">({voiceTag})</span>
        )}
      </div>

      {strengths && strengths.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-success mb-1">Strengths</p>
          <ul className="text-sm text-muted-foreground space-y-0.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-success mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {concerns && concerns.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-warning mb-1">Concerns</p>
          <ul className="text-sm text-muted-foreground space-y-0.5">
            {concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-warning mt-0.5">•</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {quote && (
        <p className="text-sm text-muted-foreground italic mt-2">&quot;{quote}&quot;</p>
      )}
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="h-full flex">
      {/* Timeline skeleton */}
      <div className="w-64 border-r border-border bg-surface">
        <div className="h-16 px-4 border-b border-border flex items-center">
          <div className="h-4 w-32 bg-elevated rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-10 w-full bg-elevated rounded-xl animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 pl-8">
              <div className="absolute left-2.5 w-3 h-3 rounded-full bg-elevated animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-16 bg-elevated rounded animate-pulse" />
                  <div className="h-4 w-14 bg-elevated rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-24 bg-elevated rounded animate-pulse" />
                <div className="h-3 w-16 bg-elevated rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-elevated rounded animate-pulse" />
            <div className="h-4 w-32 bg-elevated rounded animate-pulse" />
          </div>
          <ScoreTableSkeleton />
          {/* Reader card skeletons */}
          <div className="rounded-xl border border-border/50 bg-surface p-6 space-y-4">
            <div className="h-5 w-40 bg-elevated rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-elevated/50 space-y-2 border-l-[3px] border-muted">
                <div className="h-4 w-28 bg-elevated rounded animate-pulse" />
                <div className="h-3 w-full bg-elevated rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-elevated rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Score table skeleton
function ScoreTableSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-surface p-6 space-y-3">
      <div className="h-5 w-32 bg-elevated rounded animate-pulse mb-4" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-3 w-20 bg-elevated rounded animate-pulse" />
          <div className="flex-1 h-2 bg-elevated rounded-full animate-pulse" />
          <div className="h-3 w-10 bg-elevated rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Empty state
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <GitBranch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Drafts Yet</h2>
        <p className="text-muted-foreground mb-4">
          Upload your first script draft to start tracking revisions across iterations.
        </p>
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-gradient-gold text-primary-foreground shadow-elevated hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" />
          Upload First Draft
        </button>
      </div>
    </div>
  );
}
