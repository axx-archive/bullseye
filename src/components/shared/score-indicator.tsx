'use client';

import { cn } from '@/lib/utils';
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
  numeric,
  percentile,
  showPercentile = true,
  size = 'md',
  className,
}: ScoreIndicatorProps) {
  const filled = RATING_TO_FILLED[rating];
  const trend = percentile ? (percentile > 60 ? 'up' : percentile < 40 ? 'down' : 'neutral') : null;

  const barHeight = size === 'sm' ? 'h-4' : size === 'lg' ? 'h-8' : 'h-6';
  const barWidth = size === 'sm' ? 'w-2' : size === 'lg' ? 'w-4' : 'w-3';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';
  const labelWidth = size === 'sm' ? 'w-16' : size === 'lg' ? 'w-28' : 'w-24';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Label */}
      <span className={cn('text-muted-foreground capitalize', labelWidth, fontSize)}>{label}</span>

      {/* Score bars */}
      <div className={cn('flex', gap)}>
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-sm transition-colors duration-200',
              barWidth,
              barHeight,
              i < filled ? 'bg-bullseye-gold' : 'bg-elevated'
            )}
          />
        ))}
      </div>

      {/* Rating label */}
      <span className={cn('font-medium min-w-[80px]', fontSize)}>
        {RATING_LABELS[rating]}
      </span>

      {/* Percentile trend */}
      {showPercentile && percentile !== undefined && (
        <TrendIndicator trend={trend} percentile={percentile} size={size} />
      )}
    </div>
  );
}

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'neutral' | null;
  percentile: number;
  size?: 'sm' | 'md' | 'lg';
}

function TrendIndicator({ trend, percentile, size = 'md' }: TrendIndicatorProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  const diff = percentile - 50;
  const diffText = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '=';

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full',
        trend === 'up' && 'bg-success/20 text-success',
        trend === 'down' && 'bg-danger/20 text-danger',
        trend === 'neutral' && 'bg-muted text-muted-foreground'
      )}
    >
      {trend === 'up' && <TrendingUp className={iconSize} />}
      {trend === 'down' && <TrendingDown className={iconSize} />}
      {trend === 'neutral' && <Minus className={iconSize} />}
      <span className={fontSize}>{diffText}</span>
    </div>
  );
}

// Compact score display for reader cards
interface MiniScoreProps {
  label: string;
  rating: Rating;
  color?: string;
}

export function MiniScore({ label, rating, color }: MiniScoreProps) {
  const filled = RATING_TO_FILLED[rating];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 capitalize">{label}</span>
      <div className="flex gap-px">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-4 rounded-sm',
              i < Math.ceil(filled / 2) ? 'bg-bullseye-gold' : 'bg-elevated'
            )}
            style={i < Math.ceil(filled / 2) && color ? { backgroundColor: color } : undefined}
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
      {/* Overall score highlight */}
      <div className="p-4 rounded-lg bg-elevated border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">OVERALL SCORE</span>
          {showCalibration && (
            <span className="text-sm text-muted-foreground">vs. Studio Average</span>
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

      {/* Individual dimensions */}
      <div className="space-y-3">
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
