/**
 * openai-service.js
 * -----------------
 * Node.js клиент для общения с Python OpenAI микросервисом (python/openai_service.py).
 *
 * Использование в server.js:
 *   const { transcribeAudio, analyzeText, isOpenAiReady } = require('./services/openai-service');
 *
 * Архитектура:
 *   Node.js (server.js)  ──HTTP──►  Python (openai_service.py)  ──HTTPS──►  OpenAI API
 *
 * Это позволяет легко добавлять Python-логику (ML, обработка файлов и т.д.)
 * без изменения основного JS кода.
 */

const http = require("http");

const OPENAI_SERVICE_HOST = "127.0.0.1";
const OPENAI_SERVICE_PORT = parseInt(process.env.OPENAI_SERVICE_PORT || "5001", 10);
const OPENAI_SERVICE_BASE = `http://${OPENAI_SERVICE_HOST}:${OPENAI_SERVICE_PORT}`;

// ─── Внутренний HTTP клиент ───────────────────────────────────────────────────
function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: OPENAI_SERVICE_HOST,
      port: OPENAI_SERVICE_PORT,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from OpenAI service: ${data}`));
        }
      });
    });

    req.on("error", (err) =>
      reject(new Error(`OpenAI service unreachable: ${err.message}`))
    );
    req.setTimeout(90_000, () => {
      req.destroy();
      reject(new Error("OpenAI service timeout"));
    });

    req.write(payload);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${OPENAI_SERVICE_BASE}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON"));
          }
        });
      })
      .on("error", (err) =>
        reject(new Error(`OpenAI service unreachable: ${err.message}`))
      );
  });
}

// ─── Публичный API ────────────────────────────────────────────────────────────

/**
 * Проверяет что Python OpenAI сервис запущен и ключ настроен.
 * @returns {Promise<{ok: boolean, openai_configured: boolean}>}
 */
async function checkOpenAiService() {
  try {
    return await getJson("/health");
  } catch {
    return { ok: false, openai_configured: false };
  }
}

/**
 * Транскрибирует аудио через OpenAI Whisper.
 * @param {Buffer} audioBuffer - Бинарные данные аудио файла
 * @param {string} filename    - Имя файла (audio.ogg, voice.mp3 и т.д.)
 * @returns {Promise<{text: string, language: string}>}
 */
async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
  const audio_base64 = audioBuffer.toString("base64");
  const result = await postJson("/transcribe", { audio_base64, filename });
  if (result.error) {
    throw new Error(`Whisper error: ${result.error}`);
  }
  return result; // { text, language }
}

/**
 * Анализирует текст через GPT-4o.
 * @param {string} text          - Текст для анализа
 * @param {string} [systemPrompt] - Системный промпт (опционально)
 * @returns {Promise<{content: string, usage: object}>}
 */
async function analyzeText(text, systemPrompt = null) {
  const body = { text };
  if (systemPrompt) body.system_prompt = systemPrompt;
  const result = await postJson("/analyze", body);
  if (result.error) {
    throw new Error(`GPT error: ${result.error}`);
  }
  return result; // { content, usage }
}

/**
 * Удобная обёртка: транскрибирует голосовое сообщение WhatsApp.
 * GreenAPI присылает голосовые как downloadUrl → скачай → передай сюда.
 *
 * @param {string} downloadUrl - URL аудио файла из GreenAPI webhook
 * @returns {Promise<{text: string, language: string}>}
 */
async function transcribeWhatsAppVoice(downloadUrl) {
  // Скачиваем аудио
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download voice: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Определяем расширение из URL
  const ext = downloadUrl.split("?")[0].split(".").pop() || "ogg";
  return transcribeAudio(audioBuffer, `voice.${ext}`);
}

module.exports = {
  checkOpenAiService,
  transcribeAudio,
  analyzeText,
  transcribeWhatsAppVoice,
};
