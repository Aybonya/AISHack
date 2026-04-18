require("dotenv").config();

const express = require("express");
const { loadSchoolData, loadCollection } = require("./services/school-data-service");
const {
  buildTeacherIndex,
  parseChatNote,
  recommendReplacements,
} = require("./services/replacement-engine");
const { confirmReplacement } = require("./services/chat-note-service");
const { processIncomingMessage } = require("./services/director-ai-service");
const {
  getDashboardOverview,
  getLatestAttendance,
  buildAiBrief,
  readCollection,
} = require("./services/dashboard-service");
const {
  mapWebhookToMessage,
  buildReplyFromResult,
  sendGreenApiMessage,
} = require("./services/green-api-service");
const {
  checkOpenAiService,
  analyzeText,
  transcribeAudio,
  transcribeWhatsAppVoice,
} = require("./services/openai-service");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "GreenAPI/AISHack backend",
    ui: "http://localhost:3000",
    health: "/api/health",
    webhook: "/api/integrations/green-api/webhook",
  });
});

function mergeParsedNote(parsedNote, overrides) {
  return {
    ...parsedNote,
    teacherId: overrides.teacherId || parsedNote.teacherId,
    dayKey: overrides.dayKey || parsedNote.dayKey,
    lessonNumber: overrides.lessonNumber || parsedNote.lessonNumber,
    classId: overrides.classId || parsedNote.classId,
  };
}

app.get("/api/health", async (_req, res) => {
  const data = await loadSchoolData();
  res.json({
    ok: true,
    greenApiConfigured: Boolean(
      process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN
    ),
    counts: {
      teachers: data.teachers.length,
      scheduleEntries: data.scheduleEntries.length,
      teacherLoad: data.teacherLoad.length,
    },
  });
});

app.get("/api/teachers/search", async (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const data = await loadSchoolData();
  const results = data.teachers
    .filter((teacher) => {
      if (!query) {
        return true;
      }
      const values = [teacher.fullName, teacher.shortName, ...(teacher.aliases || []), teacher.id]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return values.some((value) => value.includes(query));
    })
    .slice(0, 20);

  res.json({ results });
});

app.get("/api/dashboard/overview", async (_req, res) => {
  const overview = await getDashboardOverview();
  res.json({
    ...overview,
    aiBrief: buildAiBrief(overview),
  });
});

app.get("/api/dashboard/attendance", async (_req, res) => {
  res.json(await getLatestAttendance());
});

app.get("/api/dashboard/incidents", async (_req, res) => {
  res.json({ items: await readCollection("incident_cards", 100) });
});

app.get("/api/dashboard/tasks", async (_req, res) => {
  res.json({ items: await readCollection("director_tasks", 100) });
});

app.get("/api/dashboard/replacements", async (_req, res) => {
  res.json({ items: await readCollection("replacement_cases", 100) });
});

