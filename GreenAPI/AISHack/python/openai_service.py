"""
openai_service.py
-----------------
Сервис для работы с OpenAI API:
  - Транскрипция голосовых/аудио сообщений (Whisper)
  - Анализ текста (GPT-4o)
  - HTTP сервер для вызова из Node.js

Запуск: python python/openai_service.py
Порт:   5001 (по умолчанию)
"""

import os
import json
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Загружаем .env вручную (без зависимостей)
def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

load_env()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_SERVICE_PORT = int(os.getenv("OPENAI_SERVICE_PORT", 5001))

COLORS = {
    "reset":  "\033[0m",
    "green":  "\033[92m",
    "yellow": "\033[93m",
    "red":    "\033[91m",
    "cyan":   "\033[96m",
    "bold":   "\033[1m",
}

def c(color, text):
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"

def log(label, msg, color="cyan"):
    print(f"{c('bold', f'[{label}]')} {c(color, msg)}")


# ─── OpenAI клиент (без SDK, чистый HTTP) ────────────────────────────────────
class OpenAIClient:
    BASE = "https://api.openai.com/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.ogg") -> dict:
        """
        Транскрипция аудио через Whisper API.
        audio_bytes — бинарные данные (ogg/mp3/mp4/wav/webm).
        Возвращает {"text": "...", "language": "..."}
        """
        import urllib.request
        import urllib.error

        boundary = "----AISHackBoundary"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="model"\r\n\r\n'
            f"whisper-1\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="response_format"\r\n\r\n'
            f"verbose_json\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8") + audio_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

        req = urllib.request.Request(
            f"{self.BASE}/audio/transcriptions",
            data=body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def analyze_text(self, text: str, system_prompt: str = None) -> dict:
        """
        Анализ текста через GPT-4o.
        Возвращает {"content": "...", "usage": {...}}
        """
        import urllib.request

        if not system_prompt:
            system_prompt = (
                "Ты умный ассистент школьного директора AIS. "
                "Анализируй сообщения учителей и отвечай кратко на русском."
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ]

        payload = json.dumps({
            "model": "gpt-4o",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 500,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self.BASE}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {
                "content": data["choices"][0]["message"]["content"],
                "usage": data.get("usage", {}),
            }


# ─── HTTP сервер (вызывается из Node.js) ─────────────────────────────────────
class OpenAIHandler(BaseHTTPRequestHandler):
    client = None  # будет инициализирован в main()

    def log_message(self, format, *args):
        pass  # отключаем стандартные логи

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {
                "ok": True,
                "openai_configured": bool(OPENAI_API_KEY and OPENAI_API_KEY != "your_openai_api_key_here"),
            })
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length) if length > 0 else b""

        try:
            # ── POST /transcribe ──────────────────────────────────────────────
            # Принимает: { "audio_base64": "...", "filename": "voice.ogg" }
            # Возвращает: { "text": "...", "language": "..." }
            if parsed.path == "/transcribe":
                import base64
                body = json.loads(raw_body.decode("utf-8"))
                audio_b64 = body.get("audio_base64", "")
                filename = body.get("filename", "audio.ogg")

                if not audio_b64:
                    return self._send_json(400, {"error": "audio_base64 is required"})

                audio_bytes = base64.b64decode(audio_b64)
                log("WHISPER", f"Транскрибируем {filename} ({len(audio_bytes)} байт)...")
                result = OpenAIHandler.client.transcribe(audio_bytes, filename)
                text = result.get("text", "")
                lang = result.get("language", "unknown")
                log("WHISPER", f"✅ [{lang}] {text[:80]}...", "green")
                self._send_json(200, {"text": text, "language": lang})

            # ── POST /analyze ─────────────────────────────────────────────────
            # Принимает: { "text": "...", "system_prompt": "..." (опц.) }
            # Возвращает: { "content": "...", "usage": {...} }
            elif parsed.path == "/analyze":
                body = json.loads(raw_body.decode("utf-8"))
                text = body.get("text", "")
                system_prompt = body.get("system_prompt", None)

                if not text:
                    return self._send_json(400, {"error": "text is required"})

                log("GPT", f"Анализируем: {text[:60]}...")
                result = OpenAIHandler.client.analyze_text(text, system_prompt)
                log("GPT", f"✅ {result['content'][:80]}...", "green")
                self._send_json(200, result)

            else:
                self._send_json(404, {"error": "Unknown endpoint"})

        except Exception as e:
            log("ERROR", traceback.format_exc(), "red")
            self._send_json(500, {"error": str(e)})


# ─── Запуск ───────────────────────────────────────────────────────────────────
def main():
    print(c("bold", "\n═══════════════════════════════════════════"))
    print(c("cyan",  "    AISHack · OpenAI Service v1.0          "))
    print(c("bold", "═══════════════════════════════════════════\n"))

    if not OPENAI_API_KEY or OPENAI_API_KEY == "your_openai_api_key_here":
        log("WARNING", "OPENAI_API_KEY не задан — сервис запущен, но запросы будут падать", "yellow")
    else:
        log("OPENAI", f"API Key: {OPENAI_API_KEY[:8]}...{'*' * 20}", "green")

    OpenAIHandler.client = OpenAIClient(OPENAI_API_KEY)

    server = HTTPServer(("127.0.0.1", OPENAI_SERVICE_PORT), OpenAIHandler)
    log("SERVER", f"✅ Слушаю http://127.0.0.1:{OPENAI_SERVICE_PORT}", "green")
    log("SERVER", "Эндпоинты: GET /health | POST /transcribe | POST /analyze", "cyan")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("SERVER", "Остановлен.", "red")


if __name__ == "__main__":
    main()
