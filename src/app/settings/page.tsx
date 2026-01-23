'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Trash2, Upload, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToastStore } from '@/stores/toast-store';
import { useUserProfile, useUpdateDisplayName, useUploadAvatar } from '@/hooks/use-user-profile';
import { UserAvatar } from '@/components/shared/user-avatar';
import { createClient } from '@/lib/supabase/client';

interface SettingsResponse {
  hasApiKey: boolean;
  maskedKey: string | null;
}

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-elevated/80 transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <UserSettingsSection />
        <ApiKeysSection />
        <AccountSettingsSection />
      </div>
    </div>
  );
}

// ============================================
// USER SETTINGS SECTION
// ============================================

function UserSettingsSection() {
  const { data: profile, isLoading } = useUserProfile();
  const updateDisplayName = useUpdateDisplayName();
  const uploadAvatar = useUploadAvatar();
  const addToast = useToastStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);

  if (profile && !nameInitialized) {
    setDisplayName(profile.displayName ?? '');
    setNameInitialized(true);
  }

  const handleNameSave = () => {
    const trimmed = displayName.trim();
    if (trimmed === (profile?.displayName ?? '')) return;
    if (!trimmed) return;
    updateDisplayName.mutate(trimmed, {
      onSuccess: () => addToast('Display name saved', 'success'),
      onError: (err: Error) => addToast(err.message, 'error'),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleAvatarClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadAvatar.mutate(file, {
          onSuccess: () => addToast('Avatar updated', 'success'),
          onError: (err: Error) => addToast(err.message, 'error'),
        });
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">User Settings</h2>
        <div className="rounded-xl border border-border/50 bg-surface p-6">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-elevated animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="w-48 h-4 bg-elevated rounded animate-pulse" />
              <div className="w-64 h-9 bg-elevated rounded animate-pulse" />
              <div className="w-36 h-3 bg-elevated rounded animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-4">User Settings</h2>
      <div className="rounded-xl border border-border/50 bg-surface p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploadAvatar.isPending}
            className="relative group flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            {uploadAvatar.isPending ? (
              <div className="w-16 h-16 rounded-full bg-elevated flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <UserAvatar
                  src={profile?.avatarUrl}
                  name={profile?.displayName}
                  email={profile?.email}
                  size="lg"
                />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              </>
            )}
          </button>

          {/* Name & Email */}
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleKeyDown}
                placeholder="Enter your display name"
                className="max-w-xs"
                disabled={updateDisplayName.isPending}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Email (cannot be changed)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// API KEYS SECTION
// ============================================

function ApiKeysSection() {
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
        addToast('API key saved', 'success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save API key');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(`Failed to save API key: ${message}`);
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
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-4">API Keys</h2>
      <div className="rounded-xl border border-border/50 bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Anthropic API Key</h3>
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
    </section>
  );
}

// ============================================
// ACCOUNT SETTINGS SECTION
// ============================================

function AccountSettingsSection() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-4">Account Settings</h2>
      <div className="rounded-xl border border-border/50 bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign Out</p>
            <p className="text-xs text-muted-foreground">Sign out of your account</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </section>
  );
}
