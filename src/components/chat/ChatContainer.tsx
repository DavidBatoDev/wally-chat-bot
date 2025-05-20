// client/src/components/chat/ChatContainer.tsx
"use client";
import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Loader2 } from "lucide-react";

export type MessageStatus = "sending" | "sent" | "error" | "delivered";

export interface Message {
  id: string;
  isUser: boolean;
  text?: string;
  timestamp: string;
  status?: MessageStatus;
  kind?: string;
  body?: any;
  sender?: string;
}

interface ChatContainerProps {
  messages?: Array<Message>;
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
 
  // Sample static messages if none are provided
  const displayMessages = messages.length > 0 ? messages : [];
  
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

  // Handle button clicks
  const handleButtonClick = (
    action: string, 
    actionType: string, 
    parameters: any, 
    toolName?: string, 
    toolParameters?: any
  ) => {
    const values: any = { 
      action_type: actionType, 
      parameters 
    };
    
    // For tool-type buttons, add tool information
    if (actionType === "tool" && toolName) {
      values.tool_name = toolName;
      values.tool_parameters = toolParameters || {};
    }
    
    console.log("Button clicked:", action, values);
    onActionClick(action, values);
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
            isUser={msg.isUser || (msg.sender === "user")}
            text={msg.text}
            timestamp={msg.timestamp}
            status={msg.status}
            kind={msg.kind}
            body={msg.body}
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