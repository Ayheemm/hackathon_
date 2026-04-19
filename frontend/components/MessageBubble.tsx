"use client";

import {
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Source } from "../types/chat";

import ConfidenceWarning from "./ConfidenceWarning";
import LanguageBadge from "./LanguageBadge";
import SourceCard from "./SourceCard";
import ThinkingDots from "./ThinkingDots";

const LEGAL_REFERENCE_REGEX = /(Article\s+\d+|الفصل\s+\d+)/gi;

function splitLegalReferences(text: string): ReactNode[] {
  return text.split(LEGAL_REFERENCE_REGEX).map((part, index) => {
    if (index % 2 === 1) {
      return (
        <span
          key={`${part}-${index}`}
          className="font-mono-legal rounded bg-[rgba(212,160,80,0.13)] px-1.5 py-0.5 text-sm text-[var(--text-dark)]"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function withHighlightedReferences(content: ReactNode): ReactNode {
  if (typeof content === "string") {
    return splitLegalReferences(content);
  }

  if (Array.isArray(content)) {
    return content.map((node, index) => <Fragment key={index}>{withHighlightedReferences(node)}</Fragment>);
  }

  if (isValidElement(content)) {
    const element = content as ReactElement<{ children?: ReactNode }>;
    return cloneElement(element, {
      children: withHighlightedReferences(element.props.children),
    });
  }

  return content;
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "thinking";
  content: string;
  lang: "ar" | "fr";
  sources?: Source[];
  warning?: string | null;
  timestamp: Date;
}

export default function MessageBubble({ role, content, lang, sources = [], warning, timestamp }: MessageBubbleProps) {
  const isArabic = lang === "ar";
  const isUser = role === "user";
  const isThinking = role === "thinking";
  const confidenceWarning = warning && warning !== "backend_unreachable" && warning !== "backend_error" ? warning : null;

  const locale = isArabic ? "ar-TN" : "fr-TN";
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

  const userRadius = isArabic ? "rounded-[18px_18px_18px_4px]" : "rounded-[18px_18px_4px_18px]";
  const assistantRadius = isArabic ? "rounded-[4px_18px_18px_18px]" : "rounded-[18px_18px_18px_4px]";

  const bubbleClass = isUser
    ? `bg-[linear-gradient(145deg,rgba(30,14,4,0.98),rgba(61,30,8,0.98))] text-[var(--text-light)] ${userRadius}`
    : `bg-[var(--surface-2)] border border-[0.5px] border-[var(--border-gold)] text-[var(--text-dark)] ${assistantRadius}`;

  return (
    <div className={`message-in flex w-full flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
      <div
        dir={isArabic ? "rtl" : "ltr"}
        className={`max-w-[88%] px-4 py-3 shadow-soft ${bubbleClass} ${isArabic ? "font-ar text-right" : "font-fr text-left"}`}
      >
        {isThinking ? (
          <ThinkingDots lang={lang} />
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-li:my-1 prose-headings:my-2 prose-strong:text-[var(--accent)]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="leading-7">{withHighlightedReferences(children)}</p>,
                li: ({ children }) => <li className="leading-7">{withHighlightedReferences(children)}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-[var(--accent)]">{withHighlightedReferences(children)}</strong>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {!isThinking ? (
        <div className={`flex items-center gap-2 text-xs text-[var(--ink-soft)] ${isUser ? "pr-1" : "pl-1"}`}>
          <LanguageBadge lang={lang} />
          <span>{timeLabel}</span>
        </div>
      ) : null}

      {!isUser && !isThinking && (confidenceWarning || sources.length > 0) ? (
        <div className="mt-1 flex w-full max-w-[88%] flex-col gap-2">
          {confidenceWarning ? <ConfidenceWarning message={confidenceWarning} lang={lang} /> : null}

          {sources.length > 0 ? (
            <details className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[rgba(212,160,80,0.08)] p-2">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text-dark)]">
                {isArabic ? `المصادر (${sources.length})` : `Sources (${sources.length})`}
              </summary>

              <div className="mt-2 space-y-2">
                {sources.map((source, index) => (
                  <SourceCard
                    key={`${source.url || source.title}-${index}`}
                    title={source.title}
                    sourceName={source.source}
                    article={source.article}
                    url={source.url}
                    score={source.score}
                    excerpt={source.excerpt}
                    animationDelayMs={index * 40}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
