"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import MessageBubble from "./MessageBubble";
import type { Message } from "../types/chat";

interface ChatWindowProps {
  messages: Message[];
  onExampleSelect: (query: string) => void;
  backendUnavailable: boolean;
  onRetry: () => void;
}

type ChatRow =
  | {
      id: string;
      type: "separator";
      label: string;
    }
  | {
      id: string;
      type: "message";
      message: Message;
    };

const AR_EXAMPLES = [
  "ما هي شروط عقد العمل في تونس؟",
  "ما هي حقوق المتهم في مرحلة الاستجواب؟",
  "كيف يتم تأسيس شركة ذات مسؤولية محدودة؟",
];

const FR_EXAMPLES = [
  "Quelles sont les conditions de validité d'un contrat de bail ?",
  "Comment contester une décision administrative ?",
  "Quels sont les délais de prescription en matière civile ?",
];

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function dateSeparatorLabel(date: Date): string {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ChatWindow({ messages, onExampleSelect, backendUnavailable, onRetry }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<ChatRow[]>(() => {
    const nextRows: ChatRow[] = [];
    let previousDateKey: string | null = null;

    for (const message of messages) {
      const timestamp = message.timestamp;
      const dateKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;

      if (dateKey !== previousDateKey) {
        nextRows.push({
          id: `separator-${dateKey}`,
          type: "separator",
          label: dateSeparatorLabel(timestamp),
        });
        previousDateKey = dateKey;
      }

      nextRows.push({
        id: message.id,
        type: "message",
        message,
      });
    }

    return nextRows;
  }, [messages]);

  const useVirtualized = rows.length > 100;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }

    if (useVirtualized) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length, useVirtualized, virtualizer]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 pb-40 pt-8">
        <div className="mx-auto max-w-4xl rounded-[18px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-2)] p-8 text-center shadow-lift">
          <Image
            src="/logo-gavel.png"
            alt="9anouni logo"
            width={40}
            height={40}
            className="mx-auto mb-4 h-10 w-10 object-contain"
            priority
            unoptimized
          />
          <h2 className="font-fr text-2xl font-semibold text-[var(--text-dark)]">9anouni</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Assistant juridique bilingue pour textes légaux tunisiens</p>
          <div className="mx-auto mt-4 h-px w-16 bg-[var(--border-gold)]" />

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-ar text-sm font-semibold text-[var(--text-dark)]">أمثلة عربية</h3>
              <div className="space-y-2">
                {AR_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onExampleSelect(example)}
                    className="w-full rounded-md border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[var(--surface-0)] px-3 py-2 text-right text-sm font-ar text-[var(--text-dark)] transition hover:border-[rgba(212,160,80,0.42)] hover:bg-[rgba(212,160,80,0.13)]"
                    aria-label="Utiliser cet exemple / استخدام هذا المثال"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-fr text-sm font-semibold text-[var(--text-dark)]">Exemples français</h3>
              <div className="space-y-2">
                {FR_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onExampleSelect(example)}
                    className="w-full rounded-md border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[var(--surface-0)] px-3 py-2 text-left text-sm font-fr text-[var(--text-dark)] transition hover:border-[rgba(212,160,80,0.42)] hover:bg-[rgba(212,160,80,0.13)]"
                    aria-label="Utiliser cet exemple / استخدام هذا المثال"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      {backendUnavailable ? (
        <div className="mx-4 mt-4 flex items-center justify-between rounded-lg border border-[0.5px] border-[rgba(166,90,0,0.38)] bg-[rgba(166,90,0,0.14)] px-3 py-2 text-sm text-[var(--state-warning)] md:mx-6">
          <span className="font-fr">الخادم غير متاح حالياً / Serveur non disponible</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-md border border-[0.5px] border-[rgba(166,90,0,0.4)] px-2 py-1 text-xs font-semibold hover:bg-[rgba(166,90,0,0.14)]"
            aria-label="Réessayer / إعادة المحاولة"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-4 pb-40 pt-6 md:px-6"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {useVirtualized ? (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const row = rows[virtualItem.index];

              return (
                <div
                  key={row.id}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: "10px",
                  }}
                >
                  {row.type === "separator" ? (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-0)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">{row.label}</span>
                    </div>
                  ) : (
                    <MessageBubble
                      role={row.message.role}
                      content={row.message.content}
                      lang={row.message.lang}
                      timestamp={row.message.timestamp}
                      sources={row.message.sources}
                      warning={row.message.warning}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
            {rows.map((row) =>
              row.type === "separator" ? (
                <div key={row.id} className="my-2 flex justify-center">
                  <span className="rounded-full border border-[0.5px] border-[var(--border-gold)] bg-[var(--surface-0)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">{row.label}</span>
                </div>
              ) : (
                <MessageBubble
                  key={row.id}
                  role={row.message.role}
                  content={row.message.content}
                  lang={row.message.lang}
                  timestamp={row.message.timestamp}
                  sources={row.message.sources}
                  warning={row.message.warning}
                />
              ),
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
