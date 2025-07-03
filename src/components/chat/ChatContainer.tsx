// client/src/components/chat/ChatContainer.tsx
"use client";
import React, { useRef, useEffect } from "react";
import ChatInput from "./ChatInput";
import NoMessagesComponent from "./NoMessageComponent";
import { Loader2 } from "lucide-react";
import { ParsedMessage } from "@/hooks/useChat";
import ConnectionStatus from "../ui/is-connected-weboscker";
import {
  MessageWrapper,
  TextMessage,
  UploadButtonMessage,
  FileCardMessage,
  FileMessage,
  MessageStatus,
} from "./messages";

interface ChatContainerProps {
  messages?: ParsedMessage[];
  onSendMessage?: (text: string) => void;
  onActionClick?: (action: string, values: any) => void;
  onFileUploaded?: (fileMessage: any) => void;
  loading?: boolean;
  isConnected?: boolean;
  conversationId?: string;
  isWorkflowRunning?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages = [],
  onSendMessage = () => {},
  onActionClick = () => {},
  onFileUploaded = () => {},
  loading = false,
  isConnected = false,
  conversationId = "",
  isWorkflowRunning = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Messages are already parsed by the hook, so we can use them directly
  const displayMessages = messages;
  const hasMessages = displayMessages.length > 0;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (hasMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages, hasMessages]);

  // Scroll to bottom when thinking animation appears
  useEffect(() => {
    if (isWorkflowRunning) {
      // Small delay to ensure the thinking animation is rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [isWorkflowRunning]);

  // Handle button clicks - simplified
  const handleButtonClick = (
    action: string,
    values: Record<string, any> = {}
  ) => {
    console.log("Button clicked:", action, values);
    onActionClick(action, values);
  };

  // Convert backend message timestamp to display format
  const formatTimestamp = (created_at: string): string => {
    return new Date(created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Render message content based on kind
  const renderMessageContent = (msg: ParsedMessage) => {
    const isUser = msg.sender === "user";
    const commonProps = {
      body: msg.body,
      onButtonClick: handleButtonClick,
      onFileUploaded,
      conversationId,
    };

    switch (msg.kind) {
      case "text":
        return <TextMessage body={msg.body} isUser={isUser} />;
      case "upload_button":
        return <UploadButtonMessage {...commonProps} />;
      case "file_card":
        return <FileCardMessage {...commonProps} />;
      case "file":
        return <FileMessage {...commonProps} />;
      default:
        // Fallback for unknown kinds - treat as text
        return <TextMessage body={msg.body} isUser={isUser} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header with real-time status */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <h2 className="text-lg font-medium">Wally ChatBot</h2>

        {/* Real-time connection status */}
        <ConnectionStatus isConnected={isConnected} />
      </div>

      {/* Messages container or No Messages component */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages && !loading && !isWorkflowRunning ? (
          /* Show NoMessagesComponent when there are no messages and no workflow running */
          <NoMessagesComponent
            onSendMessage={onSendMessage}
            onFileUploaded={onFileUploaded}
            conversationId={conversationId}
          />
        ) : (
          /* Show messages when they exist or workflow is running */
          <div className="p-4 space-y-4 max-w-3xl mx-auto w-full">
            {displayMessages.map((msg) => (
              <MessageWrapper
                key={msg.tempId || msg.id}
                isUser={msg.sender === "user"}
                timestamp={formatTimestamp(msg.created_at)}
                status={msg.status as MessageStatus}
              >
                {renderMessageContent(msg)}
              </MessageWrapper>
            ))}

            {/* Show thinking animation when workflow is running */}
            {isWorkflowRunning && (
              <div className="flex justify-start mb-4">
                <div className="flex items-center space-x-3 bg-gray-100 rounded-2xl px-4 py-3 max-w-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-wally" />
                  <span className="text-sm text-gray-600">
                    Wally is thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat input - always visible */}
      <ChatInput
        onSendMessage={onSendMessage}
        placeholder="Type a message..."
        disabled={loading || isWorkflowRunning}
      />
    </div>
  );
};

export default ChatContainer;
