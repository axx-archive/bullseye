'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitBranch,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  Clock,
  Upload,
} from 'lucide-react';
import type { Rating } from '@/types';
import { RATING_LABELS } from '@/types';

// Mock draft data for demonstration
const MOCK_DRAFTS = [
  {
    id: 'draft-1',
    draftNumber: 1,
    uploadedAt: new Date('2024-01-15'),
    pageCount: 112,
    status: 'completed',
    scores: {
      premise: { rating: 'good' as Rating, numeric: 68 },
      character: { rating: 'very_good' as Rating, numeric: 78 },
      dialogue: { rating: 'good' as Rating, numeric: 65 },
      structure: { rating: 'so_so' as Rating, numeric: 52 },
      commerciality: { rating: 'good' as Rating, numeric: 70 },
      overall: { rating: 'good' as Rating, numeric: 67 },
    },
  },
  {
    id: 'draft-2',
    draftNumber: 2,
    uploadedAt: new Date('2024-02-20'),
    pageCount: 108,
    status: 'completed',
    scores: {
      premise: { rating: 'good' as Rating, numeric: 70 },
      character: { rating: 'very_good' as Rating, numeric: 82 },
      dialogue: { rating: 'very_good' as Rating, numeric: 75 },
      structure: { rating: 'good' as Rating, numeric: 64 },
      commerciality: { rating: 'very_good' as Rating, numeric: 76 },
      overall: { rating: 'very_good' as Rating, numeric: 73 },
    },
  },
];

