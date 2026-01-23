'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useProjects, useUpdateProject, useDeleteProject, type ProjectWithCount } from '@/hooks/use-projects';
import { useToastStore } from '@/stores/toast-store';
import {
  Plus,
  Clock,
  ChevronDown,
  ChevronRight,
  Layers,
  Target,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectCreateModal } from '@/components/home/project-create-modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { EvaluationStatus } from '@/types';

const FORMAT_LABELS: Record<string, string> = {
  FEATURE: 'Feature',
  TV_PILOT: 'TV Pilot',
  TV_EPISODE: 'TV Episode',
  SHORT: 'Short',
  LIMITED_SERIES: 'Limited Series',
  DOCUMENTARY: 'Documentary',
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  ACTIVE: { dot: 'bg-bullseye-gold', label: 'Active' },
  ARCHIVED: { dot: 'bg-muted-foreground', label: 'Archived' },
  COMPLETED: { dot: 'bg-success', label: 'Completed' },
};

interface StudioGroup {
  studioId: string;
  studioName: string;
  projects: ProjectWithCount[];
}

function groupProjectsByStudio(projects: ProjectWithCount[]): StudioGroup[] {
  const studioMap = new Map<string, StudioGroup>();

  for (const project of projects) {
    const key = project.studio?.id || project.studioId;
    const name = project.studio?.name || 'My Studio';

    if (!studioMap.has(key)) {
      studioMap.set(key, { studioId: key, studioName: name, projects: [] });
    }
    studioMap.get(key)!.projects.push(project);
  }

  // Sort studios alphabetically
  return Array.from(studioMap.values()).sort((a, b) =>
    a.studioName.localeCompare(b.studioName)
  );
}

const EVALUATION_STATUS_CONFIG = {
  UNDER_CONSIDERATION: { label: 'Under Consideration', className: 'text-amber-500' },
  APPROVED: { label: 'Approved', className: 'text-green-500' },
  REJECTED: { label: 'Rejected', className: 'text-red-400/70' },
} as const;

const EVALUATION_STATUS_DOT: Record<EvaluationStatus, string> = {
  UNDER_CONSIDERATION: 'bg-amber-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-400',
};

