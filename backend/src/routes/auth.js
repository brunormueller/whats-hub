/**
 * Cadastro e sessão.
 *
 * POST /api/auth/signup  → cria a conta e já devolve a sessão
 * POST /api/auth/login   → e-mail + senha
 * GET  /api/auth/me      → conta da sessão atual (o front usa para o gate)
 *
 * POST /api/auth/forgot-password        → manda o link de recuperação por e-mail
 * POST /api/auth/reset-password/verify  → o link ainda vale? (a tela abre já sabendo)
 * POST /api/auth/reset-password         → nova senha pelo link; já devolve a sessão
 *
 * Não existe rota de logout: a sessão é um JWT sem estado no servidor, o front
 * descarta o token. Se um dia precisar de revogação, entra uma lista de
 * `jti` no Redis.
 */
import { Router } from 'express';
import {
  AccountError,
  assertPassword,
  authenticate,
  createAccount,
  isValidEmail,
  publicAccount,
  setPassword,
} from '../services/accounts.js';
import {
  RESET_TTL_MINUTES,
  consumeResetToken,
  discardResetTokens,
  peekResetToken,
  requestPasswordReset,
} from '../services/passwordReset.js';
import { signToken } from '../services/tokens.js';
import { authMiddleware } from '../middleware/auth.js';
import { isEvolution } from '../services/provider.js';
import { disconnectAccount } from '../services/socket.js';
import { io } from '../index.js';

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

/* ------------------------------------------------------------------ *
 * Recuperação de senha
 * ------------------------------------------------------------------ */

const INVALID_LINK = {
  error: 'Este link de recuperação expirou ou já foi usado. Peça um novo.',
  code: 'invalid_reset_token',
};

router.post('/forgot-password', async (req, res) => {
  const email = req.body?.email;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  // Responde ANTES de procurar a conta, e a mesma coisa exista ela ou não:
  // nem o corpo nem o tempo de resposta confirmam quem tem conta no produto.
  res.json({ ok: true, minutes: RESET_TTL_MINUTES });

  requestPasswordReset(email).catch((err) => {
    console.error('Falha ao enviar recuperação de senha:', err.message);
  });
});

router.post('/reset-password/verify', async (req, res) => {
  try {
    const account = await peekResetToken(req.body?.token);
    if (!account) return res.status(400).json(INVALID_LINK);

    res.json({ email: account.email });
  } catch (err) {
    console.error('Falha ao validar link de recuperação:', err.message);
    res.status(500).json({ error: 'Não foi possível validar o link agora' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};

  try {
    // Valida a senha antes de gastar o link: senha curta não queima o token.
    assertPassword(password);

    const accountId = await consumeResetToken(token);
    if (!accountId) return res.status(400).json(INVALID_LINK);

    const account = await setPassword(accountId, password);
    if (!account) return res.status(400).json(INVALID_LINK);

    await discardResetTokens(account.id);
    disconnectAccount(io, account.id);

    console.log(`🔑 Senha redefinida: ${account.email}`);
    res.json(session(account));
  } catch (err) {
    if (err instanceof AccountError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Falha ao redefinir senha:', err.message);
    res.status(500).json({ error: 'Não foi possível redefinir a senha agora' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    account: publicAccount(req.account),
    onboarded: Boolean(req.account.onboardedAt),
    needsPairing: isEvolution && !req.account.onboardedAt,
  });
});

export default router;
