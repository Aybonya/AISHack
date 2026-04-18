"use client";

import { BookOpenText, CheckCircle2, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { DocumentOriginalModal } from "@/components/document-original-modal";
import { useAppState } from "@/components/providers/app-provider";
import type { DocumentAnswer, DocumentChunk } from "@/lib/types";

const presets = [
  "Объясни приказ простыми словами",
  "Можно ли ставить замену этому учителю?",
  "Как правильно отправлять посещаемость в столовую?",
];

export function DocumentExplainCard() {
  const { state, askDocument, sendMessage, createTask } = useAppState();
  const [query, setQuery] = useState("Объясни приказ простыми словами");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const answer: DocumentAnswer | null = state.documentAnswers[0] ?? null;

  const sourceChunks: DocumentChunk[] = answer
    ? state.documentChunks.filter(
        (chunk) => chunk.docTitle === answer.docTitle || answer.relevantChunkIds.includes(chunk.id),
      )
    : [];

  const originalText = sourceChunks
    .sort((left, right) => left.sectionTitle.localeCompare(right.sectionTitle, "ru"))
    .map((chunk) => `${chunk.sectionTitle}\n\n${chunk.content}`)
    .join("\n\n");

  function handleExplain() {
    if (!query.trim()) {
      return;
    }

    startTransition(() => {
      askDocument(query.trim());
      setSent(false);
      setTaskCreated(false);
    });
  }

  function handleSendToTeachers() {
    if (!answer || sent) {
      return;
    }

    const text = [answer.docTitle, ...answer.bullets.map((bullet) => `• ${bullet}`)].join("\n");

    sendMessage({
      chatId: "chat-general",
      senderId: "director-janar",
      senderType: "director",
      text,
    });
    setSent(true);
  }

  function handleCreateTask() {
    if (!answer || taskCreated) {
      return;
    }

    createTask({
      title: `Донести до учителей: ${answer.docTitle}`,
      description: answer.bullets.slice(0, 3).join(" "),
      assigneeUserId: "nazken",
      dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });
    setTaskCreated(true);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">AISana</div>
        <h1 className="text-[2.4rem] font-semibold tracking-tight text-white">Документы</h1>
        <p className="max-w-2xl text-base leading-7 text-[#8ea0a7]">
          Спроси AISana, и она объяснит приказ простыми словами без чтения длинных документов.
        </p>
      </div>

      <div className="rounded-[30px] bg-[#10181d] p-6">
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3 rounded-[24px] bg-[#121d22] px-5 py-4">
            <BookOpenText className="size-5 text-[#73dba5]" />
            <input
              className="w-full bg-transparent text-lg text-white outline-none placeholder:text-[#6b7d84]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Объясни приказ простыми словами..."
              value={query}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                className="rounded-full bg-white/[0.04] px-3 py-2 text-sm text-[#a9b8bd] transition hover:bg-white/[0.07] hover:text-white"
                key={preset}
                onClick={() => setQuery(preset)}
                type="button"
              >
                {preset}
              </button>
            ))}
          </div>

          <div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0] transition hover:bg-[#134232]"
              onClick={handleExplain}
              type="button"
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Объяснить
            </button>
          </div>
        </div>
      </div>

      {answer ? (
        <div className="rounded-[30px] bg-[#10181d] p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#10271f] px-3 py-1.5 text-sm text-[#bdf6d7]">
            <CheckCircle2 className="size-4" />
            Соответствует регламенту
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">{answer.docTitle}</div>

          <div className="mt-5 space-y-3">
            {answer.bullets.slice(0, 6).map((bullet) => (
              <div className="flex gap-3 text-base leading-7 text-[#d7e0e3]" key={bullet}>
                <span className="mt-3 size-1.5 shrink-0 rounded-full bg-[#73dba5]" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-[#121d22] px-5 py-5">
            <div className="text-sm text-[#8ea0a7]">Источник</div>
            <div className="mt-2 text-lg font-medium text-white">{answer.docTitle}</div>
            <div className="mt-4">
              <button
                className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
                onClick={() => setShowOriginal(true)}
                type="button"
              >
                Показать оригинал
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
              onClick={handleSendToTeachers}
              type="button"
            >
              <Send className="size-4" />
              {sent ? "Отправлено учителям" : "Отправить учителям"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#10271f] px-4 py-2.5 text-sm text-[#bdf6d7] transition hover:bg-[#133025]"
              onClick={handleCreateTask}
              type="button"
            >
              <Sparkles className="size-4" />
              {taskCreated ? "Задача создана" : "Создать задачу"}
            </button>
          </div>
        </div>
      ) : null}

      {showOriginal && answer ? (
        <DocumentOriginalModal
          docTitle={answer.docTitle}
          onClose={() => setShowOriginal(false)}
          originalText={originalText}
        />
      ) : null}
    </div>
  );
}
