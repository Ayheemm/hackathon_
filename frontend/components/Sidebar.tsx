"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";

import type { Conversation } from "../types/chat";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

function conversationTitle(conversation: Conversation): string {
  const firstUserMessage = conversation.messages.find((message) => message.role === "user")?.content;
  if (!firstUserMessage) {
    return "Nouvelle conversation / محادثة جديدة";
  }
  return firstUserMessage.length > 40 ? `${firstUserMessage.slice(0, 40)}...` : firstUserMessage;
}

function relativeTimeLabel(date: Date, lang: "ar" | "fr"): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (minutes < 60) {
    return lang === "ar" ? `منذ ${minutes} دقيقة` : `il y a ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (lang === "ar") {
      if (hours === 1) return "منذ ساعة";
      if (hours === 2) return "منذ ساعتين";
      return `منذ ${hours} ساعات`;
    }
    return `il y a ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  if (lang === "ar") {
    if (days === 1) return "منذ يوم";
    if (days === 2) return "منذ يومين";
    return `منذ ${days} أيام`;
  }
  return `il y a ${days} j`;
}

function SidebarContent({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: Omit<SidebarProps, "mobileOpen" | "onCloseMobile">) {
  return (
    <div className="flex h-full flex-col bg-[var(--bg-deep)] text-[var(--text-light)]">
      <div className="border-b border-[0.5px] border-[var(--border-gold)] px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="rounded-[10px] bg-[var(--bg-mid)] p-2">
            <Image src="/logo-gavel.svg" alt="9anouni logo" width={36} height={36} className="h-9 w-9 object-contain" priority />
          </div>
          <h1 className="font-fr text-lg font-semibold text-[var(--text-light)]">9anouni / قانوني</h1>
        </div>
        <button
          type="button"
          onClick={onNewConversation}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--text-dark)] transition hover:opacity-90"
          aria-label="Nouvelle conversation / محادثة جديدة"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New conversation
        </button>

        <div className="mt-2 grid gap-2">
          <Link
            href="/calculators"
            className="inline-flex items-center justify-center rounded-lg border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[rgba(212,160,80,0.07)]"
          >
            Mirath Calculator
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-1">
          {conversations.map((conversation) => {
            const lang =
              conversation.messages.find((message) => message.role === "user")?.lang ??
              conversation.messages[conversation.messages.length - 1]?.lang ??
              "fr";
            const isActive = conversation.id === activeConversationId;

            return (
              <li key={conversation.id} className="sidebar-item-in">
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-[rgba(212,160,80,0.2)] border-l-2 border-l-[var(--accent)] bg-[rgba(212,160,80,0.13)] shadow-soft"
                        : "border-transparent bg-transparent hover:border-[rgba(212,160,80,0.2)] hover:bg-[rgba(212,160,80,0.07)]"
                    }`}
                    aria-label="Ouvrir la conversation / فتح المحادثة"
                  >
                    <p className="truncate text-sm font-medium text-[var(--text-light)]">{conversationTitle(conversation)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{relativeTimeLabel(conversation.updatedAt, lang)}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteConversation(conversation.id)}
                    className="absolute right-2 top-2 rounded p-1 text-[var(--text-muted)] opacity-0 transition hover:bg-[rgba(212,160,80,0.07)] hover:text-[var(--text-light)] group-hover:opacity-100"
                    aria-label="Supprimer / حذف"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-[0.5px] border-[var(--border-gold)] px-4 py-3">
        <p className="font-fr text-xs text-[var(--text-muted)]">Données issues du Ministère de la Justice TN</p>
      </div>
    </div>
  );
}

export default function Sidebar({
  conversations,
  activeConversationId,
  mobileOpen,
  onCloseMobile,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: SidebarProps) {
  return (
    <>
      <aside
        className="hidden h-screen w-[280px] shrink-0 md:fixed md:inset-y-0 md:left-0 md:block"
        style={{ borderRight: "0.5px solid rgba(212, 160, 80, 0.2)" }}
      >
        <SidebarContent
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          onNewConversation={onNewConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </aside>

      <div className={`fixed inset-0 z-40 bg-[rgba(212,160,80,0.2)] transition md:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button className="h-full w-full" onClick={onCloseMobile} aria-label="Fermer / إغلاق" />
      </div>

      <aside
        className={`fixed inset-x-0 bottom-0 z-50 h-[78vh] rounded-t-2xl border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-deep)] shadow-soft transition-transform md:hidden ${
          mobileOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[0.5px] border-[var(--border-gold)] px-4 py-3">
          <p className="font-fr text-sm font-semibold text-[var(--text-light)]">Conversations</p>
          <button onClick={onCloseMobile} className="rounded p-1 text-[var(--text-muted)]" aria-label="Fermer / إغلاق">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <SidebarContent
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            onSelectConversation(id);
            onCloseMobile();
          }}
          onNewConversation={() => {
            onNewConversation();
            onCloseMobile();
          }}
          onDeleteConversation={onDeleteConversation}
        />
      </aside>
    </>
  );
}
