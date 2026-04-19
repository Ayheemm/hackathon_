import type { ChatHistoryTurn, ChatResponse, RetrieveResponse, Source } from "../types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const REQUEST_TIMEOUT_MS = 30_000;

const NETWORK_ERROR_BILINGUAL =
  "الخادم غير متاح حالياً. تأكد من تشغيل الـ API على localhost:5000. / Serveur indisponible pour le moment. Vérifiez que l'API tourne sur localhost:5000.";

type ChatAPIErrorKind = "timeout" | "network" | "http" | "parse";

export interface Message {
  user: string;
  assistant: string;
}

export class ChatAPIError extends Error {
  kind: ChatAPIErrorKind;
  status?: number;

  constructor(kind: ChatAPIErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

function normalizeSource(raw: unknown): Source | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<Source>;
  if (typeof candidate.title !== "string" || typeof candidate.score !== "number") {
    return null;
  }

  return {
    title: candidate.title,
    source: typeof candidate.source === "string" ? candidate.source : "",
    article: typeof candidate.article === "string" ? candidate.article : "",
    url: typeof candidate.url === "string" ? candidate.url : "",
    score: candidate.score,
    excerpt: typeof candidate.excerpt === "string" ? candidate.excerpt : undefined,
  };
}

function normalizeChatResponse(data: unknown): ChatResponse | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate = data as {
    answer?: unknown;
    sources?: unknown;
    language?: unknown;
    error?: unknown;
    lang?: unknown;
    warning?: unknown;
  };

  if (typeof candidate.answer !== "string") {
    return null;
  }

  const normalizedSources = Array.isArray(candidate.sources)
    ? candidate.sources.map(normalizeSource).filter((item): item is Source => item !== null)
    : [];

  const language = candidate.language === "ar" || candidate.lang === "ar" ? "ar" : "fr";
  const error = typeof candidate.error === "string" ? candidate.error : typeof candidate.warning === "string" ? candidate.warning : null;

  return {
    answer: candidate.answer,
    sources: normalizedSources,
    language,
    error,
  };
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new ChatAPIError("http", `HTTP ${response.status}: backend response error`, response.status);
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ChatAPIError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ChatAPIError("timeout", "Request timed out after 30 seconds");
    }

    if (error instanceof TypeError) {
      throw new ChatAPIError("network", "Backend unreachable");
    }

    throw new ChatAPIError("parse", "Unexpected error while reading backend response");
  } finally {
    clearTimeout(timeout);
  }
}

function detectLanguageLocally(text: string): { language: "ar" | "fr"; rtl: boolean } {
  if (!text.trim()) {
    return { language: "fr", rtl: false };
  }
  const arabicMatches = text.match(/[\u0600-\u06FF]/g) ?? [];
  const isArabic = arabicMatches.length / text.length > 0.25;
  return { language: isArabic ? "ar" : "fr", rtl: isArabic };
}

export async function sendMessage(message: string, history: Message[]): Promise<ChatResponse> {
  try {
    const payload = await requestJson("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
      }),
    });

    const normalized = normalizeChatResponse(payload);
    if (!normalized) {
      throw new ChatAPIError("parse", "Invalid /chat response format from backend");
    }

    return normalized;
  } catch (error) {
    if (error instanceof ChatAPIError && (error.kind === "network" || error.kind === "timeout")) {
      return {
        answer: NETWORK_ERROR_BILINGUAL,
        sources: [],
        language: detectLanguageLocally(message).language,
        error: "backend_unreachable",
      };
    }

    return {
      answer: "حدث خطأ أثناء معالجة الطلب. / Une erreur est survenue pendant le traitement.",
      sources: [],
      language: detectLanguageLocally(message).language,
      error: "backend_error",
    };
  }
}

export async function retrieveChunks(message: string, k = 5): Promise<RetrieveResponse> {
  const payload = await requestJson("/retrieve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, k }),
  });

  if (!payload || typeof payload !== "object") {
    throw new ChatAPIError("parse", "Invalid /retrieve response format from backend");
  }

  const candidate = payload as { results?: unknown; language?: unknown };
  const results = Array.isArray(candidate.results)
    ? candidate.results
        .filter((item): item is RetrieveResponse["results"][number] => {
          if (!item || typeof item !== "object") {
            return false;
          }

          const row = item as {
            title?: unknown;
            source?: unknown;
            article?: unknown;
            url?: unknown;
            excerpt?: unknown;
            score?: unknown;
          };

          return (
            typeof row.title === "string" &&
            typeof row.source === "string" &&
            typeof row.article === "string" &&
            typeof row.url === "string" &&
            typeof row.excerpt === "string" &&
            typeof row.score === "number"
          );
        })
    : [];

  return {
    results,
    language: typeof candidate.language === "string" ? candidate.language : "fr",
  };
}

export async function detectLanguage(text: string): Promise<{ language: string; rtl: boolean }> {
  if (!text.trim()) {
    return { language: "fr", rtl: false };
  }

  try {
    const payload = await requestJson("/detect-language", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!payload || typeof payload !== "object") {
      throw new ChatAPIError("parse", "Invalid /detect-language response format from backend");
    }

    const candidate = payload as { language?: unknown; rtl?: unknown };
    const language = candidate.language === "ar" ? "ar" : "fr";
    const rtl = typeof candidate.rtl === "boolean" ? candidate.rtl : language === "ar";
    return { language, rtl };
  } catch {
    return detectLanguageLocally(text);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const payload = await requestJson("/health", {
      method: "GET",
    });

    if (!payload || typeof payload !== "object") {
      return false;
    }

    const candidate = payload as { status?: unknown };
    return candidate.status === "ok";
  } catch {
    return false;
  }
}

// Legacy adapter used by existing hook code during migration.
export async function postChat(payload: { query: string; history: { role: "user" | "assistant"; content: string }[] }) {
  const turns: ChatHistoryTurn[] = [];
  for (let index = 0; index < payload.history.length; index += 2) {
    const user = payload.history[index];
    const assistant = payload.history[index + 1];
    if (user?.role === "user" && assistant?.role === "assistant") {
      turns.push({ user: user.content, assistant: assistant.content });
    }
  }

  const response = await sendMessage(payload.query, turns);
  return {
    answer: response.answer,
    lang: response.language === "ar" ? "ar" : "fr",
    sources: response.sources,
    warning: response.error,
  };
}
