const admin = require('firebase-admin');
const sa = require('./firebase-service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

const directorAi = require('./src/services/director-ai-service');
const schoolData = require('./src/services/school-data-service');

(async () => {
  const data = await schoolData.getSchoolData();
  const msg = {
    text: "Есалина Айзада заболела, нужна замена на вторник 3 урок у 9А",
    senderName: "Test",
    senderRole: "teacher",
    source: "test"
  };
  const res = await directorAi.processIncomingMessage({ message: msg, schoolData: data });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})();
