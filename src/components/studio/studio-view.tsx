'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Settings,
  Users,
  BarChart3,
  Building2,
  Palette,
  Save,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { DEFAULT_READERS } from '@/lib/agents/reader-personas';
import { DEFAULT_EXECUTIVES } from '@/lib/executive';

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
                <Palette className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Readers tab */}
            <TabsContent value="readers" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Reader Panel</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure your reader personas and their analytical weights
                  </p>
                </div>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Reader
                </Button>
              </div>

              <div className="grid gap-4">
                {DEFAULT_READERS.map((reader) => (
                  <ReaderConfigCard key={reader.id} reader={reader} />
                ))}
              </div>
            </TabsContent>

            {/* Executives tab */}
            <TabsContent value="executives" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Executive Profiles</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure simulated executives for pitch evaluations
                  </p>
                </div>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Executive
                </Button>
              </div>

              <div className="grid gap-4">
                {DEFAULT_EXECUTIVES.map((exec) => (
                  <ExecutiveConfigCard key={exec.id} executive={exec} />
                ))}
              </div>
            </TabsContent>

            {/* Calibration tab */}
            <TabsContent value="calibration" className="space-y-4 mt-6">
              <CalibrationSection />
            </TabsContent>

            {/* Settings tab */}
            <TabsContent value="settings" className="space-y-4 mt-6">
              <SettingsSection />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

// Reader configuration card
function ReaderConfigCard({ reader }: { reader: (typeof DEFAULT_READERS)[0] }) {
  const [isEditing, setIsEditing] = useState(false);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Background */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Background</label>
          <p className="text-sm mt-1">{reader.background}</p>
        </div>

        {/* Favorite films */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Favorite Films</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {reader.favoriteFilms.map((film) => (
              <Badge key={film} variant="outline">
                {film}
              </Badge>
            ))}
          </div>
        </div>

        {/* Analytical weights */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-3 block">
            Analytical Weights
          </label>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(reader.weights).map(([dimension, weight]) => (
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

        {/* Color indicator */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full"
            style={{ backgroundColor: reader.color }}
          />
          <span className="text-sm text-muted-foreground">Reader color</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Executive configuration card
function ExecutiveConfigCard({ executive }: { executive: (typeof DEFAULT_EXECUTIVES)[0] }) {
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
          <Button variant="ghost" size="icon">
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Priority factors */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Priority Factors</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {executive.priorityFactors.slice(0, 4).map((factor) => (
              <Badge key={factor} variant="secondary">
                {factor}
              </Badge>
            ))}
          </div>
        </div>

        {/* Deal breakers */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Deal Breakers</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {executive.dealBreakers.slice(0, 3).map((breaker) => (
              <Badge key={breaker} variant="outline" className="text-danger">
                {breaker}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Calibration section
function CalibrationSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Studio Intelligence</h2>
        <p className="text-sm text-muted-foreground">
          Your studio's historical analysis data powers calibrated scoring
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">47</div>
            <div className="text-sm text-muted-foreground">Projects Analyzed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-success">8</div>
            <div className="text-sm text-muted-foreground">Recommend</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-warning">22</div>
            <div className="text-sm text-muted-foreground">Consider</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-danger">17</div>
            <div className="text-sm text-muted-foreground">Pass</div>
          </CardContent>
        </Card>
      </div>

      {/* Score distributions */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distributions</CardTitle>
          <CardDescription>
            Historical percentile thresholds for calibrated scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Overall Score Percentiles</h4>
              <div className="space-y-2">
                <PercentileRow label="Top 10%" value={82} />
                <PercentileRow label="Top 25%" value={74} />
                <PercentileRow label="Median" value={65} />
                <PercentileRow label="Bottom 25%" value={58} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Genre Performance</h4>
              <div className="space-y-2">
                <GenreRow genre="Thriller" avgScore={72} trend="up" />
                <GenreRow genre="Drama" avgScore={68} trend="stable" />
                <GenreRow genre="Comedy" avgScore={64} trend="down" />
                <GenreRow genre="Action" avgScore={61} trend="stable" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institutional narrative */}
      <Card>
        <CardHeader>
          <CardTitle>Institutional Narrative</CardTitle>
          <CardDescription>
            AI-generated summary of your studio's script portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This studio has analyzed 47 projects over the past year, with a strong emphasis on
            character-driven narratives. The portfolio shows above-average performance in drama
            and thriller genres, with a 17% recommend rate that suggests selective but confident
            acquisitions. Recent trends indicate increased interest in limited series formats and
            female-led narratives.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Settings section
function SettingsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Studio Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your studio profile and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Studio Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Studio Name</label>
              <Input defaultValue="My Studio" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input defaultValue="my-studio" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Reader Panel</label>
            <p className="text-xs text-muted-foreground">
              Select which readers to include by default in new analyses
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {DEFAULT_READERS.map((reader) => (
                <Badge
                  key={reader.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  style={{ borderColor: reader.color }}
                >
                  {reader.name}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Auto-run Focus Group</label>
            <p className="text-xs text-muted-foreground">
              Automatically start a focus group after analysis completes
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Calibration Display</label>
            <p className="text-xs text-muted-foreground">
              Show percentile comparisons by default in coverage view
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Guardrails</CardTitle>
          <CardDescription>
            Define what your studio is and isn't looking for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">We're Looking For</label>
            <Textarea
              placeholder="e.g., Character-driven narratives, diverse voices, elevated genre..."
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">We're Not Looking For</label>
            <Textarea
              placeholder="e.g., Derivative premises, excessive VFX requirements..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// Helper components
function PercentileRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground w-24">{label}</span>
      <Progress value={value} className="flex-1 h-2" />
      <span className="text-sm font-medium w-8">{value}</span>
    </div>
  );
}

function GenreRow({
  genre,
  avgScore,
  trend,
}: {
  genre: string;
  avgScore: number;
  trend: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{genre}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{avgScore}</span>
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-danger'
          )}
        >
          {trend === 'up' ? '+8%' : trend === 'down' ? '-3%' : '='}
        </Badge>
      </div>
    </div>
  );
}
