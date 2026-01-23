'use client';

import { useAppStore } from '@/stores/app-store';
import { ScoutChat } from './scout-chat';
import { ReaderAnalysisPanel } from './reader-analysis-panel';
import { FocusGroupPanel } from './focus-group-panel';
import { ReaderChatPanel } from './reader-chat-panel';
import { ExecutiveEvalPanel } from './executive-eval-panel';
import { motion, AnimatePresence } from 'framer-motion';

export function ScoutLayout() {
  const { rightPanelMode } = useAppStore();

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Left Panel — Scout Chat */}
      <div className="flex-1 min-w-0 lg:max-w-[50%] border-r border-border/30">
        <ScoutChat />
      </div>

      {/* Right Panel — Reader Activity */}
      <div className="flex-1 min-w-0 lg:max-w-[50%]">
        <AnimatePresence mode="wait">
          {rightPanelMode === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ExecutiveEvalPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
