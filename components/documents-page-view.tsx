"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { BookOpenText, FileClock, FileText, Info, Sparkles, Trash2, Upload } from "lucide-react";

import { DocumentOriginalModal } from "@/components/document-original-modal";
import { useAppState } from "@/components/providers/app-provider";
import { formatDateLabel, formatTime } from "@/lib/utils";

function describeDocument(docTitle: string) {
  const normalized = docTitle.toLowerCase();

  if (normalized.includes("76")) {
    return "Помогает AISana правильно собирать внутренние приказы, ответственных и контроль исполнения.";
  }

  if (normalized.includes("110")) {
    return "Нужен для официальных отчётов: структура, показатели, выводы и деловой стиль.";
  }

  if (normalized.includes("130")) {
    return "Подсказывает правила ведения школьной документации, посещаемости и журналов.";
  }

  if (normalized.includes("замещ")) {
    return "Используется, когда нужно оформить замену уроков без конфликтов по расписанию.";
  }

  if (normalized.includes("посещаем")) {
    return "Помогает собирать ежедневные данные по посещаемости и передавать их без путаницы.";
  }

  if (normalized.includes("шаблон приказа")) {
    return "Это базовый каркас школьного приказа, чтобы AISana быстрее собирала готовый документ.";
  }

  return "Этот файл используется AISana как пример формулировок и структуры для подготовки документов.";
}

export function DocumentsPageView() {
  const router = useRouter();
  const { state, uploadDocumentFile, deleteDocumentFile, deleteDocumentHistoryEntry } = useAppState();
  const [openDocTitle, setOpenDocTitle] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exampleFiles = useMemo(
    () =>
      Array.from(new Set(state.documentChunks.map((chunk) => chunk.docTitle))).map((docTitle) => ({
        docTitle,
        description: describeDocument(docTitle),
        originalText: state.documentChunks
          .filter((chunk) => chunk.docTitle === docTitle)
          .sort((left, right) => left.sectionTitle.localeCompare(right.sectionTitle, "ru"))
          .map((chunk) => `${chunk.sectionTitle}\n\n${chunk.content}`)
          .join("\n\n"),
      })),
    [state.documentChunks],
  );

  const historyFiles = useMemo(
    () =>
      state.documentAnswers.map((answer) => ({
        id: answer.id,
        docTitle: answer.docTitle,
        query: answer.query,
        summary: answer.summary ?? answer.bullets[0] ?? "AISana подготовила пояснение или черновик по этому документу.",
        createdAt: answer.createdAt,
        originalText: answer.originalText ?? answer.bullets.join("\n"),
        source: answer.source ?? "explain",
      })),
    [state.documentAnswers],
  );

  const openDocument = exampleFiles.find((document) => document.docTitle === openDocTitle) ?? null;
  const openHistoryDocument = historyFiles.find((file) => file.id === openHistoryId) ?? null;

  async function handleUploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    for (const file of files) {
      try {
        const text = await file.text();
        uploadDocumentFile(file.name, text);
      } catch {
        // Ignore unreadable files for now.
      }
    }

    event.target.value = "";
  }

  function openAISanaExplain(docTitle: string) {
    const prompt = `Объясни простыми словами, что это за файл и для чего он нужен: ${docTitle}`;
    router.push(`/chats/chat-aisana?prompt=${encodeURIComponent(prompt)}`);
  }

  return (
    <>
      <div className="h-full overflow-auto px-4 py-8 xl:px-6 xl:py-10">
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <section className="rounded-[30px] bg-[#10181d] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Файлы-примеры</div>
                  <div className="mt-2 text-2xl font-semibold text-white">База для размышления AISana</div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <input
                    accept=".txt,.md,.html,.csv,.json"
                    className="hidden"
                    multiple
                    onChange={handleUploadFiles}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#10271f] px-4 py-2.5 text-sm text-[#bdf6d7] transition hover:bg-[#133025]"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Upload className="size-4" />
                    Загрузить файл
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#121d22] px-3 py-2 text-sm text-[#c6d3d8]">
                    <BookOpenText className="size-4 text-[#73dba5]" />
                    {exampleFiles.length} файлов
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {exampleFiles.map((document) => (
                  <div
                    className="rounded-[24px] border border-white/[0.05] bg-[#121c21] px-5 py-5"
                    key={document.docTitle}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#17242b] text-[#73dba5]">
                            <FileText className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-white">{document.docTitle}</div>
                            <div className="mt-1 text-sm leading-6 text-[#8ea0a7]">{document.description}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
                          onClick={() => setOpenDocTitle(document.docTitle)}
                          type="button"
                        >
                          <FileText className="size-4" />
                          Открыть файл
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-[#10271f] px-4 py-2.5 text-sm text-[#bdf6d7] transition hover:bg-[#133025]"
                          onClick={() => openAISanaExplain(document.docTitle)}
                          type="button"
                        >
                          <Info className="size-4" />
                          Объяснить простыми словами
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-[#2a1421] px-4 py-2.5 text-sm text-[#ffc5dc] transition hover:bg-[#351a29]"
                          onClick={() => deleteDocumentFile(document.docTitle)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] bg-[#10181d] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Файлы-история</div>
                  <div className="mt-2 text-2xl font-semibold text-white">Что уже готовила AISana</div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-[#121d22] px-3 py-2 text-sm text-[#c6d3d8]">
                  <FileClock className="size-4 text-[#c896ff]" />
                  {historyFiles.length} в истории
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {historyFiles.length > 0 ? (
                  historyFiles.map((file) => (
                    <div className="rounded-[24px] border border-white/[0.05] bg-[#121c21] px-5 py-5" key={file.id}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#251a34] text-[#d2b2ff]">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-white">{file.docTitle}</div>
                          <div className="mt-2 text-sm leading-6 text-[#d7e0e3]">{file.summary}</div>
                          <div className="mt-3 rounded-[18px] bg-[#10181d] px-4 py-3 text-sm text-[#8ea0a7]">
                            Запрос: {file.query}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
                              onClick={() => setOpenHistoryId(file.id)}
                              type="button"
                            >
                              <FileText className="size-4" />
                              Открыть
                            </button>
                            {file.source === "workspace" ? (
                              <div className="inline-flex items-center rounded-full bg-[#10271f] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#bdf6d7]">
                                Сохранено из workspace
                              </div>
                            ) : null}
                            <button
                              className="inline-flex items-center gap-2 rounded-full bg-[#2a1421] px-4 py-2.5 text-sm text-[#ffc5dc] transition hover:bg-[#351a29]"
                              onClick={() => deleteDocumentHistoryEntry(file.id)}
                              type="button"
                            >
                              <Trash2 className="size-4" />
                              Удалить
                            </button>
                          </div>
                          <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[#71858c]">
                            {formatDateLabel(file.createdAt)} · {formatTime(file.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] bg-[#121c21] px-5 py-6 text-sm leading-7 text-[#8ea0a7]">
                    История пока пустая. Как только AISana начнёт разбирать документы и готовить приказы, они будут сохраняться здесь.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {openDocument ? (
        <DocumentOriginalModal
          docTitle={openDocument.docTitle}
          onClose={() => setOpenDocTitle(null)}
          originalText={openDocument.originalText}
        />
      ) : null}

      {openHistoryDocument ? (
        <DocumentOriginalModal
          docTitle={openHistoryDocument.docTitle}
          onClose={() => setOpenHistoryId(null)}
          originalText={openHistoryDocument.originalText}
        />
      ) : null}
    </>
  );
}
