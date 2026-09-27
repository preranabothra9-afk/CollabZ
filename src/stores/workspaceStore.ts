import { create } from 'zustand';
import { Workspace } from '../types';

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (ws: Workspace | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace })
}));
