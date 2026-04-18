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

  let query = db.collection(name);
  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return setCachedEntry(cacheKey, data);
}

async function loadSchoolData(options = {}) {
  const [teachers, scheduleEntries, teacherLoad, rooms, classes] = await Promise.all([
    loadCollection("teachers", options),
    loadCollection("schedule_entries", options),
    loadCollection("teacher_load", options),
    loadCollection("rooms", options),
    loadCollection("classes", options),
  ]);

  return { teachers, scheduleEntries, teacherLoad, rooms, classes };
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
