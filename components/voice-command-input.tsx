"use client";

import { Mic, LoaderCircle, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { Panel } from "@/components/panel";
import { useAppState } from "@/components/providers/app-provider";

const voicePresets = [
  "Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи",
  "Даулет, проверь кабинет 12 и замени парту до 3 урока",
  "Подготовьте сводку по питанию и отправьте в столовую",
];

export function VoiceCommandInput() {
  const { sendMessage } = useAppState();
  const [text, setText] = useState(voicePresets[0]);
  const [isPending, startTransition] = useTransition();

  return (
    <Panel className="space-y-4 bg-hero-radial">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-3 text-accent">
          <Mic className="size-5" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">Voice-to-task</div>
          <div className="text-sm text-muted">Симуляция голосовой команды директора</div>
        </div>
      </div>

      <textarea
        className="min-h-28 w-full rounded-[1.25rem] border border-border bg-[#091116] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-muted"
        onChange={(event) => setText(event.target.value)}
        placeholder="Продиктуйте команду..."
        value={text}
      />

      <div className="flex flex-wrap gap-2">
        {voicePresets.map((preset) => (
          <button
            className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground/75 transition hover:border-accent/30 hover:text-accent"
            key={preset}
            onClick={() => setText(preset)}
            type="button"
          >
            {preset}
          </button>
        ))}
      </div>

      <button
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent px-4 py-3 text-sm font-medium text-[#07210f] transition hover:brightness-105"
        onClick={() =>
          startTransition(() => {
            sendMessage({
              chatId: "chat-general",
              senderId: "director-janar",
              senderType: "director",
              text,
              kind: "voice",
            });
          })
        }
        type="button"
      >
        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Обработать как голосовую команду
      </button>
    </Panel>
  );
}
