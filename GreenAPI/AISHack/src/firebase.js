const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function readServiceAccount() {
  const explicitPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "firebase-service-account.json";

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const candidatePaths = path.isAbsolute(explicitPath)
    ? [explicitPath]
    : [
        path.join(process.cwd(), explicitPath),
        path.join(__dirname, "..", explicitPath),
        path.join(__dirname, "..", path.basename(explicitPath)),
      ];

  const resolvedPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(
      `Firebase service account file was not found. Tried: ${candidatePaths.join(", ")}. ` +
        "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  const serviceAccount = readServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.firestore();
}

module.exports = {
  admin,
  db: initializeFirebase(),
};
