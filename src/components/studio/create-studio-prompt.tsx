'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';

export function CreateStudioPrompt() {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addStudio, setCurrentStudio } = useAppStore();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a studio name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create studio');
      }

      const studio = await res.json();
      const studioData = {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        ownerId: studio.ownerId,
        createdAt: new Date(studio.createdAt),
        updatedAt: new Date(studio.updatedAt),
      };

      addStudio(studioData);
      setCurrentStudio(studioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create studio');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border/50 bg-surface p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Create Your Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            A studio is your creative workspace. Give it a name to get started.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="studio-name"
              className="text-sm font-medium text-foreground"
            >
              Studio Name
            </label>
            <input
              id="studio-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
              placeholder="My Studio"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
              disabled={isCreating}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Studio'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
