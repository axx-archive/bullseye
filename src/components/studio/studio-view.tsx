'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Settings,
  Users,
  BarChart3,
  Building2,
  Save,
  Edit2,
  X,
  Loader2,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import {
  useStudio,
  useReaderPersonas,
  useExecutiveProfiles,
  useStudioIntelligence,
  studioKeys,
} from '@/hooks/use-studio';
import { useUserProfile, useUpdateDisplayName, useUploadAvatar } from '@/hooks/use-user-profile';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useToastStore } from '@/stores/toast-store';

// ============================================
// TYPES
// ============================================

interface ReaderPersona {
  id: string;
  name: string;
  displayName: string;
  background: string;
  voiceDescription: string;
  color: string;
  premiseWeight: number;
  characterWeight: number;
  dialogueWeight: number;
  structureWeight: number;
  commercialityWeight: number;
}

interface ExecutiveProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  evaluationStyle: string;
  priorityFactors: string[];
  dealBreakers: string[];
}

interface ScoreDistributions {
  overall?: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number };
  [key: string]: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number } | undefined;
}

interface RecommendationBreakdown {
  recommend?: number;
  consider?: number;
  pass?: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StudioView() {
  const [activeSection, setActiveSection] = useState<'readers' | 'executives' | 'calibration' | 'settings'>('readers');

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings className="w-7 h-7 text-primary" />
              Studio Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Customize your reader panel, executive profiles, and calibration settings
            </p>
          </div>

          {/* Navigation tabs */}
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as typeof activeSection)}>
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="readers" className="gap-2">
                <Users className="w-4 h-4" />
                Readers
              </TabsTrigger>
              <TabsTrigger value="executives" className="gap-2">
                <Building2 className="w-4 h-4" />
                Executives
              </TabsTrigger>
              <TabsTrigger value="calibration" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Calibration
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Readers tab */}
            <TabsContent value="readers" className="space-y-4 mt-6">
              <ReadersSection />
            </TabsContent>

            {/* Executives tab */}
            <TabsContent value="executives" className="space-y-4 mt-6">
              <ExecutivesSection />
            </TabsContent>

            {/* Calibration tab */}
            <TabsContent value="calibration" className="space-y-4 mt-6">
              <CalibrationSection />
            </TabsContent>

            {/* Settings tab */}
            <TabsContent value="settings" className="space-y-8 mt-6">
              <ProfileSection />
              <SettingsSection />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// READERS SECTION
// ============================================

function ReadersSection() {
  const { data: readers, isLoading, error } = useReaderPersonas();

  if (isLoading) {
    return <SectionSkeleton count={3} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger font-medium">Failed to load reader personas</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reader Panel</h2>
        <p className="text-sm text-muted-foreground">
          Configure your reader personas and their analytical weights
        </p>
      </div>

      <div className="grid gap-4">
        {readers?.map((reader) => (
          <ReaderConfigCard key={reader.id} reader={reader} />
        ))}
      </div>
    </div>
  );
}

