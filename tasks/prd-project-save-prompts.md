# PRD: Project Save Prompt on Navigation

## Introduction

When users navigate between projects or to the Home tab, the app should behave predictably: going to Home keeps the current project open, while clicking a different project prompts the user to confirm the context switch. This PRD addresses confusing navigation behavior where the current project context may be unexpectedly cleared, and establishes a clear mental model for project switching.

## Problem Statement

Currently, navigation behavior around projects is inconsistent:
1. **Going to Home tab clears project context** - Users expect to browse projects while keeping their current project "warm" in memory
2. **Switching projects happens immediately** - No opportunity to confirm the context switch, even if the user has an in-progress analysis or is mid-conversation with Scout
3. **Mental model mismatch** - Users don't understand when their project context will be preserved vs. reset

The key insight: **most data already auto-saves to the database** (chat history, reader analysis, focus group sessions, executive evals). The real issue is about **confirming context switches**, not saving data.

## Goals

- Keep current project open when navigating to Home tab (no state reset)
- Add a confirmation prompt when switching to a different project
- Give users clear control over context switches: save-and-switch, discard-and-switch, or cancel
- Preserve user's mental model of "one project at a time, but browsing doesn't disrupt work"
- Handle edge cases: in-progress SSE streams, mid-analysis states

## Non-Goals

- Adding a "Save" button (data already auto-persists)
- Multi-project workspaces (keeping multiple projects "open" simultaneously)
- Draft-level switching prompts (only project-level)
- Offline support or local caching strategies
- Undo/redo for navigation actions

## Key Questions Answered

### 1. What constitutes "unsaved progress"?

**Answer: Nothing is truly "unsaved" in the traditional sense.** The app already persists:
- Chat history (to `ChatMessage` records)
- Reader analysis results (to `ReaderMemory` and `DraftDeliverable`)
- Focus group sessions (to `FocusSession` and `FocusGroupMessage`)
- Executive evaluations (to database)
- Right panel phase/state (to `ChatSession.scoutPhase`)

**What IS lost on project switch:**
- **In-progress SSE streams** - If an analysis is mid-flight, switching projects interrupts it
- **Ephemeral UI state** - Expanded reader cards, scroll positions, typing in progress
- **Mental context** - User's train of thought, where they were in the workflow

**Conclusion:** The prompt is about **confirming intent to switch contexts**, not about data loss. The messaging should reflect this.

### 2. Is this about confirming context switch rather than actual data saving?

**Yes.** The prompt should be framed as:
- "Switch to [Project Name]?" rather than "Save changes?"
- Acknowledge any in-progress work that would be interrupted
- Make it clear that previous work is preserved and can be resumed

### 3. What's the UX for the prompt? Modal? Toast? Inline confirmation?

**Recommendation: Modal dialog** for the following reasons:
- Context switches are significant actions that deserve focused attention
- Modal prevents accidental clicks from completing the switch
- Provides space for clear messaging about what will happen
- Consistent with delete confirmations already in the app

**Modal content:**
- Title: "Switch Project?"
- Description: Contextual based on current state (see scenarios below)
- Actions: "Switch" (primary), "Cancel" (secondary)
- Optional: "Don't ask again for this session" checkbox

### 4. Should there be a "Don't ask again" option?

**Yes, but scoped appropriately:**
- **Session-level preference:** "Don't ask again this session" (resets on page refresh)
- **Not a permanent setting:** Users shouldn't permanently disable this safety net
- **Store in Zustand (non-persisted):** `skipProjectSwitchConfirmation: boolean`

### 5. What happens if user has an in-progress analysis running?

**Scenarios:**
1. **SSE stream active (analysis/focus group/reader chat in progress):**
   - Modal warns: "An analysis is in progress. Switching projects will stop it."
   - Options: "Stop and Switch" / "Cancel"
   - Completed portions are preserved; only the in-flight stream is lost

2. **SSE stream completed but user hasn't reviewed:**
   - Standard switch prompt (no special warning)
   - All results are already saved

