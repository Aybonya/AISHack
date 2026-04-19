"use client";

import {
  BadgeCheck,
  Check,
  FileText,
  LoaderCircle,
  Mic,
  MoreVertical,
  Pause,
  Phone,
  Play,
  Plus,
  Search,
  SendHorizontal,
  SmilePlus,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import type { AssistantClarificationPrompt } from "@/lib/assistant/command-types";
import { MessageBubble } from "@/components/message-bubble";
import { useAppState } from "@/components/providers/app-provider";
import { classifyMessage } from "@/lib/parser/classifyMessage";
import { extractAbsence } from "@/lib/parser/extractAbsence";
import { extractAttendance } from "@/lib/parser/extractAttendance";
import { cn, normalizeText } from "@/lib/utils";

const AISANA_CHAT_ID = "chat-aisana";
const MAX_VOICE_RECORDING_MS = 5 * 60 * 1000;
const AI_TYPING_INTERVAL_MS = 18;

type PendingVoiceDraft = {
  blob: Blob;
  url: string;
  durationSeconds: number;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function extractClarificationPrompt(value: unknown): AssistantClarificationPrompt | null {
  if (!value || typeof value !== "object" || !("clarification" in value)) {
    return null;
  }

  const prompt = (value as { clarification?: AssistantClarificationPrompt | null }).clarification;

  if (!prompt || typeof prompt !== "object" || !prompt.question) {
    return null;
  }

  return prompt;
}

export function ConversationView({ chatId }: { chatId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, sendMessage, hydrated, backendError, runAISanaConversation } = useAppState();
  const decodedChatId = decodeURIComponent(chatId);
  const chat = state.chats.find((item) => {
    if (item.id === decodedChatId) return true;
    if (decodedChatId === "chat-general" || decodedChatId === "120363407735237721@g.us") {
      return item.id === "chat-general" || item.id === "120363407735237721@g.us" || item.title === "Учителя и Директор";
    }
    if (decodedChatId === "chat-aisana") return item.id === "chat-aisana" || item.title === "Ассистент";
    return false;
  }) ?? null;

  const isAISanaChat = chat?.id === AISANA_CHAT_ID || (chat?.type === "direct" && chat?.title === "Ассистент");

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"text" | "voice">("text");
  const [isPending, startTransition] = useTransition();
  const [isAISanaWorking, setIsAISanaWorking] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isBureaucraticMode, setIsBureaucraticMode] = useState(false);
  const [typedMessageId, setTypedMessageId] = useState<string | null>(null);
  const [typedLength, setTypedLength] = useState(0);
  const [clarificationDraft, setClarificationDraft] = useState("");
  const [pendingVoiceDraft, setPendingVoiceDraft] = useState<PendingVoiceDraft | null>(null);
  const [isSendingVoiceDraft, setIsSendingVoiceDraft] = useState(false);
  const [isDraftPlaying, setIsDraftPlaying] = useState(false);

  const [draftPlaybackSeconds, setDraftPlaybackSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoPromptRef = useRef("");


  const participants = state.users.filter((user) => chat?.participants.includes(user.id));
  const teacherParticipants = participants.filter((user) => user.role === "teacher");
  const messages = state.messages
    .filter((message) => {
      // Прямое совпадение ID
      if (message.chatId === chat?.id) return true;
      
      // Обработка алиасов для группы "Учителя и Директор"
      const isGeneralAlias = chat?.id === "chat-general" || chat?.id === "120363407735237721@g.us";
      if (isGeneralAlias && (message.chatId === "chat-general" || message.chatId === "120363407735237721@g.us")) {
        return true;
      }

      // Обработка алиасов для Ассистента
      if (chat?.id === "chat-aisana" && message.chatId === "chat-aisana") {
        return true;
      }

      return false;
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const lastMessage = messages[messages.length - 1];
  const clarificationPrompt =
    lastMessage?.senderType === "ai" ? extractClarificationPrompt(lastMessage.metadata) : null;
  const latestAISanaTextMessage =
    isAISanaChat && lastMessage?.senderType === "ai" && lastMessage.kind === "text" ? lastMessage : null;
  const clarificationLocked = isAISanaChat && Boolean(clarificationPrompt) && !isAISanaWorking;
  const handleAutoPrompt = useEffectEvent((prompt: string) => {
    submitAISanaInput(prompt, "text");
    router.replace(pathname || `/chats/${chat?.id ?? AISANA_CHAT_ID}`);
  });

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current !== null) {
        window.clearInterval(recordingIntervalRef.current);
      }

      if (stopTimeoutRef.current !== null) {
        window.clearTimeout(stopTimeoutRef.current);
      }

      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      if (pendingVoiceDraft?.url) {
        URL.revokeObjectURL(pendingVoiceDraft.url);
      }

      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [pendingVoiceDraft]);

  useEffect(() => {
    const nextMessageId = latestAISanaTextMessage?.id ?? null;

    if (nextMessageId === typedMessageId) {
      return;
    }

    const resetTimeoutId = window.setTimeout(() => {
      setTypedMessageId(nextMessageId);
      setTypedLength(0);
    }, 0);

    return () => {
      window.clearTimeout(resetTimeoutId);
    };
  }, [latestAISanaTextMessage?.id, typedMessageId]);

  useEffect(() => {
    if (!latestAISanaTextMessage || typedMessageId !== latestAISanaTextMessage.id) {
      return;
    }

    if (typedLength >= latestAISanaTextMessage.text.length) {
      return;
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setTypedLength((current) => current + 1);
    }, AI_TYPING_INTERVAL_MS);

    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [latestAISanaTextMessage, typedLength, typedMessageId]);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typedLength, isAISanaWorking, clarificationLocked]);

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim() ?? "";

    if (!prompt) {
      lastAutoPromptRef.current = "";
      return;
    }

    if (!isAISanaChat || !chat || !hydrated || isAISanaWorking || clarificationLocked) {
      return;
    }

    if (prompt === lastAutoPromptRef.current) {
      return;
    }

    lastAutoPromptRef.current = prompt;
    handleAutoPrompt(prompt);
  }, [searchParams, isAISanaChat, chat, hydrated, isAISanaWorking, clarificationLocked]);

  useEffect(() => {
    const audio = draftAudioRef.current;

    if (!audio || !pendingVoiceDraft) {
      setIsDraftPlaying(false);
      setDraftPlaybackSeconds(0);
      return;
    }

    const handleTimeUpdate = () => {
      setDraftPlaybackSeconds(Math.floor(audio.currentTime));
    };

    const handleEnded = () => {
      setIsDraftPlaying(false);
      setDraftPlaybackSeconds(0);
      audio.currentTime = 0;
    };

    const handlePause = () => {
      setIsDraftPlaying(false);
    };

    const handlePlay = () => {
      setIsDraftPlaying(true);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [pendingVoiceDraft]);

  function handleViewportScroll() {
    const node = scrollViewportRef.current;

    if (!node) {
      return;
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 72;
  }

  async function toggleDraftPlayback() {
    const audio = draftAudioRef.current;

    if (!audio || !pendingVoiceDraft) {
      return;
    }

    if (isDraftPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setVoiceError("Не удалось воспроизвести голосовое сообщение.");
    }
  }

  function inferTeacherSenderId(text: string) {
    const normalized = normalizeText(text);
    const byMention = teacherParticipants.find(
      (teacher) =>
        normalized.includes(normalizeText(teacher.name)) ||
        normalized.includes(normalizeText(teacher.name.split(" ")[0] ?? "")),
    );

    if (byMention) {
      return byMention.id;
    }

    const attendance = extractAttendance(text);
    if (attendance) {
      const grade = Number(attendance.className.match(/\d+/)?.[0] ?? 0);
      const classTeacher = teacherParticipants.find((teacher) =>
        teacher.qualifications.some((qualification) =>
          normalizeText(qualification).includes(normalizeText(attendance.className)),
        ),
      );

      if (classTeacher) {
        return classTeacher.id;
      }

      if (grade <= 4) {
        const primaryTeacher = teacherParticipants.find((teacher) =>
          teacher.subjects.some((subject) => normalizeText(subject).includes("началь")),
        );

        if (primaryTeacher) {
          return primaryTeacher.id;
        }
      }
    }

    const absence = extractAbsence(text, state.users);
    if (absence) {
      const availableTeacher = teacherParticipants.find((teacher) => teacher.id !== absence.teacherUserId);
      if (availableTeacher) {
        return availableTeacher.id;
      }
    }

    return teacherParticipants[0]?.id ?? "aigerim";
  }

  async function askAISana(text: string, messageKind: "text" | "voice") {
    setIsAISanaWorking(true);

    try {
      const result = await runAISanaConversation({
        chatId: chat?.id ?? AISANA_CHAT_ID,
        text,
        kind: messageKind,
        bureaucraticMode: isBureaucraticMode,
      });

      if (result.navigateTo && result.navigateTo !== `/chats/${AISANA_CHAT_ID}`) {
        router.push(result.navigateTo);
      }
    } catch (error) {
      sendMessage({
        chatId: chat?.id ?? AISANA_CHAT_ID,
        senderId: "ai-assistant",
        senderType: "ai",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Не получилось выполнить запрос. Попробуй отправить его ещё раз.",
        kind: "text",
      });
    } finally {
      setIsAISanaWorking(false);
    }
  }

  function submitAISanaInput(text: string, messageKind: "text" | "voice" = "text") {
    const trimmedText = text.trim();

    if (!trimmedText || !chat) {
      return;
    }

    sendMessage({
      chatId: chat.id,
      senderId: "director-janar",
      senderType: "director",
      text: trimmedText,
      kind: messageKind,
    });

    setDraft("");
    void askAISana(trimmedText, messageKind);
  }

  function handleSend() {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || !chat) {
      return;
    }

    if (isAISanaChat) {
      submitAISanaInput(trimmedDraft, "text");
      return;
    }

    const intent = classifyMessage(trimmedDraft, state.users);
    const inferredSenderType = intent === "task" || intent === "generic" ? "director" : "teacher";
    const inferredSenderId =
      inferredSenderType === "director" ? "director-janar" : inferTeacherSenderId(trimmedDraft);

    startTransition(() => {
      sendMessage({
        chatId: chat.id,
        senderId: inferredSenderId,
        senderType: inferredSenderType,
        text: trimmedDraft,
        kind,
      });
      setDraft("");
      setKind("text");
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function submitClarificationFreeText() {
    const trimmedDraft = clarificationDraft.trim();

    if (!trimmedDraft) {
      return;
    }

    submitAISanaInput(trimmedDraft, "text");
    setClarificationDraft("");
  }

  function handleClarificationKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitClarificationFreeText();
    }
  }

  // Legacy fallback kept temporarily while the pending voice draft flow settles.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleVoiceTranscription(audioBlob: Blob) {
    if (!chat) {
      return;
    }

    const form = new FormData();
    form.append("audio", audioBlob, "aisana-voice-message.webm");

    const response = await fetch("/api/voice/transcribe", {
      method: "POST",
      body: form,
    });

    const payload = (await response.json()) as { text?: string; error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось распознать аудио.");
    }

    const transcript = String(payload.text ?? "").trim();

    if (!transcript) {
      throw new Error("Не удалось распознать аудио.");
    }

    sendMessage({
      chatId: chat.id,
      senderId: "director-janar",
      senderType: "director",
      text: transcript,
      kind: "voice",
      metadata: {
        durationMs: recordingSecondsRef.current * 1000,
      },
    });

    await askAISana(transcript, "voice");
  }

  async function transcribeVoiceDraft(audioBlob: Blob) {
    const form = new FormData();
    form.append("audio", audioBlob, "aisana-voice-message.webm");

    const response = await fetch("/api/voice/transcribe", {
      method: "POST",
      body: form,
    });

    const payload = (await response.json()) as { text?: string; error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось распознать аудио.");
    }

    const transcript = String(payload.text ?? "").trim();

    if (!transcript) {
      throw new Error("Не удалось распознать аудио.");
    }

    return transcript;
  }

  function clearPendingVoiceDraft() {
    draftAudioRef.current?.pause();
    setIsDraftPlaying(false);
    setDraftPlaybackSeconds(0);

    setPendingVoiceDraft((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });
  }

  async function sendPendingVoiceDraft(mode: "voice" | "text") {
    if (!pendingVoiceDraft || !chat) {
      return;
    }

    setIsSendingVoiceDraft(true);
    setVoiceError(null);

    try {
      const transcript = await transcribeVoiceDraft(pendingVoiceDraft.blob);

      if (mode === "voice") {
        sendMessage({
          chatId: chat.id,
          senderId: "director-janar",
          senderType: "director",
          text: "Голосовое сообщение",
          kind: "voice",
          metadata: {
            durationMs: pendingVoiceDraft.durationSeconds * 1000,
          },
        });

        clearPendingVoiceDraft();
        await askAISana(transcript, "voice");
        return;
      }

      clearPendingVoiceDraft();
      submitAISanaInput(transcript, "text");
    } catch (error) {
      setVoiceError(
        error instanceof Error && error.message ? error.message : "Не удалось отправить голосовое сообщение.",
      );
    } finally {
      setIsSendingVoiceDraft(false);
    }
  }

  async function startVoiceRecording() {
    if (!isAISanaChat || isAISanaWorking || isRecordingVoice || pendingVoiceDraft) {
      return;
    }

    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setIsRecordingVoice(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationSeconds = recordingSecondsRef.current;
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        if (recordingIntervalRef.current !== null) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

        if (stopTimeoutRef.current !== null) {
          window.clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }

        setIsRecordingVoice(false);

        if (audioBlob.size === 0 || durationSeconds === 0) {
          setVoiceError("Голосовое сообщение оказалось пустым.");
          return;
        }

        const nextDraft = {
          blob: audioBlob,
          url: URL.createObjectURL(audioBlob),
          durationSeconds,
        };

        recordingSecondsRef.current = durationSeconds;
        clearPendingVoiceDraft();
        setPendingVoiceDraft(nextDraft);
        setVoiceError(null);
      };

      recorder.start(250);

      recordingIntervalRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);

      stopTimeoutRef.current = window.setTimeout(() => {
        recorder.stop();
      }, MAX_VOICE_RECORDING_MS);
    } catch (error) {
      setVoiceError(
        error instanceof Error && error.message ? error.message : "Не удалось включить микрофон.",
      );
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  if (!hydrated && !chat) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#0b141a] px-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-white/[0.08] bg-[#111b21] px-8 py-10">
          <div className="text-lg font-medium text-white">Подключаем сообщения из GreenAPI</div>
          <div className="mt-2 text-sm leading-6 text-[#9fb0b6]">
            Дизайн уже открыт. Ждём реальную историю чатов, задачи и события из backend.
          </div>
        </div>
      </div>
    );
  }


  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center bg-transparent">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="size-12 animate-spin rounded-full border-4 border-[#c896ff]/[0.2] border-t-[#c896ff]" />
          </div>
          <p className="text-[#9fb0b6]">Загрузка переписки...</p>
        </div>
      </div>
    );
  }

  const headerTitle = isAISanaChat ? "Ассистент" : chat.title;
  const headerSubtitle = isAISanaChat
    ? "Исполнительный AI-ассистент директора"
    : `${participants.length} участников`;
  const sendDisabled = isPending || isAISanaWorking || clarificationLocked || isSendingVoiceDraft;
  const showVoiceRecorder = isAISanaChat && !draft.trim() && !pendingVoiceDraft;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b141a]">
      <div
        className={cn(
          "flex h-[72px] items-center justify-between border-b px-5",
          isAISanaChat
            ? "border-[#b685ff]/[0.16] bg-[linear-gradient(135deg,#221433,#13101d)]"
            : "border-white/[0.06] bg-[#202c33]",
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white",
              isAISanaChat
                ? "bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.38),rgba(255,255,255,0.08)_18%,transparent_34%),radial-gradient(circle_at_center,rgba(174,116,255,0.86),rgba(94,54,196,0.78)_58%,rgba(49,28,110,0.92)_100%)] shadow-[0_0_28px_rgba(142,97,255,0.28)]"
                : "bg-[#1f9b55]",
            )}
          >
            {isAISanaChat ? "АС" : chat.avatar}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-[1.18rem] font-medium text-white">{headerTitle}</div>
              {isAISanaChat ? (
                <BadgeCheck className="size-4 shrink-0 text-[#c896ff]" fill="currentColor" />
              ) : null}
            </div>
            <div className={cn("truncate text-sm", isAISanaChat ? "text-[#d4baff]" : "text-[#a7b5ba]")}>
              {headerSubtitle}
            </div>
          </div>
        </div>

        <div className={cn("flex items-center gap-2", isAISanaChat ? "text-[#eddfff]" : "text-[#d3dde0]")}>
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <Video className="size-5" />
          </button>
          <button
            className="hidden items-center gap-2 rounded-full border border-white/[0.09] px-4 py-2 text-base text-white transition hover:bg-white/[0.04] 2xl:inline-flex"
            type="button"
          >
            <Phone className="size-4" />
            Позвонить
          </button>
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <Search className="size-5" />
          </button>
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <MoreVertical className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div
          className={cn(
            "h-full min-h-0 px-5 py-5",
          )}
        >
          <div
            onScroll={handleViewportScroll}
            ref={scrollViewportRef}
            className={cn(
              "h-full min-h-0 overflow-y-auto rounded-[1.7rem] px-6 py-5",
              isAISanaChat ? "aisana-chat-bg aisana-chat-bg--assistant" : "aisana-chat-bg",
            )}
          >
            <div
              className={cn(
                "mx-auto mb-6 w-fit rounded-full px-4 py-1.5 text-sm",
                isAISanaChat ? "bg-[#2d1d43] text-[#f2e7ff]" : "bg-[#1f2c34] text-[#e9edef]",
              )}
            >
              Сегодня
            </div>

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  className={cn("flex", message.senderType === "director" ? "justify-end" : "justify-start")}
                  key={message.id}
                >
                  <MessageBubble
                    isStreaming={message.id === typedMessageId && typedLength < message.text.length}
                    message={message}
                    renderedText={message.id === typedMessageId ? message.text.slice(0, typedLength) : undefined}
                  />
                </div>
              ))}

              {isAISanaWorking ? (
                <div className="flex justify-start">
                  <div className="flex max-w-[520px] items-center gap-3 rounded-[1rem] border border-[#c69dff]/[0.18] bg-[linear-gradient(180deg,rgba(33,18,53,0.94),rgba(20,11,31,0.92))] px-4 py-3 text-[#f3ebff] shadow-[0_18px_46px_rgba(9,5,18,0.26)]">
                    <LoaderCircle className="size-4 animate-spin text-[#d9bbff]" />
                    <span className="text-sm">AISana обрабатывает запрос и готовит действия по сайту…</span>
                  </div>
                </div>
              ) : null}
              <div ref={bottomAnchorRef} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "border-t px-5 py-3",
          isAISanaChat
            ? "border-[#c08dff]/[0.14] bg-[linear-gradient(180deg,#18121f,#130f19)]"
            : "border-white/[0.06] bg-[#202c33]",
        )}
      >
        {clarificationLocked ? (
          <div className="mb-3 overflow-hidden rounded-[1.35rem] border border-[#c69dff]/[0.18] bg-[linear-gradient(180deg,rgba(34,20,53,0.98),rgba(19,12,30,0.97))] shadow-[0_22px_54px_rgba(9,5,18,0.34)] animate-[clarificationSheet_320ms_cubic-bezier(0.22,1,0.36,1)]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d7bcff]">
                Уточнение
              </div>
              <div className="mt-2 text-sm leading-6 text-[#ede1ff]">
                {clarificationPrompt?.intro ?? "Нужно быстро уточнить несколько деталей перед продолжением."}
              </div>
              <div className="mt-2 text-[1rem] font-medium leading-6 text-white">
                {clarificationPrompt?.question}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-4">
              {clarificationPrompt?.options.map((option) => (
                <button
                  className="rounded-full border border-[#cfabff]/[0.22] bg-[#271a39] px-3 py-2 text-sm text-[#f2e7ff] transition hover:border-[#ddbfff]/[0.34] hover:bg-[#34214c]"
                  key={option.id}
                  onClick={() => {
                    setClarificationDraft("");
                    submitAISanaInput(option.value, "text");
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
              {clarificationPrompt?.allowFreeText ? (
                <div className="mt-1 flex w-full flex-col gap-2">
                  <textarea
                    className="min-h-[92px] w-full resize-none rounded-[1rem] border border-white/[0.1] bg-[#181320] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[#bca7db] focus:border-[#cfa8ff]/[0.42]"
                    onChange={(event) => setClarificationDraft(event.target.value)}
                    onKeyDown={handleClarificationKeyDown}
                    placeholder={clarificationPrompt.freeTextLabel ?? "Введите свой вариант ответа"}
                    rows={3}
                    value={clarificationDraft}
                  />
                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[#cfabff]/[0.24] bg-[#2a1b3f] px-3.5 py-2 text-sm text-[#f2e7ff] transition hover:border-[#ddbfff]/[0.34] hover:bg-[#35204f] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!clarificationDraft.trim()}
                      onClick={submitClarificationFreeText}
                      type="button"
                    >
                      <SendHorizontal className="size-4" />
                      Отправить свой вариант
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isAISanaChat && !clarificationLocked ? (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition",
                isBureaucraticMode
                  ? "border-[#d5b0ff]/[0.28] bg-[linear-gradient(180deg,rgba(127,83,196,0.94),rgba(88,55,151,0.94))] text-white shadow-[0_14px_30px_rgba(70,37,120,0.24)]"
                  : "border-[#c69dff]/[0.14] bg-[#1a1423] text-[#cfb4f8] hover:border-[#c69dff]/[0.24] hover:bg-[#231934]",
              )}
              onClick={() => setIsBureaucraticMode((current) => !current)}
              type="button"
            >
              Бюрократический режим
            </button>
            {false ? (
              <div className="rounded-full border border-[#c69dff]/[0.12] bg-[#1a1423] px-3 py-1.5 text-sm text-[#cfb4f8]">
                Запись {formatDuration(recordingSeconds)}
              </div>
            ) : null}
            {voiceError ? <div className="text-sm text-[#ffb8d0]">{voiceError}</div> : null}
          </div>
        ) : null}

        {false && isAISanaChat && pendingVoiceDraft && !clarificationLocked ? (
          <div className="mb-3 rounded-[1.35rem] border border-[#c69dff]/[0.18] bg-[linear-gradient(180deg,rgba(34,20,53,0.98),rgba(19,12,30,0.97))] px-4 py-4 shadow-[0_22px_54px_rgba(9,5,18,0.34)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d7bcff]">
                  Голосовое сообщение
                </div>
                <div className="mt-1 text-sm text-[#ede1ff]">{formatDuration(pendingVoiceDraft.durationSeconds)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[#cfabff]/[0.24] bg-[#2a1b3f] px-3.5 py-2 text-sm text-[#f2e7ff] transition hover:border-[#ddbfff]/[0.34] hover:bg-[#35204f] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSendingVoiceDraft || isAISanaWorking}
                  onClick={() => void sendPendingVoiceDraft("voice")}
                  type="button"
                >
                  <Check className="size-4" />
                  Отправить
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-[#181320] px-3.5 py-2 text-sm text-[#d8c2f7] transition hover:border-white/[0.2] hover:bg-[#22192f] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSendingVoiceDraft || isAISanaWorking}
                  onClick={() => void sendPendingVoiceDraft("text")}
                  type="button"
                >
                  <FileText className="size-4" />
                  Отправить как текст
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[#ffb3d2]/[0.18] bg-[#2a1421] px-3.5 py-2 text-sm text-[#ffc5dc] transition hover:border-[#ffbfd9]/[0.28] hover:bg-[#351a29] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSendingVoiceDraft}
                  onClick={() => {
                    clearPendingVoiceDraft();
                    setVoiceError(null);
                  }}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  Удалить
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1rem] border border-white/[0.06] bg-[#120d18] px-3 py-3">
              <audio className="w-full" controls src={pendingVoiceDraft.url} />
            </div>
          </div>
        ) : null}

        {!clarificationLocked ? (
          <div className="flex items-center gap-3">
            <button
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#d3dde0] transition hover:bg-white/[0.06] hover:text-white"
              type="button"
            >
              <Plus className="size-6" strokeWidth={2.2} />
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {isAISanaChat && isRecordingVoice ? (
                <div className="flex h-16 items-center gap-4 rounded-full bg-[#232626] px-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <button
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#f2f4f5] transition hover:bg-white/[0.06]"
                    onClick={() => {
                      mediaRecorderRef.current?.stop();
                      audioChunksRef.current = [];
                      setVoiceError(null);
                    }}
                    type="button"
                  >
                    <Trash2 className="size-5" />
                  </button>
                  <div className="flex items-center gap-3 text-[#ff8db4]">
                    <span className="size-3 rounded-full bg-current shadow-[0_0_12px_rgba(255,141,180,0.55)]" />
                    <span className="text-[1.05rem] font-medium tracking-[0.02em] text-white">
                      {formatDuration(recordingSeconds)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2">
                    {Array.from({ length: 28 }, (_, index) => {
                      const heights = [4, 5, 6, 8, 10, 12, 9, 7, 5, 4];
                      const height = heights[(index + recordingSeconds) % heights.length] ?? 6;
                      return (
                        <span
                          className={cn(
                            "rounded-full bg-white/70 transition-all duration-300",
                            index % 7 === 0 ? "w-1.5" : "w-1",
                          )}
                          key={`recording-bar-${index}`}
                          style={{ height: `${height + (index % 4)}px` }}
                        />
                      );
                    })}
                  </div>
                  <Mic className="size-5 shrink-0 text-[#ff8db4]" />
                  <button
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#21c063] text-[#0d1a12] transition hover:brightness-105"
                    onClick={stopVoiceRecording}
                    type="button"
                  >
                    <Square className="size-4" fill="currentColor" />
                  </button>
                </div>
              ) : null}

              {isAISanaChat && pendingVoiceDraft ? (
                <>
                  <div className="flex h-16 items-center gap-4 rounded-full bg-[#232626] px-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <audio ref={draftAudioRef} src={pendingVoiceDraft.url} />
                    <button
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#f2f4f5] transition hover:bg-white/[0.06]"
                      disabled={isSendingVoiceDraft}
                      onClick={() => {
                        clearPendingVoiceDraft();
                        setVoiceError(null);
                      }}
                      type="button"
                    >
                      <Trash2 className="size-5" />
                    </button>
                    <button
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#f2f4f5] transition hover:bg-white/[0.06] disabled:opacity-60"
                      disabled={isSendingVoiceDraft}
                      onClick={() => void toggleDraftPlayback()}
                      type="button"
                    >
                      {isDraftPlaying ? (
                        <Pause className="size-5" fill="currentColor" />
                      ) : (
                        <Play className="size-5" fill="currentColor" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2">
                      {Array.from({ length: 28 }, (_, index) => {
                        const heights = [4, 5, 7, 10, 12, 9, 7, 5, 4, 6];
                        const progress = pendingVoiceDraft.durationSeconds
                          ? draftPlaybackSeconds / pendingVoiceDraft.durationSeconds
                          : 0;
                        const isActive = index / 28 <= progress;
                        const height = heights[index % heights.length] ?? 6;
                        return (
                          <span
                            className={cn(
                              "rounded-full transition-all duration-150",
                              index % 7 === 0 ? "w-1.5" : "w-1",
                              isActive ? "bg-[#25d366]" : "bg-white/55",
                            )}
                            key={`draft-bar-${index}`}
                            style={{ height: `${height + (index % 3)}px` }}
                          />
                        );
                      })}
                    </div>
                    <div className="shrink-0 text-[1.05rem] font-medium tracking-[0.02em] text-white">
                      {formatDuration(Math.max(0, pendingVoiceDraft.durationSeconds - draftPlaybackSeconds))}
                    </div>
                    <Mic className="size-5 shrink-0 text-[#ff8db4]" />
                    <button
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#21c063] text-[#0d1a12] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSendingVoiceDraft || isAISanaWorking}
                      onClick={() => void sendPendingVoiceDraft("voice")}
                      type="button"
                    >
                      <SendHorizontal className="size-5 fill-current" />
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-[#181320] px-3.5 py-2 text-sm text-[#d8c2f7] transition hover:border-white/[0.2] hover:bg-[#22192f] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSendingVoiceDraft || isAISanaWorking}
                      onClick={() => void sendPendingVoiceDraft("text")}
                      type="button"
                    >
                      <FileText className="size-4" />
                      Отправить как текст
                    </button>
                  </div>
                </>
              ) : null}

              {!isAISanaChat || (!isRecordingVoice && !pendingVoiceDraft) ? (
                <div
                  className={cn(
                    "flex h-14 flex-1 items-center gap-2 rounded-full px-4",
                    isAISanaChat
                      ? "border border-[#c69dff]/[0.18] bg-[linear-gradient(180deg,rgba(44,28,67,0.9),rgba(27,18,40,0.9))]"
                      : "bg-[#2a3942]",
                  )}
                >
              <button
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#cfd8dc] transition hover:bg-white/[0.06] hover:text-white"
                type="button"
              >
                <SmilePlus className="size-5" />
              </button>
                  <input
                    id={isAISanaChat ? "aisana-composer-input" : undefined}
                    className={cn(
                      "h-full flex-1 bg-transparent text-[1.02rem] outline-none",
                      isAISanaChat ? "text-white placeholder:text-[#bfa7dc]" : "text-white placeholder:text-[#9badb3]",
                    )}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={isAISanaChat ? "ареа для ввода текста" : "Введите сообщение"}
                    type="text"
                    value={draft}
                  />
              <button
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full transition",
                  draft.trim()
                    ? isAISanaChat
                      ? "bg-[#b684ff] text-[#13091e] hover:brightness-105"
                      : "bg-[#00a884] text-[#091319] hover:brightness-105"
                    : "text-[#cfd8dc] hover:bg-white/[0.06] hover:text-white",
                )}
                disabled={sendDisabled}
                onClick={
                  draft.trim()
                    ? handleSend
                    : showVoiceRecorder
                      ? () => void startVoiceRecording()
                      : () => setKind(kind === "voice" ? "text" : "voice")
                }
                type="button"
              >
                {draft.trim() ? (
                  <SendHorizontal className="size-5" />
                ) : showVoiceRecorder ? (
                  <Mic className="size-5" />
                ) : (
                  <Mic className={cn("size-5", kind === "voice" ? "text-[#25d366]" : "")} />
                )}
              </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
