'use client';

import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 28,
  md: 40,
  lg: 64,
};

const TEXT_SIZE_MAP: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

const PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    return name.trim()[0].toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim()[0].toUpperCase();
  }
  return '?';
}

function getBackgroundColor(name?: string | null, email?: string): string {
  const str = name || email || '';
  const index = hashString(str) % PALETTE.length;
  return PALETTE[index];
}

export function UserAvatar({ src, name, email, size = 'md', className }: UserAvatarProps) {
  const dimension = SIZE_MAP[size];
  const initials = getInitials(name, email);
  const bgColor = getBackgroundColor(name, email);

  if (src) {
    return (
      <img
        src={src}
        alt={name || email || 'User avatar'}
        className={cn('rounded-full object-cover', className)}
        style={{ width: dimension, height: dimension }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        TEXT_SIZE_MAP[size],
        className
      )}
      style={{
        width: dimension,
        height: dimension,
        backgroundColor: bgColor,
      }}
    >
      <span className="font-semibold text-white leading-none">{initials}</span>
    </div>
  );
}
