'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { ScoutChat } from './scout-chat';
import { ReaderAnalysisPanel } from './reader-analysis-panel';
import { FocusGroupPanel } from './focus-group-panel';
import { ReaderChatPanel } from './reader-chat-panel';
import { ExecutiveEvalPanel } from './executive-eval-panel';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RightPanelPhase } from '@/lib/agent-sdk/types';

type MobilePanel = 'chat' | 'activity';

interface PillConfig {
  id: RightPanelPhase;
  label: string;
}

const PANEL_PILLS: PillConfig[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'focus_group', label: 'Focus Group' },
  { id: 'executive', label: 'Executive' },
  { id: 'reader_chat', label: 'Reader Chat' },
];

function RightPanelSelector() {
  const {
    rightPanelMode,
    userSelectedPanel,
    scoutRecommendedPanel,
    readerStates,
    focusGroupMessages,
    executiveStates,
    activeReaderChatId,
    setUserSelectedPanel,
  } = useAppStore();

  // Determine which pills have data to show
  const hasData: Record<RightPanelPhase, boolean> = {
    idle: false,
    analysis: readerStates.size > 0,
    focus_group: focusGroupMessages.length > 0,
    executive: executiveStates.size > 0,
    reader_chat: !!activeReaderChatId,
  };

  // Only show pills that have data
  const visiblePills = PANEL_PILLS.filter((pill) => hasData[pill.id]);

  if (visiblePills.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30">
      {visiblePills.map((pill) => {
        const isActive = rightPanelMode === pill.id;
        const isRecommended = scoutRecommendedPanel === pill.id && userSelectedPanel !== null && !isActive;

        return (
          <button
            key={pill.id}
            onClick={() => {
              if (isActive && userSelectedPanel !== null) {
                // Clicking the active pill while in manual mode returns to auto-follow
                setUserSelectedPanel(null);
              } else {
                setUserSelectedPanel(pill.id);
              }
            }}
            className={cn(
              'relative px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
              isActive
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5'
            )}
          >
            {pill.label}
            {/* Pulsing gold dot for SCOUT-recommended panel when user has overridden */}
            {isRecommended && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-bullseye-gold animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function RightPanelContent() {
  const { rightPanelMode } = useAppStore();

  return (
    <AnimatePresence mode="wait">
      {rightPanelMode === 'idle' && (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.58, 1] }}
          className="h-full flex items-center justify-center p-8"
        >
          <div className="text-center max-w-sm">
            <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-4">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground">
              Reader activity will appear here
            </p>
          </div>
        </motion.div>
      )}

      {rightPanelMode === 'analysis' && (
        <motion.div
          key="analysis"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.58, 1] }}
          className="h-full"
        >
          <ReaderAnalysisPanel />
        </motion.div>
      )}

      {rightPanelMode === 'focus_group' && (
        <motion.div
          key="focus_group"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.58, 1] }}
          className="h-full"
        >
          <FocusGroupPanel />
        </motion.div>
      )}

      {rightPanelMode === 'reader_chat' && (
        <motion.div
          key="reader_chat"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.58, 1] }}
          className="h-full"
        >
          <ReaderChatPanel />
        </motion.div>
      )}

      {rightPanelMode === 'executive' && (
        <motion.div
          key="executive"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.58, 1] }}
          className="h-full"
        >
          <ExecutiveEvalPanel />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ScoutLayout() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('chat');

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Toggle Buttons — visible only on mobile (< md) */}
      <div className="flex md:hidden border-b border-border/30 shrink-0">
        <button
          onClick={() => setMobilePanel('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors duration-150 ease-out relative ${
            mobilePanel === 'chat'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/70'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
          {mobilePanel === 'chat' && (
            <motion.div
              layoutId="mobile-scout-toggle"
              className="absolute bottom-0 left-4 right-4 h-0.5 bg-bullseye-gold rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => setMobilePanel('activity')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors duration-150 ease-out relative ${
            mobilePanel === 'activity'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/70'
          }`}
        >
          <Activity className="w-4 h-4" />
          Activity
          {mobilePanel === 'activity' && (
            <motion.div
              layoutId="mobile-scout-toggle"
              className="absolute bottom-0 left-4 right-4 h-0.5 bg-bullseye-gold rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 flex md:flex-row relative">
        {/* Left Panel — Scout Chat
            Always mounted to maintain SSE connection and streaming refs.
            On mobile: uses opacity/pointer-events for fade transition. */}
        <div
          className={`absolute inset-0 md:relative md:inset-auto md:flex-1 min-w-0 md:max-w-[50%] md:border-r md:border-border/30 flex flex-col overflow-y-auto transition-opacity duration-150 ease-out ${
            mobilePanel === 'chat'
              ? 'opacity-100 z-10 md:z-auto'
              : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:z-auto z-0'
          }`}
        >
          <ScoutChat />
        </div>

        {/* Right Panel — Reader Activity
            On mobile: uses opacity/pointer-events for fade transition.
            SSE events update Zustand store regardless of visibility. */}
        <div
          className={`absolute inset-0 md:relative md:inset-auto md:flex-1 min-w-0 md:max-w-[50%] flex flex-col overflow-y-auto transition-opacity duration-150 ease-out ${
            mobilePanel === 'activity'
              ? 'opacity-100 z-10 md:z-auto'
              : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:z-auto z-0'
          }`}
        >
          <RightPanelSelector />
          <RightPanelContent />
        </div>
      </div>
    </div>
  );
}
