/**
 * Cliente do serviço de voz (STT + TTS, ver /voice).
 *
 * `VOICE_URL` ausente = recurso desligado: o webhook ignora áudio como antes e
 * a IA responde sempre em texto. Falha do serviço também nunca derruba o
 * atendimento — quem chama cai para texto.
 */
const URL_BASE = (process.env.VOICE_URL || '').replace(/\/+$/, '');

// Transcrever dura ~1x a duração do áudio em CPU pequena; folga para a fila.
const STT_TIMEOUT_MS = Number(process.env.VOICE_STT_TIMEOUT_MS) || 90_000;
const TTS_TIMEOUT_MS = Number(process.env.VOICE_TTS_TIMEOUT_MS) || 60_000;

export const voiceConfigured = () => Boolean(URL_BASE);

async function call(path, init, timeoutMs) {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail).catch(() => res.statusText);
    throw new Error(`voz ${path} ${res.status}: ${detail}`);
  }
  return res;
}

/** Áudio (Buffer) → texto. String vazia quando não há fala. */
export async function transcribe(audio) {
  const res = await call('/stt', { method: 'POST', body: audio }, STT_TIMEOUT_MS);
  const { text } = await res.json();
  return String(text || '').trim();
}

/** Texto → Buffer OGG/Opus (mensagem de voz). */
export async function synthesize(text, { voice, speed } = {}) {
  const res = await call('/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, speed }),
  }, TTS_TIMEOUT_MS);

  return Buffer.from(await res.arrayBuffer());
}
