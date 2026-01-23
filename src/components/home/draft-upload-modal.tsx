'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useUploadDraft } from '@/hooks/use-drafts';
import { useToastStore } from '@/stores/toast-store';
import { X, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftUploadModalProps {
  open: boolean;
  onClose: () => void;
}

export function DraftUploadModal({ open, onClose }: DraftUploadModalProps) {
  const { currentProject, setCurrentDraft } = useAppStore();
  const { addToast } = useToastStore();
  const uploadMutation = useUploadDraft();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open || !currentProject) return null;

  const existingDrafts = currentProject.drafts?.length || 0;
  const nextDraftNumber = existingDrafts + 1;
  const isUploading = uploadMutation.isPending;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  }

  function handleUpload() {
    if (!file || !currentProject) return;

    uploadMutation.mutate(
      {
        projectId: currentProject.id,
        file,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          addToast(
            `Draft uploaded — ${data.pageCount ?? 0} pages extracted`,
            'success'
          );
          setCurrentDraft({
            id: data.id,
            projectId: currentProject.id,
            draftNumber: data.draftNumber,
            scriptUrl: data.scriptUrl,
            pageCount: data.pageCount ?? undefined,
            status: data.status as 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED',
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          });
          resetAndClose();
        },
        onError: (error) => {
          addToast(error.message, 'error');
        },
      }
    );
  }

  function resetAndClose() {
    setFile(null);
    setNotes('');
    setIsDragging(false);
    uploadMutation.reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isUploading ? resetAndClose : undefined}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative w-full max-w-md mx-4 rounded-2xl bg-background border border-border/50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Upload Draft</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Draft #{nextDraftNumber} for {currentProject.title}
            </p>
          </div>
          <button
            onClick={!isUploading ? resetAndClose : undefined}
            disabled={isUploading}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Upload area */}
        <div className="px-6 pb-6 space-y-4">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-bullseye-gold/50 bg-bullseye-gold/5">
              <Loader2 className="w-8 h-8 text-bullseye-gold mb-3 animate-spin" />
              <p className="text-sm font-medium">Extracting text...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Processing {file?.name}
              </p>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                isDragging
                  ? 'border-bullseye-gold bg-bullseye-gold/5'
                  : file
                    ? 'border-success/50 bg-success/5'
                    : 'border-border/50 hover:border-border bg-surface/50 hover:bg-surface'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <>
                  <CheckCircle className="w-8 h-8 text-success mb-3" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Drop your script here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF files only
                  </p>
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Notes <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this draft..."
              rows={2}
              disabled={isUploading}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-bullseye-gold/50 transition-colors resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50">
          <button
            onClick={resetAndClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all',
              file && !isUploading
                ? 'bg-gradient-gold text-primary-foreground shadow-elevated hover:opacity-90'
                : 'bg-surface text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading...
              </span>
            ) : (
              'Upload Draft'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
