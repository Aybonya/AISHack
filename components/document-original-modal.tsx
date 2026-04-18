"use client";

import { X } from "lucide-react";

export function DocumentOriginalModal({
  docTitle,
  originalText,
  onClose,
}: {
  docTitle: string;
  originalText: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[30px] bg-[#10181d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Оригинал документа</div>
            <div className="mt-2 text-2xl font-semibold text-white">{docTitle}</div>
          </div>
          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-[#c8d4d8] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 max-h-[65vh] overflow-auto rounded-[24px] bg-[#121d22] px-5 py-5">
          <div className="whitespace-pre-wrap text-base leading-8 text-[#d7e0e3]">
            {originalText || "Оригинальный текст недоступен."}
          </div>
        </div>
      </div>
    </div>
  );
}
