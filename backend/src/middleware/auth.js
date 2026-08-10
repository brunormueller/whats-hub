/**
 * Autenticação por JWT de sessão (ver services/tokens.js).
 *
 * `authMiddleware` põe a conta em `req.account`. Todo acesso a dado de
 * atendimento passa por aqui, e as funções do Redis exigem `accountId` — é o
 * que impede uma conta ler a conversa de outra.
 */
import { verifyToken } from '../services/tokens.js';
import { getAccount } from '../services/accounts.js';
import { isEvolution } from '../services/provider.js';

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function authMiddleware(req, res, next) {
  const claims = verifyToken(bearer(req));

  if (!claims?.accountId) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada', code: 'unauthenticated' });
  }

  const account = await getAccount(claims.accountId);
  if (!account) {
    // Token válido de conta que não existe mais.
    return res.status(401).json({ error: 'Conta não encontrada', code: 'unauthenticated' });
  }

  req.account = account;
  next();
}

/**
 * Bloqueia o resto do produto até o WhatsApp estar conectado.
 * O front usa `code` para mandar o usuário de volta ao onboarding.
 */
export function requireOnboarded(req, res, next) {
  // No provider `meta` não há o que parear: o número é o da instalação e as
  // rotas de instância nem existem. Exigir onboarding travaria o produto.
  if (!isEvolution) return next();

  if (!req.account?.onboardedAt) {
    return res.status(403).json({
      error: 'Conecte seu WhatsApp para liberar o painel',
      code: 'onboarding_required',
    });
  }
  next();
}
