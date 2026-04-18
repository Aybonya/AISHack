import type { DocumentChunk } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

function tokenize(value: string) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length > 2),
    ),
  );
}

export function retrieveRelevantChunks(chunks: DocumentChunk[], query: string, limit = 3) {
  const queryTokens = tokenize(query);

  return [...chunks]
    .map((chunk) => {
      const haystack = tokenize(
        `${chunk.docTitle} ${chunk.sectionTitle} ${chunk.content} ${chunk.tags.join(" ")}`,
      );
      const overlap = queryTokens.filter((token) => haystack.includes(token)).length;
      const docBoost = normalizeText(query).includes(normalizeText(chunk.docTitle)) ? 3 : 0;
      const keywordBoost = chunk.tags.some((tag) => normalizeText(query).includes(normalizeText(tag))) ? 2 : 0;
      return {
        chunk,
        score: overlap + docBoost + keywordBoost,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

function simplifySentence(sentence: string) {
  return sentence
    .replace("Учитель обязан", "Нужно")
    .replace("педагог сообщает", "сообщайте")
    .replace("Замещение урока допускается только", "Замену можно ставить только")
    .replace("Нельзя ставить замену", "Нельзя ставить замену")
    .replace("Классные руководители и учителя начального блока", "Классным руководителям")
    .replace("В сообщении нужно указать", "В сообщении указывайте");
}

export function summarizeDocumentChunks(query: string, chunks: DocumentChunk[]) {
  if (chunks.length === 0) {
    return [
      "По локальным документам прямого ответа не нашлось.",
      "Лучше уточнить вопрос и указать номер приказа или тему.",
    ];
  }

  const bullets = chunks.map((chunk) => {
    const firstSentence = chunk.content.split(".")[0]?.trim() ?? chunk.content;
    return simplifySentence(firstSentence);
  });

  if (normalizeText(query).includes("простыми словами")) {
    bullets.unshift("Коротко: документ задает, кто что должен сделать и в какие сроки.");
  }

  return Array.from(new Set(bullets)).slice(0, 4);
}
