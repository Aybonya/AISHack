function normalizeSpace(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClassId(value) {
  return normalizeSpace(value)
    .toUpperCase()
    .replace(/А/g, "A")
    .replace(/В/g, "B")
    .replace(/С/g, "C")
    .replace(/Д/g, "D")
    .replace(/Е/g, "E")
    .replace(/\s+/g, "");
}

function parseLessonNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDateKey(dateValue = new Date()) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function transliterate(value) {
  const map = {
    а: "a",
    ә: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    қ: "k",
    л: "l",
    м: "m",
    н: "n",
    ң: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ұ: "u",
    ү: "u",
    ф: "f",
    х: "h",
    һ: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    і: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return normalizeSpace(value)
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

function toId(value) {
  return transliterate(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function startOfDay(dateValue = new Date()) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateValue = new Date()) {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date;
}

module.exports = {
  normalizeSpace,
  normalizeClassId,
  parseLessonNumber,
  parseDateKey,
  transliterate,
  toId,
  startOfDay,
  endOfDay,
};
