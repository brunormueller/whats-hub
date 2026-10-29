"""
Serviço de voz do hub: transcreve áudio de cliente (STT) e gera áudio de
resposta (TTS). Fala só com o backend, pela rede interna do compose — não tem
autenticação e não deve ser publicado.

  POST /stt   corpo = bytes do áudio (ogg/opus, mp4…)  → { text, duration }
  POST /tts   { text, voice?, speed? }                  → audio/ogg (opus)
  GET  /health

CPU pequena: toda inferência passa por um lock único. Duas rodando juntas
dividem os mesmos núcleos e as duas ficam mais lentas que em fila.
"""
import asyncio
import io
import logging
import os
import re
import subprocess

import numpy as np
from fastapi import FastAPI, HTTPException, Request, Response
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
from pydantic import BaseModel

log = logging.getLogger("voice")
logging.basicConfig(level=logging.INFO)

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_LANG = os.getenv("WHISPER_LANG", "pt")
DEFAULT_VOICE = os.getenv("TTS_VOICE", "pf_dora")
TTS_LANG = os.getenv("TTS_LANG", "pt-br")
MAX_TTS_CHARS = int(os.getenv("MAX_TTS_CHARS", "1500"))
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(16 * 1024 * 1024)))
# Trecho por chamada ao Kokoro: o limite do modelo é ~510 fonemas.
CHUNK_CHARS = 220

app = FastAPI()
lock = asyncio.Lock()

whisper = WhisperModel(
    WHISPER_MODEL,
    device="cpu",
    compute_type="int8",
    cpu_threads=int(os.getenv("CPU_THREADS", "4")),
)
kokoro = Kokoro("/models/kokoro.onnx", "/models/voices.bin")
log.info("modelos carregados: whisper=%s kokoro=int8", WHISPER_MODEL)


@app.get("/health")
def health():
    return {"ok": True, "whisper": WHISPER_MODEL, "voice": DEFAULT_VOICE}


def transcribe(data: bytes):
    segments, info = whisper.transcribe(
        io.BytesIO(data),
        language=WHISPER_LANG or None,
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return text, info.duration


@app.post("/stt")
async def stt(request: Request):
    data = await request.body()
    if not data:
        raise HTTPException(400, "corpo vazio")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "áudio grande demais")

    async with lock:
        try:
            text, duration = await asyncio.to_thread(transcribe, data)
        except Exception as err:  # áudio corrompido / formato desconhecido
            log.warning("stt falhou: %s", err)
            raise HTTPException(422, "não foi possível ler o áudio")

    return {"text": text, "duration": round(duration, 1)}


class TtsBody(BaseModel):
    text: str
    voice: str | None = None
    speed: float = 1.0


# Emoji e símbolos viram ruído (ou silêncio) na fala.
NOISE = re.compile(
    r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200d]|https?://\S+|[*_`#~>|]"
)


def clean(text: str) -> str:
    text = NOISE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def chunks(text: str):
    """Quebra em frases e agrupa até CHUNK_CHARS, sem cortar no meio de uma."""
    sentences = re.split(r"(?<=[.!?…])\s+", text)
    out, cur = [], ""
    for s in sentences:
        while len(s) > CHUNK_CHARS:  # frase gigante: corta na vírgula/espaço
            cut = max(s.rfind(",", 0, CHUNK_CHARS), s.rfind(" ", 0, CHUNK_CHARS))
            cut = cut if cut > 40 else CHUNK_CHARS
            out.append((cur + " " + s[:cut]).strip() if cur else s[:cut])
            cur, s = "", s[cut:].lstrip(" ,")
        if cur and len(cur) + len(s) + 1 > CHUNK_CHARS:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return [c for c in out if c]


def synthesize(text: str, voice: str, speed: float):
    parts, rate = [], 24000
    for piece in chunks(text):
        samples, rate = kokoro.create(piece, voice=voice, speed=speed, lang=TTS_LANG)
        parts.append(samples)
        parts.append(np.zeros(int(rate * 0.18), dtype=np.float32))  # respiro entre frases

    pcm = np.concatenate(parts).astype(np.float32)
    proc = subprocess.run(
        [
            "ffmpeg", "-loglevel", "error",
            "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
            "-c:a", "libopus", "-b:a", "32k", "-application", "voip",
            "-f", "ogg", "pipe:1",
        ],
        input=pcm.tobytes(),
        capture_output=True,
        check=True,
    )
    return proc.stdout, len(pcm) / rate


@app.post("/tts")
async def tts(body: TtsBody):
    text = clean(body.text)[:MAX_TTS_CHARS]
    if not text:
        raise HTTPException(400, "texto vazio")

    voice = body.voice or DEFAULT_VOICE
    if voice not in kokoro.get_voices():
        raise HTTPException(400, f"voz desconhecida: {voice}")

    async with lock:
        audio, seconds = await asyncio.to_thread(
            synthesize, text, voice, min(max(body.speed, 0.7), 1.3)
        )

    return Response(
        content=audio,
        media_type="audio/ogg",
        headers={"X-Audio-Seconds": f"{seconds:.1f}"},
    )
