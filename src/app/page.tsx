'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { useAppStore } from '@/stores/app-store';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { HomeView } from '@/components/home/home-view';
import { ScoutView } from '@/components/scout/scout-view';
import { CoverageView } from '@/components/coverage/coverage-view';
import { FocusView } from '@/components/focus/focus-view';
import { RevisionsView } from '@/components/revisions/revisions-view';
import { PitchView } from '@/components/pitch/pitch-view';
import { StudioView } from '@/components/studio/studio-view';
import { SettingsView } from '@/components/settings/settings-view';
import { CreateStudioPrompt } from '@/components/studio/create-studio-prompt';

export default function Home() {
  const { activeTab, isStudioConfigOpen, currentStudio, currentProject, studios, setCurrentStudio, setStudios } = useAppStore();
  const queryClient = useQueryClient();
  const prevProjectIdRef = useRef<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [needsStudio, setNeedsStudio] = useState(false);

  // Validate studio exists on the server; handle stale localStorage
  const validateStudio = useCallback(async () => {
    try {
      const res = await fetch('/api/studio');

      if (res.ok) {
        // Studio exists on server — sync local state
        const studio = await res.json();
        const studioData = {
          id: studio.id,
          name: studio.name,
          slug: studio.slug,
          ownerId: studio.ownerId,
          createdAt: new Date(studio.createdAt),
          updatedAt: new Date(studio.updatedAt),
        };

        // Update local store with server truth
        if (!currentStudio || currentStudio.id !== studio.id) {
          setCurrentStudio(studioData);
        }
        if (studios.length === 0 || !studios.find((s) => s.id === studio.id)) {
          setStudios([studioData]);
        }

        setNeedsStudio(false);
      } else if (res.status === 404 || res.status === 401) {
        // No studio exists or user not found — clear stale local state and prompt creation
        setStudios([]);
        setCurrentStudio(null);
        setNeedsStudio(true);
      }
    } catch {
      // Network error — if we have local state, use it; otherwise prompt creation
      if (studios.length === 0 || !currentStudio) {
        setNeedsStudio(true);
      }
    } finally {
      setValidating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  useEffect(() => {
    validateStudio();
  }, [validateStudio]);

  // Re-validate when studios change (e.g., after creating a new studio)
  useEffect(() => {
    if (!validating && currentStudio && needsStudio) {
      setNeedsStudio(false);
    }
  }, [currentStudio, validating, needsStudio]);

  // Invalidate deliverable/evaluation/focus React Query caches on project switch
  useEffect(() => {
    const projectId = currentProject?.id ?? null;
    if (projectId === prevProjectIdRef.current) return;

    const prevId = prevProjectIdRef.current;
    prevProjectIdRef.current = projectId;

    // If switching away from a project, invalidate stale draft query caches
    if (prevId !== null) {
      queryClient.removeQueries({ queryKey: ['drafts'], exact: false });
    }
  }, [currentProject, queryClient]);

  // Show loading state while validating
  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  // Show create studio prompt if no studio exists
  if (needsStudio || (!currentStudio && studios.length === 0)) {
    return <CreateStudioPrompt isFirstStudio={studios.length === 0} />;
  }

  const renderContent = () => {
    if (isStudioConfigOpen) {
      return <ErrorBoundary key="studioConfig"><StudioView /></ErrorBoundary>;
    }

    switch (activeTab) {
      case 'home':
        return <ErrorBoundary key="home"><HomeView /></ErrorBoundary>;
      case 'scout':
        return <ErrorBoundary key="scout"><ScoutView /></ErrorBoundary>;
      case 'coverage':
        return <ErrorBoundary key="coverage"><CoverageView /></ErrorBoundary>;
      case 'focus':
        return <ErrorBoundary key="focus"><FocusView /></ErrorBoundary>;
      case 'revisions':
        return <ErrorBoundary key="revisions"><RevisionsView /></ErrorBoundary>;
      case 'pitch':
        return <ErrorBoundary key="pitch"><PitchView /></ErrorBoundary>;
      case 'settings':
        return <ErrorBoundary key="settings"><SettingsView /></ErrorBoundary>;
      default:
        return <ErrorBoundary key="home"><HomeView /></ErrorBoundary>;
    }
  };

  return (
    <AppShell>
      {renderContent()}
    </AppShell>
  );
}