export function RevisionsView() {
  const { currentProject, currentDeliverable } = useAppStore();
  const [selectedDraft, setSelectedDraft] = useState<string | null>(
    MOCK_DRAFTS[MOCK_DRAFTS.length - 1]?.id || null
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareDraft, setCompareDraft] = useState<string | null>(null);

  const drafts = MOCK_DRAFTS; // In production, this would come from the store/API

  if (drafts.length === 0) {
    return <EmptyState />;
  }

  const currentDraft = drafts.find((d) => d.id === selectedDraft);
  const comparisonDraft = compareDraft ? drafts.find((d) => d.id === compareDraft) : null;

  return (
    <div className="h-full flex">
      {/* Timeline sidebar */}
      <div className="w-64 border-r border-border bg-surface">
        <div className="h-16 px-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Draft Timeline
          </h3>
        </div>

        <ScrollArea className="h-[calc(100%-4rem)]">
          <div className="p-4 space-y-2">
            {/* Upload new draft button */}
            <Button variant="outline" className="w-full gap-2 mb-4">
              <Upload className="w-4 h-4" />
              Upload New Draft
            </Button>

            {/* Draft timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {drafts
                .slice()
                .reverse()
                .map((draft, index) => {
                  const isSelected = selectedDraft === draft.id;
                  const isComparison = compareDraft === draft.id;

                  return (
                    <motion.button
                      key={draft.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        if (compareMode && selectedDraft !== draft.id) {
                          setCompareDraft(draft.id);
                        } else {
                          setSelectedDraft(draft.id);
                          setCompareDraft(null);
                        }
                      }}
                      className={cn(
                        'relative w-full flex items-start gap-3 p-3 pl-8 rounded-lg text-left transition-colors',
                        'hover:bg-elevated',
                        isSelected && 'bg-elevated ring-1 ring-primary',
                        isComparison && 'bg-elevated ring-1 ring-info'
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 bg-background',
                          isSelected
                            ? 'border-primary'
                            : isComparison
                              ? 'border-info'
                              : 'border-muted-foreground'
                        )}
                      />

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Draft {draft.draftNumber}</span>
                          <Badge variant="outline" className="text-xs">
                            {draft.scores.overall.rating.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {draft.uploadedAt.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {draft.pageCount} pages
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  Draft {currentDraft?.draftNumber} Analysis
                </h1>
                <p className="text-muted-foreground">
                  Uploaded {currentDraft?.uploadedAt.toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={compareMode ? 'default' : 'outline'}
                  onClick={() => {
                    setCompareMode(!compareMode);
                    if (!compareMode) {
                      setCompareDraft(null);
                    }
                  }}
                >
                  {compareMode ? 'Exit Compare' : 'Compare Drafts'}
                </Button>
              </div>
            </div>

            {/* Compare mode instructions */}
            {compareMode && !compareDraft && (
              <Card className="border-info">
                <CardContent className="pt-6">
                  <p className="text-sm text-center text-muted-foreground">
                    Select another draft from the timeline to compare
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Score comparison */}
            {currentDraft && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {compareMode && comparisonDraft
                      ? `Comparing Draft ${currentDraft.draftNumber} vs Draft ${comparisonDraft.draftNumber}`
                      : 'Score Summary'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreComparison
                    current={currentDraft.scores}
                    comparison={comparisonDraft?.scores}
                    showComparison={compareMode && !!comparisonDraft}
                  />
                </CardContent>
              </Card>
            )}

            {/* Delta notes */}
            {currentDraft && currentDraft.draftNumber > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Changes from Previous Draft</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <DeltaNote
                      type="improved"
                      title="Structure improved"
                      description="Second act pacing issues addressed. Readers noted tighter scene transitions and better momentum through pages 35-60."
                    />
                    <DeltaNote
                      type="improved"
                      title="Dialogue sharpened"
                      description="Devon noted significant improvement in dialogue rhythm. The restaurant scene on page 45 now crackles."
                    />
                    <DeltaNote
                      type="unchanged"
                      title="Character concerns persist"
                      description="Maya still wants deeper exploration of the protagonist's backstory. Consider adding a flashback in Act 1."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reader memory browser */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reader Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  What each reader remembers about this project across drafts.
                </p>

                <div className="space-y-4">
                  <ReaderMemoryCard
                    name="Maya Chen"
                    voiceTag="The Optimist"
                    color="#30D5C8"
                    narrative="I've been following this project since Draft 1. The emotional core has always been strong, but I'm thrilled to see the protagonist's arc gaining depth. The changes to Act 2 addressed my main concerns about pacing. Still hoping to see more of the sibling relationship explored."
                  />
                  <ReaderMemoryCard
                    name="Colton Rivers"
                    voiceTag="The Skeptic"
                    color="#FF7F7F"
                    narrative="This project has come a long way. Initial structural issues were significant, but Draft 2 shows real improvement. Commercial viability is stronger now—the marketing hooks are clearer. I'd still push for a more dynamic opening, but we're moving in the right direction."
                  />
                  <ReaderMemoryCard
                    name="Devon Park"
                    voiceTag="The Craftsman"
                    color="#B8A9C9"
                    narrative="From a craft perspective, the biggest gains are in dialogue and scene construction. The writer clearly took our notes seriously. Pages 45-60 are transformed. I'm cautiously optimistic about where this is heading."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Score comparison table
function ScoreComparison({
  current,
  comparison,
  showComparison,
}: {
  current: Record<string, { rating: Rating; numeric: number }>;
  comparison?: Record<string, { rating: Rating; numeric: number }>;
  showComparison: boolean;
}) {
  const dimensions = [
    { key: 'premise', label: 'Premise' },
    { key: 'character', label: 'Character' },
    { key: 'dialogue', label: 'Dialogue' },
    { key: 'structure', label: 'Structure' },
    { key: 'commerciality', label: 'Commercial' },
    { key: 'overall', label: 'Overall' },
  ];

  return (
    <div className="space-y-3">
      {dimensions.map(({ key, label }) => {
        const currentScore = current[key];
        const comparisonScore = comparison?.[key];
        const delta = comparisonScore
          ? currentScore.numeric - comparisonScore.numeric
          : 0;

        return (
          <div key={key} className="flex items-center gap-4">
            <span className="w-24 text-sm text-muted-foreground">{label}</span>

            {/* Current score bar */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-bullseye-gold rounded-full transition-all duration-300"
                  style={{ width: `${currentScore.numeric}%` }}
                />
              </div>
              <span className="text-sm font-medium w-20">
                {RATING_LABELS[currentScore.rating]}
              </span>
            </div>

            {/* Delta indicator */}
            {showComparison && comparison && (
              <div
                className={cn(
                  'flex items-center gap-1 w-16 text-sm',
                  delta > 0 && 'text-success',
                  delta < 0 && 'text-danger',
                  delta === 0 && 'text-muted-foreground'
                )}
              >
                {delta > 0 && <ArrowUp className="w-4 h-4" />}
                {delta < 0 && <ArrowDown className="w-4 h-4" />}
                {delta === 0 && <Minus className="w-4 h-4" />}
                {delta > 0 ? '+' : ''}
                {delta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Delta note card
function DeltaNote({
  type,
  title,
  description,
}: {
  type: 'improved' | 'unchanged' | 'declined';
  title: string;
  description: string;
}) {
  const colors = {
    improved: 'border-success text-success',
    unchanged: 'border-warning text-warning',
    declined: 'border-danger text-danger',
  };

  const icons = {
    improved: <ArrowUp className="w-4 h-4" />,
    unchanged: <Minus className="w-4 h-4" />,
    declined: <ArrowDown className="w-4 h-4" />,
  };

  return (
    <div className={cn('p-4 rounded-lg border-l-4 bg-elevated', colors[type])}>
      <div className="flex items-center gap-2 mb-1">
        {icons[type]}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// Reader memory card
function ReaderMemoryCard({
  name,
  voiceTag,
  color,
  narrative,
}: {
  name: string;
  voiceTag: string;
  color: string;
  narrative: string;
}) {
  return (
    <div
      className="p-4 rounded-lg bg-elevated"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium" style={{ color }}>
          {name}
        </span>
        <span className="text-xs text-muted-foreground">({voiceTag})</span>
      </div>
      <p className="text-sm text-muted-foreground italic">"{narrative}"</p>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <GitBranch className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Drafts Yet</h2>
        <p className="text-muted-foreground mb-4">
          Upload your first script draft to start tracking revisions across iterations.
        </p>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload First Draft
        </Button>
      </div>
    </div>
  );
}
