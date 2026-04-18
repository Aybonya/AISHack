import type { DocumentAnswer, DocumentChunk } from "@/lib/types";
import { createId } from "@/lib/utils";
import { retrieveRelevantChunks, summarizeDocumentChunks } from "@/lib/services/documents";

export function explainDocument(query: string, chunks: DocumentChunk[]): DocumentAnswer {
  const relevantChunks = retrieveRelevantChunks(chunks, query, 3);
  const bullets = summarizeDocumentChunks(query, relevantChunks);
  const docTitle = relevantChunks[0]?.docTitle ?? "Регламент школы";

  return {
    id: createId("doc-answer"),
    query,
    docTitle,
    bullets,
    relevantChunkIds: relevantChunks.map((chunk) => chunk.id),
    createdAt: new Date().toISOString(),
  };
}
