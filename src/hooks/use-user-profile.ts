'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UserProfile {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

export const userProfileKeys = {
  profile: ['user', 'profile'] as const,
};

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: userProfileKeys.profile,
    queryFn: async () => {
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (displayName: string) => {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(error.error || 'Failed to save');
      }
      return res.json() as Promise<UserProfile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userProfileKeys.profile });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to upload' }));
        throw new Error(error.error || 'Failed to upload avatar');
      }
      return res.json() as Promise<{ avatarUrl: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userProfileKeys.profile });
    },
  });
}
