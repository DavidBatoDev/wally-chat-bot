// client/src/components/chat/ChatContainer.tsx
"use client";
import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Loader2 } from "lucide-react";
import { ParsedMessage } from "@/hooks/useChat";

export type MessageStatus = "sending" | "sent" | "error" | "delivered";

interface ChatContainerProps {
  messages?: ParsedMessage[]; // Now using ParsedMessage from the hook
  onSendMessage?: (text: string) => void;
  onActionClick?: (action: string, values: any) => void;
  loading?: boolean;
  onDocumentStateChange?: (isActive: boolean) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages = [],
  onSendMessage = () => {},
  onActionClick = () => {},
  loading = false,
  onDocumentStateChange = () => {},
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [documentActive, setDocumentActive] = useState(false);

  // Messages are already parsed by the hook, so we can use them directly
  const displayMessages = messages;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Toggle document panel
  const toggleDocumentState = () => {
    const newState = !documentActive;
    setDocumentActive(newState);
    onDocumentStateChange(newState);
  };

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
        <button
          onClick={toggleDocumentState}
          className={`px-3 py-1 rounded-md text-sm ${
            documentActive
              ? "bg-wally text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {documentActive ? "Hide Document" : "Show Document"}
        </button>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {displayMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            isUser={msg.sender === "user"}
            timestamp={formatTimestamp(msg.created_at)}
            kind={msg.kind}
            body={msg.body} // This is now already parsed JSON
            onButtonClick={handleButtonClick}
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