'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const READER_CONFIG = [
  {
    id: 'reader-maya',
    name: 'Maya Chen',
    voiceTag: 'The Optimist',
    color: '#30D5C8',
    focus: 'Character & Emotional Resonance',
  },
  {
    id: 'reader-colton',
    name: 'Colton Rivers',
    voiceTag: 'The Skeptic',
    color: '#FF7F7F',
    focus: 'Structure & Commerciality',
  },
  {
    id: 'reader-devon',
    name: 'Devon Park',
    voiceTag: 'The Craftsman',
    color: '#B8A9C9',
    focus: 'Dialogue & Craft',
  },
];

const SCORE_DIMENSIONS = ['premise', 'character', 'dialogue', 'structure', 'commerciality', 'overall'] as const;

function numericToFilled(value: number): number {
  // Convert 0-100 score to 0-10 filled bars
  return Math.round(value / 10);
}

function ReaderAnalysisSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Reader Analysis
        </span>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-elevated/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted-foreground/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-muted-foreground/10 rounded animate-pulse" />
              <div className="h-2 w-32 bg-muted-foreground/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-2">
                <div className="h-2 w-16 bg-muted-foreground/10 rounded animate-pulse" />
                <div className="flex-1 h-2 bg-muted-foreground/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReaderAnalysisPanel() {
  const { readerStates, isHydratingScoutState } = useAppStore();

  // Show skeleton while hydrating and no local data
  if (isHydratingScoutState && readerStates.size === 0) {
    return <ReaderAnalysisSkeleton />;
  }

  // Check if all 3 readers are complete for harmonized scores
  const allComplete = READER_CONFIG.every(
    (r) => readerStates.get(r.id)?.status === 'complete'
  );

  // Calculate harmonized (averaged) scores when all complete
  const harmonizedScores = allComplete
    ? computeHarmonizedScores(readerStates)
    : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Reader Analysis
          </span>
        </div>

        {/* Harmonized Scores — appears after all 3 readers complete */}
        <AnimatePresence>
          {allComplete && harmonizedScores && (
            <motion.div
              key="harmonized"
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <HarmonizedScoresSection scores={harmonizedScores} />
            </motion.div>
          )}
        </AnimatePresence>

        {READER_CONFIG.map((reader, index) => {
          const state = readerStates.get(reader.id);

          return (
            <motion.div
              key={reader.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <ReaderCard reader={reader} state={state} />
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function HarmonizedScoresSection({
  scores,
}: {
  scores: Record<string, number>;
}) {
  return (
    <div className="rounded-xl border border-bullseye-gold/20 bg-bullseye-gold/5 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-bullseye-gold/20 flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-bullseye-gold" />
        </div>
        <span className="text-xs font-semibold text-bullseye-gold uppercase tracking-wider">
          Harmonized Scores
        </span>
      </div>
      <div className="space-y-2">
        {SCORE_DIMENSIONS.map((dim, index) => (
          <div key={dim} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground capitalize w-20">
              {dim}
            </span>
            <ScoreBars
              value={scores[dim] || 0}
              color="var(--bullseye-gold)"
              staggerDelay={index * 50}
              animated
            />
            <span className="text-[11px] font-medium tabular-nums w-6 text-right text-foreground/80">
              {scores[dim] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReaderCardProps {
  reader: (typeof READER_CONFIG)[0];
  state?: {
    readerId: string;
    status: string;
    progress?: number;
    scores?: Record<string, number>;
    recommendation?: string;
    keyStrengths?: string[];
    keyConcerns?: string[];
    standoutQuote?: string;
    error?: string;
  };
}

function ReaderCard({ reader, state }: ReaderCardProps) {
  const { expandedReaders, toggleReaderExpanded } = useAppStore();
  const isExpanded = expandedReaders.includes(reader.id);

  const status = state?.status || 'pending';
  const isComplete = status === 'complete';
  const isStreaming = status === 'streaming';
  const isError = status === 'error';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-300',
        isComplete && 'border-border/60 bg-surface/50',
        isStreaming && 'border-border/40 bg-surface/30',
        isError && 'border-red-500/20 bg-red-500/5',
        !state && 'border-border/20 bg-transparent opacity-60'
      )}
      style={isComplete ? { borderLeftColor: reader.color, borderLeftWidth: '3px' } : undefined}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between',
          isComplete && 'cursor-pointer'
        )}
        onClick={isComplete ? () => toggleReaderExpanded(reader.id) : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${reader.color}15` }}
          >
            <span
              className="text-[10px] font-bold"
              style={{ color: reader.color }}
            >
              {reader.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium block leading-tight">
              {reader.name}
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: reader.color }}
            >
              {reader.voiceTag}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Loader2
              className="w-4 h-4 animate-spin"
              style={{ color: reader.color }}
            />
          )}
          {isComplete && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </>
          )}
          {isError && <AlertCircle className="w-4 h-4 text-red-500" />}
        </div>
      </div>

      {/* Loading state with progress */}
      {isStreaming && (
        <div className="mt-3 space-y-2">
          {state?.progress !== undefined && state.progress > 0 ? (
            <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: reader.color }}
                initial={{ width: 0 }}
                animate={{ width: `${state.progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          ) : (
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1 rounded-full flex-1"
                  style={{ backgroundColor: `${reader.color}30` }}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Analyzing {reader.focus.toLowerCase()}...
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <p className="text-xs text-red-400 mt-2">
          {state?.error || 'Analysis failed'}
        </p>
      )}

      {/* Complete state — summary always visible */}
      {isComplete && state?.scores && (
        <div className="mt-3 space-y-2">
          {/* Overall score + recommendation — always visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Overall</span>
              <ScoreBars
                value={state.scores.overall || 0}
                color={reader.color}
                staggerDelay={0}
                animated
              />
              <span className="text-[11px] font-medium tabular-nums">
                {state.scores.overall}
              </span>
            </div>
            {state.recommendation && (
              <span
                className={cn(
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                  state.recommendation === 'recommend' &&
                    'bg-green-500/10 text-green-500',
                  state.recommendation === 'consider' &&
                    'bg-yellow-500/10 text-yellow-500',
                  state.recommendation === 'low_consider' &&
                    'bg-orange-500/10 text-orange-500',
                  state.recommendation === 'pass' &&
                    'bg-red-500/10 text-red-500'
                )}
              >
                {state.recommendation.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Expandable details */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2">
                  {/* Detailed scores */}
                  <div className="space-y-1.5">
                    {SCORE_DIMENSIONS.filter((d) => d !== 'overall').map(
                      (dim, index) => (
                        <div key={dim} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground capitalize w-20">
                            {dim}
                          </span>
                          <ScoreBars
                            value={state.scores?.[dim] || 0}
                            color={reader.color}
                            staggerDelay={index * 50}
                            animated
                          />
                          <span className="text-[10px] font-medium tabular-nums w-5 text-right">
                            {state.scores?.[dim] || 0}
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Key strengths */}
                  {state.keyStrengths && state.keyStrengths.length > 0 && (
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                        Strengths
                      </span>
                      <ul className="space-y-0.5">
                        {state.keyStrengths.slice(0, 3).map((s, i) => (
                          <li
                            key={i}
                            className="text-xs text-foreground/80 flex items-start gap-1.5"
                          >
                            <span className="text-green-500 mt-0.5 flex-shrink-0">
                              +
                            </span>
                            <span className="line-clamp-2">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key concerns */}
                  {state.keyConcerns && state.keyConcerns.length > 0 && (
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                        Concerns
                      </span>
                      <ul className="space-y-0.5">
                        {state.keyConcerns.slice(0, 3).map((c, i) => (
                          <li
                            key={i}
                            className="text-xs text-foreground/80 flex items-start gap-1.5"
                          >
                            <span className="text-amber-500 mt-0.5 flex-shrink-0">
                              –
                            </span>
                            <span className="line-clamp-2">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Standout quote */}
                  {state.standoutQuote && (
                    <div
                      className="border-l-2 pl-2.5 mt-2"
                      style={{ borderColor: `${reader.color}40` }}
                    >
                      <p className="text-[11px] text-muted-foreground italic line-clamp-3">
                        &ldquo;{state.standoutQuote}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pending state */}
      {!state && (
        <p className="text-[11px] text-muted-foreground/60 mt-2">
          Waiting to start...
        </p>
      )}
    </div>
  );
}

/**
 * 10-bar score visualization with staggered left-to-right fill animation.
 */
function ScoreBars({
  value,
  color,
  staggerDelay = 0,
  animated = false,
}: {
  value: number;
  color: string;
  staggerDelay?: number;
  animated?: boolean;
}) {
  const filled = numericToFilled(value);

  return (
    <div className="flex gap-[2px]">
      {[...Array(10)].map((_, i) => {
        const isFilled = i < filled;
        if (animated && isFilled) {
          return (
            <motion.div
              key={i}
              className="w-1.5 h-3 rounded-[2px]"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                duration: 0.3,
                delay: (staggerDelay + i * 50) / 1000,
                ease: 'easeOut',
              }}
              style={{ backgroundColor: color, transformOrigin: 'left' }}
            />
          );
        }
        return (
          <div
            key={i}
            className={cn('w-1.5 h-3 rounded-[2px]', !isFilled && 'bg-elevated')}
            style={isFilled ? { backgroundColor: color } : undefined}
          />
        );
      })}
    </div>
  );
}

/**
 * Compute averaged harmonized scores from all 3 readers.
 */
function computeHarmonizedScores(
  readerStates: Map<string, { scores?: Record<string, number> }>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const dim of SCORE_DIMENSIONS) {
    let sum = 0;
    let count = 0;
    for (const reader of READER_CONFIG) {
      const state = readerStates.get(reader.id);
      if (state?.scores?.[dim] != null) {
        sum += state.scores[dim];
        count++;
      }
    }
    result[dim] = count > 0 ? Math.round(sum / count) : 0;
  }

  return result;
}
