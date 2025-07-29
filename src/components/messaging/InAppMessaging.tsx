'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageCircle,
  Send,
  Search,
  Users,
  Hash,
  Plus,
  X,
  CheckCheck,
  Phone,
  Video,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { useMessagingStore } from '@/lib/store/MessagingStore';
import type { TeamMember } from '@/types/translation';

interface InAppMessagingProps {
  isOpen: boolean;
  onClose: () => void;
  defaultConversationId?: string;
}

export const InAppMessaging: React.FC<InAppMessagingProps> = ({
  isOpen,
  onClose,
  defaultConversationId,
}) => {
  const { currentUser, teamMembers, userRoles } = useTranslationStore();
  const {
    conversations,
    sendMessage,
    markConversationAsRead,
    getVisibleConversations,
    getConversationMessages,
    createConversation,
  } = useMessagingStore();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    defaultConversationId || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get visible conversations
  const visibleConversations = useMemo(() => {
    if (!currentUser) return [];
    return getVisibleConversations(currentUser.id, currentUser.role);
  }, [currentUser, getVisibleConversations, conversations]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = visibleConversations;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv =>
        conv.name.toLowerCase().includes(query) ||
        conv.participantNames.some(name => name.toLowerCase().includes(query))
      );
    }

    switch (selectedTab) {
      case 'direct':
        filtered = filtered.filter(conv => conv.type === 'direct');
        break;
      case 'projects':
        filtered = filtered.filter(conv => conv.type === 'project');
        break;
    }

    return filtered;
  }, [visibleConversations, searchQuery, selectedTab]);

  // Get current conversation and messages
  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const currentMessages = selectedConversation ? getConversationMessages(selectedConversation) : [];

  // Available users for messaging
  const getAvailableUsers = useCallback(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'project-manager') {
      return teamMembers.filter(member => member.id !== currentUser.id);
    } else {
      return teamMembers.filter(member => 
        member.id !== currentUser.id && 
        userRoles.find(ur => ur.id === member.id)?.role === 'project-manager'
      );
    }
  }, [currentUser, teamMembers, userRoles]);

  // Create new conversation
  const createNewConversation = useCallback((userId: string) => {
    const user = teamMembers.find(member => member.id === userId);
    if (!user || !currentUser) return;

    const conversationId = createConversation({
      type: 'direct',
      name: user.name,
      participants: [currentUser.id, userId],
      participantNames: [currentUser.name, user.name],
      unreadCount: 0,
      avatar: user.avatar,
      archived: false,
    });

    setSelectedConversation(conversationId);
    setShowNewMessageModal(false);
  }, [teamMembers, currentUser, createConversation]);

  // Send message
  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !selectedConversation || !currentUser) return;

    sendMessage(
      selectedConversation,
      currentUser.id,
      currentUser.name,
      messageInput.trim(),
      currentUser.avatar
    );

    setMessageInput('');
  }, [messageInput, selectedConversation, currentUser, sendMessage]);

  // Select conversation
  const handleConversationSelect = useCallback((conversationId: string) => {
    setSelectedConversation(conversationId);
    if (currentUser) {
      markConversationAsRead(conversationId, currentUser.id);
    }
  }, [currentUser, markConversationAsRead]);

  // Format time
  const formatMessageTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages]);

  // Handle Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
        onClick={onClose} 
      />
      
      {/* Main Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-4 bg-white rounded-xl shadow-2xl z-50 flex overflow-hidden max-w-7xl max-h-[90vh] mx-auto my-auto"
      >
        {/* Sidebar */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Messages
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewMessageModal(true)}
                  className="h-8 px-3 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 py-2 border-b">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="direct" className="text-xs">Direct</TabsTrigger>
                <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversation === conversation.id}
                      onClick={() => handleConversationSelect(conversation.id)}
                      formatTime={formatMessageTime}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversation && currentConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-white flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {currentConversation.type === 'direct' ? (
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={currentConversation.avatar} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {currentConversation.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Hash className="h-5 w-5 text-green-600" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{currentConversation.name}</h3>
                    <p className="text-sm text-gray-500">
                      {currentConversation.type === 'project' ? 'Project Discussion' : 'Direct Message'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {currentMessages.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No messages yet</h3>
                      <p className="text-sm">Start the conversation by sending a message!</p>
                    </div>
                  ) : (
                    currentMessages.map((message, index) => {
                      const isOwnMessage = message.senderId === currentUser?.id;
                      const showAvatar = index === 0 || currentMessages[index - 1].senderId !== message.senderId;
                      const showTimestamp = index === 0 || 
                        new Date(message.timestamp).getTime() - new Date(currentMessages[index - 1].timestamp).getTime() > 300000; // 5 minutes

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex gap-3 group",
                            isOwnMessage && "flex-row-reverse"
                          )}
                        >
                          {showAvatar ? (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={message.senderAvatar} />
                              <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                {message.senderName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}
                          
                          <div className={cn("flex-1 max-w-xs sm:max-w-md", isOwnMessage && "flex flex-col items-end")}>
                            {showAvatar && (
                              <div className={cn("flex items-center gap-2 mb-1", isOwnMessage && "flex-row-reverse")}>
                                <span className="text-sm font-medium text-gray-900">
                                  {message.senderName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatMessageTime(message.timestamp)}
                                </span>
                              </div>
                            )}
                            
                            <div className={cn(
                              "rounded-2xl px-4 py-2 shadow-sm transition-all",
                              isOwnMessage 
                                ? "bg-blue-600 text-white" 
                                : "bg-white border text-gray-900"
                            )}>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            
                            {message.read && isOwnMessage && (
                              <CheckCheck className="h-3 w-3 text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Message Input */}
              <div className="p-4 border-t bg-white">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      ref={inputRef}
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="resize-none min-h-[40px] rounded-full px-4"
                    />
                  </div>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    size="sm"
                    className="rounded-full h-10 w-10 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50/50">
              <div className="text-center">
                <MessageCircle className="h-20 w-20 mx-auto mb-6 text-gray-300" />
                <h3 className="text-xl font-medium mb-2 text-gray-600">Select a conversation</h3>
                <p className="text-gray-500 max-w-sm">Choose a conversation from the sidebar to start messaging, or create a new one.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* New Message Modal */}
      <Dialog open={showNewMessageModal} onOpenChange={setShowNewMessageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              {currentUser?.role === 'project-manager' 
                ? 'Select a team member to start a conversation with.'
                : 'Select a Project Manager to start a conversation with.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                className="pl-10"
              />
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {getAvailableUsers().map((user) => (
                  <div
                    key={user.id}
                    onClick={() => createNewConversation(user.id)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {userRoles.find(ur => ur.id === user.id)?.role === 'project-manager' ? 'Project Manager' : 'Translator'}
                        {user.specialtyLanguages && user.specialtyLanguages.length > 0 && 
                          ` • ${user.specialtyLanguages.join(', ')}`
                        }
                      </p>
                    </div>
                    {user.availableTime && (
                      <Badge variant="outline" className="text-xs">
                        Available
                      </Badge>
                    )}
                  </div>
                ))}
                
                {getAvailableUsers().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No users available to message</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Conversation Item Component
const ConversationItem: React.FC<{
  conversation: any;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
}> = ({ conversation, isSelected, onClick, formatTime }) => {
  return (
    <div
      className={cn(
        "p-3 rounded-lg cursor-pointer transition-all duration-200 group",
        isSelected 
          ? "bg-blue-50 border border-blue-200 shadow-sm" 
          : "hover:bg-white hover:shadow-sm"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          {conversation.type === 'direct' ? (
            <Avatar className="h-12 w-12">
              <AvatarImage src={conversation.avatar} />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {conversation.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Hash className="h-6 w-6 text-green-600" />
            </div>
          )}
          {conversation.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-sm truncate text-gray-900">
              {conversation.name}
            </p>
            {conversation.lastMessage && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {formatTime(conversation.lastMessage.timestamp)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {conversation.lastMessage ? (
              <p className="text-sm text-gray-600 truncate">
                <span className="font-medium">{conversation.lastMessage.senderName}: </span>
                <span>{conversation.lastMessage.content}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No messages yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 