export interface Source {
  title: string;
  source: string;
  article: string;
  url: string;
  score: number;
  excerpt?: string;
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

export interface ChatResponse {
  answer: string;
  language: "ar" | "fr";
  sources: Source[];
  error: string | null;
}

export interface ChatHistoryTurn {
  user: string;
  assistant: string;
}

export interface RetrieveResult {
  title: string;
  source: string;
  article: string;
  url: string;
  excerpt: string;
  score: number;
}

export interface RetrieveResponse {
  results: RetrieveResult[];
  language: string;
}
