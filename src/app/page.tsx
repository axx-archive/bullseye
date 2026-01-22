'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useAppStore } from '@/stores/app-store';
import { ScoutView } from '@/components/scout/scout-view';
import { CoverageView } from '@/components/coverage/coverage-view';
import { FocusView } from '@/components/focus/focus-view';
import { RevisionsView } from '@/components/revisions/revisions-view';
import { PitchView } from '@/components/pitch/pitch-view';
import { StudioView } from '@/components/studio/studio-view';

export default function Home() {
  const { activeTab } = useAppStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'scout':
        return <ScoutView />;
      case 'coverage':
        return <CoverageView />;
      case 'focus':
        return <FocusView />;
      case 'revisions':
        return <RevisionsView />;
      case 'pitch':
        return <PitchView />;
      case 'studio':
        return <StudioView />;
      default:
        return <ScoutView />;
    }
  };

  return (
    <AppShell>
      {renderContent()}
    </AppShell>
  );
}
