// src/hooks/useGenAI.ts
import { useState, useCallback } from 'react';
import { ChatMessage, ChatResponse } from '@/lib/genai/types';

interface UseGenAIOptions {
  initialMessages?: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export function useGenAI(options: UseGenAIOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    options.initialMessages || [
      {
        role: 'model',
        content: "Hi there! I'm Wally, your document assistant. Upload a document and I can help you understand it, translate it, or extract information from it."
      }
    ]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Add user message to state
        const userMessage: ChatMessage = {
          role: 'user',
          content
        };
        
        setMessages(prev => [...prev, userMessage]);

        // Prepare all messages for the API
        const allMessages = [...messages, userMessage];

        // Call the API
        const response = await fetch('/api/genai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: allMessages,
            options: {
              temperature: options.temperature,
              maxOutputTokens: options.maxOutputTokens
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data: ChatResponse = await response.json();

        // Add AI response to messages
        const aiMessage: ChatMessage = {
          role: 'model',
          content: data.message
        };

        setMessages(prev => [...prev, aiMessage]);
        return data.message;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMessage);
        
        // Add error message as AI response
        const errorAiMessage: ChatMessage = {
          role: 'model',
          content: 'I encountered an error processing your request. Please try again later.'
        };
        
        setMessages(prev => [...prev, errorAiMessage]);
        return errorAiMessage.content;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.temperature, options.maxOutputTokens]
  );

  const clearMessages = useCallback(() => {
    setMessages([
      {
        role: 'model',
        content: "Hi there! I'm Wally, your document assistant. Upload a document and I can help you understand it, translate it, or extract information from it."
      }
    ]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  };
}