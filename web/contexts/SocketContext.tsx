'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io as socketIO, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  reconnecting: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    // Si ya existe un socket previo, desconectarlo para reconectar con el nuevo auth (o como invitado)
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = socketIO(SOCKET_URL, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);

      // Si venía de una desconexión previa, emitir evento para que las pantallas resincronicen datos
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        window.dispatchEvent(new CustomEvent('socket:reconnected'));
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      wasDisconnectedRef.current = true;
      if (reason !== 'io client disconnect') {
        setReconnecting(true);
      }
    });

    socket.on('connect_error', () => {
      setConnected(false);
      setReconnecting(true);
      wasDisconnectedRef.current = true;
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setReconnecting(false);
    };
  }, [token, authLoading]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, reconnecting }}>
      {children}
      {/* Indicador sutil de reconexión */}
      {reconnecting && (
        <div className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>Reconectando con el servidor…</span>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
