'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Target,
  Home,
  FileText,
  Users,
  GitBranch,
  Presentation,
  Settings,
  Upload,
  LogOut,
  Check,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TabId } from '@/stores/app-store';
import { DraftUploadModal } from '@/components/home/draft-upload-modal';

const PROJECT_TABS = [
  { id: 'scout', label: 'Scout', icon: Target },
  { id: 'coverage', label: 'Coverage', icon: FileText },
  { id: 'focus', label: 'Focus', icon: Users },
  { id: 'revisions', label: 'Revisions', icon: GitBranch },
  { id: 'pitch', label: 'Pitch', icon: Presentation },
  { id: 'studio', label: 'Studio', icon: Settings },
] as const;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const {
    activeTab,
    setActiveTab,
    currentProject,
    currentStudio,
    studios,
    setCurrentStudio,
    setCurrentProject,
  } = useAppStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showStudioSwitcher, setShowStudioSwitcher] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
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

  function handleGoHome() {
    setCurrentProject(null);
    setActiveTab('home');
  }

  const hasProject = currentProject !== null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Icon Rail — hidden on mobile */}
        <nav className="hidden md:flex w-[72px] flex-col items-center py-6 bg-sidebar border-r border-border/50">
          {/* Logo mark */}
          <div className="mb-6">
            <button
              onClick={handleGoHome}
              className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-elevated hover:opacity-90 transition-opacity"
            >
              <Target className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </button>
          </div>

          {/* Home */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleGoHome}
                className={cn(
                  'relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
                  'hover:bg-elevated/80',
                  activeTab === 'home' && 'bg-elevated'
                )}
              >
                {activeTab === 'home' && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -left-[22px] w-1 h-5 rounded-full bg-gradient-gold"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Home
                  className={cn(
                    'w-[20px] h-[20px] transition-colors duration-200',
                    activeTab === 'home' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  strokeWidth={activeTab === 'home' ? 2 : 1.5}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="glass border-border/50 px-3 py-1.5">
              <span className="text-xs font-medium">Home</span>
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="w-6 h-px bg-border/50 my-2" />

          {/* Project tabs */}
          <div className="flex-1 flex flex-col items-center gap-1">
            {PROJECT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const disabled = !hasProject;

              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => !disabled && setActiveTab(tab.id as TabId)}
                      className={cn(
                        'relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
                        disabled
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:bg-elevated/80',
                        isActive && !disabled && 'bg-elevated'
                      )}
                    >
                      {isActive && !disabled && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute -left-[22px] w-1 h-5 rounded-full bg-gradient-gold"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon
                        className={cn(
                          'w-[20px] h-[20px] transition-colors duration-200',
                          isActive && !disabled ? 'text-foreground' : 'text-muted-foreground'
                        )}
                        strokeWidth={isActive && !disabled ? 2 : 1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="glass border-border/50 px-3 py-1.5">
                    <span className="text-xs font-medium">
                      {disabled ? `${tab.label} (open a project)` : tab.label}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col items-center gap-2 mt-4">
            {/* Studio switcher */}
            {studios.length > 0 && (
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowStudioSwitcher(!showStudioSwitcher)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-elevated/80 transition-colors duration-150 ease-out"
                    >
                      <div className="w-6 h-6 rounded-lg bg-elevated flex items-center justify-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {currentStudio?.name?.charAt(0) || 'S'}
                        </span>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="glass border-border/50 px-3 py-1.5">
                    <span className="text-xs font-medium">{currentStudio?.name || 'Studios'}</span>
                  </TooltipContent>
                </Tooltip>

                {/* Studio switcher dropdown */}
                <AnimatePresence>
                  {showStudioSwitcher && (
                    <StudioSwitcherDropdown
                      studios={studios}
                      currentStudioId={currentStudio?.id}
                      onSelect={(studio) => {
                        setCurrentStudio(studio);
                        setCurrentProject(null);
                        setActiveTab('home');
                        setShowStudioSwitcher(false);
                      }}
                      onClose={() => setShowStudioSwitcher(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {userEmail && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-elevated/80 transition-colors duration-150 ease-out"
                    >
                      <LogOut className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="glass border-border/50 px-3 py-1.5">
                    <span className="text-xs font-medium">Sign out</span>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {userEmail.charAt(0)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="glass border-border/50 px-3 py-1.5">
                    <span className="text-xs">{userEmail}</span>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          {/* Context bar — only shows in project context */}
          {activeTab !== 'home' && (
            <div className="flex items-center justify-between px-4 md:px-8 pt-4 md:pt-6 pb-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <h1 className="text-lg md:text-2xl font-semibold tracking-tight flex-shrink-0">
                  {PROJECT_TABS.find((t) => t.id === activeTab)?.label}
                </h1>
                {currentProject && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-xs text-muted-foreground min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-bullseye-gold flex-shrink-0" />
                    <span className="truncate">{currentProject.title}</span>
                  </div>
                )}
              </div>

              {currentProject && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface hover:bg-elevated transition-colors duration-150 ease-out text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="hidden sm:inline">Upload Draft</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="glass border-border/50">
                    <span className="text-xs">Upload a new draft (PDF)</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Content Area */}
          <div className={cn(
            'flex-1 overflow-auto pb-8',
            activeTab === 'home' ? 'px-4 md:px-8 pt-4 md:pt-6' : 'px-4 md:px-8'
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0, 0, 0.58, 1] }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-sidebar border-t border-border/50 px-2 py-1 safe-area-bottom">
          <MobileTabButton
            icon={Home}
            label="Home"
            isActive={activeTab === 'home'}
            onClick={handleGoHome}
          />
          {PROJECT_TABS.map((tab) => {
            const disabled = !hasProject;
            return (
              <MobileTabButton
                key={tab.id}
                icon={tab.icon}
                label={tab.label}
                isActive={activeTab === tab.id}
                disabled={disabled}
                onClick={() => !disabled && setActiveTab(tab.id as TabId)}
              />
            );
          })}
        </nav>
      </div>
      <DraftUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </TooltipProvider>
  );
}

// Mobile tab button
function MobileTabButton({
  icon: Icon,
  label,
  isActive,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-w-[48px] rounded-lg transition-colors duration-150 ease-out',
        disabled && 'opacity-30 cursor-not-allowed',
        isActive && !disabled && 'text-foreground'
      )}
    >
      <div className="relative">
        <Icon
          className={cn(
            'w-5 h-5 transition-colors',
            isActive && !disabled ? 'text-foreground' : 'text-muted-foreground'
          )}
          strokeWidth={isActive && !disabled ? 2 : 1.5}
        />
        {isActive && !disabled && (
          <motion.div
            layoutId="mobile-nav-indicator"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gradient-gold"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
      </div>
      <span className={cn(
        'text-[9px] font-medium leading-tight',
        isActive && !disabled ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {label}
      </span>
    </button>
  );
}

// Studio switcher dropdown
function StudioSwitcherDropdown({
  studios,
  currentStudioId,
  onSelect,
  onClose,
}: {
  studios: { id: string; name: string; slug: string; ownerId: string; createdAt: Date; updatedAt: Date }[];
  currentStudioId?: string;
  onSelect: (studio: typeof studios[0]) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, x: -4, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -4, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="absolute left-14 bottom-0 z-50 w-52 rounded-xl bg-background border border-border/50 shadow-2xl overflow-hidden"
      >
        <div className="p-1.5">
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Studios
            </span>
          </div>
          {studios.map((studio) => (
            <button
              key={studio.id}
              onClick={() => onSelect(studio)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 ease-out',
                studio.id === currentStudioId
                  ? 'bg-elevated text-foreground'
                  : 'hover:bg-elevated/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="w-6 h-6 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold uppercase">
                  {studio.name.charAt(0)}
                </span>
              </div>
              <span className="text-xs font-medium flex-1 truncate">{studio.name}</span>
              {studio.id === currentStudioId && (
                <Check className="w-3.5 h-3.5 text-bullseye-gold" />
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
