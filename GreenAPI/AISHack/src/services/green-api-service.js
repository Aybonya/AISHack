const { normalizeSpace } = require("../utils");

// Справочник номеров телефонов — привязка к реальным учителям из базы данных
const PHONE_DIRECTORY = {
  // Ақырап А. — первый учитель кафедры английского / IELTS
  "77479609925@c.us": { role: "teacher", name: "Ақырап А.", teacherId: "akyrap_akerke" },
  // Алимбекова У. — второй учитель, основной кандидат на замену
  "77088908028@c.us": { role: "teacher", name: "Алимбекова У.", teacherId: "alimbekova_u_s" },
  // Куратор
  "77086187050@c.us": { role: "curator", name: "Куратор" },
  // Завхоз / слесарь
  "77713364671@c.us": { role: "facilities", name: "Завхоз / слесарь" },
  // Заведующая столовой
  "77786938964@c.us": { role: "cafeteria", name: "Заведующая столовой" },
  // Внешний контакт
  "77475924170@c.us": { role: "external", name: "Внешний контакт" },
};

function extractTextFromWebhook(body) {
  const typeMessage = body?.messageData?.typeMessage;
  if (typeMessage === "textMessage") {
    return body?.messageData?.textMessageData?.textMessage || "";
  }
  if (typeMessage === "extendedTextMessage") {
    return body?.messageData?.extendedTextMessageData?.text || "";
  }
  return "";
}

function mapWebhookToMessage(body) {
  // senderPhone — номер того кто написал (в группах это участник, не группа)
  const senderPhone = body?.senderData?.sender || "";
  // chatId — куда отвечать (в группах это ID группы @g.us, в личных — номер@c.us)
  const chatId = body?.senderData?.chatId || senderPhone;
  const isGroup = chatId.endsWith("@g.us");
  const directoryInfo = PHONE_DIRECTORY[senderPhone] || {};

  return {
    text: extractTextFromWebhook(body),
    senderName:
      directoryInfo.name || body?.senderData?.senderName || body?.senderData?.senderContactName || body?.senderData?.chatName || null,
    senderRole: directoryInfo.role || "teacher",
    senderTeacherId: directoryInfo.teacherId || null,
    source: isGroup ? "green_api_group" : "green_api_webhook",
    chatId,        // группа или личный чат — отвечаем туда
    chatName: isGroup ? (body?.senderData?.chatName || "Группа") : null,
    senderPhone,   // реальный номер отправителя для уведомлений
    externalMessageId: body?.idMessage || null,
    isGroup,
  };
}

function buildReplyFromResult(result) {
  const parts = [];

  if (result.result?.attendanceUpdateId && result.detections.attendance) {
    const attList = result.detections.attendanceList || [result.detections.attendance];
    const lines = attList.map(a => `${a.classId}: ${a.presentCount} присут., ${a.absentCount} отсут.`).join("\n");
    parts.push(`✅ Посещаемость принята:\n${lines}`);
  }

  if (result.result.incidentId && result.detections.incident) {
    parts.push(`🔴 Инцидент зафиксирован: ${result.detections.incident.summary}`);
  }

  if (result.result?.taskIds?.length) {
    parts.push(`✅ Принято`);
  }

  if (result.parsedAbsence && result.parsedAbsence.intent === "teacher_absence") {
    const replacement = result.result.replacement;
    if (!replacement || !replacement.recommendations || replacement.recommendations.length === 0) {
      parts.push(`⚠️ Не смог найти подходящих уроков для замены. Учитель не найден, либо такого урока нет в расписании (проверьте класс, день недели и номер урока).`);
    } else {
      const preferredRecommendation =
        replacement.recommendations.find((item) => {
          const candidate = item.candidates?.[0];
          return candidate && candidate.teacherId !== "curator_replacement";
        }) || replacement.recommendations[0];

      const rec = preferredRecommendation;
      const topCandidate = rec.candidates?.[0];
      if (topCandidate) {
        parts.push(`✅ Найдена замена: ${rec.entry.classId} (${rec.entry.lessonNumber} урок, ${rec.entry.subjectName}).\nКандидат: ${topCandidate.fullName}`);
      } else {
        parts.push(`⚠️ Карточка замены для ${rec.entry.classId} (${rec.entry.lessonNumber} урок) создана, но свободных кандидатов пока нет.`);
      }
      if (replacement.recommendations.length > 1) {
        parts.push(`(Создано еще ${replacement.recommendations.length - 1} карточек для других уроков)`);
      }
    }
  }

  return parts.length ? parts.join("\n\n") : null;
}

async function sendGreenApiMessage({ idInstance, apiTokenInstance, chatId, message }) {
  if (!idInstance || !apiTokenInstance || !chatId || !message) {
    return { skipped: true };
  }

  const response = await fetch(
    `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message,
      }),
    }
  );

  return response.json();
}

/**
 * Возвращает chatId (номер@c.us) по teacherId из PHONE_DIRECTORY.
 * Используется для отправки уведомлений о замене напрямую учителю.
 */
function getPhoneByTeacherId(teacherId) {
  for (const [phone, info] of Object.entries(PHONE_DIRECTORY)) {
    if (info.teacherId === teacherId) return phone;
  }
  return null;
}

/**
 * Возвращает chatId (номер@c.us) по роли из PHONE_DIRECTORY.
 * Используется, например, для отправки отчёта в столовую (role: "cafeteria").
 */
function getPhoneByRole(role) {
  for (const [phone, info] of Object.entries(PHONE_DIRECTORY)) {
    if (info.role === role) return phone;
  }
  return null;
}

module.exports = {
  mapWebhookToMessage,
  buildReplyFromResult,
  sendGreenApiMessage,
  getPhoneByTeacherId,
  getPhoneByRole,
};
