require("dotenv").config();
const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.join(__dirname, "..", "firebase-service-account.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

(async () => {
  const snap = await db.collection("replacement_cases").get();
  if (snap.size === 0) {
    console.log("replacement_cases уже пуст");
    process.exit(0);
  }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log("Удалено:", snap.size, "записей из replacement_cases ✅");
  process.exit(0);
})();
