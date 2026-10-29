/**
 * Sessão por JWT assinado com HMAC-SHA256.
 *
 * Sem biblioteca: o formato é `base64url(header).base64url(payload).assinatura`
 * e o `crypto` do Node faz o HMAC. Escopo deliberadamente pequeno — só HS256,
 * só os campos que este produto usa. Nada de `alg: none`, nada de JWK remoto.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;   // 30 dias

function secret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (!secret.warned) {
    secret.warned = true;
    if (fromEnv) {
      console.warn('⚠️  JWT_SECRET tem menos de 32 caracteres — gerando uma chave temporária.');
    } else {
      console.warn('⚠️  JWT_SECRET não definida — sessões caem a cada restart do servidor.');
    }
    console.warn('   Defina JWT_SECRET no backend/.env (ex.: openssl rand -hex 32).');
    secret.ephemeral = randomBytes(32).toString('hex');
  }

  return secret.ephemeral;
}

/** Chave de 32 bytes para cifrar dado em repouso, separada por finalidade. */
export function secretKey(purpose) {
  return createHash('sha256').update(`${purpose}:${secret()}`).digest();
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(data) {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

/**
 * @param {object} payload  claims da sessão (accountId, email…)
 * @param {number} ttl      validade em segundos
 */
export function signToken(payload, ttl = DEFAULT_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  const data = `${header}.${body}`;

  return {
    token: `${data}.${sign(data)}`,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  };
}

/**
 * Valida assinatura e expiração.
 * @returns {object|null} claims, ou null se o token não presta
 */
export function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let claims;
  let head;
  try {
    head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (head?.alg !== 'HS256') return null;
  if (!claims?.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;

  return claims;
}
