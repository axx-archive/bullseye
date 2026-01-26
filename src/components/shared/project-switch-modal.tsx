'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { Project } from '@/types';

interface ProjectSwitchModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (skipFutureConfirms: boolean) => void;
  currentProject: Project;
  targetProject: { id: string; title: string };
  isStreamActive?: boolean;
}

/**
 * US-002/003: Confirmation modal shown when user attempts to switch
 * from one project to another. Warns about context switch and optionally
 * in-progress analysis. Includes "Don't ask again this session" checkbox.
 */
export function ProjectSwitchModal({
  open,
  onClose,
  onConfirm,
  currentProject,
  targetProject,
  isStreamActive = false,
}: ProjectSwitchModalProps) {
  const [skipFutureConfirms, setSkipFutureConfirms] = useState(false);

  function handleConfirm() {
    onConfirm(skipFutureConfirms);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
      // Reset checkbox state when modal closes
      setSkipFutureConfirms(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch to {targetProject.title}?</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            {isStreamActive ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-amber-200 text-sm">
                  Analysis is in progress on {currentProject.title}. Switching will stop it.
                </span>
              </div>
            ) : null}
            <span className="block text-muted-foreground">
              Your current work is saved. Switch projects?
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Don't ask again checkbox */}
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="skip-confirm"
            checked={skipFutureConfirms}
            onCheckedChange={(checked) => setSkipFutureConfirms(checked === true)}
          />
          <label
            htmlFor="skip-confirm"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Don&apos;t ask again this session
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-elevated/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'bg-gradient-gold text-primary-foreground hover:opacity-90'
            )}
          >
            Switch
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
