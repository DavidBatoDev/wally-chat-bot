// client/src/components/chat/ChatContainer.tsx
"use client";
import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Loader2 } from "lucide-react";
import { ParsedMessage } from "@/hooks/useChat";

export type MessageStatus = "sending" | "sent" | "error";

interface ChatContainerProps {
  messages?: ParsedMessage[];
  onSendMessage?: (text: string) => void;
  onActionClick?: (action: string, values: any) => void;
  onFileUploaded?: (fileMessage: any) => void; 
  onViewFile?: (message: any) => void;
  loading?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages = [],
  onSendMessage = () => {},
  onActionClick = () => {},
  onViewFile = () => {}, 
  onFileUploaded = () => {},
  loading = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Messages are already parsed by the hook, so we can use them directly
  const displayMessages = messages;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Handle button clicks - simplified
  const handleButtonClick = (action: string, values: Record<string, any> = {}) => {
    console.log("Button clicked:", action, values);
    onActionClick(action, values);
  };

  // Convert backend message timestamp to display format
  const formatTimestamp = (created_at: string): string => {
    return new Date(created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header for document toggle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <h2 className="text-lg font-medium">Chat</h2>
      </div>
     
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {displayMessages.map((msg) => (
          <ChatMessage
            key={msg.tempId || msg.id} 
            conversationId={msg.conversation_id}
            isUser={msg.sender === "user"}
            timestamp={formatTimestamp(msg.created_at)}
            status={msg.status} 
            kind={msg.kind}
            body={msg.body} 
            onButtonClick={handleButtonClick}
            onFileUploaded={onFileUploaded}
            onViewFile={onViewFile} 
          />
        ))}
       
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-3 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
       
        <div ref={messagesEndRef} />
      </div>
     
      {/* Chat input */}
      <ChatInput
        onSendMessage={onSendMessage}
        placeholder="Type a message..."
        disabled={loading}
      />
    </div>
  );
};

export default ChatContainer;