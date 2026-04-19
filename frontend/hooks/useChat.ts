"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ChatAPIError, postChat } from "../lib/api";
import type { ChatHistoryItem, Conversation, Message } from "../types/chat";

const STORAGE_KEY = "9anouni-conversations";
const ACTIVE_CONVERSATION_KEY = "9anouni-active-conversation";
const LEGACY_STORAGE_KEY = "9anouni-ai-conversations";
const LEGACY_ACTIVE_CONVERSATION_KEY = "9anouni-ai-active-conversation";

type PersistedMessage = Omit<Message, "timestamp"> & { timestamp: string };
type PersistedConversation = Omit<Conversation, "messages" | "createdAt" | "updatedAt"> & {
  messages: PersistedMessage[];
  createdAt: string;
  updatedAt: string;
};

function containsArabicRatio(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  const arabicMatches = value.match(/[\u0600-\u06FF]/g) ?? [];
  return arabicMatches.length / value.length;
}

function detectLanguage(value: string): "ar" | "fr" {
  return containsArabicRatio(value) > 0.25 ? "ar" : "fr";
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function serializeConversations(conversations: Conversation[]): PersistedConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
  }));
}

function deserializeConversations(raw: string | null): Conversation[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PersistedConversation[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortConversations(
      parsed.map((conversation) => ({
        ...conversation,
        createdAt: new Date(conversation.createdAt),
        updatedAt: new Date(conversation.updatedAt),
        messages: (conversation.messages ?? []).map((message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        })),
      })),
    );
  } catch {
    return [];
  }
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [lastDetectedLang, setLastDetectedLang] = useState<"ar" | "fr">("fr");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Keep previously saved chats when migrating from older key names.
    if (!localStorage.getItem(STORAGE_KEY)) {
      const legacyConversations = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyConversations) {
        localStorage.setItem(STORAGE_KEY, legacyConversations);
      }
    }

    if (!localStorage.getItem(ACTIVE_CONVERSATION_KEY)) {
      const legacyActiveConversation = localStorage.getItem(LEGACY_ACTIVE_CONVERSATION_KEY);
      if (legacyActiveConversation) {
        localStorage.setItem(ACTIVE_CONVERSATION_KEY, legacyActiveConversation);
      }
    }

    const loadedConversations = deserializeConversations(localStorage.getItem(STORAGE_KEY));
    setConversations(loadedConversations);

    const activeId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    const activeConversation = loadedConversations.find((conversation) => conversation.id === activeId);

    if (activeConversation) {
      setConversationId(activeConversation.id);
      setMessages(activeConversation.messages);
      const latestLang = activeConversation.messages[activeConversation.messages.length - 1]?.lang;
      if (latestLang) {
        setLastDetectedLang(latestLang);
      }
    } else {
      const nextId = uuidv4();
      setConversationId(nextId);
      setMessages([]);
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, nextId);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeConversations(conversations)));
  }, [conversations, isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  }, [conversationId, isHydrated]);

  const upsertConversation = useCallback((id: string, nextMessages: Message[]) => {
    const now = new Date();
    setConversations((previous) => {
      const existing = previous.find((conversation) => conversation.id === id);
      const nextConversation: Conversation = {
        id,
        messages: nextMessages,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const remaining = previous.filter((conversation) => conversation.id !== id);
      return sortConversations([nextConversation, ...remaining]);
    });
  }, []);

  const sendMessage = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const lang = detectLanguage(trimmed);
      setLastDetectedLang(lang);
      setError(null);
      setIsLoading(true);

      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content: trimmed,
        lang,
        timestamp: new Date(),
      };

      const thinkingMessage: Message = {
        id: uuidv4(),
        role: "thinking",
        content: "",
        lang,
        timestamp: new Date(),
      };

      const baseMessages = messages.filter((message) => message.role !== "thinking");
      const optimisticMessages = [...baseMessages, userMessage, thinkingMessage];
      setMessages(optimisticMessages);

      const history: ChatHistoryItem[] = [...baseMessages, userMessage]
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));

      try {
        const response = await postChat({
          query: trimmed,
          history,
        });

        const assistantMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: response.answer,
          lang: response.lang,
          sources: response.sources,
          warning: response.warning,
          timestamp: new Date(),
        };

        const finalMessages = [...baseMessages, userMessage, assistantMessage];
        setMessages(finalMessages);
        upsertConversation(conversationId, finalMessages);
      } catch (caught) {
        const fallbackMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: "عذراً، حدث خطأ. / Désolé, une erreur s'est produite.",
          lang,
          warning: null,
          timestamp: new Date(),
        };

        const finalMessages = [...baseMessages, userMessage, fallbackMessage];
        setMessages(finalMessages);
        upsertConversation(conversationId, finalMessages);

        if (caught instanceof ChatAPIError && (caught.kind === "network" || caught.kind === "timeout")) {
          setError("backend_unreachable");
        } else {
          setError("request_failed");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, messages, upsertConversation],
  );

  const startNewConversation = useCallback(() => {
    const nextId = uuidv4();
    const now = new Date();
    setConversationId(nextId);
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setLastDetectedLang("fr");

    setConversations((previous) =>
      sortConversations([
        {
          id: nextId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        ...previous,
      ]),
    );
  }, []);

  const loadConversation = useCallback(
    (id: string) => {
      const target = conversations.find((conversation) => conversation.id === id);
      if (!target) {
        return;
      }

      setConversationId(id);
      setMessages(target.messages);
      setError(null);
      setIsLoading(false);

      const latestLang = target.messages[target.messages.length - 1]?.lang;
      if (latestLang) {
        setLastDetectedLang(latestLang);
      }
    },
    [conversations],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((previous) => previous.filter((conversation) => conversation.id !== id));

      if (conversationId !== id) {
        return;
      }

      const nextConversation = conversations.find((conversation) => conversation.id !== id);
      if (nextConversation) {
        setConversationId(nextConversation.id);
        setMessages(nextConversation.messages);
      } else {
        const nextId = uuidv4();
        setConversationId(nextId);
        setMessages([]);
      }
    },
    [conversationId, conversations],
  );

  const clearHistory = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }

    const nextId = uuidv4();
    setConversations([]);
    setConversationId(nextId);
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setLastDetectedLang("fr");
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const backendUnavailable = useMemo(() => error === "backend_unreachable", [error]);

  return {
    messages,
    conversations,
    isLoading,
    error,
    backendUnavailable,
    conversationId,
    lastDetectedLang,
    sendMessage,
    startNewConversation,
    loadConversation,
    deleteConversation,
    clearHistory,
    dismissError,
  };
}
