'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HistoricalDraftBannerProps {
  viewingDraftNumber: number;
  currentDraftNumber: number;
  onViewCurrent: () => void;
  className?: string;
}

/**
 * Warning banner displayed when viewing analysis from a non-current draft.
 * Shows which draft is being viewed and provides a quick action to switch back.
 */
export function HistoricalDraftBanner({
  viewingDraftNumber,
  currentDraftNumber,
  onViewCurrent,
  className,
}: HistoricalDraftBannerProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-lg',
        'flex items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
        <p className="text-sm text-warning">
          You&apos;re viewing <span className="font-medium">Draft {viewingDraftNumber}</span> analysis.{' '}
          <span className="text-warning/80">Draft {currentDraftNumber} is the current draft.</span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onViewCurrent}
        className="flex-shrink-0 h-7 text-xs bg-warning/10 border-warning/30 text-warning hover:bg-warning/20 hover:text-warning hover:border-warning/40"
      >
        View current draft
      </Button>
    </div>
  );
}
