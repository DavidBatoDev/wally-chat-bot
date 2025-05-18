// client/src/lib/api/chatApi.ts
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '@/components/chat/ChatContainer';

// Types for backend communication
export interface ConversationResponse {
  success: boolean;
  conversation: Conversation;
  messages?: Message[];
}

export interface MessagesResponse {
  success: boolean;
  messages: BackendMessage[];
}

export interface SendTextMessageResponse {
  success: boolean;
  user_message: BackendMessage;
  assistant_message: BackendMessage;
  response_type: string;
  tool_result?: any;
}

export interface Conversation {
  id: string;
  profile_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface BackendMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant';
  kind: 'text' | 'action' | 'buttons' | 'inputs' | 'file_card';
  body: string;
  created_at: string;
}

// Convert backend messages to frontend format
export const convertToFrontendMessages = (
  backendMessages: BackendMessage[]
): Message[] => {
  return backendMessages.map((msg) => {
    // Parse timestamp to a readable format
    const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      id: msg.id,
      isUser: msg.sender === 'user',
      text: msg.kind === 'text' ? msg.body : parseComplexMessage(msg),
      timestamp,
      status: 'delivered',
    };
  });
};

// Handle complex message types like buttons, inputs, etc.
const parseComplexMessage = (message: BackendMessage): string => {
  try {
    switch (message.kind) {
      case 'buttons': {
        const data = JSON.parse(message.body);
        return `${data.prompt}\n\n${data.buttons
          .map((btn: any) => `- ${btn.label}`)
          .join('\n')}`;
      }
      case 'inputs': {
        const data = JSON.parse(message.body);
        return `${data.prompt}\n\n${data.inputs
          .map((input: any) => `- ${input.label}: _____________`)
          .join('\n')}`;
      }
      case 'action': {
        const data = JSON.parse(message.body);
        return `Selected: ${data.action}`;
      }
      case 'file_card': {
        const data = JSON.parse(message.body);
        return `File: ${data.filename || 'Unnamed file'}`;
      }
      default:
        return message.body;
    }
  } catch (error) {
    console.error('Error parsing complex message:', error);
    return message.body;
  }
};

// API functions for conversations
export const chatApi = {
  // Create a new conversation
  createConversation: async (title: string = 'New Conversation'): Promise<string> => {
    try {
      const response = await api.post<{ success: boolean; conversation_id: string }>('/api/conversations/conversations/', {
        title,
      });
      return response.data.conversation_id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  },

  // List all conversations
  listConversations: async (limit: number = 10, offset: number = 0): Promise<Conversation[]> => {
    try {
      const response = await api.get<{ success: boolean; conversations: Conversation[] }>(
        `/api/conversations/conversations/?limit=${limit}&offset=${offset}`
      );
      return response.data.conversations;
    } catch (error) {
      console.error('Error listing conversations:', error);
      throw error;
    }
  },

  // Get a specific conversation with its messages
  getConversation: async (conversationId: string): Promise<ConversationResponse> => {
    try {
      const response = await api.get<ConversationResponse>(`/api/conversations/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  },

  // Delete (archive) a conversation
  deleteConversation: async (conversationId: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/api/conversations/conversations/${conversationId}`);
      return response.data.success;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  },

  // Get messages for a conversation
  getMessages: async (
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> => {
    try {
      const response = await api.get<MessagesResponse>(
        `/api/messages/messages/${conversationId}?limit=${limit}&offset=${offset}`
      );
      
      return convertToFrontendMessages(response.data.messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  },

  // Send a text message to the conversation
  sendTextMessage: async (
    conversationId: string,
    message: string
  ): Promise<{ userMessage: Message; assistantMessage: Message }> => {
    try {
      const response = await api.post<SendTextMessageResponse>('/api/messages/messages/text', {
        conversation_id: conversationId,
        body: message,
      });

      const { user_message, assistant_message } = response.data;

      // Convert to frontend format
      const userMessage = {
        id: user_message.id,
        isUser: true,
        text: user_message.body,
        timestamp: new Date(user_message.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'delivered' as const,
      };

      const assistantMessage = {
        id: assistant_message.id,
        isUser: false,
        text: assistant_message.kind === 'text' 
          ? assistant_message.body 
          : parseComplexMessage(assistant_message),
        timestamp: new Date(assistant_message.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'delivered' as const,
      };

      return { userMessage, assistantMessage };
    } catch (error) {
      console.error('Error sending text message:', error);
      throw error;
    }
  },

  // Send an action message (response to buttons or inputs)
  sendActionMessage: async (
    conversationId: string,
    action: string,
    values: Record<string, any> = {}
  ): Promise<{ userMessage: Message; assistantMessage: Message }> => {
    try {
      const response = await api.post<SendTextMessageResponse>('/api/messages/messages/action', {
        conversation_id: conversationId,
        action,
        values,
      });

      const { user_message, assistant_message } = response.data;

      // Convert to frontend format
      const userMessage = {
        id: user_message.id,
        isUser: true,
        text: `Selected: ${action}`,
        timestamp: new Date(user_message.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'delivered' as const,
      };

      const assistantMessage = {
        id: assistant_message.id,
        isUser: false,
        text: assistant_message.kind === 'text' 
          ? assistant_message.body 
          : parseComplexMessage(assistant_message),
        timestamp: new Date(assistant_message.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'delivered' as const,
      };

      return { userMessage, assistantMessage };
    } catch (error) {
      console.error('Error sending action message:', error);
      throw error;
    }
  }
};

export default chatApi;