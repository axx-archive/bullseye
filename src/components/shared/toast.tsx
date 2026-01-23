'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/stores/toast-store';

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: typeof CheckCircle }> = {
  success: { bg: 'bg-success/10', border: 'border-success/40', icon: CheckCircle },
  error: { bg: 'bg-danger/10', border: 'border-danger/40', icon: XCircle },
  warning: { bg: 'bg-warning/10', border: 'border-warning/40', icon: AlertTriangle },
  info: { bg: 'bg-info/10', border: 'border-info/40', icon: Info },
};

const variantIconColor: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const style = variantStyles[toast.variant];
          const Icon = style.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => removeToast(toast.id)}
              className={`pointer-events-auto cursor-pointer flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} shadow-elevated backdrop-blur-sm max-w-sm`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${variantIconColor[toast.variant]}`} />
              <span className="text-sm text-foreground">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
