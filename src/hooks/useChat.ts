// client/src/hooks/useChat.ts
import { useState, useEffect, useCallback } from 'react';
import chatApi, { BackendMessage } from '@/lib/api/chatApi';

interface UseChatProps {
  conversationId?: string;
  initialMessages?: BackendMessage[];
}

export type MessageStatus = "sending" | "sent" | "error";

// Parsed message type that components will consume
export interface ParsedMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant';
  kind: 'text' | 'action' | 'buttons' | 'file_card' | 'file_upload' | 'upload_button' | 'file';
  body: any; // This will be the parsed JSON object
  created_at: string;
  status?: MessageStatus; // Add status field
  tempId?: string; // For tracking optimistic updates
}

// Document state interface
export interface DocumentState {
  isOpen: boolean;
  fileData: any | null;
}

interface UseChatReturn {
  messages: ParsedMessage[];
  documentState: DocumentState;
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendAction: (action: string, values?: Record<string, any>) => Promise<void>;
  createNewConversation: () => Promise<string>;
  activeConversationId?: string;
  handleFileUploaded: (fileMessage: any) => void;
  onViewFile: (fileData: any) => void;
  clearViewFile: () => void;
}

export default function useChat({ 
  conversationId: initialConversationId,
  initialMessages = []
}: UseChatProps = {}): UseChatReturn {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [documentState, setDocumentState] = useState<DocumentState>({
    isOpen: false,
    fileData: null
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId);

  // Generate temporary ID for optimistic updates
  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      body: parsedBody,
      status: 'sent' // Backend messages are always considered sent
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

  // Update message status by tempId or id
  const updateMessageStatus = (messageId: string, status: MessageStatus, tempId?: string) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        (msg.id === messageId || msg.tempId === tempId) 
          ? { ...msg, status }
          : msg
      )
    );
  };

  // Replace temporary message with actual backend message
  const replaceTemporaryMessage = (tempId: string, actualMessage: ParsedMessage) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.tempId === tempId ? actualMessage : msg
      )
    );
  };

  // Handle file upload - add the file message to chat immediately
  const handleFileUploaded = useCallback((fileMessage: any) => {
    console.log('Adding uploaded file message to chat:', fileMessage);
    
    // Convert the file message to our ParsedMessage format
    const parsedFileMessage: ParsedMessage = {
      id: fileMessage.id,
      conversation_id: fileMessage.conversation_id,
      sender: fileMessage.sender,
      kind: fileMessage.kind,
      body: fileMessage.body,
      created_at: fileMessage.created_at,
      status: fileMessage.status || 'sent'
    };
    
    // Add the file message to the end of the messages array
    setMessages(prevMessages => [...prevMessages, parsedFileMessage]);
  }, []);

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

    // Create optimistic user message
    const tempId = generateTempId();
    const optimisticUserMessage: ParsedMessage = {
      id: tempId, // Temporary ID
      tempId: tempId,
      conversation_id: conversationId,
      sender: 'user',
      kind: 'text',
      body: { text },
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    // Add optimistic message immediately
    setMessages(prevMessages => [...prevMessages, optimisticUserMessage]);
    setLoading(true);
    setError(null);

    try {
      // Send the message to the backend
      const { userMessage, assistantMessage } = await chatApi.sendTextMessage(
        conversationId,
        text
      );

      // Parse both messages
      const parsedUserMessage = parseMessage(userMessage);
      const parsedAssistantMessage = parseMessage(assistantMessage);
      
      // Replace the optimistic message with the actual one and add assistant message
      setMessages(prevMessages => {
        const filteredMessages = prevMessages.filter(msg => msg.tempId !== tempId);
        return [...filteredMessages, parsedUserMessage, parsedAssistantMessage];
      });

    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      
      // Update the optimistic message status to error
      updateMessageStatus('', 'error', tempId);
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

    // Create optimistic user action message
    const tempId = generateTempId();
    const optimisticActionMessage: ParsedMessage = {
      id: tempId,
      tempId: tempId,
      conversation_id: activeConversationId,
      sender: 'user',
      kind: 'action',
      body: { action, values },
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    // Add optimistic message immediately
    setMessages(prevMessages => [...prevMessages, optimisticActionMessage]);
    setLoading(true);
    setError(null);

    try {
      // Send the action to the backend
      const { userMessage, assistantMessage } = await chatApi.sendActionMessage(
        activeConversationId,
        action,
        values
      );

      // Parse both messages
      const parsedUserMessage = parseMessage(userMessage);
      const parsedAssistantMessage = parseMessage(assistantMessage);
      
      // Replace the optimistic message with the actual one and add assistant message
      setMessages(prevMessages => {
        const filteredMessages = prevMessages.filter(msg => msg.tempId !== tempId);
        return [...filteredMessages, parsedUserMessage, parsedAssistantMessage];
      });

    } catch (err) {
      console.error('Failed to send action:', err);
      setError('Failed to send action. Please try again.');
      
      // Update the optimistic message status to error
      updateMessageStatus('', 'error', tempId);
    } finally {
      setLoading(false);
    }
  };

  // Handle viewing files in document canvas
  const onViewFile = useCallback((fileData: any) => {
    console.log('onViewFile called with:', fileData);
    
    setDocumentState({
      isOpen: true,
      fileData: fileData
    });
  }, []);

  // Clear document view
  const clearViewFile = useCallback(() => {
    console.log('Clearing document view');
    setDocumentState({
      isOpen: false,
      fileData: null
    });
  }, []);

  return {
    messages,
    documentState,
    activeConversationId,
    loading,
    error,
    sendMessage,
    sendAction,
    createNewConversation,
    handleFileUploaded,
    onViewFile,
    clearViewFile
  };
}