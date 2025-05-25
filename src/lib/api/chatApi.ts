// client/src/lib/api/chatApi.ts
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

// Types for backend communication
export interface ConversationResponse {
  success: boolean;
  conversation: Conversation;
  messages?: BackendMessage[];
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
  body: string; // Raw JSON string from backend
  created_at: string;
}

// API functions for conversations
export const chatApi = {
  // Create a new conversation
  createConversation: async (title: string = 'New Conversation'): Promise<string> => {
    try {
      const response = await api.post<{ success: boolean; conversation_id: string }>('/api/conversations/', {
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
        `/api/conversations/?limit=${limit}&offset=${offset}`
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
      const response = await api.get<ConversationResponse>(`/api/conversations/${conversationId}`);
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

  // Get messages for a conversation - Keep it simple, return raw backend messages
  getMessages: async (
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BackendMessage[]> => {
    try {
      const response = await api.get<MessagesResponse>(
        `/api/messages/${conversationId}?limit=${limit}&offset=${offset}`
      );
      
      // Return raw messages - parsing will be done in the hook
      return response.data.messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  },

  // Send a text message to the conversation
  sendTextMessage: async (
    conversationId: string,
    message: string
  ): Promise<{ userMessage: BackendMessage; assistantMessage: BackendMessage }> => {
    try {
      const response = await api.post<SendTextMessageResponse>('/api/messages/text', {
        conversation_id: conversationId,
        body: message,
      });

      const { user_message, assistant_message } = response.data;

      return { 
        userMessage: user_message, 
        assistantMessage: assistant_message 
      };
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
  ): Promise<{ userMessage: BackendMessage; assistantMessage: BackendMessage }> => {
    try {
      const response = await api.post<SendTextMessageResponse>('/api/messages/action', {
        conversation_id: conversationId,
        action,
        values,
      });

      const { user_message, assistant_message } = response.data;

      return { 
        userMessage: user_message, 
        assistantMessage: assistant_message 
      };
    } catch (error) {
      console.error('Error sending action message:', error);
      throw error;
    }
  }
};

export default chatApi;