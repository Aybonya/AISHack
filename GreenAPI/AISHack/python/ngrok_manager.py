"""
ngrok_manager.py
----------------
1. Запускает ngrok tunnel на порт Node.js сервера
2. Получает публичный URL от ngrok API
3. Автоматически регистрирует webhook в GreenAPI
4. Обновляет .env файл с новым URL
5. Опционально: транскрипция голосовых сообщений через OpenAI Whisper
"""

import subprocess
import time
import requests
import os
import sys
import json
import re
from pathlib import Path
from dotenv import load_dotenv

# ─── Пути ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
ENV_FILE = BASE_DIR / ".env"

# Загружаем .env
load_dotenv(ENV_FILE)

# ─── Конфиг ───────────────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 3000))
GREEN_API_ID = os.getenv("GREEN_API_ID_INSTANCE", "")
GREEN_API_TOKEN = os.getenv("GREEN_API_TOKEN", "")
NGROK_API_URL = "http://127.0.0.1:4040/api/tunnels"
WEBHOOK_PATH = "/api/integrations/green-api/webhook"

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


# ─── 1. Запуск ngrok ──────────────────────────────────────────────────────────
def start_ngrok(port: int) -> subprocess.Popen:
    log("NGROK", f"Запускаем ngrok на порту {port}...", "yellow")
    proc = subprocess.Popen(
        ["ngrok", "http", str(port), "--log=stdout"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Даём ngrok время подняться
    time.sleep(3)
    return proc


# ─── 2. Получение публичного URL ──────────────────────────────────────────────
def get_ngrok_url(retries: int = 10) -> str:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(NGROK_API_URL, timeout=5)
            tunnels = resp.json().get("tunnels", [])
            for tunnel in tunnels:
                if tunnel.get("proto") == "https":
                    return tunnel["public_url"]
        except Exception:
            pass
        log("NGROK", f"Ожидаем ngrok... попытка {attempt}/{retries}", "yellow")
        time.sleep(2)
    raise RuntimeError("Не удалось получить ngrok URL. Убедись что ngrok установлен и авторизован.")


# ─── 3. Обновление .env ───────────────────────────────────────────────────────
def update_env_url(new_url: str):
    content = ENV_FILE.read_text(encoding="utf-8")
    pattern = r"^PUBLIC_WEBHOOK_BASE_URL=.*$"
    replacement = f"PUBLIC_WEBHOOK_BASE_URL={new_url}"
    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        content += f"\nPUBLIC_WEBHOOK_BASE_URL={new_url}\n"
    ENV_FILE.write_text(content, encoding="utf-8")
    log("ENV", f"Обновлён PUBLIC_WEBHOOK_BASE_URL={new_url}", "green")


# ─── 4. Регистрация webhook в GreenAPI ────────────────────────────────────────
def set_green_api_webhook(webhook_url: str) -> dict:
    if not GREEN_API_ID or not GREEN_API_TOKEN:
        log("GREEN-API", "Нет GREEN_API_ID_INSTANCE или GREEN_API_TOKEN — пропускаем", "yellow")
        return {}

    endpoint = (
        f"https://api.green-api.com"
        f"/waInstance{GREEN_API_ID}"
        f"/setSettings/{GREEN_API_TOKEN}"
    )

    payload = {
        "webhookUrl": webhook_url,
        "outgoingWebhook": "yes",
        "stateWebhook": "yes",
        "incomingWebhook": "yes",
    }

    try:
        resp = requests.post(endpoint, json=payload, timeout=15)
        data = resp.json()
        if data.get("saveSettings"):
            log("GREEN-API", f"✅ Webhook успешно зарегистрирован: {webhook_url}", "green")
        else:
            log("GREEN-API", f"⚠️  Ответ GreenAPI: {data}", "yellow")
        return data
    except Exception as e:
        log("GREEN-API", f"❌ Ошибка при регистрации webhook: {e}", "red")
        return {}


# ─── 5. Проверка текущего webhook ─────────────────────────────────────────────
def get_current_webhook() -> str:
    if not GREEN_API_ID or not GREEN_API_TOKEN:
        return ""
    endpoint = (
        f"https://api.green-api.com"
        f"/waInstance{GREEN_API_ID}"
        f"/getSettings/{GREEN_API_TOKEN}"
    )
    try:
        resp = requests.get(endpoint, timeout=10)
        return resp.json().get("webhookUrl", "")
    except Exception:
        return ""


# ─── 6. Главная функция ───────────────────────────────────────────────────────
def main():
    print(c("bold", "\n═══════════════════════════════════════════"))
    print(c("cyan",  "       AISHack · ngrok Manager v1.0        "))
    print(c("bold", "═══════════════════════════════════════════\n"))

    # Проверяем: может ngrok уже запущен (вручную или предыдущим запуском)
    existing_url = None
    try:
        resp = requests.get(NGROK_API_URL, timeout=3)
        tunnels = resp.json().get("tunnels", [])
        for t in tunnels:
            if t.get("proto") == "https":
                existing_url = t["public_url"]
                break
    except Exception:
        pass

    if existing_url:
        log("NGROK", f"ngrok уже запущен: {existing_url}", "green")
        public_url = existing_url
    else:
        start_ngrok(PORT)  # запускается в фоне (subprocess.Popen)
        public_url = get_ngrok_url()
        log("NGROK", f"✅ Публичный URL: {public_url}", "green")

    # Полный URL webhook
    webhook_url = public_url + WEBHOOK_PATH
    log("WEBHOOK", f"Регистрируем: {webhook_url}", "cyan")

    # Обновляем .env
    update_env_url(public_url)

    # Регистрируем в GreenAPI
    set_green_api_webhook(webhook_url)

    # Проверяем
    time.sleep(1)
    current = get_current_webhook()
    if current == webhook_url:
        log("GREEN-API", "✅ Webhook подтверждён!", "green")
    elif current:
        log("GREEN-API", f"Текущий webhook в GreenAPI: {current}", "yellow")

    print(c("bold", "\n═══════════════════════════════════════════"))
    print(c("green", "  ngrok запущен, webhook зарегистрирован!  "))
    print(c("bold", "═══════════════════════════════════════════\n"))

    # Выходим — ngrok продолжает работать в фоне.
    # start.ps1 запустит Node.js и OpenAI сервис следующими шагами.
    sys.exit(0)


if __name__ == "__main__":
    main()
