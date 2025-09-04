export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  kind: "text" | "buttons" | "inputs";
  content: string;
  body?: string;
}

export interface ChatOptions {
  temperature?: number;
  maxOutputTokens?: number;
  retrievalOptions?: Record<string, unknown>;
  streaming?: boolean;
  onStreamChunk?: (chunk: string) => Promise<void> | void;
}

export interface ChatRequest {
  messages: ChatMessage[];
  options?: ChatOptions;
}

export interface ChatResponse {
  messages: ChatMessage[];
}
