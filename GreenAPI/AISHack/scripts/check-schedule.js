const admin = require('firebase-admin');
const path = require('path');
const sa = require(path.join(__dirname, '..', 'firebase-service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

const { loadCollection } = require(path.join(__dirname, '..', 'src', 'services', 'school-data-service'));

(async () => {
  const scheduleEntries = await loadCollection('schedule_entries');
  const teachers = await loadCollection('teachers');
  
  const teacher = teachers.find(t => t.fullName === 'Есалина Айзада');
  if (!teacher) {
    console.log("Teacher not found!");
    process.exit(1);
  }
  
  const teacherEntries = scheduleEntries.filter(e => (e.teacherIds || []).includes(teacher.id));
  console.log("Есалина Айзада schedule:");
  teacherEntries.forEach(e => {
    console.log(`${e.dayKey} - lesson ${e.lessonNumber} - class ${e.classId} - ${e.subjectName}`);
  });
  
  process.exit(0);
})();
