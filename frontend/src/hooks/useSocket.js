import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Socket único por token de sessão. Trocar de conta (logout/login) precisa
// derrubar a conexão antiga: ela está autenticada com o token anterior e
// continuaria recebendo os eventos da conta errada.
let current = { token: null, socket: null };

export function getSocket(token) {
  if (current.socket && current.token === token) return current.socket;

  if (current.socket) {
    current.socket.disconnect();
    current.socket = null;
  }

  current = {
    token,
    socket: io(URL, { auth: { token }, autoConnect: true }),
  };

  return current.socket;
}

export function useSocket(token, handlers = {}) {
  const socket = getSocket(token);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listeners = Object.keys(handlersRef.current).map((event) => {
      const handler = (...args) => handlersRef.current[event]?.(...args);
      socket.on(event, handler);
      return [event, handler];
    });

    return () => {
      listeners.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [socket]);

  return socket;
}