3. **No active work:**
   - Standard switch prompt

## User Stories

### US-001: Keep Project Open on Home Navigation

**Description:** As a user, I want to navigate to the Home tab without losing my current project context, so I can browse other projects without disrupting my work.

**Acceptance Criteria:**
- [ ] Clicking Home tab or logo sets `activeTab: 'home'` but does NOT call `setCurrentProject(null)`
- [ ] Current project remains in `currentProject` state
- [ ] Project context bar still shows current project name when on Home tab
- [ ] All Scout tab state (chat, readers, focus group) is preserved in memory
- [ ] User can return to Scout/Coverage/etc. tabs and see their previous state
- [ ] Typecheck passes

### US-002: Prompt on Different Project Selection

**Description:** As a user, I want to see a confirmation prompt when clicking a different project, so I don't accidentally lose my context.

**Acceptance Criteria:**
- [ ] Clicking a project card in Home view checks if `currentProject.id !== clickedProject.id`
- [ ] If different, show modal: "Switch to [Project Title]?"
- [ ] If same project, navigate directly to Scout tab (no prompt)
- [ ] If no current project (`currentProject === null`), navigate directly (no prompt)
- [ ] Modal appears centered with backdrop overlay
- [ ] Typecheck passes

### US-003: Switch Project Confirmation Modal

**Description:** As a user, I want clear options in the switch confirmation modal so I understand what will happen.

**Acceptance Criteria:**
- [ ] Modal title: "Switch Project?"
- [ ] Modal description varies by context:
  - Default: "Your work on [Current Project] is saved. Switch to [New Project]?"
  - If SSE active: "An analysis is running on [Current Project]. Switching will stop it. Your completed work is saved."
- [ ] Primary button: "Switch" - calls `setCurrentProject(newProject)` then `setActiveTab('scout')`
- [ ] Secondary button: "Cancel" - closes modal, no state change
- [ ] Clicking backdrop closes modal (same as Cancel)
- [ ] Escape key closes modal (same as Cancel)
- [ ] Typecheck passes

### US-004: Session-Level "Don't Ask Again" Option

**Description:** As a user, I want to skip the confirmation prompt for the rest of my session if I'm actively browsing projects.

**Acceptance Criteria:**
- [ ] Checkbox in modal: "Don't ask again this session"
- [ ] If checked when clicking "Switch", set `skipProjectSwitchConfirmation: true` in Zustand (non-persisted)
- [ ] Subsequent project clicks bypass the modal and switch immediately
- [ ] Preference resets to `false` on page refresh (not persisted to localStorage)
- [ ] Typecheck passes

### US-005: Handle In-Progress SSE Streams

**Description:** As a user, I want to be warned if switching projects will interrupt an active analysis, so I can make an informed decision.

**Acceptance Criteria:**
- [ ] Detect active SSE by checking `isStreaming` or `isAnalyzing` state
- [ ] If active, modal description includes warning about interruption
- [ ] Switching projects calls stream cleanup/abort before `setCurrentProject`
- [ ] Completed reader states and messages are preserved in database before switch
- [ ] No orphaned SSE connections after switch
- [ ] Typecheck passes

### US-006: Visual Indicator for Active Project on Home

**Description:** As a user, I want to see which project I currently have open when browsing the Home tab, so I know my context.

**Acceptance Criteria:**
- [ ] When on Home tab with `currentProject !== null`, show indicator on that project's card
- [ ] Indicator: gold border or "Currently Open" badge
- [ ] Clicking the currently-open project card navigates to Scout (no prompt needed)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `handleGoHome()` in `app-shell.tsx` must NOT call `setCurrentProject(null)` - only `setActiveTab('home')`
- FR-2: Project card click handler must check for project ID change before switching
- FR-3: Create `ProjectSwitchModal` component with title, description, checkbox, and two buttons
- FR-4: Add `skipProjectSwitchConfirmation` boolean to Zustand UI state (non-persisted)
- FR-5: Add `isStreamActive` selector that returns `true` if any SSE stream is in progress
- FR-6: Before calling `setCurrentProject()` with a new project ID, abort any active fetch/SSE connections
- FR-7: Project cards on Home view must visually indicate the currently-open project

