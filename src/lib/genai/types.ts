/* ------------------------------------------------------------------
   GenAI – Shared TypeScript Interfaces
   ------------------------------------------------------------------ */

/* ===== 0. Runtime config ======================================== */
export interface GenAIConfig {
  apiKey: string;
  modelName: string;
  maxOutputTokens: number;
  temperature: number;
}

/* ===== 1. Chat message envelope ================================= */

/**
 * All messages exchanged with the backend.
 *
 *  • `role`   → conversation perspective
 *  • `kind`   → how the UI should render it
 *  • `content`→ free text for kind='text'          (optional otherwise)
 *  • `body`   → JSON-encoded payload for rich kinds (stored in DB as text)
 */

export type ChatRole = "user" | "model";
export type ChatMessageKind = "text" | "file" | "file_card" | "buttons" | "inputs" | "action";
export interface ChatMessage {
  role: ChatRole;
  kind: ChatMessageKind;
  content: string;
  body?: string;  // JSON data for non-text messages
  metadata?: {
    timestamp?: number;
    [key: string]: any;
  };
}

/* ===== 2. Rich payload helper shapes (frontend only) ============ */

export interface MsgFilePayload {
  file_id: string;
  display_name?: string;
}

export interface MsgFileCardPayload {
  file_id: string;
  version_id: string;
  rev: number;
  title: string;
  thumb_url?: string;
}

export interface MsgButtonsPayload {
  prompt: string;
  buttons: { label: string; action: string; icon?: string }[];
}

export interface MsgInputsPayload {
  prompt: string;
  inputs: { key: string; label: string; type?: "text" | "number" }[];
}

export interface MsgActionPayload {
  action: string;
  values?: Record<string, string>;
  status?: "ok" | "error";
  meta?: any;
}

/* ===== 3. Attachments & metadata ================================ */

export interface Attachment {
  type: string; // mime-type or custom tag
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

/* ===== 4. Request / Response payloads =========================== */

export interface ChatRequest {
  messages: ChatMessage[];
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    streaming?: boolean;
    retrievalOptions?: {
      messageLimit?: number;
      prioritizeRecent?: boolean;
      includeMetadata?: boolean;
    };
  };
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

/**
 * The backend may return *one* or *many* assistant messages.
 * `messages` is preferred; `message` is kept for backward compatibility.
 */
export interface ChatResponse {
  message?: string;
  messages?: ChatMessage[];
  toolCall?: any;  // For function calling responses
  error?: string;
}
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/* ===== 5. Document-analysis helper types (unchanged) ============ */

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

/* ===== 6. Function calling tools ================================= */

export interface ButtonTool {
  name: "ui.buttons";
  args: {
    prompt: string;
    buttons: Array<{
      label: string;
      action: string;
    }>;
  };
}


export interface InputsTool {
  name: "ui.request_inputs";
  args: {
    prompt: string;
    inputs: Array<{
      key: string;
      label: string;
      type?: string;
    }>;
  };
}

export interface TranslateDocTool {
  name: "backend.translate_doc";
  args: {
    file_id: string;
    target_lang: string;
  };
}

export type FunctionCall = ButtonTool | InputsTool | TranslateDocTool;
