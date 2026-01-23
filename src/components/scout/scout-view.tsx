'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { FileText, Upload } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { DraftUploadModal } from '@/components/home/draft-upload-modal';
import { ScoutLayout } from './scout-layout';

export function ScoutView() {
  const { currentProject, currentDraft } = useAppStore();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { setActiveTab } = useAppStore();

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
