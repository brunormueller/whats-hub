/**
 * Recuperação de senha por link de uso único.
 *
 * O link leva um token aleatório de 32 bytes; o banco guarda só o SHA-256
 * dele, como `_id`. Quem ler a coleção não consegue montar um link válido — o
 * mesmo motivo de não guardar senha em claro. SHA-256 simples basta aqui: o
 * token já tem 256 bits de entropia, não há dicionário para um ataque tentar.
 *
 * Validade curta e uso único. O índice TTL em `expiresAt` apaga os vencidos
 * sozinho; quando a senha troca, os outros links pendentes da conta morrem
 * junto.
 */
import { createHash, randomBytes } from 'node:crypto';
import { passwordResets } from './mongo.js';
import { findByEmail, getAccount } from './accounts.js';
import { sendMail } from './mailer.js';
import { passwordResetEmail } from '../emails/index.js';

export const RESET_TTL_MINUTES = 30;

// Intervalo mínimo entre dois e-mails para a mesma conta: sem ele, quem sabe
// o e-mail de alguém consegue lotar a caixa dessa pessoa pelo formulário.
const COOLDOWN_MS = 60 * 1000;

export const RESET_PATH = '/redefinir-senha';

const digest = (token) => createHash('sha256').update(String(token || '')).digest('hex');

function appUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/** Filtro de um link ainda utilizável. */
const usable = (token) => ({ _id: digest(token), usedAt: null, expiresAt: { $gt: new Date() } });

/**
 * Pedido de recuperação. Não diz se o e-mail tem conta: sem conta, ou dentro
 * do intervalo mínimo, simplesmente não envia nada. A rota responde antes de
 * chamar isto, então o tempo de resposta também não denuncia.
 */
export async function requestPasswordReset(email) {
  const account = await findByEmail(email);
  if (!account) return;

  const now = Date.now();
  const recent = await passwordResets().findOne({
    accountId: account.id,
    createdAt: { $gt: new Date(now - COOLDOWN_MS) },
  });
  if (recent) return;

  const token = randomBytes(32).toString('base64url');

  await passwordResets().insertOne({
    _id: digest(token),
    accountId: account.id,
    createdAt: new Date(now),
    expiresAt: new Date(now + RESET_TTL_MINUTES * 60 * 1000),
    usedAt: null,
  });

  await sendMail({
    to: account.email,
    ...passwordResetEmail({
      name: account.name,
      email: account.email,
      resetUrl: `${appUrl()}${RESET_PATH}?token=${token}`,
      minutes: RESET_TTL_MINUTES,
      appUrl: appUrl(),
    }),
  });

  console.log(`🔑 Link de recuperação enviado para ${account.email}`);
}

/** Conta dona de um link ainda válido, sem gastar o link. Para a tela abrir já sabendo. */
export async function peekResetToken(token) {
  const doc = await passwordResets().findOne(usable(token));
  return doc ? getAccount(doc.accountId) : null;
}

/**
 * Gasta o link. O `findOneAndUpdate` com `usedAt: null` no filtro é o que faz
 * o uso único valer mesmo com dois envios simultâneos: só um deles encontra o
 * documento ainda sem `usedAt`.
 *
 * @returns {Promise<string|null>} accountId, ou null se o link não presta
 */
export async function consumeResetToken(token) {
  const doc = await passwordResets().findOneAndUpdate(
    usable(token),
    { $set: { usedAt: new Date() } },
  );
  return doc?.accountId ?? null;
}

/** Senha trocada: nenhum outro link pendente da conta continua valendo. */
export async function discardResetTokens(accountId) {
  await passwordResets().deleteMany({ accountId });
}
