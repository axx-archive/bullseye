'use client';

import { useEffect } from 'react';
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

export default function Home() {
  const { activeTab, currentStudio, studios, setCurrentStudio, addStudio } = useAppStore();

  // Initialize default studio if none exists
  useEffect(() => {
    if (studios.length === 0) {
      const defaultStudio = {
        id: crypto.randomUUID(),
        name: 'My Studio',
        slug: 'my-studio',
        ownerId: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addStudio(defaultStudio);
      setCurrentStudio(defaultStudio);
    } else if (!currentStudio) {
      setCurrentStudio(studios[0]);
    }
  }, [studios.length]);

  const renderContent = () => {
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
      case 'studio':
        return <ErrorBoundary key="studio"><StudioView /></ErrorBoundary>;
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
