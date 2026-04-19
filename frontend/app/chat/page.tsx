"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Plus, Trash } from "lucide-react";

import ChatWindow from "../../components/ChatWindow";
import InputBar from "../../components/InputBar";
import Sidebar from "../../components/Sidebar";
import { useChat } from "../../hooks/useChat";

export default function ChatPage() {
  const {
    messages,
    conversations,
    isLoading,
    conversationId,
    backendUnavailable,
    sendMessage,
    loadConversation,
    startNewConversation,
    deleteConversation,
    clearHistory,
    dismissError,
  } = useChat();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [seedValue, setSeedValue] = useState("");

  useEffect(() => {
    const syncSeedFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const query = params.get("q");
      if (query) {
        setSeedValue(query);
      }
    };

    syncSeedFromUrl();
    window.addEventListener("popstate", syncSeedFromUrl);
    return () => window.removeEventListener("popstate", syncSeedFromUrl);
  }, []);

  return (
    <div className="h-screen bg-[var(--bg-main)] text-[var(--text-dark)]">
      <Sidebar
        conversations={conversations}
        activeConversationId={conversationId}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectConversation={(id) => {
          setSeedValue("");
          loadConversation(id);
        }}
        onNewConversation={() => {
          setSeedValue("");
          startNewConversation();
        }}
        onDeleteConversation={(id) => {
          deleteConversation(id);
        }}
      />

      <div className="flex h-full flex-col md:ml-[280px]">
        <header className="flex h-16 items-center justify-between border-b border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-dark)] px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md p-2 text-[var(--text-light)] md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Ouvrir l'historique / فتح سجل المحادثات"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="font-mono-legal text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">9ANOUNI</h2>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/calculators"
              className="inline-flex items-center gap-1 rounded-md border border-[0.5px] border-[var(--border-gold)] bg-[rgba(212,160,80,0.07)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-light)] transition hover:bg-[rgba(212,160,80,0.13)]"
            >
              Mirath Calculator
            </Link>

            <button
              type="button"
              onClick={() => {
                setSeedValue("");
                startNewConversation();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[0.5px] border-[var(--border-gold)] bg-[rgba(212,160,80,0.07)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-light)] transition hover:bg-[rgba(212,160,80,0.13)]"
              aria-label="Nouvelle conversation / محادثة جديدة"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New
            </button>

            <button
              type="button"
              onClick={() => {
                setSeedValue("");
                clearHistory();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[0.5px] border-[var(--border-gold)] bg-[rgba(212,160,80,0.07)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-light)] transition hover:bg-[rgba(212,160,80,0.13)]"
              aria-label="Effacer l'historique / مسح السجل"
            >
              <Trash className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>
        </header>

        <main className="relative flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            onExampleSelect={(query) => setSeedValue(query)}
            backendUnavailable={backendUnavailable}
            onRetry={dismissError}
          />

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:left-[280px]">
            <div className="pointer-events-auto">
              <InputBar
                isLoading={isLoading}
                seedValue={seedValue}
                onSubmit={async (query) => {
                  setSeedValue("");
                  await sendMessage(query);
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
