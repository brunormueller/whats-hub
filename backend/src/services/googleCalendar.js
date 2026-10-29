/**
 * Google Calendar por conta: cada cliente do SaaS autoriza o próprio
 * calendário (OAuth, escopo mínimo) e a IA agenda nele.
 *
 * Sem SDK: o OAuth e a API de calendário são REST simples, e `fetch` do Node
 * basta. O que fica no banco é só o refresh token (cifrado com AES-256-GCM,
 * chave derivada do JWT_SECRET); o access token vive em memória e é renovado
 * quando vence.
 *
 * Variáveis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI (a
 * URL pública de /api/google/callback, a mesma cadastrada no Google Cloud).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { googleConnections } from './mongo.js';
import { secretKey, signToken, verifyToken } from './tokens.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/userinfo.email',
];

const TIMEZONE = process.env.AI_TIMEZONE || 'America/Sao_Paulo';

export const CALENDAR_DEFAULTS = {
  enabled: false,
  calendarId: 'primary',
  durationMin: 30,
  // 0 = domingo … 6 = sábado
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '18:00',
  minNoticeMin: 120,
  horizonDays: 7,
  bufferMin: 0,
  eventTitle: 'Conversa com {nome}',
};

/** Erro de uso (conta sem Google, credencial ausente…) — a rota devolve a mensagem. */
export class CalendarError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET
    && process.env.GOOGLE_REDIRECT_URI,
  );
}

/* ------------------------------------------------------------------ *
 * Refresh token cifrado
 * ------------------------------------------------------------------ */

function seal(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey('google-refresh'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function unseal(sealed) {
  const [iv, tag, data] = String(sealed).split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', secretKey('google-refresh'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/* ------------------------------------------------------------------ *
 * OAuth
 * ------------------------------------------------------------------ */

/** URL de consentimento. O `state` é um token curto assinado: só a conta que o pediu o completa. */
export function authUrl(accountId) {
  if (!googleConfigured()) {
    throw new CalendarError('Google não configurado no servidor (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)', 503);
  }

  const { token } = signToken({ accountId, purpose: 'google-oauth' }, 600);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent: sem isso o Google não devolve refresh token numa
    // reconexão e a agenda pararia de funcionar em uma hora.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: token,
  });

  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...body,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || `Google OAuth ${res.status}`);
    err.code = json.error;
    throw err;
  }
  return json;
}

/** Conclui o consentimento: troca o código e guarda a conexão. Devolve o accountId. */
export async function completeAuth(code, state) {
  const claims = verifyToken(state);
  if (claims?.purpose !== 'google-oauth' || !claims.accountId) {
    throw new CalendarError('Autorização expirada — tente conectar de novo');
  }

  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });

  if (!tokens.refresh_token) {
    throw new CalendarError(
      'O Google não devolveu permissão offline. Remova o acesso em myaccount.google.com/permissions e conecte de novo.',
    );
  }

  const granted = String(tokens.scope || '');
  if (!granted.includes('calendar.events') || !granted.includes('calendar.freebusy')) {
    throw new CalendarError('Autorize o acesso ao calendário na tela do Google para a IA poder agendar.');
  }

  let email = '';
  try {
    const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    email = info.email || '';
  } catch { /* só decorativo na tela */ }

  await googleConnections().updateOne(
    { _id: claims.accountId },
    { $set: { email, refreshToken: seal(tokens.refresh_token), connectedAt: new Date().toISOString() } },
    { upsert: true },
  );

  accessCache.set(claims.accountId, {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
  });

  return claims.accountId;
}

export async function getConnection(accountId) {
  if (!accountId) return null;
  return googleConnections().findOne({ _id: accountId }, { projection: { email: 1, connectedAt: 1 } });
}

export async function disconnect(accountId) {
  const doc = await googleConnections().findOne({ _id: accountId });
  accessCache.delete(accountId);
  if (!doc) return;

  await googleConnections().deleteOne({ _id: accountId });

  // Revogar é cortesia: se falhar, a conexão já saiu do nosso lado.
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: unseal(doc.refreshToken) }),
    });
  } catch { /* ignora */ }
}

const accessCache = new Map();

async function accessToken(accountId) {
  const cached = accessCache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const doc = await googleConnections().findOne({ _id: accountId });
  if (!doc) throw new CalendarError('Google Calendar não conectado', 409);

  try {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: unseal(doc.refreshToken),
    });
    accessCache.set(accountId, {
      token: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
    });
    return tokens.access_token;
  } catch (err) {
    // O cliente revogou o acesso (ou o app está em modo de teste e o token
    // venceu): a conexão não serve mais, e deixá-la faria toda mensagem tentar.
    if (err.code === 'invalid_grant') {
      await googleConnections().deleteOne({ _id: accountId });
      accessCache.delete(accountId);
      throw new CalendarError('O acesso ao Google foi revogado ou expirou — conecte de novo', 409);
    }
    throw err;
  }
}

