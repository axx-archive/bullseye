'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectFormat } from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ProjectWithCount extends Project {
  _count: { drafts: number };
  studio: { id: string; name: string };
}

interface ProjectWithDrafts extends Omit<Project, 'drafts'> {
  drafts: Array<{
    id: string;
    draftNumber: number;
    pageCount: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface CreateProjectInput {
  title: string;
  logline?: string;
  genre: string;
  format: ProjectFormat;
}

// ============================================
// HOOKS
// ============================================

export function useProjects() {
  return useQuery<ProjectWithCount[]>({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useProject(id: string | null) {
  return useQuery<ProjectWithDrafts>({
    queryKey: projectKeys.detail(id!),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch project');
      }
      return res.json();
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

interface MutationContext {
  previous: ProjectWithCount[] | undefined;
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectWithCount, Error, CreateProjectInput, MutationContext>({
    mutationFn: async (input) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to create project' }));
        throw new Error(error.error || 'Failed to create project');
      }
      return res.json();
    },
    onMutate: async (newProject) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({ queryKey: projectKeys.all });

      // Snapshot previous value
      const previous = queryClient.getQueryData<ProjectWithCount[]>(projectKeys.all);

      // Optimistically add the new project
      const optimistic: ProjectWithCount = {
        id: `temp-${Date.now()}`,
        title: newProject.title,
        logline: newProject.logline,
        genre: newProject.genre,
        format: newProject.format,
        status: 'ACTIVE',
        evaluationStatus: 'UNDER_CONSIDERATION',
        sortOrder: 0,
        studioId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { drafts: 0 },
        studio: { id: '', name: '' },
      };

      queryClient.setQueryData<ProjectWithCount[]>(projectKeys.all, (old) => [
        optimistic,
        ...(old || []),
      ]);

      return { previous };
    },
    onError: (_err, _newProject, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(projectKeys.all, context.previous);
      }
    },
    onSettled: () => {
      // Refetch to get server state
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