app.post("/api/replacements/recommend", async (req, res) => {
  try {
    const data = await loadSchoolData();
    const teacherIndex = buildTeacherIndex(data.teachers);
    const noteText = req.body.text || "";
    const parsed = parseChatNote(noteText, teacherIndex);
    const parsedNote = mergeParsedNote(parsed, req.body);

    res.json({
      parsedNote,
      recommendations: recommendReplacements(data, parsedNote),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/messages/process", async (req, res) => {
  try {
    const schoolData = await loadSchoolData();
    const result = await processIncomingMessage({
      message: {
        text: req.body.text || "",
        senderName: req.body.senderName || null,
        senderRole: req.body.senderRole || "teacher",
        source: req.body.source || "manual_message",
        chatId: req.body.chatId || null,
        externalMessageId: req.body.externalMessageId || null,
      },
      schoolData,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/actions/send-cafeteria", async (req, res) => {
  try {
    const { getLatestAttendance } = require("./services/dashboard-service");
    const { sendGreenApiMessage } = require("./services/green-api-service");
    
    const attendance = await getLatestAttendance();
    const totals = attendance.totals || { present: 0, absent: 0 };
    
    const text = `*Свод по столовой* 🍲\nВсего порций (присутствуют): ${totals.present}\nОтсутствуют: ${totals.absent}\nСдало классов: ${totals.classesReported || 0}`;
    
    const reply = await sendGreenApiMessage({
      idInstance: process.env.GREEN_API_ID_INSTANCE,
      apiTokenInstance: process.env.GREEN_API_TOKEN,
      chatId: "77086187050@c.us",
      message: text,
    });
    
    res.json({ ok: true, text, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/integrations/green-api/webhook", async (req, res) => {
  try {
    const typeWebhook = req.body?.typeWebhook;

    // Пропускаем всё кроме входящих сообщений
    if (typeWebhook !== "incomingMessageReceived") {
      return res.json({ ok: true, skipped: true });
    }

    let message = mapWebhookToMessage(req.body);
    const typeMessage = req.body?.messageData?.typeMessage;

    // ── Голосовое сообщение: транскрибируем через OpenAI Whisper ─────────────
    if (typeMessage === "audioMessage" || typeMessage === "voiceMessage") {
      const downloadUrl = req.body?.messageData?.fileMessageData?.downloadUrl;
      if (downloadUrl) {
        try {
          const transcription = await transcribeWhatsAppVoice(downloadUrl);
          message = { ...message, text: transcription.text, transcribed: true };
          console.log(`[WHISPER] Транскрипция: ${transcription.text}`);
        } catch (whisperErr) {
          console.warn(`[WHISPER] Ошибка транскрипции: ${whisperErr.message}`);
        }
      }
    }

    // Если текст пустой — нечего обрабатывать
    if (!message.text) {
      return res.json({ ok: true, skipped: true, reason: "empty_text" });
    }

    const schoolData = await loadSchoolData();
    const result = await processIncomingMessage({ message, schoolData });

    const replyText = buildReplyFromResult(result);
    let reply = null;
    if (replyText) {
      reply = await sendGreenApiMessage({
        idInstance: process.env.GREEN_API_ID_INSTANCE,
        apiTokenInstance: process.env.GREEN_API_TOKEN,
        chatId: message.chatId,
        message: replyText,
      });
    } else {
      console.log(`[IGNORE] Сообщение от ${message.chatId} проигнорировано (нет полезной нагрузки).`);
    }

    // ── СИМУЛЯЦИЯ ОТПРАВКИ УВЕДОМЛЕНИЯ ЗАМЕНЯЮЩЕМУ УЧИТЕЛЮ ──
    if (result.result?.replacement?.recommendations) {
      for (const rec of result.result.replacement.recommendations) {
        const topCandidate = rec.candidates?.[0];
        if (topCandidate) {
          const notifyText = `🔔 *Уведомление о замене*\nЗдравствуйте, ${topCandidate.fullName}!\nВ связи с отсутствием коллеги, вы назначены на замену:\nКласс: ${rec.entry.classId}\nУрок: ${rec.entry.lessonNumber}\nПредмет: ${rec.entry.subjectName}\nПожалуйста, подтвердите получение.`;
          
          // Отправляем симуляцию в тот же чат (т.к. у нас нет базы номеров телефонов всех учителей)
          await sendGreenApiMessage({
            idInstance: process.env.GREEN_API_ID_INSTANCE,
            apiTokenInstance: process.env.GREEN_API_TOKEN,
            chatId: message.chatId,
            message: `🤖 *[Симуляция отправки на личный номер кандидата]*\n${notifyText}`,
          });
        }
      }
    }

    res.json({
      ok: true,
      processed: result,
      transcribed: message.transcribed || false,
      replyText,
      reply,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat/process", async (req, res) => {
  try {
    const schoolData = await loadSchoolData();
    const result = await processIncomingMessage({
      message: {
        text: req.body.text || "",
        senderName: req.body.senderName || null,
        senderRole: req.body.senderRole || "teacher",
        source: req.body.source || "manual_chat",
        chatId: req.body.chatId || null,
        externalMessageId: req.body.externalMessageId || null,
      },
      schoolData,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/replacements/:caseId/confirm", async (req, res) => {
  try {
    const candidate = await confirmReplacement({
      caseId: req.params.caseId,
      candidateTeacherId: req.body.candidateTeacherId,
      approvedBy: req.body.approvedBy,
    });
    res.json({ ok: true, candidate });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get("/api/feed/chat-messages", async (_req, res) => {
  res.json({ items: await loadCollection("chat_messages") });
});

// ─── OpenAI эндпоинты ─────────────────────────────────────────────────────────

// GET /api/ai/health — проверка статуса Python OpenAI сервиса
app.get("/api/ai/health", async (_req, res) => {
  const status = await checkOpenAiService();
  res.json(status);
});

// POST /api/ai/analyze — анализ текста через GPT-4o
// Body: { text: string, system_prompt?: string }
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const text = req.body.text || "";
    if (!text) return res.status(400).json({ error: "text is required" });
    const result = await analyzeText(text, req.body.system_prompt || null);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/transcribe — транскрипция аудио через Whisper
// Body: multipart/form-data с полем "audio" (файл)
app.post("/api/ai/transcribe", async (req, res) => {
  try {
    // Простой вариант: принимаем base64 в JSON
    // Body: { audio_base64: string, filename?: string }
    const { audio_base64, filename = "audio.ogg" } = req.body;
    if (!audio_base64) return res.status(400).json({ error: "audio_base64 is required" });
    const audioBuffer = Buffer.from(audio_base64, "base64");
    const result = await transcribeAudio(audioBuffer, filename);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`AISHack bot API listening on port ${PORT}`);
  console.log(`Webhook: POST http://localhost:${PORT}/api/integrations/green-api/webhook`);
  console.log(`UI: http://localhost:3000`);
});
