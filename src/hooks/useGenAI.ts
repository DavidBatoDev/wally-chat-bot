// src/hooks/useGenAI.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, ChatRequestOptions } from '@/lib/genai/types';

interface UseGenAIOptions {
  endpoint?: string;
  onStart?: () => void;
  onComplete?: (response: ChatMessage[]) => void;
  onError?: (error: Error) => void;
  defaultOptions?: Partial<ChatRequestOptions>;
}

interface UseGenAIReturn {
  loading: boolean;
  error: Error | null;
  lastResponse: ChatMessage[] | null;
  sendMessage: (messages: ChatMessage[], options?: Partial<ChatRequestOptions>) => Promise<ChatMessage[] | null>;
  streamMessage: (messages: ChatMessage[], options?: Partial<ChatRequestOptions>) => Promise<void>;
  cancelStream: () => void;
}

/**
 * React hook for interacting with our LangChain-based GenAI API
 */
export function useGenAI({
  endpoint = '/api/genai/chat',
  onStart,
  onComplete,
  onError,
  defaultOptions = {}
}: UseGenAIOptions = {}): UseGenAIReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatMessage[] | null>(null);
  
  // For streaming control
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Clean up any active streams on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Standard message sending (non-streaming)
  const sendMessage = useCallback(
    async (messages: ChatMessage[], options: Partial<ChatRequestOptions> = {}): Promise<ChatMessage[] | null> => {
      try {
        setLoading(true);
        setError(null);
        onStart?.();

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            options: { ...defaultOptions, ...options },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to send message');
        }

        const data = await response.json();
        const responseMessages = data.messages || [];
        
        setLastResponse(responseMessages);
        onComplete?.(responseMessages);
        
        return responseMessages;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        onError?.(errorObj);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, onStart, onComplete, onError, defaultOptions]
  );

  // Streaming message - returns a promise that resolves when streaming is complete
  const streamMessage = useCallback(
    async (messages: ChatMessage[], options: Partial<ChatRequestOptions> = {}): Promise<void> => {
      // Cancel any existing streams first
      cancelStream();
      
      try {
        setLoading(true);
        setError(null);
        onStart?.();

        // Create a new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        // Use fetch for initial request with streaming options
        const response = await fetch(`${endpoint}/streaming`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            options: { 
              ...defaultOptions, 
              ...options,
              streaming: true 
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to start streaming');
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Create reader and process the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          
          // Process the SSE chunks
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            const data = line.replace('data: ', '');
            
            // Check for stream end
            if (data === '[DONE]') {
              // Stream complete, create the final message
              const finalMessage: ChatMessage = {
                role: 'model',
                kind: 'text',
                content: accumulatedText,
              };
              
              setLastResponse([finalMessage]);
              onComplete?.([finalMessage]);
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              
              if (parsed.text) {
                accumulatedText += parsed.text;
                // You could call a callback here to update UI during streaming
              }
            } catch (err) {
              console.error('Error parsing stream chunk:', err);
            }
          }
        }
      } catch (err) {
        // Only set error if it's not an abort error
        if (err instanceof Error && err.name !== 'AbortError') {
          const errorObj = err;
          setError(errorObj);
          onError?.(errorObj);
        }
      } finally {
        abortControllerRef.current = null;
        setLoading(false);
      }
    },
    [endpoint, onStart, onComplete, onError, defaultOptions]
  );

  // Cancel any active stream
  const cancelStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    lastResponse,
    sendMessage,
    streamMessage,
    cancelStream,
  };
}

export default useGenAI;