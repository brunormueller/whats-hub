FROM python:3.11-slim

# ffmpeg: PCM → OGG/Opus (formato de mensagem de voz do WhatsApp)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kokoro v1.0 quantizado (int8, ~90 MB): bem mais leve que o fp32 e sem perda
# audível em CPU. Os modelos do Whisper baixam na primeira execução para o
# volume de cache, para a imagem não carregá-los.
RUN mkdir -p /models \
    && curl -fL -o /models/kokoro.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx \
    && curl -fL -o /models/voices.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
