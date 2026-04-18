const admin = require("firebase-admin");

const serviceAccount = require("../firebase-service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function loadCollection(name) {
  const snapshot = await db.collection(name).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function formatCandidate(candidate) {
  const parts = [
    candidate.fullName,
    candidate.sameClassExperience ? `same class: ${candidate.sameClassExperience}h` : null,
    candidate.totalMatchingLoad ? `subject load: ${candidate.totalMatchingLoad}h` : null,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

async function run() {
  const [, , teacherId, dayKey, lessonNumberArg, classIdArg] = process.argv;

  if (!teacherId || !dayKey || !lessonNumberArg) {
    console.log(
      "Usage: node scripts/find-replacements.js <teacherId> <dayKey> <lessonNumber> [classId]"
    );
    process.exit(1);
  }

  const lessonNumber = toNumber(lessonNumberArg);
  if (!lessonNumber) {
    console.log("lessonNumber must be a number");
    process.exit(1);
  }

  const [teachers, scheduleEntries, teacherLoad] = await Promise.all([
    loadCollection("teachers"),
    loadCollection("schedule_entries"),
    loadCollection("teacher_load"),
  ]);

  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

  if (!teacherById.has(teacherId)) {
    console.log(`Teacher not found: ${teacherId}`);
    process.exit(1);
  }

  const slotEntries = scheduleEntries.filter(
    (entry) => entry.dayKey === dayKey && entry.lessonNumber === lessonNumber
  );

  const absentEntries = slotEntries.filter((entry) => {
    const matchesTeacher = Array.isArray(entry.teacherIds) && entry.teacherIds.includes(teacherId);
    const matchesClass = classIdArg ? entry.classId === classIdArg : true;
    return matchesTeacher && matchesClass;
  });

  if (!absentEntries.length) {
    console.log("No lessons found for this teacher in the selected slot.");
    process.exit(0);
  }

  const busyTeacherIds = new Set(
    slotEntries.flatMap((entry) => entry.teacherIds || [])
  );

  absentEntries.forEach((entry) => {
    const relevantLoads = teacherLoad.filter(
      (load) =>
        load.baseSubjectId === entry.baseSubjectId &&
        (!classIdArg || load.classId === entry.classId)
    );

    const candidateMap = new Map();
    relevantLoads.forEach((load) => {
      if (load.teacherId === teacherId || busyTeacherIds.has(load.teacherId)) {
        return;
      }
      const current = candidateMap.get(load.teacherId) || {
        teacherId: load.teacherId,
        fullName: teacherById.get(load.teacherId)?.fullName || load.teacherName,
        sameClassExperience: 0,
        totalMatchingLoad: 0,
      };
      current.totalMatchingLoad += Number(load.hours || 0);
      if (load.classId === entry.classId) {
        current.sameClassExperience += Number(load.hours || 0);
      }
      candidateMap.set(load.teacherId, current);
    });

    const candidates = Array.from(candidateMap.values()).sort((a, b) => {
      if (b.sameClassExperience !== a.sameClassExperience) {
        return b.sameClassExperience - a.sameClassExperience;
      }
      return b.totalMatchingLoad - a.totalMatchingLoad;
    });

    console.log("");
    console.log(
      `Absent slot: ${entry.dayKey} lesson ${entry.lessonNumber} | ${entry.classId} | ${entry.subjectName}`
    );
    console.log(`Time: ${entry.timeStart || "?"} - ${entry.timeEnd || "?"}`);
    console.log(`Teacher: ${teacherById.get(teacherId).fullName}`);
    console.log(`Base subject: ${entry.baseSubjectName}`);
    console.log("Candidates:");

    if (!candidates.length) {
      console.log("- No free matching teachers found in this slot.");
      return;
    }

    candidates.slice(0, 10).forEach((candidate) => {
      console.log(formatCandidate(candidate));
    });
  });
}

run().catch((error) => {
  console.error("Replacement search failed:", error);
  process.exit(1);
});
