"use client";

import { Check, Copy, Download, Expand, FileText, Save, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppState } from "@/components/providers/app-provider";
import type { AssistantWorkspaceDocument } from "@/lib/assistant/command-types";

function sanitizeWorkspaceHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function buildWordDocument(title: string, html: string) {
  return `<!DOCTYPE html>
<html lang="ru" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      @page { size: A4; margin: 2.5cm 2cm 2.5cm 3cm; }
      body { font-family: "Times New Roman", serif; font-size: 14pt; line-height: 1.5; color: #111; }
      h1, h2, h3 { text-align: center; margin: 0 0 18pt; font-weight: 700; }
      h1 { font-size: 16pt; text-transform: uppercase; }
      h2 { font-size: 14pt; }
      h3 { font-size: 14pt; }
      p { margin: 0 0 12pt; text-align: justify; text-indent: 1.25cm; }
      ul, ol { margin: 0 0 12pt 1.2cm; }
      li { margin-bottom: 6pt; }
      table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
      td, th { border: 1px solid #222; padding: 8pt; }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

export function AISanaWorkspace({
  workspace,
  compact = false,
}: {
  workspace: AssistantWorkspaceDocument;
  compact?: boolean;
}) {
  const { state, saveWorkspaceToHistory } = useAppState();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const cleanHtml = useMemo(() => sanitizeWorkspaceHtml(workspace.html), [workspace.html]);
  const isAlreadySaved = useMemo(
    () =>
      state.documentAnswers.some(
        (item) =>
          item.source === "workspace" &&
          item.docTitle === workspace.title &&
          item.fileName === workspace.fileName,
      ),
    [state.documentAnswers, workspace.fileName, workspace.title],
  );

  async function handleCopy() {
    const text = new DOMParser().parseFromString(cleanHtml, "text/html").body.innerText;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleDownload() {
    const content = buildWordDocument(workspace.title, cleanHtml);
    const blob = new Blob(["\ufeff", content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = workspace.fileName.endsWith(".doc") ? workspace.fileName : `${workspace.fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleSaveToHistory() {
    saveWorkspaceToHistory(workspace);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  const workspacePanel = (
    <aside
      className={`
        flex min-h-0 flex-col overflow-hidden border border-white/[0.08] bg-[linear-gradient(180deg,#16131d,#110f16)] shadow-[0_28px_70px_rgba(0,0,0,0.28)]
        ${compact ? "rounded-[1.45rem]" : "h-full rounded-[1.9rem]"}
      `}
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white">
            <FileText className="size-4 text-[#d8b8ff]" />
            <div className="truncate text-[1.02rem] font-semibold">{workspace.title}</div>
          </div>
          <div className="mt-1 truncate text-sm text-[#ab9cbc]">{workspace.summary}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
            onClick={handleSaveToHistory}
            type="button"
          >
            {saved || isAlreadySaved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved || isAlreadySaved ? "В истории" : "Сохранить в историю"}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
            onClick={() => setIsExpanded(true)}
            type="button"
          >
            <Expand className="size-4" />
            Открыть
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
            onClick={handleCopy}
            type="button"
          >
            <Copy className="size-4" />
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[#f3f0f6] px-4 py-2 text-sm font-medium text-[#17121d] transition hover:brightness-95"
            onClick={handleDownload}
            type="button"
          >
            <Download className="size-4" />
            Скачать
          </button>
        </div>
      </div>
      <div
        className={`overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(95,63,151,0.08),transparent_30%),#1a1820] px-6 py-6 ${compact ? "max-h-[620px]" : "flex-1"}`}
      >
        <div className="mx-auto min-h-full max-w-[820px] rounded-[0.6rem] bg-white px-[72px] py-[88px] text-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
          <div
            className="aisana-workspace-doc prose prose-neutral max-w-none prose-headings:font-serif prose-headings:font-bold prose-h1:mb-7 prose-h1:text-center prose-h1:text-[1.25rem] prose-h1:uppercase prose-h1:tracking-[0.04em] prose-h2:mb-5 prose-h2:mt-8 prose-h2:text-center prose-h2:text-[1.08rem] prose-h3:mb-4 prose-h3:mt-6 prose-h3:text-[1rem] prose-p:my-0 prose-p:mb-4 prose-p:indent-8 prose-p:text-justify prose-p:leading-7 prose-ol:my-4 prose-ol:pl-6 prose-ul:my-4 prose-ul:pl-6 prose-li:my-2 prose-table:my-6 prose-table:w-full prose-td:border prose-th:border prose-td:p-2 prose-th:p-2"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {workspacePanel}
      {isExpanded ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(7,5,12,0.72)] p-6 backdrop-blur-md">
          <div className="flex h-[min(94vh,980px)] w-[min(96vw,1400px)] flex-col overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,#16131d,#110f16)] shadow-[0_32px_100px_rgba(0,0,0,0.42)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
              <div className="min-w-0">
                <div className="truncate text-[1.1rem] font-semibold text-white">{workspace.title}</div>
                <div className="mt-1 text-sm text-[#ab9cbc]">{workspace.summary}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                  onClick={handleSaveToHistory}
                  type="button"
                >
                  {saved || isAlreadySaved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saved || isAlreadySaved ? "В истории" : "Сохранить в историю"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                  onClick={handleCopy}
                  type="button"
                >
                  <Copy className="size-4" />
                  {copied ? "Скопировано" : "Копировать"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-[#f3f0f6] px-4 py-2 text-sm font-medium text-[#17121d] transition hover:brightness-95"
                  onClick={handleDownload}
                  type="button"
                >
                  <Download className="size-4" />
                  Скачать
                </button>
                <button
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                  onClick={() => setIsExpanded(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(95,63,151,0.08),transparent_30%),#1a1820] px-8 py-8">
            <div className="mx-auto min-h-full max-w-[920px] rounded-[0.6rem] bg-white px-[84px] py-[96px] text-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
                <div
                  className="aisana-workspace-doc prose prose-neutral max-w-none prose-headings:font-serif prose-headings:font-bold prose-h1:mb-7 prose-h1:text-center prose-h1:text-[1.4rem] prose-h1:uppercase prose-h1:tracking-[0.04em] prose-h2:mb-5 prose-h2:mt-8 prose-h2:text-center prose-h2:text-[1.12rem] prose-h3:mb-4 prose-h3:mt-6 prose-h3:text-[1rem] prose-p:my-0 prose-p:mb-4 prose-p:indent-8 prose-p:text-justify prose-p:leading-7 prose-ol:my-4 prose-ol:pl-6 prose-ul:my-4 prose-ul:pl-6 prose-li:my-2 prose-table:my-6 prose-table:w-full prose-td:border prose-th:border prose-td:p-2 prose-th:p-2"
                  dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
