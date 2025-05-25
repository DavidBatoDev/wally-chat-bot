// client/src/hooks/useChat.ts
import { useState, useEffect, useCallback } from 'react';
import chatApi, { BackendMessage } from '@/lib/api/chatApi';

interface UseChatProps {
  conversationId?: string;
  initialMessages?: BackendMessage[];
}

// Parsed message type that components will consume
export interface ParsedMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant';
  kind: 'text' | 'action' | 'buttons' | 'inputs' | 'file_card';
  body: any; // This will be the parsed JSON object
  created_at: string;
}

interface UseChatReturn {
  messages: ParsedMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendAction: (action: string, values?: Record<string, any>) => Promise<void>;
  createNewConversation: () => Promise<string>;
  activeConversationId?: string;
}

export default function useChat({ 
  conversationId: initialConversationId,
  initialMessages = []
}: UseChatProps = {}): UseChatReturn {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId);

  // Parse a single backend message into our component-friendly format
  const parseMessage = (backendMessage: BackendMessage): ParsedMessage => {
    let parsedBody;
    
    try {
      // Try to parse the body as JSON
      parsedBody = JSON.parse(backendMessage.body);
    } catch {
      // If parsing fails, treat it as plain text
      console.warn('Failed to parse message body as JSON, treating as plain text');
      parsedBody = { text: backendMessage.body };
    }

    return {
      ...backendMessage,
      body: parsedBody
    };
  };

  // Parse multiple backend messages
  const parseMessages = (backendMessages: BackendMessage[]): ParsedMessage[] => {
    return backendMessages.map(parseMessage);
  };

  // Initialize with parsed initial messages
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(parseMessages(initialMessages));
    }
  }, []);

  // Load conversation messages if ID is provided
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get raw backend messages
      const backendMessages = await chatApi.getMessages(conversationId);
      
      // Parse them in our hook
      const parsedMessages = parseMessages(backendMessages);
      
      setMessages(parsedMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create a new conversation
  const createNewConversation = async (title?: string): Promise<string> => {
    try {
      setLoading(true);
      setError(null);
      const conversationId = await chatApi.createConversation(title);
      setActiveConversationId(conversationId);
      setMessages([]);
      return conversationId;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to create a new conversation. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send a text message
  const sendMessage = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    
    // Create or ensure we have a conversation
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        conversationId = await createNewConversation('New Conversation');
      } catch (err) {
        setError('Failed to create conversation. Please try again.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Send the message to the backend
      const { userMessage, assistantMessage } = await chatApi.sendTextMessage(
        conversationId,
        text
      );

      // Parse both messages and add them to state
      const parsedUserMessage = parseMessage(userMessage);
      const parsedAssistantMessage = parseMessage(assistantMessage);
      
      setMessages(prevMessages => [...prevMessages, parsedUserMessage, parsedAssistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Send an action message (response to buttons or inputs)
  const sendAction = async (action: string, values: Record<string, any> = {}): Promise<void> => {
    if (!activeConversationId) {
      setError('No active conversation to send action to.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send the action to the backend
      const { userMessage, assistantMessage } = await chatApi.sendActionMessage(
        activeConversationId,
        action,
        values
      );

      // Parse both messages and add them to state
      const parsedUserMessage = parseMessage(userMessage);
      const parsedAssistantMessage = parseMessage(assistantMessage);
      
      setMessages(prevMessages => [...prevMessages, parsedUserMessage, parsedAssistantMessage]);
    } catch (err) {
      console.error('Failed to send action:', err);
      setError('Failed to send action. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    sendAction,
    createNewConversation,
    activeConversationId,
  };
}