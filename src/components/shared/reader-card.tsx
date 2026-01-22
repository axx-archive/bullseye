'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MiniScore } from './score-indicator';
import type { ReaderPerspective, Recommendation } from '@/types';
import { RECOMMENDATION_LABELS } from '@/types';

interface ReaderCardProps {
  perspective: ReaderPerspective;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onStartChat?: () => void;
}

const RECOMMENDATION_VARIANTS: Record<Recommendation, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  recommend: 'default',
  consider: 'secondary',
  low_consider: 'outline',
  pass: 'destructive',
};

export function ReaderCard({
  perspective,
  expanded = false,
  onToggleExpand,
  onStartChat,
}: ReaderCardProps) {
  const {
    readerName,
    voiceTag,
    color,
    scores,
    recommendation,
    keyStrengths,
    keyConcerns,
    standoutQuote,
    evidenceStrength,
  } = perspective;

  const initials = readerName
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <Card
      className="overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" style={{ backgroundColor: `${color}20` }}>
              <AvatarFallback style={{ color }}>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold text-foreground">{readerName}</h4>
              <span className="text-sm text-muted-foreground">{voiceTag}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={RECOMMENDATION_VARIANTS[recommendation]}>
              {RECOMMENDATION_LABELS[recommendation]}
            </Badge>
            {onStartChat && (
              <Button variant="ghost" size="icon" onClick={onStartChat}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Mini scores grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <MiniScore label="Premise" rating={scores.premise} color={color} />
          <MiniScore label="Character" rating={scores.character} color={color} />
          <MiniScore label="Dialogue" rating={scores.dialogue} color={color} />
          <MiniScore label="Structure" rating={scores.structure} color={color} />
          <MiniScore label="Commercial" rating={scores.commerciality} color={color} />
          <MiniScore label="Overall" rating={scores.overall} color={color} />
        </div>

        {/* Evidence strength indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Evidence Strength:</span>
          <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-bullseye-gold rounded-full transition-all duration-300"
              style={{ width: `${evidenceStrength}%` }}
            />
          </div>
          <span className="text-xs font-medium">{evidenceStrength}%</span>
        </div>

        {/* Expandable POV section */}
        <Collapsible open={expanded} onOpenChange={onToggleExpand}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-sm">Expand POV</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  expanded && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pt-4 space-y-4"
                >
                  {/* Standout quote */}
                  <div
                    className="p-3 rounded-lg italic text-sm"
                    style={{ backgroundColor: `${color}10`, borderLeft: `3px solid ${color}` }}
                  >
                    "{standoutQuote}"
                  </div>

                  {/* Key strengths */}
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">
                      KEY STRENGTHS
                    </h5>
                    <ul className="space-y-1">
                      {keyStrengths.map((strength, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-success">+</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Key concerns */}
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">
                      KEY CONCERNS
                    </h5>
                    <ul className="space-y-1">
                      {keyConcerns.map((concern, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-danger">-</span>
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// Compact reader comparison grid
interface ReaderComparisonProps {
  perspectives: ReaderPerspective[];
  onExpandReader?: (readerId: string) => void;
  expandedReaders?: string[];
}

export function ReaderComparison({
  perspectives,
  onExpandReader,
  expandedReaders = [],
}: ReaderComparisonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {perspectives.map((perspective) => (
        <ReaderCard
          key={perspective.readerId}
          perspective={perspective}
          expanded={expandedReaders.includes(perspective.readerId)}
          onToggleExpand={() => onExpandReader?.(perspective.readerId)}
        />
      ))}
    </div>
  );
}
