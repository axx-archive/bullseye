'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useCreateProject } from '@/hooks/use-projects';
import { useToastStore } from '@/stores/toast-store';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { ProjectFormat } from '@/types';

interface ProjectCreateModalProps {
  open: boolean;
  onClose: () => void;
}

const FORMATS: { value: ProjectFormat; label: string }[] = [
  { value: 'FEATURE', label: 'Feature Film' },
  { value: 'TV_PILOT', label: 'TV Pilot' },
  { value: 'TV_EPISODE', label: 'TV Episode' },
  { value: 'SHORT', label: 'Short Film' },
  { value: 'LIMITED_SERIES', label: 'Limited Series' },
  { value: 'DOCUMENTARY', label: 'Documentary' },
];

const GENRES = [
  'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi',
  'Action', 'Romance', 'Mystery', 'Fantasy', 'Crime',
  'Adventure', 'Animation', 'Documentary', 'Musical',
];

export function ProjectCreateModal({ open, onClose }: ProjectCreateModalProps) {
  const { setCurrentProject, setActiveTab } = useAppStore();
  const createProject = useCreateProject();
  const addToast = useToastStore((s) => s.addToast);
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState<ProjectFormat>('FEATURE');

  function handleCreate() {
    if (!title.trim() || !genre) return;

    createProject.mutate(
      {
        title: title.trim(),
        logline: logline.trim() || undefined,
        genre,
        format,
      },
      {
        onSuccess: (project) => {
          addToast('Project created successfully', 'success');
          setCurrentProject(project);
          setActiveTab('scout');
          resetAndClose();
        },
        onError: (error) => {
          addToast(error.message || 'Failed to create project', 'error');
        },
      }
    );
  }

  function resetAndClose() {
    setTitle('');
    setLogline('');
    setGenre('');
    setFormat('FEATURE');
    onClose();
  }

  if (!open) return null;

  const isValid = title.trim().length > 0 && genre.length > 0 && !createProject.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative w-full md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl bg-background border border-border/50 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight">New Project</h2>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-elevated active:scale-[0.98] transition-colors duration-150 ease-out"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 pb-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Script"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-bullseye-gold/50 transition-colors"
              autoFocus
            />
          </div>

          {/* Logline */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Logline <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <textarea
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              placeholder="A brief description of your script..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-bullseye-gold/50 transition-colors resize-none"
            />
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Format
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFormat(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    format === value
                      ? 'bg-bullseye-gold/15 text-bullseye-gold border border-bullseye-gold/30'
                      : 'bg-surface border border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Genre
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    genre === g
                      ? 'bg-bullseye-gold/15 text-bullseye-gold border border-bullseye-gold/30'
                      : 'bg-surface border border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all',
              isValid
                ? 'bg-gradient-gold text-primary-foreground shadow-elevated hover:opacity-90'
                : 'bg-surface text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            Create Project
          </button>
        </div>
      </motion.div>
    </div>
  );
}
