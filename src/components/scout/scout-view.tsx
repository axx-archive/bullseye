'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useDrafts } from '@/hooks/use-drafts';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { DraftUploadModal } from '@/components/home/draft-upload-modal';
import { ScoutLayout } from './scout-layout';

export function ScoutView() {
  const { currentProject, currentDraft, setCurrentDraft, setActiveTab } = useAppStore();
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Track which project we've auto-loaded drafts for to avoid re-triggering on tab switch
  const autoLoadedProjectRef = useRef<string | null>(null);

  // Fetch drafts for the current project
  const { data: drafts, isLoading: isLoadingDrafts } = useDrafts(currentProject?.id ?? null);

  // Auto-select the latest draft when:
  // 1. Project has drafts
  // 2. No currentDraft is set
  // 3. We haven't already auto-loaded for this project (prevents re-triggering on tab switch)
  useEffect(() => {
    if (
      currentProject &&
      !currentDraft &&
      drafts &&
      drafts.length > 0 &&
      autoLoadedProjectRef.current !== currentProject.id
    ) {
      // Mark this project as auto-loaded
      autoLoadedProjectRef.current = currentProject.id;

      // Find the latest draft (highest draft number)
      const latestDraft = drafts.reduce((latest, draft) =>
        draft.draftNumber > latest.draftNumber ? draft : latest
      );

      // Set the current draft
      setCurrentDraft({
        id: latestDraft.id,
        projectId: currentProject.id,
        draftNumber: latestDraft.draftNumber,
        scriptUrl: latestDraft.scriptUrl,
        pageCount: latestDraft.pageCount ?? undefined,
        status: latestDraft.status as 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED',
        createdAt: new Date(latestDraft.createdAt),
        updatedAt: new Date(latestDraft.updatedAt),
      });
    }
  }, [currentProject, currentDraft, drafts, setCurrentDraft]);

  // Reset auto-load tracker when project changes
  useEffect(() => {
    if (currentProject?.id !== autoLoadedProjectRef.current) {
      // Only reset if we're switching to a different project (not null)
      // This allows re-loading drafts when switching projects
      if (currentProject?.id && autoLoadedProjectRef.current) {
        autoLoadedProjectRef.current = null;
      }
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <EmptyState
        icon={FileText}
        title="Select a project first"
        description="Choose a project from Home to start analyzing"
        actionLabel="Go to Home"
        onAction={() => setActiveTab('home')}
      />
    );
  }

  // Show loading state while fetching drafts
  if (isLoadingDrafts) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading drafts...</span>
        </div>
      </div>
    );
  }

  if (!currentDraft) {
    return (
      <>
        <EmptyState
          icon={Upload}
          title="Upload a script to get started"
          description="Upload a screenplay PDF to begin analysis with your reader panel."
          actionLabel="Upload Script"
          onAction={() => setShowUploadModal(true)}
        />
        <DraftUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} />
      </>
    );
  }

  return <ScoutLayout />;
}
