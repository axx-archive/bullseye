'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Rating } from '@/types';
import { RATING_LABELS } from '@/types';

interface ScoreIndicatorProps {
  label: string;
  rating: Rating;
  numeric?: number;
  percentile?: number;
  showPercentile?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RATING_TO_FILLED: Record<Rating, number> = {
  excellent: 10,
  very_good: 8,
  good: 6,
  so_so: 4,
  not_good: 2,
};

export function ScoreIndicator({
  label,
  rating,
  percentile,
  showPercentile = true,
  size = 'md',
  className,
}: ScoreIndicatorProps) {
  const filled = RATING_TO_FILLED[rating];

  const barHeight = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';
  const barWidth = size === 'sm' ? 'w-1.5' : size === 'lg' ? 'w-3' : 'w-2';
  const labelWidth = size === 'sm' ? 'w-12 sm:w-16' : size === 'lg' ? 'w-20 sm:w-28' : 'w-16 sm:w-24';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className={cn('flex items-center gap-2 sm:gap-3', className)}>
      {label && (
        <span className={cn('text-muted-foreground capitalize truncate', labelWidth, fontSize)}>
          {label}
        </span>
      )}

      {/* Score bars — animated on mount with stagger */}
      <div className="flex gap-[2px] flex-shrink-0">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: 0.4,
              delay: i * 0.05,
              ease: [0, 0, 0.58, 1],
            }}
            style={{ transformOrigin: 'left' }}
            className={cn(
              'rounded-[2px]',
              barWidth,
              barHeight,
              i < filled ? 'bg-bullseye-gold' : 'bg-elevated'
            )}
          />
        ))}
      </div>

      {/* Rating label */}
      <span className={cn('font-medium text-foreground/80 hidden sm:inline min-w-[72px]', fontSize)}>
        {RATING_LABELS[rating]}
      </span>

      {/* Percentile */}
      {showPercentile && percentile !== undefined && (
        <PercentilePill percentile={percentile} size={size} />
      )}
    </div>
  );
}

function PercentilePill({ percentile }: { percentile: number; size?: string }) {
  const diff = percentile - 50;
  const trend = diff > 10 ? 'up' : diff < -10 ? 'down' : 'neutral';
  const label = diff > 0 ? `+${diff}` : `${diff}`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
        trend === 'up' && 'bg-success/10 text-success',
        trend === 'down' && 'bg-danger/10 text-danger',
        trend === 'neutral' && 'bg-surface text-muted-foreground'
      )}
    >
      {trend === 'up' && <TrendingUp className="w-2.5 h-2.5" />}
      {trend === 'down' && <TrendingDown className="w-2.5 h-2.5" />}
      {trend === 'neutral' && <Minus className="w-2.5 h-2.5" />}
      <span>{label}%</span>
    </div>
  );
}

// Compact score for reader cards
interface MiniScoreProps {
  label: string;
  rating: Rating;
  color?: string;
}

export function MiniScore({ label, rating, color }: MiniScoreProps) {
  const filled = RATING_TO_FILLED[rating];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-[72px] capitalize">{label}</span>
      <div className="flex gap-[1px]">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-1.5 h-3 rounded-[1px]',
              i < Math.ceil(filled / 2) ? '' : 'bg-elevated'
            )}
            style={i < Math.ceil(filled / 2) ? { backgroundColor: color || 'var(--bullseye-gold)' } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// Harmonized scores display
interface HarmonizedScoresDisplayProps {
  scores: {
    premise: { rating: Rating; numeric: number; percentile: number };
    character: { rating: Rating; numeric: number; percentile: number };
    dialogue: { rating: Rating; numeric: number; percentile: number };
    structure: { rating: Rating; numeric: number; percentile: number };
    commerciality: { rating: Rating; numeric: number; percentile: number };
    overall: { rating: Rating; numeric: number; percentile: number };
  };
  showCalibration?: boolean;
}

export function HarmonizedScoresDisplay({
  scores,
  showCalibration = true,
}: HarmonizedScoresDisplayProps) {
  const dimensions = [
    { key: 'premise', label: 'Premise' },
    { key: 'character', label: 'Character' },
    { key: 'dialogue', label: 'Dialogue' },
    { key: 'structure', label: 'Structure' },
    { key: 'commerciality', label: 'Commercial' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Overall — emphasized */}
      <div className="p-5 rounded-2xl bg-elevated/60 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Overall
          </span>
          {showCalibration && (
            <span className="text-[11px] text-muted-foreground">vs. corpus</span>
          )}
        </div>
        <ScoreIndicator
          label=""
          rating={scores.overall.rating}
          numeric={scores.overall.numeric}
          percentile={scores.overall.percentile}
          showPercentile={showCalibration}
          size="lg"
        />
      </div>

      {/* Dimensions */}
      <div className="space-y-2.5 pt-2">
        {dimensions.map(({ key, label }) => (
          <ScoreIndicator
            key={key}
            label={label}
            rating={scores[key].rating}
            numeric={scores[key].numeric}
            percentile={scores[key].percentile}
            showPercentile={showCalibration}
          />
        ))}
      </div>
    </div>
  );
}
