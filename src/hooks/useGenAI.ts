// src/hooks/useGenAI.ts
import { useState, useCallback } from "react";
import { ChatMessage, ChatResponse } from "@/lib/genai/types";

interface UseGenAIOptions {
  initialMessages?: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  retrievalOptions?: {
    messageLimit?: number;
    prioritizeRecent?: boolean;
    includeMetadata?: boolean;
  };
}

const SYSTEM_GREETING: ChatMessage = {
  role: "model",
  kind: "text",
  content:
    "Hi there! I'm Wally, your document assistant. Upload a document and I can help you understand it, translate it, or extract information from it.",
  metadata: { timestamp: Date.now() }
};

export function useGenAI(options: UseGenAIOptions = {}) {
  /* ------------------------------------------------------------------ */
  /* React state                                                         */
  const [messages, setMessages] = useState<ChatMessage[]>(
    options.initialMessages ?? [SYSTEM_GREETING]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Helper to POST to /api/genai/chat                                   */
  const callChatAPI = async (
    conv: ChatMessage[]
  ): Promise<ChatMessage[]> => {
    const resp = await fetch("/api/genai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conv,
        options: {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          retrievalOptions: options.retrievalOptions,
        },
      }),
    });

    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error ?? data.message ?? "LLM request failed");
    }

    const data: ChatResponse = await resp.json();
    
    // Handle different response formats
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      // Ensure all messages have timestamps
      return data.messages.map(msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          timestamp: msg.metadata?.timestamp || Date.now()
        }
      }));
    }
    
    if (data.message) {
      // Legacy string response format
      return [
        {
          role: "model",
          kind: "text",
          content: data.message,
          metadata: { timestamp: Date.now() }
        },
      ];
    }
    
    // Empty or unexpected response
    throw new Error("Invalid response from AI service");
  };

  /* ------------------------------------------------------------------ */
  /* sendMessage overload:                                               */
  /*   1) sendMessage("hi")                        ← plain string        */
  /*   2) sendMessage({role:'user',kind:'text',…}) ← full object         */
  /* ------------------------------------------------------------------ */
  const sendMessage = useCallback(
    async (msg: string | ChatMessage): Promise<ChatMessage[]> => {
      try {
        setIsLoading(true);
        setError(null);

        // Normalize input and ensure it has a timestamp
        const userMsg: ChatMessage = typeof msg === "string"
          ? { 
              role: "user", 
              kind: "text", 
              content: msg,
              metadata: { timestamp: Date.now() }
            }
          : {
              ...msg,
              metadata: {
                ...msg.metadata,
                timestamp: msg.metadata?.timestamp || Date.now()
              }
            };

        // Push user message to local state immediately
        setMessages((prev) => [...prev, userMsg]);

        // Send entire history INCLUDING this new user message
        const history = [...messages, userMsg];
        const aiReplies = await callChatAPI(history);

        // Push all assistant replies
        setMessages((prev) => [...prev, ...aiReplies]);
        return aiReplies;
      } catch (err) {
        const text =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(text);

        const fallback: ChatMessage = {
          role: "model",
          kind: "text",
          content:
            "I encountered an error processing your request. Please try again later.",
          metadata: { timestamp: Date.now() }
        };
        setMessages((prev) => [...prev, fallback]);
        return [fallback];
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.temperature, options.maxOutputTokens, options.retrievalOptions]
  );

  /* ------------------------------------------------------------------ */
  /* Reset conversation                                                  */
  const clearMessages = useCallback(() => {
    setMessages([{
      ...SYSTEM_GREETING,
      metadata: { timestamp: Date.now() }
    }]);
    setError(null);
  }, []);

  /* ------------------------------------------------------------------ */
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}