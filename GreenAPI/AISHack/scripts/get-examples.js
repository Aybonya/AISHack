const admin = require('firebase-admin');
const path = require('path');
const sa = require(path.join(__dirname, '..', 'firebase-service-account.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

const { loadCollection } = require(path.join(__dirname, '..', 'src', 'services', 'school-data-service'));

(async () => {
  const scheduleEntries = await loadCollection('schedule_entries');
  const teachers = await loadCollection('teachers');
  
  const examples = [];
  
  // Find a few unique teachers who have classes
  const teacherIds = [...new Set(scheduleEntries.map(e => (e.teacherIds || [])[0]).filter(Boolean))];
  
  for (const tid of teacherIds.slice(0, 5)) {
    const teacher = teachers.find(t => t.id === tid);
    if (!teacher) continue;
    
    // get a random entry for this teacher
    const entry = scheduleEntries.find(e => (e.teacherIds || []).includes(tid));
    if (entry) {
       const dayRu = {
         'monday': 'понедельник',
         'tuesday': 'вторник',
         'wednesday': 'среду',
         'thursday': 'четверг',
         'friday': 'пятницу',
         'saturday': 'субботу'
       }[entry.dayKey];
       
       examples.push(`"${teacher.fullName} заболела, нужна замена в ${dayRu} на ${entry.lessonNumber} урок у ${entry.classId}" (Предмет: ${entry.subjectName})`);
    }
  }
  
  console.log(examples.join('\n\n'));
  process.exit(0);
})();
