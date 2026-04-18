const { db, admin } = require("../firebase");
const { toId, normalizeSpace } = require("../utils");
const { invalidateCollectionCache } = require("./school-data-service");

async function saveChatNote({ rawText, parsedNote, recommendations, source = "manual_chat", messageId = null, autoApprove = false }) {
  const noteRef = db.collection("chat_notes").doc();
  const caseDocs = [];

  recommendations.forEach((recommendation, index) => {
    const topCandidate = recommendation.candidates[0] || null;
    caseDocs.push({
      id: `${noteRef.id}_${index + 1}`,
      chatNoteId: noteRef.id,
      messageId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source,
      status: topCandidate ? (autoApprove ? "approved" : "suggested") : "no_candidate",
      absentTeacherId: parsedNote.teacherId || null,
      classId: recommendation.entry.classId,
      dayKey: recommendation.entry.dayKey,
      lessonNumber: recommendation.entry.lessonNumber,
      entryId: recommendation.entry.id,
      subjectName: recommendation.entry.subjectName,
      baseSubjectId: recommendation.entry.baseSubjectId,
      candidateTeacherId: topCandidate?.teacherId || null,
      candidateTeacherName: topCandidate?.fullName || null,
      candidateScore: topCandidate?.score || null,
      candidates: recommendation.candidates.slice(0, 5),
    });
  });

  await noteRef.set({
    rawText,
    normalizedText: normalizeSpace(rawText),
    parsedNote,
    messageId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source,
    recommendationCount: recommendations.length,
  });

  for (const caseDoc of caseDocs) {
    const { id, ...data } = caseDoc;
    await db.collection("replacement_cases").doc(id).set(data);
  }

  invalidateCollectionCache("chat_notes", "replacement_cases");

  return {
    noteId: noteRef.id,
    caseIds: caseDocs.map((item) => item.id),
  };
}

async function confirmReplacement({ caseId, approvedBy, candidateTeacherId }) {
  const caseRef = db.collection("replacement_cases").doc(caseId);
  const snapshot = await caseRef.get();
  if (!snapshot.exists) {
    throw new Error("Replacement case not found");
  }

  const data = snapshot.data();
  const chosenCandidate =
    data.candidates.find((candidate) => candidate.teacherId === candidateTeacherId) ||
    data.candidates[0] ||
    null;

  await caseRef.set(
    {
      status: chosenCandidate ? "approved" : "no_candidate",
      approvedBy: approvedBy || "system",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      candidateTeacherId: chosenCandidate?.teacherId || null,
      candidateTeacherName: chosenCandidate?.fullName || null,
      candidateScore: chosenCandidate?.score || null,
    },
    { merge: true }
  );

  if (chosenCandidate) {
    await db.collection("replacement_assignments").doc(`${caseId}_${toId(chosenCandidate.teacherId)}`).set({
      caseId,
      entryId: data.entryId,
      absentTeacherId: data.absentTeacherId,
      substituteTeacherId: chosenCandidate.teacherId,
      substituteTeacherName: chosenCandidate.fullName,
      classId: data.classId,
      dayKey: data.dayKey,
      lessonNumber: data.lessonNumber,
      subjectName: data.subjectName,
      baseSubjectId: data.baseSubjectId,
      status: "approved",
      approvedBy: approvedBy || "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  invalidateCollectionCache("replacement_cases", "replacement_assignments");

  return chosenCandidate;
}

module.exports = {
  saveChatNote,
  confirmReplacement,
};
