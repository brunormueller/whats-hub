import { listConversations, markAsRead } from './store.js';
import { verifyToken } from './tokens.js';
import { getAccount, isSessionCurrent } from './accounts.js';
import { isEvolution } from './provider.js';

/**
 * Socket.IO do dashboard.
 *
 * Cada conexão entra na sala da própria conta (`acc:<id>`) e todo broadcast é
 * endereçado a essa sala — nenhum evento de uma conta chega em outra. O
 * telefone forma uma subsala (`acc:<id>:conv:<telefone>`) para o histórico
 * aberto na tela.
 */

const accountRoom = (accountId) => `acc:${accountId}`;
const conversationRoom = (accountId, phoneNumber) => `acc:${accountId}:conv:${phoneNumber}`;

export function setupSocket(io) {
  // Mesmo JWT do HTTP: sessão inválida não abre socket.
  io.use(async (socket, next) => {
    const claims = verifyToken(socket.handshake.auth?.token);
    if (!claims?.accountId) return next(new Error('Sessão inválida'));

    const account = await getAccount(claims.accountId);
    if (!account) return next(new Error('Conta não encontrada'));
    if (!isSessionCurrent(account, claims)) return next(new Error('Sessão inválida'));
    // Mesma regra do requireOnboarded: só o provider evolution tem pareamento.
    if (isEvolution && !account.onboardedAt) {
      return next(new Error('Conecte seu WhatsApp primeiro'));
    }

    socket.accountId = account.id;
    socket.accountName = account.name;
    return next();
  });

  io.on('connection', async (socket) => {
    const { accountId } = socket;
    socket.join(accountRoom(accountId));
    console.log(`🟡 ${socket.accountName} conectou no painel (${socket.id})`);

    // Envia lista de conversas da conta ao conectar
    socket.emit('conversations:list', await listConversations(accountId));

    // Operador entra na "sala" de um número específico para ver o histórico
    socket.on('conversation:join', (phoneNumber) => {
      socket.join(conversationRoom(accountId, phoneNumber));
    });

    socket.on('conversation:leave', (phoneNumber) => {
      socket.leave(conversationRoom(accountId, phoneNumber));
    });

    // Operador marca conversa como lida
    socket.on('conversation:read', async (phoneNumber) => {
      await markAsRead(accountId, phoneNumber);
      io.to(accountRoom(accountId)).emit('conversation:updated', { phoneNumber, unread: 0 });
    });

    socket.on('disconnect', () => {
      console.log(`🔴 ${socket.accountName} saiu do painel (${socket.id})`);
    });
  });
}

export function broadcastConversationUpdate(io, accountId, phoneNumber, patch) {
  io.to(accountRoom(accountId)).emit('conversation:updated', { phoneNumber, ...patch });
}

export function broadcastMessage(io, accountId, phoneNumber, message) {
  // Thread aberta na tela
  io.to(conversationRoom(accountId, phoneNumber)).emit('message:new', message);

  // Sidebar de quem estiver logado nessa conta
  io.to(accountRoom(accountId)).emit('conversation:updated', {
    phoneNumber,
    lastMessage: message.formatted,
    lastTimestamp: message.timestamp,
    unread: message.direction === 'inbound' ? 1 : 0,
  });
}

/**
 * Senha trocada: fecha os painéis abertos da conta. O handshake só olha o JWT
 * ao conectar, então sem isto um socket aberto com a senha antiga continuaria
 * recebendo as conversas; na reconexão o token velho já é recusado.
 */
export function disconnectAccount(io, accountId) {
  io.in(accountRoom(accountId)).disconnectSockets(true);
}

/** Lead fechado: alimenta o painel de métricas em tempo real. */
export function broadcastLead(io, accountId, lead) {
  io.to(accountRoom(accountId)).emit('lead:new', lead);
}
