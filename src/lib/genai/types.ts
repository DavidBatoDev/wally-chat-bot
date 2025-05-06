// src/lib/genai/types.ts
export interface GenAIConfig {
  apiKey: string;
  modelName: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

export interface Attachment {
  type: string;
  name?: string;
  url?: string;
  data?: any;
}

export interface MessageMetadata {
  timestamp?: string | number;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  [key: string]: any;
}

export interface ChatRequest {
  messages: ChatMessage[];
  options?: ChatRequestOptions;
}

export interface ChatRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  conversationId?: string;
  retrievalOptions?: {
    prioritizeRecent?: boolean;
    includeMetadata?: boolean;
    messageLimit?: number;
    useContextCache?: boolean;
  };
}

export interface ChatResponse {
  message: string;
  error?: string;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DocumentAnalysisRequest {
  documentUrl: string;
  query: string;
  options?: {
    includeMetadata?: boolean;
    maxPages?: number;
  };
}

export interface DocumentAnalysisResponse {
  analysis: string;
  error?: string;
  metadata?: {
    pageCount: number;
    processedPages: number;
    documentType: string;
  };
}