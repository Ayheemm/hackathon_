import type { ChatAPIRequest, ChatAPIResponse } from "../types/chat";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const CHAT_ENDPOINT = `${API_BASE_URL}/api/chat`;
const REQUEST_TIMEOUT_MS = 30_000;

type ChatAPIErrorKind = "timeout" | "network" | "http" | "parse";

export class ChatAPIError extends Error {
  kind: ChatAPIErrorKind;
  status?: number;

  constructor(kind: ChatAPIErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

function isChatAPIResponse(payload: unknown): payload is ChatAPIResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ChatAPIResponse>;
  const validLang = candidate.lang === "ar" || candidate.lang === "fr";
  const validAnswer = typeof candidate.answer === "string";
  const validWarning =
    typeof candidate.warning === "string" || candidate.warning === null || candidate.warning === undefined;
  const validSources =
    Array.isArray(candidate.sources) &&
    candidate.sources.every(
      (source) =>
        source &&
        typeof source === "object" &&
        typeof source.title === "string" &&
        typeof source.url === "string" &&
        typeof source.score === "number",
    );

  return validLang && validAnswer && validWarning && validSources;
}

export async function postChat(payload: ChatAPIRequest): Promise<ChatAPIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new ChatAPIError("http", `HTTP ${response.status}: backend response error`, response.status);
    }

    const data: unknown = await response.json();
    if (!isChatAPIResponse(data)) {
      throw new ChatAPIError("parse", "Invalid response format from backend");
    }

    return {
      ...data,
      warning: data.warning ?? null,
    };
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
