'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { ChatInterface, QuickActions, type ChatMessage } from '@/components/chat/chat-interface';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Upload, FileText, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function ScoutView() {
  const {
    isAnalyzing,
    analysisProgress,
    currentProject,
    currentDeliverable,
    setActiveTab,
  } = useAppStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to BULLSEYE. I'm Scout, your orchestrating intelligence for script analysis.

I can help you:
- Analyze scripts with our panel of readers (Maya, Colton, and Devon)
- Run focus group discussions to surface divergent perspectives
- Simulate executive pitch meetings
- Track revisions across draft iterations

To get started, upload a script or tell me what you'd like to do.`,
      agentType: 'SCOUT',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate Scout response
    await simulateScoutResponse(content, setMessages, setIsLoading);
  }, []);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'analyze':
        handleSendMessage('I want to analyze a new script');
        break;
      case 'focus-group':
        handleSendMessage('Start a focus group discussion');
        break;
      case 'executive':
        handleSendMessage('Run an executive pitch simulation');
        break;
      case 'compare':
        handleSendMessage('Compare drafts of the current project');
        break;
    }
  }, [handleSendMessage]);

  return (
    <div className="h-full flex flex-col">
      {/* Analysis progress banner */}
      {isAnalyzing && analysisProgress && (
        <AnalysisProgressBanner progress={analysisProgress} />
      )}

      {/* Main chat interface */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          placeholder="Message Scout..."
          agentName="Scout"
          agentColor="#D4A84B"
        />

        {/* Quick actions */}
        {!isAnalyzing && (
          <QuickActions onAction={handleQuickAction} disabled={isLoading} />
        )}
      </div>

      {/* Script upload dropzone overlay (could be shown conditionally) */}
    </div>
  );
}

// Analysis progress banner
function AnalysisProgressBanner({
  progress,
}: {
  progress: { stage: string; progress: number; currentReader?: string; message?: string };
}) {
  const stageLabels: Record<string, string> = {
    starting: 'Initializing analysis...',
    readers: `Analyzing with ${progress.currentReader || 'readers'}...`,
    harmonizing: 'Harmonizing reader perspectives...',
    focus_group: 'Running focus group...',
    executive: 'Running executive evaluations...',
    complete: 'Analysis complete!',
    failed: 'Analysis failed',
  };

  return (
    <div className="bg-surface border-b border-border p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {stageLabels[progress.stage] || progress.message}
            </span>
          </div>
          <Badge variant="outline">{progress.progress}%</Badge>
        </div>
        <Progress value={progress.progress} className="h-2" />
      </div>
    </div>
  );
}

// Simulate Scout responses
async function simulateScoutResponse(
  userMessage: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
  await delay(1000);

  const lowerMessage = userMessage.toLowerCase();
  let response = '';

  if (lowerMessage.includes('analyze') || lowerMessage.includes('script')) {
    response = `I'd be happy to help you analyze a script. Here's how we'll proceed:

1. **Upload your script** - Click the "Upload Script" button or drag and drop a PDF
2. **Reader panel activation** - I'll spawn our three readers:
   - Maya Chen (The Optimist) - focuses on character and emotional resonance
   - Colton Rivers (The Skeptic) - focuses on structure and commerciality
   - Devon Park (The Craftsman) - focuses on dialogue and craft
3. **Parallel analysis** - Each reader will analyze independently
4. **Harmonization** - I'll synthesize their perspectives into unified coverage
5. **Calibration** - Scores will be contextualized against studio history

Would you like to upload a script now?`;
  } else if (lowerMessage.includes('focus group') || lowerMessage.includes('discussion')) {
    response = `Focus groups are where the magic happens. Here's how they work:

I'll moderate a live conversation between our readers where they:
- Debate points of divergence from their analyses
- Surface nuanced perspectives
- Defend their positions with evidence
- Find consensus on key issues

To run a focus group, you'll need:
- A completed analysis (so readers have context)
- Optional: specific questions you want explored

Navigate to the **Focus** tab to start a session, or tell me what you'd like the readers to discuss.`;
  } else if (lowerMessage.includes('executive') || lowerMessage.includes('pitch')) {
    response = `Executive pitch simulation helps you anticipate how industry leaders might respond to your project.

Our executive profiles include:
- **Alexandra Sterling** - Streaming platform content chief (character-driven, awards focus)
- **Marcus Chen** - Major studio production president (commercial, four-quadrant)
- **Samira Okonkwo** - Indie producer (voice-driven, festival potential)

Each executive evaluates based on:
- Their track record and greenlight history
- Current market context and slate priorities
- The coverage analysis (they never invent details)

Navigate to the **Pitch** tab to run simulations.`;
  } else if (lowerMessage.includes('revision') || lowerMessage.includes('draft') || lowerMessage.includes('compare')) {
    response = `Draft tracking is core to BULLSEYE's value. Here's what happens across revisions:

1. **Reader memory persists** - When you upload Draft 2, readers remember Draft 1
2. **Delta sessions** - Analysis highlights what changed and whether concerns were addressed
3. **Score evolution** - See how ratings shift across drafts
4. **Consistency enforcement** - Readers acknowledge when their position changes

Navigate to the **Revisions** tab to see the draft timeline and compare analyses.`;
  } else {
    response = `I can help you with script analysis, focus group discussions, executive pitch simulations, and draft tracking.

Here's what I'd suggest based on where you are:

${!false ? '**Get started:** Upload a script and I\'ll coordinate our reader panel for a full analysis.' : ''}

What would you like to do next?`;
  }

  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: response,
    agentType: 'SCOUT',
    timestamp: new Date(),
  };

  setMessages((prev) => [...prev, assistantMessage]);
  setIsLoading(false);
}

// Helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
