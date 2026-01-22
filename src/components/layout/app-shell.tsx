'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Target,
  FileText,
  Users,
  GitBranch,
  Presentation,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Tab configuration
const TABS = [
  { id: 'scout', label: 'Scout', icon: Target, description: 'AI Orchestrator' },
  { id: 'coverage', label: 'Coverage', icon: FileText, description: 'Script Analysis' },
  { id: 'focus', label: 'Focus', icon: Users, description: 'Live Discussion' },
  { id: 'revisions', label: 'Revisions', icon: GitBranch, description: 'Draft History' },
  { id: 'pitch', label: 'Pitch', icon: Presentation, description: 'Executive Sim' },
  { id: 'studio', label: 'Studio', icon: Settings, description: 'Configuration' },
] as const;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { activeTab, setActiveTab, sidebarOpen, toggleSidebar, currentProject } = useAppStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 240 : 72 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex flex-col border-r border-border bg-surface"
        >
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-gold flex items-center justify-center">
                <Target className="w-6 h-6 text-primary-foreground" />
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h1 className="text-lg font-bold text-gradient-gold">BULLSEYE</h1>
                    <p className="text-xs text-muted-foreground">Script Intelligence</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Project Selector */}
          <div className="p-3 border-b border-border">
            {sidebarOpen ? (
              <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                <Plus className="w-4 h-4" />
                {currentProject ? currentProject.title : 'New Project'}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Project</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex-1 p-3 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                        'hover:bg-elevated',
                        isActive && 'bg-elevated text-primary glow-gold-sm'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 flex-shrink-0',
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 text-left"
                          >
                            <span
                              className={cn(
                                'text-sm font-medium',
                                isActive ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {tab.label}
                            </span>
                            <p className="text-xs text-muted-foreground">{tab.description}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </TooltipTrigger>
                  {!sidebarOpen && (
                    <TooltipContent side="right">
                      <p className="font-medium">{tab.label}</p>
                      <p className="text-xs text-muted-foreground">{tab.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse Toggle */}
          <div className="p-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="w-full justify-center"
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-surface">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              {currentProject && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-elevated text-sm">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{currentProject.title}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload Script
              </Button>
              {userEmail && (
                <div className="flex items-center gap-2 pl-3 border-l border-border">
                  <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground hidden lg:inline">
                    {userEmail}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={handleSignOut}
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
