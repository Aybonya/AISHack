"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { DocumentExplainCard } from "@/components/document-explain-card";
import { DocumentOriginalModal } from "@/components/document-original-modal";
import { useAppState } from "@/components/providers/app-provider";

export function DocumentsPageView() {
  const { state } = useAppState();
  const [openDocTitle, setOpenDocTitle] = useState<string | null>(null);

  const documents = useMemo(
    () =>
      Array.from(new Set(state.documentChunks.map((chunk) => chunk.docTitle))).map((docTitle) => ({
        docTitle,
        originalText: state.documentChunks
          .filter((chunk) => chunk.docTitle === docTitle)
          .sort((left, right) => left.sectionTitle.localeCompare(right.sectionTitle, "ru"))
          .map((chunk) => `${chunk.sectionTitle}\n\n${chunk.content}`)
          .join("\n\n"),
      })),
    [state.documentChunks],
  );

  const openDocument = documents.find((document) => document.docTitle === openDocTitle) ?? null;

  return (
    <>
      <div className="h-full overflow-auto px-4 py-8 xl:px-6 xl:py-10">
        <div className="mx-auto w-full max-w-4xl space-y-10">
          <DocumentExplainCard />

          <div className="space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Документы</div>
              <div className="mt-2 text-lg font-semibold text-white">Открыть оригинал</div>
            </div>

            <div className="rounded-[30px] bg-[#10181d] p-3">
              <div className="space-y-1">
                {documents.map((document) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-[#d7e0e3] transition hover:bg-white/[0.04]"
                    key={document.docTitle}
                    onClick={() => setOpenDocTitle(document.docTitle)}
                    type="button"
                  >
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#121d22] text-[#73dba5]">
                      <FileText className="size-4" />
                    </div>
                    <span className="text-sm">{document.docTitle}</span>
                  </button>
                ))}
              </div>
            </div>
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
    </>
  );
}
