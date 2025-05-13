// src/lib/genai/text.ts
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "./types";

/* ── 0. Tool definitions ───────────────────────────── */
const tools = [
  {
    name: "ui.buttons",
    description: "Ask the user to pick the next action",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        buttons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              action: { type: "string" },
            },
          },
        },
      },
      required: ["prompt", "buttons"],
    },
  },
  {
    name: "ui.request_inputs",
    description: "Ask the user to fill missing placeholders",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        inputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
      required: ["prompt", "inputs"],
    },
  },
  {
    name: "backend.translate_doc",
    description: "Request the server to translate a file object",
    parameters: {
      type: "object",
      properties: {
        file_id: { type: "string" },
        target_lang: { type: "string" },
      },
      required: ["file_id", "target_lang"],
    },
  },
] as const;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Missing environment variable GEMINI_API_KEY");

const ai = new GoogleGenAI({ apiKey });

/* ── constants ─────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are Wally, a helpful document assistant. You help users with their documents, including understanding, 
translating, or extracting information from documents. Be concise, friendly, and helpful.

When appropriate, use the following tools:
1. ui.buttons - Use this when you want the user to choose between distinct actions. 
   For example: "What would you like to do with this document?" with buttons like "Translate", "Summarize", "Extract Data".

2. ui.request_inputs - Use this when you need specific information from the user.
   For example: Ask for target language when translating, or specific data fields to extract.

3. backend.translate_doc - Call this when ready to translate a document after having all needed info.

If the user uploads a document, acknowledge it and offer actions using ui.buttons.
When a function for document upload is needed, use the action "upload_document" to trigger the interface.`;

const TOKENS_PER_CHAR = 0.25;
const MAX_CONTEXT_TOKENS = 30_000; // For Gemini 2.0 Flash
const RESERVED_RESPONSE_TOKENS = 2_048;

/* ── helpers (same, but with ?? \"\" safety) ───────────────────── */
const estimateTokenCount = (t: string) => Math.ceil((t?.length || 0) * TOKENS_PER_CHAR);

/* Filter to TEXT messages only */
const isTextMsg = (m: ChatMessage) => m.kind === "text" && m.content;

/**
 * Efficiently trim messages to fit within token limits while preserving
 * conversation coherence and maximizing context
 *
 * Enhanced for database-backed conversations with smarter trimming strategies
 */
function getMessagesWithinTokenLimit(messages: ChatMessage[]): ChatMessage[] {
  const systemTokens = estimateTokenCount(SYSTEM_PROMPT);
  const available =
    MAX_CONTEXT_TOKENS - systemTokens - RESERVED_RESPONSE_TOKENS;
  const pool = messages.filter(isTextMsg);

  // Always include final query
  const last = messages[messages.length - 1];
  const lastTokens = estimateTokenCount(last.content ?? "");

  let remaining = available - lastTokens;
  const keep: ChatMessage[] = [];
  const prior = messages.slice(0, -1);

  // Identify question→answer pairs
  const critical = new Set<number>();
  for (let i = 0; i < prior.length; i++) {
    if (prior[i].role === "user" && prior[i + 1]?.role === "model") {
      critical.add(i);
      critical.add(i + 1);
    }
  }

  // Score each prior message
  const scored = prior
    .map((msg, i) => {
      const t = estimateTokenCount(msg.content ?? "");
      const recency = i / prior.length;
      const sizeScore = 1 - t / MAX_CONTEXT_TOKENS;
      const roleScore = msg.role === "user" ? 1.2 : 1.0;
      const score = recency * 0.6 + sizeScore * 0.2 + roleScore * 0.2;
      return { msg, tokens: t, score, idx: i };
    })
    .sort((a, b) => b.score - a.score);

  // First: force-add any critical pairs
  const added = new Set<number>();
  for (const { msg, tokens, idx } of scored) {
    if (critical.has(idx) && tokens <= remaining) {
      keep.push(msg);
      added.add(idx);
      remaining -= tokens;
    }
  }

  // Then: greedy fill by score
  for (const { msg, tokens, idx } of scored) {
    if (added.has(idx)) continue;
    if (tokens <= remaining) {
      keep.push(msg);
      remaining -= tokens;
    }
  }

  // Chronological order
  keep.sort((a, b) => messages.indexOf(a) - messages.indexOf(b));
  keep.push(last);
  return keep;
}

