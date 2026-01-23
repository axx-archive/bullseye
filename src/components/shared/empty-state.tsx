'use client';

import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-sm"
      >
        <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-5">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {description}
        </p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-sm font-medium text-bullseye-gold hover:text-bullseye-gold/80 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </motion.div>
    </div>
  );
}
