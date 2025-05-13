// src/lib/langchain/index.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMessage } from "../genai/types";
import { 
  ChatPromptTemplate, 
  HumanMessagePromptTemplate, 
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { 
  RunnableSequence, 
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

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
            required: ["label", "action"],
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
            required: ["key", "label"],
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

/* Ensure API key is available */
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("Missing environment variable GEMINI_API_KEY or GOOGLE_API_KEY");

/* ── Constants ─────────────────────────────────────────────────── */
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

/* ── Create the LangChain model ───────────────────────────── */
function createLangChainModel(opts: {
  temperature?: number;
  maxOutputTokens?: number;
} = {}) {
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    streaming: false
  });
}

/* ── Helpers ───────────────────────────────────────────────── */
const estimateTokenCount = (t: string) => Math.ceil((t?.length || 0) * TOKENS_PER_CHAR);

/* Filter to TEXT messages only */
const isTextMsg = (m: ChatMessage) => m.kind === "text" && m.content;

/**
 * Efficiently trim messages to fit within token limits while preserving
 * conversation coherence and maximizing context
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

/**
 * Convert our application's ChatMessage format to LangChain's BaseMessage format
 */
function toLangChainMessages(msgs: ChatMessage[], includeMeta = false): BaseMessage[] {
  const result: BaseMessage[] = [];
  
  // Add system message first
  result.push(new SystemMessage(SYSTEM_PROMPT));
  
  for (const m of msgs) {
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
    
    // Add metadata if needed
    if (includeMeta && m.metadata?.timestamp) {
      content += `\n[Sent: ${new Date(+m.metadata.timestamp).toISOString()}]`;
    }
    
    // Convert to appropriate LangChain message type
    if (m.role === "user") {
      result.push(new HumanMessage(content));
    } else {
      result.push(new AIMessage(content));
    }
  }
  
  return result;
}

/**
 * Process a text conversation with LangChain
 * Supports both one-shot and streaming chat calls
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
  /* 1) trim messages to fit token limits */
  const keep = getMessagesWithinTokenLimit(messages);
  
  /* 2) convert to LangChain message format */
  const langChainMessages = toLangChainMessages(
    keep,
    Boolean(opts.retrievalOptions?.includeMetadata)
  );
  
  /* 3) Setup model and parsing */
  const model = createLangChainModel({
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens
  });
  
  /* 4) Handle non-streaming case */
  if (!opts.streaming) {
    try {
      // Get response from the model
      const response = await model.invoke(langChainMessages);
      
      // Check for function calls in the response
      if (response.tool_calls && response.tool_calls.length > 0) {
        const functionCall = response.tool_calls[0];
        return JSON.stringify({
          name: functionCall.name,
          args: functionCall.args
        });
      }
      
      // Regular text response
      return response.content.toString();
    } catch (error) {
      console.error("LangChain API error:", error);
      return "I'm sorry, I encountered an error processing your request.";
    }
  }
  
  /* 5) Handle streaming case */
  try {
    // Create a streaming model
    const streamingModel = new ChatGoogleGenerativeAI({
      apiKey,
      model: "gemini-2.0-flash",
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      streaming: true
    });
    
    let full = "";
    let hasFunctionCall = false;
    let functionCallData: any = null;
    
    // Stream the response
    const stream = await streamingModel.stream(langChainMessages);
    
    for await (const chunk of stream) {
      // Check for function calls
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        hasFunctionCall = true;
        functionCallData = chunk.tool_calls[0];
        // Don't stream function calls, we'll return at the end
        continue;
      }
      
      // Add text chunk to full response and call callback
      const text = chunk.content.toString();
      full += text;
      opts.onStreamChunk?.(text);
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
    console.error("LangChain API streaming error:", error);
    return "I'm sorry, I encountered an error processing your request.";
  }
}

/**
 * Simple function to generate a response to a single prompt using LangChain
 */
export async function generateText(prompt: string): Promise<string> {
  try {
    const model = createLangChainModel();
    const response = await model.invoke([new HumanMessage(prompt)]);
    return response.content.toString();
  } catch (error) {
    console.error("Error generating text:", error);
    return "I'm sorry, I encountered an error processing your request.";
  }
}

/**
 * Simple alternative to get the last N turns of conversation
 */
export function getLastNTurns(messages: ChatMessage[], n: number = 8): ChatMessage[] {
  if (messages.length <= n) return messages;
  return messages.slice(-n);
}

/**
 * Create a chain for more complex processing
 * Shows how to build a more sophisticated processing pipeline with LangChain
 */
export function createChain(options: {
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
}) {
  const model = createLangChainModel(options);
  
  // Create a prompt template
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      options.systemPrompt || SYSTEM_PROMPT
    ),
    HumanMessagePromptTemplate.fromTemplate("{input}")
  ]);
  
  // Create a simple chain: prompt -> model -> output parser
  return RunnableSequence.from([
    {
      input: (input: string) => input
    },
    chatPrompt,
    model,
    new StringOutputParser()
  ]);
}

/**
 * Create a chain for structured output
 */
export function createStructuredOutputChain<T extends z.ZodType>(
  schema: T,
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    systemPrompt?: string;
  } = {}
) {
  const model = createLangChainModel({
    temperature: options.temperature ?? 0.2, // Lower temp for structured output
    maxOutputTokens: options.maxOutputTokens
  });
  
  // Create the output parser
  const outputParser = StructuredOutputParser.fromZodSchema(schema);
  
  // Create a prompt template with formatting instructions
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `${options.systemPrompt || SYSTEM_PROMPT}\n\n{format_instructions}`
    ),
    HumanMessagePromptTemplate.fromTemplate("{input}")
  ]);
  
  // Create the chain
  return RunnableSequence.from([
    {
      input: (input: string) => input,
      format_instructions: async () => outputParser.getFormatInstructions()
    },
    chatPrompt,
    model,
    outputParser
  ]);
}