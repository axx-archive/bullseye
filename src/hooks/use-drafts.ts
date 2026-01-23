'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from './use-projects';

// ============================================
// TYPES
// ============================================

interface UploadDraftInput {
  projectId: string;
  file: File;
  notes?: string;
}

interface UploadDraftResponse {
  id: string;
  draftNumber: number;
  pageCount: number | null;
  status: string;
  scriptUrl: string;
  scriptText?: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// QUERY KEYS
// ============================================

export const draftKeys = {
  list: (projectId: string) => ['drafts', projectId] as const,
  deliverable: (draftId: string) => ['drafts', draftId, 'deliverable'] as const,
  focusSessions: (draftId: string) => ['drafts', draftId, 'focus-sessions'] as const,
  evaluations: (draftId: string) => ['drafts', draftId, 'evaluations'] as const,
};

// ============================================
// HOOKS
// ============================================

export function useDrafts(projectId: string | null) {
  return useQuery<UploadDraftResponse[]>({
    queryKey: draftKeys.list(projectId!),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch project');
      }
      const project = await res.json();
      return project.drafts ?? [];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useUploadDraft() {
  const queryClient = useQueryClient();

  return useMutation<UploadDraftResponse, Error, UploadDraftInput>({
    mutationFn: async ({ projectId, file, notes }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) {
        formData.append('notes', notes);
      }

      const res = await fetch(`/api/projects/${projectId}/drafts`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to upload draft' }));
        throw new Error(error.error || 'Failed to upload draft');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the project detail query so draft count updates
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      // Also invalidate the projects list for _count.drafts
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

interface UpdateDraftInput {
  projectId: string;
  draftId: string;
  notes: string;
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation<UploadDraftResponse, Error, UpdateDraftInput>({
    mutationFn: async ({ projectId, draftId, notes }) => {
      const res = await fetch(`/api/projects/${projectId}/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to update draft' }));
        throw new Error(error.error || 'Failed to update draft');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: draftKeys.list(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
    },
  });
}

interface DeleteDraftInput {
  projectId: string;
  draftId: string;
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, DeleteDraftInput>({
    mutationFn: async ({ projectId, draftId }) => {
      const res = await fetch(`/api/projects/${projectId}/drafts/${draftId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete draft' }));
        throw new Error(error.error || 'Failed to delete draft');
      }

      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: draftKeys.list(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
