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

export interface SendActionMessageResponse {
  success: boolean;
  user_action_message: BackendMessage;   // name mirrors backend payload
  assistant_message: BackendMessage;
  response: any;
  workflow_status: string;
  steps_completed: number;
  user_confirmation_pending?: boolean;
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
  kind: 'text' | 'action' | 'buttons' | 'file_card' | 'file_upload' | 'upload_button' | 'file';
  body: string; // Raw JSON string from backend
  created_at: string;
}

// Enhanced error handling for API calls
class ChatApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}

const handleApiError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  
  if (error.response) {
    // The request was made and the server responded with a status code
    const statusCode = error.response.status;
    const message = error.response.data?.message || error.response.data?.error || `${context} failed`;
    throw new ChatApiError(message, statusCode, error);
  } else if (error.request) {
    // The request was made but no response was received
    throw new ChatApiError(`Network error during ${context}`, undefined, error);
  } else {
    // Something happened in setting up the request
    throw new ChatApiError(`Request setup error during ${context}`, undefined, error);
  }
};

// API functions for conversations
export const chatApi = {
  // Create a new conversation
  createConversation: async (title: string = 'New Conversation'): Promise<string> => {
    try {
      const response = await api.post<{ success: boolean; conversation_id: string }>('/api/conversations/', {
        title,
      });
      
      if (!response.data.success) {
        throw new Error('Failed to create conversation');
      }
      
      return response.data.conversation_id;
    } catch (error) {
      handleApiError(error, 'creating conversation');
      throw error; // This will never be reached due to handleApiError throwing
    }
  },

  // List all conversations
  listConversations: async (limit: number = 10, offset: number = 0): Promise<Conversation[]> => {
    try {
      const response = await api.get<{ success: boolean; conversations: Conversation[] }>(
        `/api/conversations/?limit=${limit}&offset=${offset}`
      );
      
      if (!response.data.success) {
        throw new Error('Failed to list conversations');
      }
      
      return response.data.conversations;
    } catch (error) {
      handleApiError(error, 'listing conversations');
      throw error;
    }
  },

  // Get a specific conversation with its messages
  getConversation: async (conversationId: string): Promise<ConversationResponse> => {
    try {
      const response = await api.get<ConversationResponse>(`/api/conversations/${conversationId}`);
      
      if (!response.data.success) {
        throw new Error('Failed to get conversation');
      }
      
      return response.data;
    } catch (error) {
      handleApiError(error, 'getting conversation');
      throw error;
    }
  },

  // Delete (archive) a conversation
  deleteConversation: async (conversationId: string): Promise<boolean> => {
    try {
      const response = await api.delete<{ success: boolean }>(`/api/conversations/${conversationId}`);
      return response.data.success;
    } catch (error) {
      handleApiError(error, 'deleting conversation');
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
      
      if (!response.data.success) {
        throw new Error('Failed to get messages');
      }
      
      // Return raw messages - parsing will be done in the hook
      return response.data.messages;
    } catch (error) {
      handleApiError(error, 'getting messages');
      throw error;
    }
  },

  // Send a text message to the conversation
  // Note: With real-time updates, we don't need to return the messages since they'll come via Supabase
  sendTextMessage: async (
    conversationId: string,
    message: string
  ): Promise<void> => {
    try {
      const response = await api.post<SendTextMessageResponse>('/api/messages/text', {
        conversation_id: conversationId,
        body: message,
      });

      if (!response.data.success) {
        throw new Error('Failed to send text message');
      }

      // With real-time updates, we don't need to return the messages
      // They will be received via the Supabase subscription
      console.log('Text message sent successfully, waiting for real-time updates');
    } catch (error) {
      handleApiError(error, 'sending text message');
      throw error;
    }
  },

  // Send an action message (response to buttons or inputs)
  // Note: With real-time updates, we don't need to return the messages since they'll come via Supabase
  sendActionMessage: async (
    conversationId: string,
    action: string,
    values: Record<string, any> = {}
  ): Promise<void> => {
    try {
      const response = await api.post<SendActionMessageResponse>('/api/messages/action', {
        conversation_id: conversationId,
        action,
        values,
      });

      if (!response.data.success) {
        throw new Error('Failed to send action message');
      }

      // With real-time updates, we don't need to return the messages
      // They will be received via the Supabase subscription
      console.log('Action message sent successfully, waiting for real-time updates');
    } catch (error) {
      handleApiError(error, 'sending action message');
      throw error;
    }
  },

  // Helper method to handle button clicks - simplified for real-time architecture
  handleButtonClick: async (
    conversationId: string,
    buttonAction: string,
    buttonLabel: string,
    buttonValue?: string
  ): Promise<void> => {
    return chatApi.sendActionMessage(conversationId, buttonAction, {
      label: buttonLabel,
      value: buttonValue || buttonLabel.toLowerCase().replace(/\s+/g, '_'),
      text: buttonLabel
    });
  },

  // Utility method to check if the API is reachable
  healthCheck: async (): Promise<boolean> => {
    try {
      const response = await api.get('/api/health');
      return response.status === 200;
    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  },

  // Utility method for file uploads (if needed)
  uploadFile: async (
    conversationId: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<BackendMessage> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', conversationId);

      const response = await api.post<{ success: boolean; message: BackendMessage }>(
        '/api/uploads/file',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onUploadProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onUploadProgress(progress);
            }
          },
        }
      );

      if (!response.data.success) {
        throw new Error('File upload failed');
      }

      return response.data.message;
    } catch (error) {
      handleApiError(error, 'uploading file');
      throw error;
    }
  }
};

export default chatApi;
export { ChatApiError };