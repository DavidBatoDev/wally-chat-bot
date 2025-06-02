// client/src/hooks/useChat.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import chatApi, { BackendMessage } from '@/lib/api/chatApi';
import { createClient } from '@supabase/supabase-js';

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
  isConnected: boolean;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Use ref to track subscription to avoid stale closures
  const subscriptionRef = useRef<any>(null);
  const messagesRef = useRef<ParsedMessage[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  // Load initial messages for a conversation
  const loadInitialMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading initial messages for conversation:', conversationId);
      
      // Get raw backend messages
      const backendMessages = await chatApi.getMessages(conversationId);
      
      // Parse them in our hook
      const parsedMessages = parseMessages(backendMessages);
      
      console.log('Loaded initial messages:', parsedMessages.length);
      setMessages(parsedMessages);
    } catch (err) {
      console.error('Failed to load initial messages:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for messages
  const setupRealtimeSubscription = useCallback((conversationId: string) => {
    console.log('Setting up real-time subscription for conversation:', conversationId);
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription');
      supabase.removeChannel(subscriptionRef.current);
    }

    // Create new subscription
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Real-time message received:', payload);
          
          try {
            const newMessage = payload.new as BackendMessage;
            const parsedMessage = parseMessage(newMessage);
            
            // Check if message already exists (avoid duplicates)
            const messageExists = messagesRef.current.some(
              msg => msg.id === parsedMessage.id
            );
            
            if (!messageExists) {
              console.log('Adding new real-time message:', parsedMessage);
              setMessages(prevMessages => {
                // Also remove any temporary messages that might match
                const filteredMessages = prevMessages.filter(
                  msg => !msg.tempId || msg.status !== 'sending'
                );
                return [...filteredMessages, parsedMessage];
              });
            } else {
              console.log('Message already exists, skipping');
            }
          } catch (err) {
            console.error('Error processing real-time message:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Real-time message updated:', payload);
          
          try {
            const updatedMessage = payload.new as BackendMessage;
            const parsedMessage = parseMessage(updatedMessage);
            
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === parsedMessage.id ? parsedMessage : msg
              )
            );
          } catch (err) {
            console.error('Error processing real-time message update:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'CHANNEL_ERROR') {
          console.error('Subscription error');
          setError('Real-time connection failed');
        }
      });

    subscriptionRef.current = channel;
  }, []);

  // Initialize with parsed initial messages
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(parseMessages(initialMessages));
    }
  }, []);

  // Handle conversation ID changes
  useEffect(() => {
    if (activeConversationId) {
      console.log('Active conversation changed to:', activeConversationId);
      
      // Load initial messages
      loadInitialMessages(activeConversationId);
      
      // Set up real-time subscription
      setupRealtimeSubscription(activeConversationId);
    }

    // Cleanup on unmount or conversation change
    return () => {
      if (subscriptionRef.current) {
        console.log('Cleaning up subscription on conversation change');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
        setIsConnected(false);
      }
    };
  }, [activeConversationId, setupRealtimeSubscription]);

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

  // Send a text message (optimistic updates + real-time will handle the response)
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
      // The real-time subscription will handle adding the actual messages
      await chatApi.sendTextMessage(conversationId, text);
      
      // Remove the optimistic message since real-time will add the real one
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.tempId !== tempId)
      );

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
      // The real-time subscription will handle adding the actual messages
      await chatApi.sendActionMessage(activeConversationId, action, values);
      
      // Remove the optimistic message since real-time will add the real one
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.tempId !== tempId)
      );

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
    clearViewFile,
    isConnected
  };
}