async function api(accountId, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(accountId)}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google Calendar ${res.status}: ${json.error?.message || 'erro'}`);
  }
  return json;
}

/* ------------------------------------------------------------------ *
 * Fuso e disponibilidade
 * ------------------------------------------------------------------ */

/** Diferença (ms) entre o relógio local de `tz` e UTC no instante `date`. */
function tzOffsetMs(date, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );

  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-03" + "14:30" no fuso `tz` → Date (instante UTC). */
export function zonedTime(dateStr, timeStr, tz = TIMEZONE) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);

  // Duas passadas: a segunda corrige o offset quando o palpite cai do outro
  // lado de uma troca de horário de verão.
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

const localDate = (date, tz) => new Intl.DateTimeFormat('en-CA', {
  timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const localTime = (date, tz) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(date);

const weekdayLabel = (dateStr) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit',
}).format(new Date(`${dateStr}T00:00:00Z`));

/** Configuração da conta com defaults e valores saneados. */
export function calendarSettings(config) {
  const c = { ...CALENDAR_DEFAULTS, ...(config?.calendar || {}) };
  const clock = (v, fallback) => (/^\d{2}:\d{2}$/.test(v) ? v : fallback);

  return {
    ...c,
    durationMin: Math.min(Math.max(Number(c.durationMin) || 30, 10), 480),
    minNoticeMin: Math.max(Number(c.minNoticeMin) || 0, 0),
    horizonDays: Math.min(Math.max(Number(c.horizonDays) || 7, 1), 30),
    bufferMin: Math.min(Math.max(Number(c.bufferMin) || 0, 0), 120),
    start: clock(c.start, '09:00'),
    end: clock(c.end, '18:00'),
    days: Array.isArray(c.days) ? c.days.map(Number).filter((d) => d >= 0 && d <= 6) : [1, 2, 3, 4, 5],
    calendarId: String(c.calendarId || 'primary'),
  };
}

async function busyIntervals(accountId, cfg, from, to) {
  const json = await api(accountId, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: cfg.calendarId }],
    }),
  });

  const entry = json.calendars?.[cfg.calendarId];
  if (entry?.errors?.length) {
    throw new CalendarError(`Calendário "${cfg.calendarId}" inacessível: ${entry.errors[0].reason}`, 409);
  }

  const pad = cfg.bufferMin * 60000;
  return (entry?.busy || []).map((b) => [
    new Date(b.start).getTime() - pad,
    new Date(b.end).getTime() + pad,
  ]);
}

/** Subtrai os intervalos ocupados de [lo, hi). Tudo em ms UTC. */
function subtract(lo, hi, busy) {
  let free = [[lo, hi]];
  for (const [bs, be] of busy) {
    free = free.flatMap(([s, e]) => {
      if (be <= s || bs >= e) return [[s, e]];
      const out = [];
      if (bs > s) out.push([s, bs]);
      if (be < e) out.push([be, e]);
      return out;
    });
  }
  return free;
}

/**
 * Janelas livres dentro do expediente configurado, já descontados os
 * compromissos do Google e a antecedência mínima. Só entram janelas em que
 * cabe a duração do atendimento.
 */
export async function freeWindows(accountId, config, now = new Date()) {
  const cfg = calendarSettings(config);
  const durationMs = cfg.durationMin * 60000;

  const today = localDate(now, TIMEZONE);
  const dates = [];
  for (let i = 0; i <= cfg.horizonDays; i += 1) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const spans = dates
    .filter((d) => cfg.days.includes(new Date(`${d}T00:00:00Z`).getUTCDay()))
    .map((date) => ({
      date,
      start: zonedTime(date, cfg.start).getTime(),
      end: zonedTime(date, cfg.end).getTime(),
    }))
    .filter((s) => s.end > s.start);

  if (!spans.length) return { cfg, days: [] };

  const busy = await busyIntervals(
    accountId,
    cfg,
    new Date(spans[0].start),
    new Date(spans[spans.length - 1].end),
  );

  const earliest = now.getTime() + cfg.minNoticeMin * 60000;

  const days = spans
    .map(({ date, start, end }) => {
      const windows = subtract(Math.max(start, earliest), end, busy)
        .filter(([s, e]) => e - s >= durationMs);
      return { date, label: weekdayLabel(date), windows };
    })
    .filter((d) => d.windows.length);

  return { cfg, days };
}

/** Texto compacto das janelas livres para o contexto do modelo. */
export function describeWindows({ cfg, days }) {
  if (!days.length) {
    return `Sem horário livre nos próximos ${cfg.horizonDays} dias.`;
  }

  return days
    .map((d) => `- ${d.label} (${d.date}): ${d.windows
      .map(([s, e]) => `${localTime(new Date(s), TIMEZONE)}–${localTime(new Date(e), TIMEZONE)}`)
      .join(', ')}`)
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * Agendamento
 * ------------------------------------------------------------------ */

/**
 * Cria o evento se o horário ainda estiver livre (consulta o Google de novo:
 * o cliente pode ter demorado a confirmar e a agenda mudou nesse meio tempo).
 *
 * @returns {Promise<{ok: true, eventId, link, start, end}|{ok: false, reason: string}>}
 */
export async function bookSlot(accountId, config, { date, time, title, description, attendeeEmail }) {
  const cfg = calendarSettings(config);

  const start = zonedTime(date, time);
  const end = new Date(start.getTime() + cfg.durationMin * 60000);

  const { days } = await freeWindows(accountId, config);
  const window = days.find((d) => d.date === date)?.windows;
  const fits = window?.some(([s, e]) => start.getTime() >= s && end.getTime() <= e);

  if (!fits) return { ok: false, reason: 'unavailable' };

  const event = await api(
    accountId,
    `/calendars/${encodeURIComponent(cfg.calendarId)}/events${attendeeEmail ? '?sendUpdates=all' : ''}`,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: title,
        description,
        start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
        ...(attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
      }),
    },
  );

  return {
    ok: true,
    eventId: event.id,
    link: event.htmlLink,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
