"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

interface InputBarProps {
  isLoading: boolean;
  seedValue?: string;
  onSubmit: (query: string) => Promise<void> | void;
}

const PLACEHOLDERS = ["اطرح سؤالاً قانونياً...", "Posez votre question juridique..."];
const MAX_CHARACTERS = 1000;

function detectLanguage(value: string): "ar" | "fr" {
  if (!value.trim()) {
    return "fr";
  }
  const arabicMatches = value.match(/[\u0600-\u06FF]/g) ?? [];
  return arabicMatches.length / value.length > 0.25 ? "ar" : "fr";
}

export default function InputBar({ isLoading, seedValue, onSubmit }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [detectedLang, setDetectedLang] = useState<"ar" | "fr">("fr");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((previous) => (previous + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDetectedLang(detectLanguage(value));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (!seedValue) {
      return;
    }
    const nextValue = seedValue.slice(0, MAX_CHARACTERS);
    setValue(nextValue);
    setDetectedLang(detectLanguage(nextValue));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [seedValue]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    textareaRef.current.style.height = "auto";
    const nextHeight = Math.min(textareaRef.current.scrollHeight, 152);
    textareaRef.current.style.height = `${nextHeight}px`;
  }, [value]);

  const canSend = useMemo(() => value.trim().length > 0 && value.length <= MAX_CHARACTERS && !isLoading, [value, isLoading]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) {
      return;
    }
    setValue("");
    await onSubmit(trimmed);
  };

  return (
    <div className="border-t border-[0.5px] border-[rgba(212,160,80,0.2)] bg-[linear-gradient(180deg,rgba(30,14,4,0.97),rgba(61,30,8,0.96))] px-4 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pt-3 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-end gap-3 rounded-xl border border-[0.5px] border-[var(--border-gold)] bg-[rgba(255,248,234,0.08)] p-3 shadow-lift">
        <div className="mb-2 shrink-0">
          <span
            className={`inline-flex rounded-full border border-[0.5px] border-[rgba(212,160,80,0.33)] bg-[rgba(212,160,80,0.2)] px-2 py-1 text-xs font-semibold text-[var(--text-light)] ${
              detectedLang === "ar" ? "font-ar" : "font-fr"
            }`}
            aria-label="Langue détectée / اللغة المكتشفة"
          >
            {detectedLang.toUpperCase()}
          </span>
        </div>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            maxLength={MAX_CHARACTERS}
            rows={1}
            onChange={(event) => setValue(event.target.value.slice(0, MAX_CHARACTERS))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            className="max-h-[152px] min-h-[40px] w-full resize-none overflow-y-auto rounded-md border border-[0.5px] border-[rgba(212,160,80,0.23)] bg-[rgba(255,253,248,0.12)] px-2 py-1 text-sm text-[var(--text-light)] outline-none placeholder:text-[rgba(255,248,234,0.45)] focus:border-[rgba(212,160,80,0.55)]"
            aria-label="Question juridique / سؤال قانوني"
          />

          {value.length > 300 ? (
            <p className="mt-1 text-right text-xs text-[var(--text-muted)]" aria-live="polite">
              {value.length}/{MAX_CHARACTERS}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[0.5px] border-transparent bg-[var(--accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Envoyer / إرسال"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--bg-deep)]" />
          ) : (
            <Send className="h-4 w-4 text-[var(--bg-deep)]" strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
