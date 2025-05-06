// src/lib/genai/text.ts ()
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from './types';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Missing environment variable GEMINI_API_KEY');
}

const ai = new GoogleGenAI({ apiKey });
const SYSTEM_PROMPT = `You are Wally, a helpful document assistant. You help users with their documents, including understanding, 
translating, or extracting information from documents. Be concise, friendly, and helpful.`;

// Approximate token count per character (this is a rough estimate)
const TOKENS_PER_CHAR = 0.25;

// Maximum context window size for Gemini
const MAX_CONTEXT_TOKENS = 30000; // For Gemini 2.0 Flash

// Reserved tokens for the response
const RESERVED_RESPONSE_TOKENS = 2048;

/**
 * More accurate token estimation based on character count
 * Consider replacing with an actual tokenizer for production use
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

/**
 * Efficiently trim messages to fit within token limits while preserving 
 * conversation coherence and maximizing context
 * 
 * Enhanced for database-backed conversations with smarter trimming strategies
 */
function getMessagesWithinTokenLimit(messages: ChatMessage[]): ChatMessage[] {
    const systemTokens = estimateTokenCount(SYSTEM_PROMPT);
    const available = MAX_CONTEXT_TOKENS - systemTokens - RESERVED_RESPONSE_TOKENS;
  
    // Always include final query
    const last = messages[messages.length - 1];
    const lastTokens = estimateTokenCount(last.content);
  
    let remaining = available - lastTokens;
    const keep: ChatMessage[] = [];
    const prior = messages.slice(0, -1);
  
    // Identify question→answer pairs
    const critical = new Set<number>();
    for (let i = 0; i < prior.length; i++) {
      if (prior[i].role === 'user' && prior[i + 1]?.role === 'assistant') {
        critical.add(i);
        critical.add(i + 1);
      }
    }
  
    // Score each prior message
    const scored = prior.map((msg, i) => {
      const t = estimateTokenCount(msg.content);
      const recency = i / prior.length;
      const sizeScore = 1 - t / MAX_CONTEXT_TOKENS;
      const roleScore = msg.role === 'user' ? 1.2 : 1.0;
      const score = recency * 0.6 + sizeScore * 0.2 + roleScore * 0.2;
      return { msg, tokens: t, score, idx: i };
    }).sort((a, b) => b.score - a.score);
  
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

function flattenToStrings(
    msgs: ChatMessage[],
    includeMetadata: boolean
  ): string[] {
    const out: string[] = [];
  
    // system instruction first
    out.push(`SYSTEM: ${SYSTEM_PROMPT}`);
  
    for (const m of msgs) {
      let line = (m.role === 'user' ? 'USER:' : 'ASSISTANT:') + ' ' + m.content;
      if (includeMetadata && m.metadata?.timestamp) {
        line += `\n[Sent: ${new Date(m.metadata.timestamp).toISOString()}]`;
      }
      out.push(line);
    }
  
    return out;
  }

/**
 * Process a text conversation with Gemini using the new GoogleGenAI SDK
 * Supports both one-shot and streaming chat calls
 * 
 * @param messages Array of chat messages
 * @param options Configuration options
 * @returns The AI response text
 */
export async function processTextChat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
      retrievalOptions?: {
        messageLimit?: number;
        prioritizeRecent?: boolean;
        includeMetadata?: boolean;
      };
      streaming?: boolean;
      onStreamChunk?: (chunk: string) => void;
    }
  ): Promise<string> {
    const opts      = options ?? {};
    const retrieval = opts.retrievalOptions ?? {};
  
    // a) optionally cap by count
    let pool = messages;
    if (retrieval.messageLimit && pool.length > retrieval.messageLimit) {
      pool = retrieval.prioritizeRecent !== false
        ? pool.slice(-retrieval.messageLimit)
        : pool.slice(0, retrieval.messageLimit);
    }
  
    // b) token-trim your history
    const keep = getMessagesWithinTokenLimit(pool);
  
    // c) flatten everything into a string[]
    const promptContents = flattenToStrings(
      keep,
      Boolean(retrieval.includeMetadata)
    );
  
    // d) defaults
    const temp = opts.temperature    ?? 0.7;
    const maxT = opts.maxOutputTokens ?? 1024;
    const modelName = 'gemini-2.0-flash';
  
  
    // 4) Non-streaming: single RPC generateContent
    if (!opts.streaming) {
        const resp = await ai.models.generateContent({
          model: modelName,
          contents: promptContents,
          config: {
            temperature:   temp,
            maxOutputTokens: maxT,
          }
        });
    
        // resp.text is a string | undefined → coalesce or throw
        return resp.text ?? '';
      }
  
    // 5) Streaming: incremental chunks via generateContentStream
    const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: promptContents,
        config: { temperature: temp, maxOutputTokens: maxT }
      });
  
      let full = '';
      for await (const chunk of stream) {
        // chunk.text is string | undefined
        const txt = chunk.text ?? '';
        full += txt;
        opts.onStreamChunk?.(txt);
      }
    
      return full;
}

/**
 * Simple function to generate a response to a single prompt
 * Updated to use the new Gemini API format
 */
export async function generateText(prompt: string): Promise<string> {
    const modelName = 'gemini-2.0-flash';
    const resp = await ai.models.generateContent({
      model: modelName,
      contents: [prompt],
    });
    return resp.text ?? '';
  }

/**
 * Simple alternative to get the last N turns of conversation
 * This can be used instead of complex scoring logic when appropriate
 */
export function getLastNTurns(
    messages: ChatMessage[],
    n: number = 8
  ): ChatMessage[] {
    if (messages.length <= n) return messages;
    return messages.slice(-n);
  }