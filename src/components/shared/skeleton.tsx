import { cn } from '@/lib/utils';

// Base skeleton component with pulse animation using bg-elevated
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-elevated animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

// Matches project card dimensions: rounded-2xl, p-5, status dot, title, logline lines, footer with badges
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border/50 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-elevated" />
        <div className="h-2.5 w-16 rounded bg-elevated" />
      </div>
      <div className="h-4 w-3/4 rounded bg-elevated mb-2" />
      <div className="h-3 w-full rounded bg-elevated mb-1" />
      <div className="h-3 w-2/3 rounded bg-elevated mb-4" />
      <div className="flex items-center gap-4 pt-2 border-t border-border/30">
        <div className="h-3 w-16 rounded bg-elevated" />
        <div className="h-3 w-14 rounded bg-elevated" />
      </div>
    </div>
  );
}

// Matches reader card dimensions: avatar circle (w-9 h-9), name bar, 6 mini score bars (grid-cols-2), evidence bar
export function ReaderCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border/50 overflow-hidden animate-pulse">
      <div className="p-5 pb-4">
        {/* Header: avatar + name + recommendation pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-elevated" />
            <div>
              <div className="h-3.5 w-24 rounded bg-elevated mb-1" />
              <div className="h-2.5 w-16 rounded bg-elevated" />
            </div>
          </div>
          <div className="h-5 w-20 rounded-full bg-elevated" />
        </div>

        {/* Mini scores grid (6 items, 2 cols) */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-[72px] rounded bg-elevated" />
              <div className="flex gap-[1px]">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="w-1.5 h-3 rounded-[1px] bg-elevated" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Evidence strength bar */}
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-14 rounded bg-elevated" />
          <div className="flex-1 h-1 bg-elevated rounded-full" />
          <div className="h-2.5 w-8 rounded bg-elevated" />
        </div>
      </div>

      {/* Expand trigger bar */}
      <div className="w-full py-2.5 border-t border-border/50 flex justify-center">
        <div className="h-3 w-12 rounded bg-elevated" />
      </div>
    </div>
  );
}

// Matches 10-bar ScoreIndicator: label + 10 bars (gap-[2px], rounded-[2px]) + rating label
export function ScoreBarSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="h-3 w-[72px] rounded bg-elevated" />
      <div className="flex gap-[2px]">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="w-2 h-4 rounded-[2px] bg-elevated" />
        ))}
      </div>
      <div className="h-3 w-[72px] rounded bg-elevated" />
    </div>
  );
}

// Matches chat message bubble: avatar circle (w-7 h-7) + 2-3 text lines of varying widths
export function ChatMessageSkeleton({ lines = 2 }: { lines?: number }) {
  const widths = ['w-full', 'w-4/5', 'w-3/5'];
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-lg bg-elevated flex-shrink-0" />
      <div className="flex-1 max-w-[85%] space-y-1.5">
        <div className="h-2.5 w-16 rounded bg-elevated mb-1" />
        {[...Array(Math.min(lines, 3))].map((_, i) => (
          <div key={i} className={cn('h-3 rounded bg-elevated', widths[i] || 'w-3/5')} />
        ))}
      </div>
    </div>
  );
}

// Matches revisions timeline item: circle dot (w-3 h-3) + draft number + date + page count
export function TimelineItemSkeleton() {
  return (
    <div className="relative flex items-start gap-3 p-3 pl-8 animate-pulse">
      <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-elevated" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-4 w-16 rounded bg-elevated" />
          <div className="h-4 w-14 rounded-full bg-elevated" />
        </div>
        <div className="h-3 w-24 rounded bg-elevated" />
        <div className="h-3 w-16 rounded bg-elevated" />
      </div>
    </div>
  );
}
