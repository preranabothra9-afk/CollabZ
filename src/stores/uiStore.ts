import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'nebula';

export interface ThemeMeta {
  id: Theme;
  name: string;
  blurb: string;
  /** Swatch colors for the picker — [base, panel, accent] */
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  { id: 'light',  name: 'Linen',    blurb: 'Warm paper, bright surfaces',  swatch: ['#faf9f7', '#ffffff', '#4f46e5'] },
  { id: 'dark',   name: 'Obsidian', blurb: 'Cool near-black, crisp text',  swatch: ['#0a0b10', '#12141b', '#6366f1'] },
  { id: 'nebula', name: 'Nebula',   blurb: 'Deep violet dusk, soft glow',  swatch: ['#151022', '#1e1733', '#8b7cf8'] },
];

const THEME_KEY = 'collabz-theme';
const VALID_THEMES: Theme[] = ['light', 'dark', 'nebula'];

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && VALID_THEMES.includes(stored as Theme)) return stored as Theme;
  } catch {
    /* localStorage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reflect the active theme onto <html> so the CSS token cascade flips. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Remove every mode class first so only the active one remains
  root.classList.remove('dark', 'nebula');
  if (theme !== 'light') root.classList.add(theme);
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}

export interface UIState {
  selectedModels: string[];
  isSidebarOpen: boolean;
  isSavedResponsesOpen: boolean;
  isAdminPanelOpen: boolean;
  currentPath: string;
  theme: Theme;
  
  setSelectedModels: (models: string[]) => void;
  toggleModel: (modelKey: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSavedResponsesOpen: (isOpen: boolean) => void;
  setAdminPanelOpen: (isOpen: boolean) => void;
  setCurrentPath: (path: string) => void;
  navigateTo: (path: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialTheme = getInitialTheme();
// Keep the DOM in sync even if the store hydrates after the inline head script
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set, get) => ({
  // Default to the three-model comparison: Google Gemini + OpenAI GPT-OSS + Alibaba Qwen.
  // All three sit on genuine free tiers, so only two signups are needed.
  selectedModels: ['gemini-2.5-flash', 'gpt-oss-120b', 'qwen3.8-27b'],
  isSidebarOpen: true,
  isSavedResponsesOpen: false,
  isAdminPanelOpen: false,
  currentPath: window.location.pathname,
  theme: initialTheme,

  setSelectedModels: (selectedModels) => set({ selectedModels }),
  toggleModel: (modelKey) => set((state) => {
    const models = [...state.selectedModels];
    const idx = models.indexOf(modelKey);
    if (idx !== -1) {
      if (models.length > 1) models.splice(idx, 1); // keep at least one active
    } else {
      models.push(modelKey);
    }
    return { selectedModels: models };
  }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSavedResponsesOpen: (isSavedResponsesOpen) => set({ isSavedResponsesOpen }),
  setAdminPanelOpen: (isAdminPanelOpen) => set({ isAdminPanelOpen }),
  setCurrentPath: (currentPath) => set({ currentPath }),
  navigateTo: (path) => {
    window.history.pushState(null, '', path);
    set({ currentPath: path });
  },
  setTheme: (theme) => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },
  toggleTheme: () => {
    const order: Theme[] = ['light', 'dark', 'nebula'];
    const idx = order.indexOf(get().theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    set({ theme: next });
  },
}));