function EvaluationStatusBadge({
  projectId,
  status,
}: {
  projectId: string;
  status: EvaluationStatus;
}) {
  const { mutate: updateProject } = useUpdateProject();
  const config = EVALUATION_STATUS_CONFIG[status];
  const dotColor = EVALUATION_STATUS_DOT[status];

  function handleSelect(newStatus: EvaluationStatus) {
    if (newStatus !== status) {
      updateProject({ id: projectId, evaluationStatus: newStatus });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-elevated/50 transition-colors text-[10px]"
        >
          <div className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
          <span className={cn('font-medium', config.className)}>
            {config.label}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
        {(Object.entries(EVALUATION_STATUS_CONFIG) as [EvaluationStatus, typeof config][]).map(
          ([key, cfg]) => (
            <DropdownMenuItem
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(key);
              }}
              className="flex items-center gap-2"
            >
              <div className={cn('w-2 h-2 rounded-full', EVALUATION_STATUS_DOT[key])} />
              <span className={cfg.className}>{cfg.label}</span>
              {key === status && (
                <span className="ml-auto text-muted-foreground text-xs">Current</span>
              )}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StudioStats({ projects }: { projects: ProjectWithCount[] }) {
  const counts = { UNDER_CONSIDERATION: 0, APPROVED: 0, REJECTED: 0 };
  for (const project of projects) {
    const status = project.evaluationStatus || 'UNDER_CONSIDERATION';
    if (status in counts) {
      counts[status as keyof typeof counts]++;
    }
  }

  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-3 ml-6">
      {entries.map(([status, count]) => {
        const config = EVALUATION_STATUS_CONFIG[status as keyof typeof EVALUATION_STATUS_CONFIG];
        return (
          <span key={status} className="flex items-center gap-1 text-xs">
            <span className={cn('font-medium', config.className)}>{count}</span>
            <span className="text-muted-foreground">{config.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function HomeView() {
  const { setCurrentProject, setActiveTab } = useAppStore();
  const { data: projects, isLoading, error } = useProjects();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const addToast = useToastStore((s) => s.addToast);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [collapsedStudios, setCollapsedStudios] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const studioGroups = projects ? groupProjectsByStudio(projects) : [];

  function handleOpenProject(project: ProjectWithCount) {
    setCurrentProject(project);
    setActiveTab('scout');
  }

  function toggleStudioCollapse(studioId: string) {
    setCollapsedStudios((prev) => {
      const next = new Set(prev);
      if (next.has(studioId)) {
        next.delete(studioId);
      } else {
        next.add(studioId);
      }
      return next;
    });
  }

  function handleConfirmDelete() {
    if (!deleteConfirmId) return;
    deleteProject(deleteConfirmId, {
      onSuccess: () => {
        addToast('Project deleted', 'success');
        setDeleteConfirmId(null);
      },
      onError: (err) => {
        addToast(err.message || 'Failed to delete project', 'error');
        setDeleteConfirmId(null);
      },
    });
  }

  return (
    <>
      <div className="max-w-5xl mx-auto py-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Projects
            </h1>
            {!isLoading && projects && (
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'} across {studioGroups.length} {studioGroups.length === 1 ? 'studio' : 'studios'}
              </p>
            )}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-gold text-primary-foreground text-sm font-medium shadow-elevated hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-danger">Failed to load projects</p>
          </div>
        )}

        {/* Projects grouped by studio */}
        {!isLoading && !error && projects && projects.length > 0 && (
          <div className="space-y-6">
            {studioGroups.map((group) => {
              const isCollapsed = collapsedStudios.has(group.studioId);
              return (
                <div key={group.studioId}>
                  {/* Studio header */}
                  <button
                    onClick={() => toggleStudioCollapse(group.studioId)}
                    className="flex items-center gap-2 mb-3 group/header"
                  >
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform duration-200',
                        isCollapsed && '-rotate-90'
                      )}
                    />
                    <h2 className="text-lg font-semibold tracking-tight">
                      {group.studioName}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </button>

                  {/* Studio stat cards */}
                  {!isCollapsed && group.projects.length > 0 && (
                    <StudioStats projects={group.projects} />
                  )}

                  {/* Project cards */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <AnimatePresence>
                            {group.projects.map((project, i) => (
                              <motion.div
                                key={project.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                              >
                                <ProjectCard
                                  project={project}
                                  onOpen={() => handleOpenProject(project)}
                                  onDelete={() => setDeleteConfirmId(project.id)}
                                />
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && projects && projects.length === 0 && (
          <EmptyState onCreateProject={() => setShowCreateModal(true)} />
        )}
      </div>

      <ProjectCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently delete the project and all its drafts. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-elevated/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border/50 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-elevated" />
        <div className="h-2.5 w-16 rounded bg-elevated" />
      </div>
      <div className="h-4 w-3/4 rounded bg-elevated mb-2" />
      <div className="h-3 w-full rounded bg-elevated mb-1" />
      <div className="h-3 w-2/3 rounded bg-elevated mb-4" />
      <div className="flex items-center gap-4 pt-2 border-t border-border/30">
        <div className="h-3 w-16 rounded bg-elevated" />
        <div className="h-3 w-14 rounded bg-elevated" />
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen, onDelete }: { project: ProjectWithCount; onOpen: () => void; onDelete: () => void }) {
  const draftCount = project._count?.drafts ?? 0;
  const status = STATUS_STYLES[project.status] || STATUS_STYLES.ACTIVE;
  const evalStatus: EvaluationStatus = project.evaluationStatus || 'UNDER_CONSIDERATION';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(project.title);
  const [editError, setEditError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: updateProject } = useUpdateProject();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleStartRename() {
    setEditValue(project.title);
    setEditError(false);
    setIsEditing(true);
  }

  function handleSaveRename() {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditError(true);
      return;
    }
    if (trimmed !== project.title) {
      updateProject({ id: project.id, title: trimmed });
    }
    setIsEditing(false);
    setEditError(false);
  }

  function handleCancelRename() {
    setIsEditing(false);
    setEditValue(project.title);
    setEditError(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  }

  return (
    <div
      onClick={isEditing ? undefined : onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (!isEditing && (e.key === 'Enter' || e.key === ' ')) onOpen(); }}
      className="w-full text-left rounded-2xl bg-surface border border-border/50 p-5 hover:border-border hover:bg-elevated/30 active:scale-[0.98] transition-all duration-200 ease-out group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {FORMAT_LABELS[project.format] || project.format}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-elevated/50 transition-all"
                aria-label="Project actions"
              >
                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename();
                }}
                className="flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-2 text-red-500 focus:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
        </div>
      </div>

      {isEditing ? (
        <div className="mb-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              if (e.target.value.trim()) setEditError(false);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveRename}
            className={cn(
              'w-full text-sm font-semibold bg-elevated/50 rounded px-2 py-1 outline-none border',
              editError ? 'border-red-500' : 'border-border focus:border-bullseye-gold'
            )}
          />
          {editError && (
            <p className="text-[10px] text-red-500 mt-0.5">Name cannot be empty</p>
          )}
        </div>
      ) : (
        <h3 className="text-sm font-semibold mb-1 line-clamp-1">{project.title}</h3>
      )}
      {project.logline && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {project.logline}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="w-3 h-3" />
            <span className="text-[11px]">{draftCount} {draftCount === 1 ? 'draft' : 'drafts'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[11px]">{formatRelativeDate(project.updatedAt)}</span>
          </div>
        </div>
        <EvaluationStatusBadge projectId={project.id} status={evalStatus} />
      </div>
    </div>
  );
}

function EmptyState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24"
    >
      <div className="mb-6">
        <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center">
          <Target className="w-12 h-12 text-muted-foreground" />
        </div>
      </div>

      <h2 className="text-lg font-semibold tracking-tight mb-2">Create your first project</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
        Get started by creating a project to analyze scripts with your AI reader panel.
      </p>

      <button
        onClick={onCreateProject}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-gold text-primary-foreground text-sm font-medium shadow-elevated hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>
    </motion.div>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
