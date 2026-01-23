'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  createdAt: string;
  updatedAt: string;
}

// ============================================
// HOOKS
// ============================================

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