function ReaderConfigCard({ reader }: { reader: ReaderPersona }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(reader.name);
  const [displayName, setDisplayName] = useState(reader.displayName);
  const [background, setBackground] = useState(reader.background);
  const [voiceDescription, setVoiceDescription] = useState(reader.voiceDescription);
  const [premiseWeight, setPremiseWeight] = useState(reader.premiseWeight);
  const [characterWeight, setCharacterWeight] = useState(reader.characterWeight);
  const [dialogueWeight, setDialogueWeight] = useState(reader.dialogueWeight);
  const [structureWeight, setStructureWeight] = useState(reader.structureWeight);
  const [commercialityWeight, setCommercialityWeight] = useState(reader.commercialityWeight);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ReaderPersona>) => {
      const res = await fetch(`/api/studio/readers/${reader.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(error.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioKeys.readers });
      addToast('Reader persona saved', 'success');
      setIsEditing(false);
      setErrors({});
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!displayName.trim()) newErrors.displayName = 'Display name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate({
      name: name.trim(),
      displayName: displayName.trim(),
      background: background.trim(),
      voiceDescription: voiceDescription.trim(),
      premiseWeight,
      characterWeight,
      dialogueWeight,
      structureWeight,
      commercialityWeight,
    });
  };

  const handleCancel = () => {
    setName(reader.name);
    setDisplayName(reader.displayName);
    setBackground(reader.background);
    setVoiceDescription(reader.voiceDescription);
    setPremiseWeight(reader.premiseWeight);
    setCharacterWeight(reader.characterWeight);
    setDialogueWeight(reader.dialogueWeight);
    setStructureWeight(reader.structureWeight);
    setCommercialityWeight(reader.commercialityWeight);
    setErrors({});
    setIsEditing(false);
  };

  const weights = { premise: premiseWeight, character: characterWeight, dialogue: dialogueWeight, structure: structureWeight, commerciality: commercialityWeight };
  const weightSetters = { premise: setPremiseWeight, character: setCharacterWeight, dialogue: setDialogueWeight, structure: setStructureWeight, commerciality: setCommercialityWeight };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              className="h-12 w-12"
              style={{ backgroundColor: `${reader.color}20` }}
            >
              <AvatarFallback style={{ color: reader.color }}>
                {reader.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{reader.name}</CardTitle>
              <CardDescription>{reader.displayName}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={handleCancel} disabled={saveMutation.isPending}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(errors.name && 'border-danger')}
                />
                {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={cn(errors.displayName && 'border-danger')}
                />
                {errors.displayName && <p className="text-xs text-danger">{errors.displayName}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Background</label>
              <Textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Voice Description</label>
              <Textarea
                value={voiceDescription}
                onChange={(e) => setVoiceDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Analytical Weights</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {Object.entries(weights).map(([dimension, weight]) => (
                  <div key={dimension} className="space-y-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="3"
                      value={weight}
                      onChange={(e) => weightSetters[dimension as keyof typeof weightSetters](parseFloat(e.target.value) || 0)}
                      className="text-center text-sm"
                    />
                    <div className="text-xs text-muted-foreground capitalize text-center">{dimension}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Background</label>
              <p className="text-sm mt-1">{reader.background}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Voice Description</label>
              <p className="text-sm mt-1">{reader.voiceDescription}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-3 block">
                Analytical Weights
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {Object.entries(weights).map(([dimension, weight]) => (
                  <div key={dimension} className="text-center">
                    <div
                      className={cn(
                        'text-2xl font-bold',
                        weight > 1 && 'text-success',
                        weight < 1 && 'text-muted-foreground'
                      )}
                    >
                      {weight.toFixed(1)}x
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{dimension}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: reader.color }}
              />
              <span className="text-sm text-muted-foreground">Reader color</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// EXECUTIVES SECTION
// ============================================

function ExecutivesSection() {
  const { data: executives, isLoading, error } = useExecutiveProfiles();

  if (isLoading) {
    return <SectionSkeleton count={3} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger font-medium">Failed to load executive profiles</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Executive Profiles</h2>
        <p className="text-sm text-muted-foreground">
          Configure simulated executives for pitch evaluations
        </p>
      </div>

      <div className="grid gap-4">
        {executives?.map((exec) => (
          <ExecutiveConfigCard key={exec.id} executive={exec} />
        ))}
      </div>
    </div>
  );
}

function ExecutiveConfigCard({ executive }: { executive: ExecutiveProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(executive.name);
  const [title, setTitle] = useState(executive.title);
  const [company, setCompany] = useState(executive.company);
  const [priorityFactors, setPriorityFactors] = useState(executive.priorityFactors.join(', '));
  const [dealBreakers, setDealBreakers] = useState(executive.dealBreakers.join(', '));

  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/studio/executives/${executive.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(error.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioKeys.executives });
      addToast('Executive profile saved', 'success');
      setIsEditing(false);
      setErrors({});
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!company.trim()) newErrors.company = 'Company is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate({
      name: name.trim(),
      title: title.trim(),
      company: company.trim(),
      priorityFactors: priorityFactors.split(',').map(f => f.trim()).filter(Boolean),
      dealBreakers: dealBreakers.split(',').map(f => f.trim()).filter(Boolean),
    });
  };

  const handleCancel = () => {
    setName(executive.name);
    setTitle(executive.title);
    setCompany(executive.company);
    setPriorityFactors(executive.priorityFactors.join(', '));
    setDealBreakers(executive.dealBreakers.join(', '));
    setErrors({});
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {executive.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{executive.name}</CardTitle>
              <CardDescription>
                {executive.title}, {executive.company}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={handleCancel} disabled={saveMutation.isPending}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(errors.name && 'border-danger')}
                />
                {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(errors.title && 'border-danger')}
                />
                {errors.title && <p className="text-xs text-danger">{errors.title}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Company</label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={cn(errors.company && 'border-danger')}
                />
                {errors.company && <p className="text-xs text-danger">{errors.company}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Priority Factors</label>
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
              <Textarea
                value={priorityFactors}
                onChange={(e) => setPriorityFactors(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Deal Breakers</label>
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
              <Textarea
                value={dealBreakers}
                onChange={(e) => setDealBreakers(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Priority Factors</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {executive.priorityFactors.map((factor) => (
                  <Badge key={factor} variant="secondary">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Deal Breakers</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {executive.dealBreakers.map((breaker) => (
                  <Badge key={breaker} variant="outline" className="text-danger">
                    {breaker}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// CALIBRATION SECTION
// ============================================

function CalibrationSection() {
  const { data: intelligence, isLoading, error } = useStudioIntelligence();

  if (isLoading) {
    return <SectionSkeleton count={2} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger font-medium">Failed to load calibration data</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (intelligence === null || intelligence === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Studio Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Your studio&apos;s historical analysis data powers calibrated scoring
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No calibration data yet</p>
            <p className="text-sm mt-1">Run analyses from Scout to build your studio intelligence</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scoreDistributions = intelligence.scoreDistributions as ScoreDistributions | null;
  const recommendationBreakdown = intelligence.recommendationBreakdown as RecommendationBreakdown | null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Studio Intelligence</h2>
        <p className="text-sm text-muted-foreground">
          Your studio&apos;s historical analysis data powers calibrated scoring
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{intelligence.totalProjectsAnalyzed}</div>
            <div className="text-sm text-muted-foreground">Projects Analyzed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-success">{recommendationBreakdown?.recommend ?? 0}</div>
            <div className="text-sm text-muted-foreground">Recommend</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-warning">{recommendationBreakdown?.consider ?? 0}</div>
            <div className="text-sm text-muted-foreground">Consider</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-danger">{recommendationBreakdown?.pass ?? 0}</div>
            <div className="text-sm text-muted-foreground">Pass</div>
          </CardContent>
        </Card>
      </div>

      {/* Score distributions */}
      {scoreDistributions?.overall && (
        <Card>
          <CardHeader>
            <CardTitle>Score Distributions</CardTitle>
            <CardDescription>
              Historical percentile thresholds for calibrated scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="text-sm font-medium mb-3">Overall Score Percentiles</h4>
            <div className="space-y-2">
              {scoreDistributions.overall.p90 !== undefined && (
                <PercentileRow label="Top 10%" value={scoreDistributions.overall.p90} />
              )}
              {scoreDistributions.overall.p75 !== undefined && (
                <PercentileRow label="Top 25%" value={scoreDistributions.overall.p75} />
              )}
              {scoreDistributions.overall.p50 !== undefined && (
                <PercentileRow label="Median" value={scoreDistributions.overall.p50} />
              )}
              {scoreDistributions.overall.p25 !== undefined && (
                <PercentileRow label="Bottom 25%" value={scoreDistributions.overall.p25} />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// PROFILE SECTION
// ============================================

function ProfileSection() {
  const { data: profile, isLoading, error } = useUserProfile();
  const updateDisplayName = useUpdateDisplayName();
  const uploadAvatar = useUploadAvatar();
  const { addToast } = useToastStore();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [nameInitialized, setNameInitialized] = useState(false);

  // Initialize display name from fetched data
  if (profile && !nameInitialized) {
    setDisplayName(profile.displayName ?? '');
    setNameInitialized(true);
  }

  const handleNameSave = () => {
    const trimmed = displayName.trim();
    // Only save if changed from current value
    if (trimmed === (profile?.displayName ?? '')) return;
    if (!trimmed) return;
    updateDisplayName.mutate(trimmed, {
      onSuccess: () => {
        addToast('Display name saved', 'success');
      },
      onError: (err: Error) => {
        addToast(err.message, 'error');
      },
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
          onSuccess: () => {
            addToast('Avatar updated', 'success');
          },
          onError: (err: Error) => {
            addToast(err.message, 'error');
          },
        });
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Your personal profile settings</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-full bg-elevated animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="w-48 h-4 bg-elevated rounded animate-pulse" />
                <div className="w-64 h-9 bg-elevated rounded animate-pulse" />
                <div className="w-36 h-3 bg-elevated rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger font-medium">Failed to load profile</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Your personal profile settings</p>
      </div>

      <Card>
        <CardContent className="pt-6">
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
                  {/* Upload overlay on hover */}
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
                <p className="text-xs text-muted-foreground">
                  {profile?.email}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Username (cannot be changed)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// SETTINGS SECTION
// ============================================

function SettingsSection() {
  const { data: studio, isLoading, error } = useStudio();
  const [studioName, setStudioName] = useState('');
  const [nameError, setNameError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  // Initialize name from fetched data
  if (studio && !initialized) {
    setStudioName(studio.name);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch('/api/studio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(error.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioKeys.studio });
      addToast('Studio settings saved', 'success');
      setNameError('');
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const handleSave = () => {
    if (!studioName.trim()) {
      setNameError('Studio name is required');
      return;
    }
    setNameError('');
    saveMutation.mutate({ name: studioName.trim() });
  };

  if (isLoading) {
    return <SectionSkeleton count={1} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-danger mb-2" />
        <p className="text-sm text-danger font-medium">Failed to load studio settings</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Studio Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your studio profile
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Studio Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Studio Name</label>
            <Input
              value={studioName}
              onChange={(e) => {
                setStudioName(e.target.value);
                if (nameError) setNameError('');
              }}
              className={cn(nameError && 'border-danger')}
            />
            {nameError && <p className="text-xs text-danger">{nameError}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function PercentileRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground w-24">{label}</span>
      <Progress value={value} className="flex-1 h-2" />
      <span className="text-sm font-medium w-8">{value}</span>
    </div>
  );
}

function SectionSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-elevated animate-pulse" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-elevated rounded animate-pulse" />
                <div className="w-24 h-3 bg-elevated rounded animate-pulse" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full h-3 bg-elevated rounded animate-pulse" />
            <div className="w-3/4 h-3 bg-elevated rounded animate-pulse" />
            <div className="w-1/2 h-3 bg-elevated rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
