import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  read: boolean;
  edited?: boolean;
  editedAt?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'project';
  name: string;
  participants: string[]; // User IDs
  participantNames: string[]; // User names for display
  lastMessage?: Message;
  unreadCount: number;
  avatar?: string;
  projectId?: string; // For project-based conversations
  archived: boolean;
  createdAt: string;
  archivedAt?: string;
}

interface MessagingState {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  unreadCount: number;
  
  // Actions
  createConversation: (conversation: Omit<Conversation, 'id' | 'createdAt'>) => string;
  createProjectConversation: (projectId: string, creatorId: string, creatorName: string, pmId: string, pmName: string) => string;
  sendMessage: (conversationId: string, senderId: string, senderName: string, content: string, senderAvatar?: string) => void;
  markConversationAsRead: (conversationId: string, userId: string) => void;
  archiveConversation: (conversationId: string) => void;
  getVisibleConversations: (userId: string, userRole: string) => Conversation[];
  getConversationMessages: (conversationId: string) => Message[];
  updateUnreadCount: () => void;
}

export const useMessagingStore = create<MessagingState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      unreadCount: 0,

      createConversation: (conversationData) => {
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newConversation: Conversation = {
          ...conversationData,
          id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          messages: { ...state.messages, [id]: [] }
        }));

        return id;
      },

      createProjectConversation: (projectId, creatorId, creatorName, pmId, pmName) => {
        // Check if conversation already exists for this project
        const existingConv = get().conversations.find(
          conv => conv.type === 'project' && conv.projectId === projectId
        );
        
        if (existingConv) {
          return existingConv.id;
        }

        const id = `proj_${projectId}_${Date.now()}`;
        const newConversation: Conversation = {
          id,
          type: 'project',
          name: `Project Discussion - ${projectId}`,
          participants: [creatorId, pmId],
          participantNames: [creatorName, pmName],
          unreadCount: 0,
          projectId,
          archived: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          messages: { ...state.messages, [id]: [] }
        }));

        return id;
      },

      sendMessage: (conversationId, senderId, senderName, content, senderAvatar) => {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newMessage: Message = {
          id: messageId,
          senderId,
          senderName,
          senderAvatar,
          content,
          timestamp: new Date().toISOString(),
          read: false,
        };

        set((state) => {
          const updatedMessages = {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), newMessage]
          };

          const updatedConversations = state.conversations.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                lastMessage: newMessage,
                unreadCount: conv.unreadCount + 1
              };
            }
            return conv;
          });

          return {
            messages: updatedMessages,
            conversations: updatedConversations
          };
        });

        // Update global unread count
        get().updateUnreadCount();
      },

      markConversationAsRead: (conversationId, userId) => {
        set((state) => {
          const updatedMessages = {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map(msg => 
              msg.senderId !== userId ? { ...msg, read: true } : msg
            )
          };

          const updatedConversations = state.conversations.map(conv => {
            if (conv.id === conversationId) {
              return { ...conv, unreadCount: 0 };
            }
            return conv;
          });

          return {
            messages: updatedMessages,
            conversations: updatedConversations
          };
        });

        get().updateUnreadCount();
      },

      archiveConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                archived: true,
                archivedAt: new Date().toISOString()
              };
            }
            return conv;
          })
        }));
      },

      getVisibleConversations: (userId, userRole) => {
        const { conversations } = get();
        return conversations.filter(conv => {
          // Don't show archived conversations
          if (conv.archived) return false;
          
          // Show conversations where user is a participant
          return conv.participants.includes(userId);
        }).sort((a, b) => {
          // Sort by last message timestamp, most recent first
          const aTime = a.lastMessage?.timestamp || a.createdAt;
          const bTime = b.lastMessage?.timestamp || b.createdAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      },

      getConversationMessages: (conversationId) => {
        return get().messages[conversationId] || [];
      },

      updateUnreadCount: () => {
        const { conversations } = get();
        const totalUnread = conversations
          .filter(conv => !conv.archived)
          .reduce((total, conv) => total + conv.unreadCount, 0);
        
        set({ unreadCount: totalUnread });
      },
    }),
    {
      name: 'messaging-storage',
      version: 1,
    }
  )
); 