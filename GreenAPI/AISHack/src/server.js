require("dotenv").config();

const express = require("express");
const { loadSchoolData, loadCollection, invalidateCollectionCache } = require("./services/school-data-service");
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

const GROUP_CHAT_NAMES = {
  teachers: "Учителя и Директор",
  curators: "Кураторы и Директор",
  facilities: "Завхоз и Директор",
  cafeteria: "Столовая и Директор",
};

const GROUP_CHAT_ENV = {
  teachers: process.env.GREEN_API_TEACHERS_GROUP_CHAT_ID || null,
  curators: process.env.GREEN_API_CURATORS_GROUP_CHAT_ID || null,
  facilities: process.env.GREEN_API_FACILITIES_GROUP_CHAT_ID || null,
  cafeteria: process.env.GREEN_API_CAFETERIA_GROUP_CHAT_ID || null,
};

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

async function logOutgoingMessage({
  chatId,
  chatName = null,
  text,
  source = "green_api_outbound",
  senderName = "Директор",
  senderRole = "director",
  linkedMessageId = null,
}) {
  if (!chatId || !text) {
    return null;
  }

  const { db, admin } = require("./firebase");
  const ref = db.collection("chat_messages").doc();
  await ref.set({
    chatId,
    chatName,
    text,
    source,
    senderName,
    senderRole,
    senderTeacherId: null,
    senderPhone: String(chatId).endsWith("@g.us") ? null : chatId,
    sender: String(chatId).endsWith("@g.us") ? null : chatId,
    externalMessageId: null,
    linkedMessageId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  invalidateCollectionCache("chat_messages");
  return ref.id;
}

async function sendAndLogMessage({
  chatId,
  chatName = null,
  message,
  source,
  senderName,
  senderRole,
  linkedMessageId,
}) {
  if (!chatId || !message) {
    return { skipped: true };
  }

  const reply = await sendGreenApiMessage({
    idInstance: process.env.GREEN_API_ID_INSTANCE,
    apiTokenInstance: process.env.GREEN_API_TOKEN,
    chatId,
    message,
  });

  await logOutgoingMessage({
    chatId,
    chatName,
    text: message,
    source,
    senderName,
    senderRole,
    linkedMessageId,
  });

  return reply;
}

async function resolveGroupChatId(groupKey) {
  const envChatId = GROUP_CHAT_ENV[groupKey];
  if (envChatId) {
    return envChatId;
  }

  return getChatIdByName(GROUP_CHAT_NAMES[groupKey]);
}

function buildReplacementGroupMessage(result, originalMessage) {
  const recommendations = result.result?.replacement?.recommendations || [];
  const preferredRecommendation =
    recommendations.find((item) => {
      const candidate = item.candidates?.[0];
      return candidate && candidate.teacherId !== "curator_replacement";
    }) || recommendations[0];

  if (!preferredRecommendation) {
    return null;
  }

  const candidate = preferredRecommendation.candidates?.[0];
  const author = originalMessage.senderName || "Учитель";
  if (!candidate) {
    return `📚 *Замена для группы учителей*\nОт: ${author}\n${preferredRecommendation.entry.classId}, ${preferredRecommendation.entry.lessonNumber} урок, ${preferredRecommendation.entry.subjectName}\nСвободный заменяющий пока не найден.`;
  }

  return `📚 *Замена для группы учителей*\nОт: ${author}\nКласс: ${preferredRecommendation.entry.classId}\nУрок: ${preferredRecommendation.entry.lessonNumber}\nПредмет: ${preferredRecommendation.entry.subjectName}\nЗамещает: ${candidate.fullName}`;
}

function buildIncidentGroupMessage(result, originalMessage) {
  const incident = result.detections?.incident;
  if (!incident) {
    return null;
  }

  return `🔧 *Новый инцидент*\nОт: ${originalMessage.senderName || "Сотрудник"}\nПроблема: ${incident.summary}\nЛокация: ${incident.roomText || incident.location || "Уточняется"}\nКарточка инцидента создана в дашборде.`;
}

function buildAttendanceGroupMessage(result, originalMessage) {
  const attendanceList = result.detections?.attendanceList || (result.detections?.attendance ? [result.detections.attendance] : []);
  if (!attendanceList.length) {
    return null;
  }

  const lines = attendanceList
    .map((item) => `• ${item.classId}: ${item.presentCount} присутствуют, ${item.absentCount} отсутствуют`)
    .join("\n");

  return `👥 *Посещаемость от куратора*\nОт: ${originalMessage.senderName || "Куратор"}\n${lines}\nДанные уже внесены в дашборд.`;
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
    const { sendGreenApiMessage, getPhoneByRole } = require("./services/green-api-service");
    
    const attendance = await getLatestAttendance();
    const totals = attendance.totals || { present: 0, absent: 0 };
    
    const text = `*Свод по столовой* 🍲\nВсего порций (присутствуют): ${totals.present}\nОтсутствуют: ${totals.absent}\nСдало классов: ${totals.classesReported || 0}`;
    const cafeteriaPhone = getPhoneByRole("cafeteria");
    
    const reply = await sendGreenApiMessage({
      idInstance: process.env.GREEN_API_ID_INSTANCE,
      apiTokenInstance: process.env.GREEN_API_TOKEN,
      chatId: cafeteriaPhone,
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
      reply = await sendAndLogMessage({
        chatId: message.chatId,
        chatName: message.chatName || null,
        message: replyText,
        source: "green_api_auto_reply",
        senderName: "Директор",
        senderRole: "director",
        linkedMessageId: result.messageId,
      });
    } else {
      console.log(`[IGNORE] Сообщение от ${message.chatId} проигнорировано (нет полезной нагрузки).`);
    }

    // ── УВЕДОМЛЕНИЕ ЗАМЕНЯЮЩЕМУ УЧИТЕЛЮ (Реальная отправка) ──
    if (result.result?.replacement?.recommendations) {
      const { getPhoneByTeacherId } = require("./services/green-api-service");
      for (const rec of result.result.replacement.recommendations) {
        const topCandidate = rec.candidates?.[0];
        if (topCandidate) {
          const subPhone = getPhoneByTeacherId(topCandidate.teacherId);
          if (subPhone) {
            const notifyText = `🔔 *Уведомление о замене*\nЗдравствуйте, ${topCandidate.fullName}!\nВ связи с отсутствием коллеги, вы назначены на замену:\nКласс: ${rec.entry.classId}\nУрок: ${rec.entry.lessonNumber}\nПредмет: ${rec.entry.subjectName}\nПожалуйста, подтвердите получение.`;
            
            await sendAndLogMessage({
              chatId: subPhone,
              message: notifyText,
              source: "replacement_candidate_notice",
              senderName: "Директор",
              senderRole: "director",
              linkedMessageId: result.messageId,
            });
            console.log(`[NOTIFY] Уведомление отправлено ${topCandidate.fullName} на номер ${subPhone}`);
          }
        }
      }

      const teachersGroupChatId = await resolveGroupChatId("teachers");
      const groupText = buildReplacementGroupMessage(result, message);
      if (teachersGroupChatId && groupText) {
        await sendAndLogMessage({
          chatId: teachersGroupChatId,
          chatName: GROUP_CHAT_NAMES.teachers,
          message: groupText,
          source: "replacement_group_notice",
          senderName: "Директор",
          senderRole: "director",
          linkedMessageId: result.messageId,
        });
      }
    }

    // ── УВЕДОМЛЕНИЕ ЗАВХОЗУ о новой задаче ──────────────────────────────────
    if (result.result?.incidentId || result.result?.taskIds?.length > 0) {
      const { getPhoneByRole } = require("./services/green-api-service");
      const zavhozPhone = getPhoneByRole("facilities");
      
      // Ищем группу Завхоза
      const groupChatId = await resolveGroupChatId("facilities");
      const targetChatId = groupChatId || zavhozPhone;

      if (targetChatId) {
        // Если сообщение про срочные вещи (сломалось, протечка и т.д.) - помечаем срочно
        const lowerText = message.text.toLowerCase();
        const isUrgent = lowerText.includes("слома") || lowerText.includes("течет") || lowerText.includes("протек");
        const urgencyMarker = isUrgent ? "🔴 *СРОЧНО* " : "🔧 ";

        const taskText = result.result?.incidentId
          ? buildIncidentGroupMessage(result, message)
          : `${urgencyMarker}*Новая задача*\nОт: ${message.senderName || "Сотрудник"}\nГде: Уточняется\n\n"${message.text}"\n\nПожалуйста, ознакомьтесь и выполните.`;
        await sendAndLogMessage({
          chatId: targetChatId,
          message: taskText,
          chatName: groupChatId ? GROUP_CHAT_NAMES.facilities : null,
          source: result.result?.incidentId ? "incident_group_notice" : "task_group_notice",
          senderName: "Директор",
          senderRole: "director",
          linkedMessageId: result.messageId,
        });
        console.log(`[NOTIFY] Задача отправлена Завхозу на ${targetChatId}`);
      }
    }

    if (result.result?.attendanceUpdateId && (message.senderRole === "curator" || message.senderRole === "teacher")) {
      const curatorsGroupChatId = await resolveGroupChatId("curators");
      const attendanceText = buildAttendanceGroupMessage(result, message);
      if (curatorsGroupChatId && attendanceText) {
        await sendAndLogMessage({
          chatId: curatorsGroupChatId,
          chatName: GROUP_CHAT_NAMES.curators,
          message: attendanceText,
          source: "attendance_group_notice",
          senderName: "Директор",
          senderRole: "director",
          linkedMessageId: result.messageId,
        });
      }
    }

    // ── ВАЖНЫЕ СООБЩЕНИЯ от внешних контактов ───────────────────────────────
    if (message.senderRole === "external" && result.result?.partnership) {
      const { db: fireDb, admin: fireAdmin } = require("./firebase");
      const partnershipData = result.result.partnership;
      try {
        const snap = await fireDb.collection("chat_messages")
          .where("externalMessageId", "==", message.externalMessageId)
          .limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.set(
            { isImportant: true, importantTopic: partnershipData.topic || "Важное" },
            { merge: true }
          );
        }
        console.log(`[IMPORTANT] Помечено как важное: ${partnershipData.topic}`);
      } catch(e) { console.warn("[IMPORTANT] Ошибка пометки:", e.message); }
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

    // Отправляем уведомление в WhatsApp назначенному учителю
    if (candidate) {
      const { getPhoneByTeacherId } = require("./services/green-api-service");
      const subPhone = getPhoneByTeacherId(candidate.teacherId);
      if (subPhone) {
        const msg = `✅ *Замена подтверждена*\n${candidate.fullName}, вам назначена замена.\nДетали на дашборде.`;
        await sendGreenApiMessage({
          idInstance: process.env.GREEN_API_ID_INSTANCE,
          apiTokenInstance: process.env.GREEN_API_TOKEN,
          chatId: subPhone,
          message: msg,
        });
      }
    }

    res.json({ ok: true, candidate });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

async function getChatIdByName(targetName) {
  try {
    const { db } = require("./firebase");
    const snap = await db.collection("chat_messages").where("chatName", "==", targetName).limit(5).get();
    if (!snap.empty) {
      const groupDoc = snap.docs.find((doc) => String(doc.data().chatId || "").endsWith("@g.us"));
      return (groupDoc || snap.docs[0]).data().chatId;
    }
  } catch (e) {
    console.error("Ошибка поиска группы по имени:", e.message);
  }
  return null;
}

app.post("/api/integrations/cafeteria/send-report", async (req, res) => {
  try {
    const { totalPresent, totalAbsent, date } = req.body;
    const { getPhoneByRole } = require("./services/green-api-service");
    const cafeteriaPhone = getPhoneByRole("cafeteria");

    // Пытаемся найти ID группы "Столовая и Директор"
    const groupChatId = await getChatIdByName("Столовая и Директор");
    const targetChatId = groupChatId || cafeteriaPhone;

    if (!targetChatId) {
      throw new Error("Номер столовой или группа не найдены");
    }

    const message = `🍴 *ОТЧЕТ ПО ПИТАНИЮ* (${date || "Сегодня"})\n--------------------------\n✅ Присутствуют: *${totalPresent}*\n❌ Отсутствуют: *${totalAbsent}*\nИТОГО ПОРЦИЙ: *${totalPresent}*`;

    await sendAndLogMessage({
      chatId: targetChatId,
      message: message,
      chatName: groupChatId ? GROUP_CHAT_NAMES.cafeteria : null,
      source: "cafeteria_report",
      senderName: "Директор",
      senderRole: "director",
    });

    res.json({ ok: true, sentTo: cafeteriaPhone });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
