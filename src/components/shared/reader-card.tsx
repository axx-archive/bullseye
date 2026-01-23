'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { MiniScore } from './score-indicator';
import type { ReaderPerspective, Recommendation } from '@/types';
import { RECOMMENDATION_LABELS } from '@/types';

interface ReaderCardProps {
  perspective: ReaderPerspective;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onStartChat?: () => void;
}

const RECOMMENDATION_STYLES: Record<Recommendation, string> = {
  recommend: 'bg-success/10 text-success',
  consider: 'bg-bullseye-gold/10 text-bullseye-gold',
  low_consider: 'bg-surface text-muted-foreground',
  pass: 'bg-danger/10 text-danger',
};

export function ReaderCard({
  perspective,
  expanded = false,
  onToggleExpand,
}: ReaderCardProps) {
  const {
    readerName,
    voiceTag,
    color,
    scores,
    recommendation,
    keyStrengths,
    keyConcerns,
    standoutQuote,
    evidenceStrength,
  } = perspective;

  const initials = readerName
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden transition-all duration-200 hover:border-border">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar with reader color */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}12` }}
            >
              <span
                className="text-xs font-bold"
                style={{ color }}
              >
                {initials}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">{readerName}</h4>
              <span className="text-[11px] text-muted-foreground">{voiceTag}</span>
            </div>
          </div>

          {/* Recommendation pill */}
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full',
            RECOMMENDATION_STYLES[recommendation]
          )}>
            {RECOMMENDATION_LABELS[recommendation]}
          </span>
        </div>

        {/* Mini scores */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          <MiniScore label="Premise" rating={scores.premise} color={color} />
          <MiniScore label="Character" rating={scores.character} color={color} />
          <MiniScore label="Dialogue" rating={scores.dialogue} color={color} />
          <MiniScore label="Structure" rating={scores.structure} color={color} />
          <MiniScore label="Commercial" rating={scores.commerciality} color={color} />
          <MiniScore label="Overall" rating={scores.overall} color={color} />
        </div>

        {/* Evidence strength — minimal bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Evidence</span>
          <div className="flex-1 h-1 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${evidenceStrength}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{evidenceStrength}%</span>
        </div>
      </div>

      {/* Expand trigger */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-border/50 text-[11px] text-muted-foreground hover:text-foreground hover:bg-elevated/50 transition-colors"
      >
        <span>{expanded ? 'Collapse' : 'Details'}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border/50">
              {/* Standout quote */}
              <div
                className="p-3 rounded-xl text-xs leading-relaxed italic text-foreground/80"
                style={{ backgroundColor: `${color}08` }}
              >
                &ldquo;{standoutQuote}&rdquo;
              </div>

              {/* Strengths */}
              <div>
                <h5 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                  Strengths
                </h5>
                <ul className="space-y-1.5">
                  {keyStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                      <span className="text-success mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Concerns */}
              <div>
                <h5 className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                  Concerns
                </h5>
                <ul className="space-y-1.5">
                  {keyConcerns.map((c, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                      <span className="text-danger mt-0.5">-</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reader comparison grid
interface ReaderComparisonProps {
  perspectives: ReaderPerspective[];
  onExpandReader?: (readerId: string) => void;
  expandedReaders?: string[];
}

export function ReaderComparison({
  perspectives,
  onExpandReader,
  expandedReaders = [],
}: ReaderComparisonProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {perspectives.map((perspective) => (
        <ReaderCard
          key={perspective.readerId}
          perspective={perspective}
          expanded={expandedReaders.includes(perspective.readerId)}
          onToggleExpand={() => onExpandReader?.(perspective.readerId)}
        />
      ))}
    </div>
  );
}