## Technical Considerations

### State Changes

**app-shell.tsx - handleGoHome():**
```typescript
// BEFORE (problematic)
function handleGoHome() {
  setCurrentProject(null);  // This clears project context
  setActiveTab('home');
}

// AFTER (preserve context)
function handleGoHome() {
  setActiveTab('home');  // Just switch tab, keep project
}
```

**home-view.tsx - handleOpenProject():**
```typescript
// BEFORE (immediate switch)
function handleOpenProject(project: ProjectWithCount) {
  setCurrentProject(project);
  setActiveTab('scout');
}

// AFTER (with confirmation)
function handleOpenProject(project: ProjectWithCount) {
  const currentId = currentProject?.id;
  const skipConfirm = useAppStore.getState().skipProjectSwitchConfirmation;

  // Same project or no current project - switch immediately
  if (!currentId || currentId === project.id || skipConfirm) {
    setCurrentProject(project);
    setActiveTab('scout');
    return;
  }

  // Different project - show confirmation
  setProjectToSwitchTo(project);
  setShowSwitchModal(true);
}
```

### New Zustand State

```typescript
interface UIState {
  // ... existing fields
  skipProjectSwitchConfirmation: boolean;
  setSkipProjectSwitchConfirmation: (skip: boolean) => void;
}

// In persist config - explicitly EXCLUDE from persistence:
partialize: (state) => ({
  // ... existing persisted fields
  // NOTE: skipProjectSwitchConfirmation intentionally NOT persisted
})
```

### Stream Abort Logic

```typescript
// Before setCurrentProject with different ID:
function cleanupBeforeProjectSwitch() {
  // Abort any active fetch controllers
  if (scoutAbortController.current) {
    scoutAbortController.current.abort();
  }
  if (readerChatAbortController.current) {
    readerChatAbortController.current.abort();
  }
  // SSE EventSource cleanup
  if (eventSource.current) {
    eventSource.current.close();
  }
}
```

### Modal Component

Create `src/components/shared/project-switch-modal.tsx`:
- Uses existing `Dialog` component from shadcn/ui
- Props: `open`, `onConfirm`, `onCancel`, `currentProject`, `targetProject`, `isStreamActive`
- Renders contextual description based on `isStreamActive`
- Includes checkbox for "Don't ask again"

## Design Considerations

- Modal should match existing dialog styling (dark theme, gold accents)
- Use existing `Dialog` primitive from shadcn/ui
- Warning state (when SSE active) should use amber/warning color for emphasis
- "Currently Open" badge on project cards should use subtle gold indicator
- Checkbox should be left-aligned below description, before buttons

## Success Metrics

- Zero unintended project context losses when navigating to Home
- Users understand the difference between "browsing" (Home) and "switching" (clicking different project)
- In-progress analyses are not silently interrupted
- Modal appears in <100ms after clicking a different project
- No orphaned SSE connections after project switches

## Open Questions

1. **Should we add a "Return to Project" button on the Home tab header?**
   - Pro: Makes it obvious how to get back to work
   - Con: Context bar already shows current project, might be redundant

2. **Should the prompt appear for ALL navigation away from Scout, or just project switches?**
   - Current recommendation: Only project switches (tab changes preserve state)
   - Alternative: Also prompt when leaving Scout mid-analysis for any reason

3. **What if user has unsent text in the chat input?**
   - Current: Text is lost on project switch (ephemeral)
   - Option: Save draft message to localStorage keyed by project ID
   - Recommendation: Accept the loss for MVP; draft messages are low-value

## Implementation Order

1. **US-001** - Fix Home navigation (remove `setCurrentProject(null)`)
2. **US-006** - Add visual indicator for current project on Home
3. **US-002 + US-003** - Add confirmation modal for project switching
4. **US-005** - Handle in-progress SSE streams
5. **US-004** - Add "Don't ask again" checkbox
