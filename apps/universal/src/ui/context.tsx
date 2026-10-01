import {createContext, useContext, useMemo, useState} from 'react';
import type {useWorkspace} from '../workspace/useWorkspace';

export type Workspace = ReturnType<typeof useWorkspace>;
export type SettingsTab = 'general' | 'privacy' | 'ai' | 'about';

// Presentation-only state: which sheet or panel is open. Everything about documents,
// results, jobs and persistence stays in the workspace (the single source of truth).
export function useShellState() {
  const [settings, setSettings] = useState<SettingsTab | null>(null);
  const [startOver, setStartOver] = useState(false);
  const [quickLook, setQuickLook] = useState<{ref: string; title: string} | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [palette, setPalette] = useState(false);
  // The Files panel's visibility is the user's choice; it docks at ≥ 1120 pt and overlays below that.
  const [filesPanel, setFilesPanel] = useState<boolean | null>(null);
  const [overlayPanel, setOverlayPanel] = useState(false);
  return useMemo(() => ({
    settings, openSettings: (tab: SettingsTab = 'general') => setSettings(tab), closeSettings: () => setSettings(null),
    startOver, setStartOver, quickLook, setQuickLook, onboarding, setOnboarding, shortcuts, setShortcuts, palette, setPalette,
    filesPanel, setFilesPanel, overlayPanel, setOverlayPanel,
  }), [settings, startOver, quickLook, onboarding, shortcuts, palette, filesPanel, overlayPanel]);
}
export type Shell = ReturnType<typeof useShellState>;

export type Composer = {fill: (text: string) => void; focus: () => void};
export const WorkspaceContext = createContext<{workspace: Workspace; shell: Shell; composer: Composer} | null>(null);
export function useApp() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace unavailable');
  return context;
}