/* Convert to Gemini JSON format (type:\"text\") */
function toGeminiContents(msgs: ChatMessage[], includeMeta = false) {
  const arr: { type: "text"; text: string }[] = [];
  arr.push({ type: "text", text: `SYSTEM: ${SYSTEM_PROMPT}` });

  for (const m of msgs) {
    // Include all messages but transform them appropriately
    let content = "";
    
    // Handle non-text message types
    if (m.kind === "file" && m.body) {
      try {
        const fileData = JSON.parse(m.body);
        content = `[User uploaded a file: ${fileData.display_name || fileData.file_id}]`;
      } catch (e) {
        content = "[User uploaded a file]";
      }
    } else if (m.kind === "file_card" && m.body) {
      try {
        const fileData = JSON.parse(m.body);
        content = `[File reference: ${fileData.title || fileData.file_id}]`;
      } catch (e) {
        content = "[File reference]";
      }
    } else if (m.kind === "action" && m.body) {
      try {
        const actionData = JSON.parse(m.body);
        content = `[User selected action: ${actionData.action}]`;
        if (actionData.values) {
          content += ` with values: ${JSON.stringify(actionData.values)}`;
        }
      } catch (e) {
        content = "[User performed an action]";
      }
    } else if (m.kind === "buttons" || m.kind === "inputs") {
      // Skip buttons/inputs in history as they're UI elements
      continue;
    } else {
      // Default to content field
      content = m.content || "";
    }
    
    if (!content.trim()) continue; // Skip empty messages
    
    // Add to Gemini format
    let line = `${m.role === "user" ? "USER" : "ASSISTANT"}: ${content}`;
    if (includeMeta && m.metadata?.timestamp) {
      line += `\n[Sent: ${new Date(+m.metadata.timestamp).toISOString()}]`;
    }
    arr.push({ type: "text", text: line });
  }
  return arr;
}

/**
 * Process a text conversation with Gemini using the new GoogleGenAI SDK
 * Supports both one-shot and streaming chat calls
 *
 * @param messages Array of chat messages
 * @param options Configuration options
 * @returns The AI response text or function call JSON
 */
export async function processTextChat(
  messages: ChatMessage[],
  opts: {
    temperature?: number;
    maxOutputTokens?: number;
    retrievalOptions?: {
      messageLimit?: number;
      prioritizeRecent?: boolean;
      includeMetadata?: boolean;
    };
    streaming?: boolean;
    onStreamChunk?: (c: string) => void;
  } = {}
) {
  /* 1) trim messages */
  const keep = getMessagesWithinTokenLimit(messages);
  const prompt = toGeminiContents(
    keep,
    Boolean(opts.retrievalOptions?.includeMetadata)
  );

  const cfg = {
    model: "gemini-2.0-flash",
    contents: prompt,
    tools,
    toolConfig: { toolChoice: "auto" },
    config: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    },
  };

  /* 2) non-streaming */
  if (!opts.streaming) {
    try {
      const resp = await ai.models.generateContent(cfg);
      
      // Check for function calls
      if (resp.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        const functionCall = resp.candidates[0].content.parts[0].functionCall;
        return JSON.stringify({
          name: functionCall.name,
          args: functionCall.args
        });
      }
      
      return resp.text ?? "";
    } catch (error) {
      console.error("Gemini API error:", error);
      return "I'm sorry, I encountered an error processing your request.";
    }
  }

  /* 3) streaming */
  try {
    const stream = await ai.models.generateContentStream(cfg);
    let full = "";
    let hasFunctionCall = false;
    let functionCallData = null;
    
    for await (const chunk of stream) {
      // Check for function calls in streaming response
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        hasFunctionCall = true;
        functionCallData = chunk.candidates[0].content.parts[0].functionCall;
        // No need to stream function calls, we'll return it at the end
        continue;
      }
      
      const txt = chunk.text ?? "";
      full += txt;
      opts.onStreamChunk?.(txt);
    }
    
    // If we saw a function call, return it as JSON
    if (hasFunctionCall && functionCallData) {
      return JSON.stringify({
        name: functionCallData.name,
        args: functionCallData.args
      });
    }
    
    return full;
  } catch (error) {
    console.error("Gemini API streaming error:", error);
    return "I'm sorry, I encountered an error processing your request.";
  }
}

/**
 * Simple function to generate a response to a single prompt
 * Updated to use the new Gemini API format
 */
export async function generateText(prompt: string): Promise<string> {
  const modelName = "gemini-2.0-flash";
  const resp = await ai.models.generateContent({
    model: modelName,
    contents: [{ text: prompt }],
  });
  return resp.text ?? "";
}

/**
 * Simple alternative to get the last N turns of conversation
 * This can be used instead of complex scoring logic when appropriate
 */
export function getLastNTurns(messages: ChatMessage[], n: number = 8): ChatMessage[] {
  if (messages.length <= n) return messages;
  return messages.slice(-n);
}