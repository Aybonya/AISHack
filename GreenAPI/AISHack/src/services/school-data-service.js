const { db } = require("../firebase");

const CACHE_TTL_MS = 30 * 1000;
const collectionCache = new Map();

function getCachedEntry(name) {
  const cached = collectionCache.get(name);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    collectionCache.delete(name);
    return null;
  }
  return cached.data;
}

function setCachedEntry(name, data) {
  collectionCache.set(name, {
    data,
    timestamp: Date.now(),
  });
  return data;
}

async function loadCollection(name, options = {}) {
  const {
    forceRefresh = false,
    limit = null,
  } = options;

  const cacheKey = limit ? `${name}::limit=${limit}` : name;

  if (!forceRefresh) {
    const cached = getCachedEntry(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    let query = db.collection(name);
    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return setCachedEntry(cacheKey, data);
  } catch (error) {
    console.error(`Error loading collection ${name}:`, error.message);
    // Если это ошибка авторизации, возвращаем пустой массив, чтобы не ломать всё приложение
    if (error.message.includes("UNAUTHENTICATED") || error.message.includes("credentials")) {
      return [];
    }
    throw error;
  }
}

const { loadDataFromExcel } = require("./excel-service");

async function loadSchoolData(options = {}) {
  try {
    const [teachers, scheduleEntries, teacherLoad, rooms, classes] = await Promise.all([
      loadCollection("teachers", options),
      loadCollection("schedule_entries", options),
      loadCollection("teacher_load", options),
      loadCollection("rooms", options),
      loadCollection("classes", options),
    ]);

    // Если база пустая, пробуем Excel
    if (teachers.length === 0 && scheduleEntries.length === 0) {
      return await loadDataFromExcel();
    }

    return { teachers, scheduleEntries, teacherLoad, rooms, classes };
  } catch (error) {
    console.error("Firebase load failed, falling back to Excel:", error.message);
    return await loadDataFromExcel();
  }
}

function invalidateCollectionCache(...names) {
  if (!names.length) {
    collectionCache.clear();
    return;
  }

  const prefixes = new Set(names);
  for (const key of collectionCache.keys()) {
    for (const prefix of prefixes) {
      if (key === prefix || key.startsWith(`${prefix}::`)) {
        collectionCache.delete(key);
      }
    }
  }
}

module.exports = {
  loadCollection,
  loadSchoolData,
  invalidateCollectionCache,
};
