import { create } from 'zustand';
import { Socket } from 'socket.io-client';

export interface SocketState {
  socket: Socket | null;
  socketConnected: boolean;
  
  setSocket: (socket: Socket | null) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  socketConnected: false,

  setSocket: (socket) => set({ socket }),
  setSocketConnected: (socketConnected) => set({ socketConnected })
}));
