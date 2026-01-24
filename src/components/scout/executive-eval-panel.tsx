'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { Loader2, CheckCircle2, XCircle, Briefcase } from 'lucide-react';

function ExecutiveEvalSkeleton() {
  return (
    <div className="h-full p-4 space-y-3">
      <div className="px-1 mb-2">
        <div className="h-3.5 w-36 bg-muted-foreground/10 rounded animate-pulse" />
        <div className="h-2.5 w-24 bg-muted-foreground/10 rounded animate-pulse mt-1.5" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-elevated/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted-foreground/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-muted-foreground/10 rounded animate-pulse" />
              <div className="h-2 w-16 bg-muted-foreground/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-2.5 w-full bg-muted-foreground/10 rounded animate-pulse" />
          <div className="h-2.5 w-2/3 bg-muted-foreground/10 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ExecutiveEvalPanel() {
  const { executiveStates, isHydratingScoutState } = useAppStore();

  const executives = Array.from(executiveStates.values());

  // Show skeleton while hydrating and no local data
  if (isHydratingScoutState && executives.length === 0) {
    return <ExecutiveEvalSkeleton />;
  }

  if (executives.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            Executive evaluations will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="px-1 mb-2">
        <h3 className="text-sm font-medium text-foreground">Executive Evaluations</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {executives.filter((e) => e.status === 'complete').length} of {executives.length} complete
        </p>
      </div>

      <AnimatePresence mode="popLayout">
        {executives.map((exec) => (
          <motion.div
            key={exec.executiveId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-border/50 bg-elevated/30 overflow-hidden"
          >
            {exec.status === 'evaluating' ? (
              <EvaluatingCard name={exec.executiveName} />
            ) : (
              <CompleteCard
                name={exec.executiveName}
                verdict={exec.verdict}
                confidence={exec.confidence}
                rationale={exec.rationale}
                keyFactors={exec.keyFactors}
                concerns={exec.concerns}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EvaluatingCard({ name }: { name: string }) {
  return (
    <div className="p-4 flex items-center gap-3">
      <Loader2 className="w-4 h-4 text-[#D4A84B] animate-spin flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">Evaluating...</p>
      </div>
    </div>
  );
}

function CompleteCard({
  name,
  verdict,
  confidence,
  rationale,
  keyFactors,
  concerns,
}: {
  name: string;
  verdict?: 'pursue' | 'pass';
  confidence?: number;
  rationale?: string;
  keyFactors?: string[];
  concerns?: string[];
}) {
  const isPursue = verdict === 'pursue';

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPursue ? (
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-danger flex-shrink-0" />
          )}
          <p className="text-sm font-medium text-foreground">{name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPursue
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {isPursue ? 'PURSUE' : 'PASS'}
          </span>
          {confidence != null && (
            <span className="text-xs text-muted-foreground">
              {confidence}%
            </span>
          )}
        </div>
      </div>

      {/* Rationale */}
      {rationale && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {rationale}
        </p>
      )}

      {/* Key Factors */}
      {keyFactors && keyFactors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground/80 mb-1">Key Factors</p>
          <ul className="space-y-0.5">
            {keyFactors.map((factor, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-success mt-0.5 flex-shrink-0">+</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {concerns && concerns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground/80 mb-1">Concerns</p>
          <ul className="space-y-0.5">
            {concerns.map((concern, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-danger mt-0.5 flex-shrink-0">-</span>
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
