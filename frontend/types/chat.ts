export interface Source {
  title: string;
  url: string;
  score: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "thinking";
  content: string;
  lang: "ar" | "fr";
  sources?: Source[];
  warning?: string | null;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatAPIResponse {
  answer: string;
  lang: "ar" | "fr";
  sources: Source[];
  warning: string | null;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAPIRequest {
  query: string;
  history: ChatHistoryItem[];
}
