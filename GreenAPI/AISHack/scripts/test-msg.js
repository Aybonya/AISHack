const admin = require('firebase-admin');
const sa = require('../firebase-service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

const directorAi = require('../src/services/director-ai-service');
const schoolData = require('../src/services/school-data-service');

(async () => {
  const data = await schoolData.loadSchoolData();
  const msg = {
    text: "Я заболела в пятницу, не смогу выйти. Поставьте, пожалуйста, замену на мои уроки английского языка и IELTS.",
    senderName: "Ақырап А.",
    senderRole: "teacher",
    senderTeacherId: "akyrap_akerke",
    source: "test"
  };
  const res = await directorAi.processIncomingMessage({ message: msg, schoolData: data });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})();
