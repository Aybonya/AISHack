const { admin, db } = require("../firebase");
const { invalidateCollectionCache } = require("./school-data-service");

async function createDirectorTask({
  title,
  description,
  assigneeId,
  assigneeName,
  dueAt,
  createdBy = "director_dashboard",
}) {
  const docRef = db.collection("director_tasks").doc();
  await docRef.set({
    title: title || "Задача",
    description: description || "",
    assigneeId: assigneeId || null,
    assigneeName: assigneeName || null,
    dueAt: dueAt || null,
    createdBy,
    status: "open",
    source: "dashboard_manual",
    messageId: "manual-task",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  invalidateCollectionCache("director_tasks");
  return { id: docRef.id };
}

async function updateDirectorTaskStatus({ taskId, status }) {
  const normalizedStatus =
    status === "done" ? "done" : status === "in_progress" ? "in_progress" : "open";

  await db.collection("director_tasks").doc(taskId).set(
    {
      status: normalizedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  invalidateCollectionCache("director_tasks");
}

async function updateIncidentCardStatus({ incidentId, status }) {
  const normalizedStatus =
    status === "resolved" ? "closed" : status === "in_progress" ? "in_progress" : "open";

  await db.collection("incident_cards").doc(incidentId).set(
    {
      status: normalizedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  invalidateCollectionCache("incident_cards");
}

async function createLinkedTaskFromIncident({ incidentId, title, description, location }) {
  const taskRef = db.collection("director_tasks").doc();
  const taskData = {
    title: title || "Устранить инцидент",
    description: description || "",
    location: location || "",
    assigneeId: null,
    assigneeName: "Завхоз",
    dueAt: null,
    createdBy: "ai_incident_trigger",
    status: "open",
    source: "ai_incident",
    linkedIncidentId: incidentId,
    messageId: `incident-${incidentId}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await taskRef.set(taskData);

  // Обновляем инцидент — записываем linkedTaskId
  await db.collection("incident_cards").doc(incidentId).set(
    { linkedTaskId: taskRef.id },
    { merge: true }
  );

  invalidateCollectionCache("director_tasks", "incident_cards");
  return { taskId: taskRef.id };
}

module.exports = {
  createDirectorTask,
  updateDirectorTaskStatus,
  updateIncidentCardStatus,
  createLinkedTaskFromIncident,
};
