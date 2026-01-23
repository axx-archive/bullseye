'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToastStore } from '@/stores/toast-store';

interface SettingsResponse {
  hasApiKey: boolean;
  maskedKey: string | null;
}

export function SettingsView() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: SettingsResponse = await res.json();
        setHasApiKey(data.hasApiKey);
        setMaskedKey(data.maskedKey);
      }
    } catch {
      // Silently handle fetch error on load
    }
  }

  function validateKey(key: string): boolean {
    if (!key.startsWith('sk-ant-')) {
      setError('API key must start with sk-ant-');
      return false;
    }
    setError(null);
    return true;
  }

  async function handleSave() {
    if (!validateKey(apiKey)) return;

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claudeApiKey: apiKey }),
      });

      if (res.ok) {
        const data: SettingsResponse = await res.json();
        setHasApiKey(data.hasApiKey);
        setMaskedKey(data.maskedKey);
        setApiKey('');
        setError(null);
        addToast('API key saved successfully', 'success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save API key');
      }
    } catch {
      setError('Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' });
      if (res.ok) {
        setHasApiKey(false);
        setMaskedKey(null);
        setApiKey('');
        setShowDeleteConfirm(false);
        addToast('API key removed', 'success');
      }
    } catch {
      addToast('Failed to remove API key', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-xl font-semibold tracking-tight mb-6">Settings</h2>

      {/* Claude API Key Section */}
      <div className="rounded-xl border border-border/50 bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Claude API Key</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Your API key is encrypted and stored securely. It&apos;s used by Scout and Focus Group features.
        </p>

        {hasApiKey && maskedKey && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-elevated text-sm text-muted-foreground">
            <span className="font-mono">{maskedKey}</span>
            <span className="text-xs text-green-500 ml-auto">Active</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (error) setError(null);
              }}
              placeholder={hasApiKey ? 'Enter new key to replace...' : 'sk-ant-...'}
              className={error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={handleSave} disabled={!apiKey || saving} size="default">
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {hasApiKey && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
            <p className="text-xs text-muted-foreground mb-3">
              Are you sure you want to remove your API key? Scout and Focus Group features will stop working.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Removing...' : 'Remove Key'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
