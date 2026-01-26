'use client';

import { useMemo } from 'react';
import { Check, ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Draft } from '@/types';

interface DraftInfo {
  id: string;
  draftNumber: number;
  hasData: boolean;
  isCurrent: boolean;
}

interface DraftSelectorProps {
  drafts: Draft[];
  currentDraftId: string | null;
  selectedDraftId: string | null;
  onSelectDraft: (draftId: string | null) => void;
  className?: string;
}

/**
 * Dropdown selector for viewing historical draft data.
 * Shows all drafts for the current project, grouped by whether they have data.
 * Current draft shows "(current)" suffix and checkmark.
 * Drafts without data are shown dimmed/disabled.
 */
export function DraftSelector({
  drafts,
  currentDraftId,
  selectedDraftId,
  onSelectDraft,
  className,
}: DraftSelectorProps) {
  // Process drafts into display format
  const draftInfos: DraftInfo[] = useMemo(() => {
    return drafts.map((draft) => ({
      id: draft.id,
      draftNumber: draft.draftNumber,
      hasData: draft.status === 'COMPLETED' || !!draft.deliverable,
      isCurrent: draft.id === currentDraftId,
    }));
  }, [drafts, currentDraftId]);

  // Find drafts with and without data
  const draftsWithData = draftInfos.filter((d) => d.hasData);
  const draftsWithoutData = draftInfos.filter((d) => !d.hasData);

  // Determine which draft is being viewed
  // If selectedDraftId is null, auto-select most recent with data
  const viewingDraftId = useMemo(() => {
    if (selectedDraftId) return selectedDraftId;
    // Auto: most recent draft with data (highest draft number)
    const sorted = [...draftsWithData].sort((a, b) => b.draftNumber - a.draftNumber);
    return sorted[0]?.id ?? null;
  }, [selectedDraftId, draftsWithData]);

  const viewingDraft = draftInfos.find((d) => d.id === viewingDraftId);

  // Hide selector if only one draft exists (or no drafts)
  if (drafts.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2 bg-surface border-border/50 hover:bg-elevated hover:border-border text-xs font-medium',
            className
          )}
        >
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span>
            Draft {viewingDraft?.draftNumber ?? '?'}
            {viewingDraft?.isCurrent && ' (current)'}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        {/* Drafts with data */}
        {draftsWithData.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Available Drafts
            </DropdownMenuLabel>
            {draftsWithData
              .sort((a, b) => b.draftNumber - a.draftNumber)
              .map((draft) => (
                <DropdownMenuItem
                  key={draft.id}
                  onClick={() => onSelectDraft(draft.id === currentDraftId ? null : draft.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span>
                    Draft {draft.draftNumber}
                    {draft.isCurrent && (
                      <span className="text-muted-foreground ml-1">(current)</span>
                    )}
                  </span>
                  {draft.id === viewingDraftId && (
                    <Check className="w-4 h-4 text-bullseye-gold" />
                  )}
                </DropdownMenuItem>
              ))}
          </>
        )}

        {/* Separator if both groups exist */}
        {draftsWithData.length > 0 && draftsWithoutData.length > 0 && (
          <DropdownMenuSeparator />
        )}

        {/* Drafts without data */}
        {draftsWithoutData.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
              No Data Yet
            </DropdownMenuLabel>
            {draftsWithoutData
              .sort((a, b) => b.draftNumber - a.draftNumber)
              .map((draft) => (
                <DropdownMenuItem
                  key={draft.id}
                  disabled
                  className="flex items-center justify-between opacity-50 cursor-not-allowed"
                >
                  <span>
                    Draft {draft.draftNumber}
                    {draft.isCurrent && (
                      <span className="text-muted-foreground ml-1">(current)</span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Helper to determine which draft ID should be used for data fetching.
 * Returns the selected draft ID, or auto-selects most recent draft with data.
 */
export function getEffectiveDraftId(
  drafts: Draft[],
  currentDraftId: string | null,
  selectedDraftId: string | null
): string | null {
  if (selectedDraftId) return selectedDraftId;

  // Auto: find most recent draft with data (highest draft number with COMPLETED status)
  const draftsWithData = drafts
    .filter((d) => d.status === 'COMPLETED' || !!d.deliverable)
    .sort((a, b) => b.draftNumber - a.draftNumber);

  return draftsWithData[0]?.id ?? null;
}

/**
 * Helper to determine if we're viewing a historical (non-current) draft.
 */
export function isViewingHistoricalDraft(
  drafts: Draft[],
  currentDraftId: string | null,
  selectedDraftId: string | null
): boolean {
  const effectiveDraftId = getEffectiveDraftId(drafts, currentDraftId, selectedDraftId);
  if (!effectiveDraftId || !currentDraftId) return false;
  return effectiveDraftId !== currentDraftId;
}
