const admin = require("firebase-admin");

const serviceAccount = require("../firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const teachers = [
  {
    id: "nazhmadinov_marat",
    fullName: "Нажмадинов Марат",
    shortName: "Нажмадинов М.",
    subjects: ["алгебра", "геометрия"],
    homeroomClass: null,
    active: true,
  },
  {
    id: "esalina_aizada",
    fullName: "Есалина Айзада",
    shortName: "Есалина А.",
    subjects: ["алгебра", "геометрия"],
    homeroomClass: null,
    active: true,
  },
];

const classes = [
  {
    id: "7A",
    name: "7A",
    grade: 7,
    letter: "A",
    studentCount: 15,
    academicYear: "2025-2026",
  },
  {
    id: "8D",
    name: "8D",
    grade: 8,
    letter: "D",
    studentCount: 16,
    academicYear: "2025-2026",
  },
];

const rooms = [
  {
    id: "205",
    roomNumber: "205",
    floor: 2,
    capacity: 22,
    assignedClass: "7A",
    managerTeacher: "Есалина Айзада",
    description: "математика",
  },
  {
    id: "206",
    roomNumber: "206",
    floor: 2,
    capacity: 22,
    assignedClass: "7B",
    managerTeacher: "Нажмадинов Марат",
    description: "математика",
  },
];

async function importCollection(collectionName, docs) {
  for (const doc of docs) {
    const { id, ...data } = doc;
    await db.collection(collectionName).doc(id).set(data, { merge: true });
    console.log(`Imported ${collectionName}/${id}`);
  }
}

async function run() {
  await importCollection("teachers", teachers);
  await importCollection("classes", classes);
  await importCollection("rooms", rooms);
  console.log("Firestore import completed.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
