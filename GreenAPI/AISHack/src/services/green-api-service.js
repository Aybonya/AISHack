const { normalizeSpace } = require("../utils");

// Здесь можно прописать номера телефонов (в формате 7708... @c.us) и привязать к ним роли/имена.
const PHONE_DIRECTORY = {
  "77771234567@c.us": { role: "director", name: "Директор" },
  "77001112233@c.us": { role: "teacher", name: "Учитель Марат", teacherId: "marat" },
  "77009998877@c.us": { role: "facilities", name: "Завхоз" },
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
  const senderPhone = body?.senderData?.sender || "";
  const directoryInfo = PHONE_DIRECTORY[senderPhone] || {};

  return {
    text: extractTextFromWebhook(body),
    senderName:
      directoryInfo.name || body?.senderData?.senderName || body?.senderData?.senderContactName || body?.senderData?.chatName || null,
    senderRole: directoryInfo.role || "teacher",
    senderTeacherId: directoryInfo.teacherId || null,
    source: "green_api_webhook",
    chatId: body?.senderData?.chatId || null,
    externalMessageId: body?.idMessage || null,
    senderPhone,
  };
}

function buildReplyFromResult(result) {
  const parts = [];

  if (result.result.attendanceUpdateId && result.detections.attendance) {
    parts.push(
      `✅ Посещаемость принята: ${result.detections.attendance.classId} (${result.detections.attendance.presentCount} присут., ${result.detections.attendance.absentCount} отсут.)`
    );
  }

  if (result.result.incidentId && result.detections.incident) {
    parts.push(`🔴 Инцидент зафиксирован: ${result.detections.incident.summary}`);
  }

  if (result.result.taskIds && result.result.taskIds.length) {
    parts.push(`📝 Добавлено задач: ${result.result.taskIds.length}.`);
  }

  if (result.parsedAbsence && result.parsedAbsence.intent === "teacher_absence") {
    const replacement = result.result.replacement;
    if (!replacement || !replacement.recommendations || replacement.recommendations.length === 0) {
      parts.push(`⚠️ Не смог найти подходящих уроков для замены. Учитель не найден, либо такого урока нет в расписании (проверьте класс, день недели и номер урока).`);
    } else {
      const rec = replacement.recommendations[0];
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

module.exports = {
  mapWebhookToMessage,
  buildReplyFromResult,
  sendGreenApiMessage,
};
