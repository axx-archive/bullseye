'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useProjects } from '@/hooks/use-projects';
import {
  Plus,
  Clock,
  ChevronRight,
  Layers,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectCreateModal } from '@/components/home/project-create-modal';
import type { Project } from '@/types';

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

interface ProjectWithCount extends Project {
  _count: { drafts: number };
}

export function HomeView() {
  const { setCurrentProject, setActiveTab } = useAppStore();
  const { data: projects, isLoading, error } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleOpenProject(project: ProjectWithCount) {
    setCurrentProject(project);
    setActiveTab('scout');
  }

  return (
    <>
      <div className="max-w-5xl mx-auto py-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your Studio
            </h1>
            {!isLoading && projects && (
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
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

        {/* Projects grid */}
        {!isLoading && !error && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <ProjectCard
                  project={project}
                  onOpen={() => handleOpenProject(project)}
                />
              </motion.div>
            ))}
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

function ProjectCard({ project, onOpen }: { project: ProjectWithCount; onOpen: () => void }) {
  const draftCount = project._count?.drafts ?? 0;
  const status = STATUS_STYLES[project.status] || STATUS_STYLES.ACTIVE;

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl bg-surface border border-border/50 p-5 hover:border-border hover:bg-elevated/30 active:scale-[0.98] transition-all duration-200 ease-out group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {FORMAT_LABELS[project.format] || project.format}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out" />
      </div>

      <h3 className="text-sm font-semibold mb-1 line-clamp-1">{project.title}</h3>
      {project.logline && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {project.logline}
        </p>
      )}

      <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layers className="w-3 h-3" />
          <span className="text-[11px]">{draftCount} {draftCount === 1 ? 'draft' : 'drafts'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="text-[11px]">{formatRelativeDate(project.updatedAt)}</span>
        </div>
      </div>
    </button>
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
