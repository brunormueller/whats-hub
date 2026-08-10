/**
 * Cadastro e sessão.
 *
 * POST /api/auth/signup  → cria a conta e já devolve a sessão
 * POST /api/auth/login   → e-mail + senha
 * GET  /api/auth/me      → conta da sessão atual (o front usa para o gate)
 *
 * Não existe rota de logout: a sessão é um JWT sem estado no servidor, o front
 * descarta o token. Se um dia precisar de revogação, entra uma lista de
 * `jti` no Redis.
 */
import { Router } from 'express';
import {
  AccountError,
  authenticate,
  createAccount,
  publicAccount,
} from '../services/accounts.js';
import { signToken } from '../services/tokens.js';
import { authMiddleware } from '../middleware/auth.js';
import { isEvolution } from '../services/provider.js';

const router = Router();

function session(account) {
  const { token, expiresAt } = signToken({ accountId: account.id, email: account.email });

  return {
    token,
    expiresAt,
    account: publicAccount(account),
    // O front usa isto para saber se ainda falta conectar o WhatsApp
    onboarded: Boolean(account.onboardedAt),
    needsPairing: isEvolution && !account.onboardedAt,
  };
}

router.post('/signup', async (req, res) => {
  const { name, email, password, company } = req.body || {};

  try {
    const account = await createAccount({ name, email, password, company });
    console.log(`✨ Conta criada: ${account.email} (instância ${account.instanceName})`);
    res.status(201).json(session(account));
  } catch (err) {
    if (err instanceof AccountError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Falha no cadastro:', err.message);
    res.status(500).json({ error: 'Não foi possível criar a conta agora' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  // Mesma mensagem para e-mail inexistente e senha errada: não confirma quem
  // tem conta no produto.
  const account = await authenticate(email, password);
  if (!account) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  res.json(session(account));
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    account: publicAccount(req.account),
    onboarded: Boolean(req.account.onboardedAt),
    needsPairing: isEvolution && !req.account.onboardedAt,
  });
});

export default router;
