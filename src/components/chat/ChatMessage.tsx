// client/src/components/chat/ChatMessage.tsx
"use client";
import React from "react";
import { User, Bot, CheckCheck, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { MessageStatus } from "./ChatContainer";

/* ------------------------------------------------------------------ */
/* Types for chat messages                                            */
export interface ChatMessageProps {
  isUser: boolean;
  timestamp: string;
  text?: string;
  status?: MessageStatus;
  kind?: string;
  body?: any; // For structured content like buttons
  onButtonClick?: (action: string, actionType: string, parameters: any, toolName?: string, toolParameters?: any) => void;
}

interface ButtonAction {
  text: string;
  action: string;
  action_type: string;
  parameters: any;
  tool_name?: string;
  tool_parameters?: any;
}

/* ------------------------------------------------------------------ */
/* Status Indicator component                                         */
const StatusIndicator: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  if (!status || status === "delivered") {
    return <CheckCheck size={14} className="text-gray-400" />;
  } else if (status === "sent") {
    return <Check size={14} className="text-gray-400" />;
  } else if (status === "sending") {
    return <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />;
  } else if (status === "error") {
    return <AlertCircle size={14} className="text-red-500" />;
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Bubble component                                                   */
const Bubble: React.FC<{
  children: React.ReactNode;
  isUser: boolean;
}> = ({ children, isUser }) => (
  <div
    className={`rounded-2xl px-4 py-3 ${
      isUser
        ? "bg-wally text-white rounded-tr-none shadow-md"
        : "bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100"
    }`}
  >
    {children}
  </div>
);



/* ------------------------------------------------------------------ */
/* Buttons Message Component                                          */
const ButtonsMessage: React.FC<{
  prompt: string;
  buttons: ButtonAction[];
  onButtonClick: (action: string, actionType: string, parameters: any, toolName?: string, toolParameters?: any) => void;
}> = ({ prompt, buttons, onButtonClick }) => {
  return (
    <div className="flex flex-col space-y-3">
      <p className="text-gray-800 mb-2">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((button, index) => (
          <Button
            key={index}
            variant="outline"
            className="text-sm border-gray-300 hover:bg-gray-50 hover:text-gray-900"
            onClick={() => onButtonClick(
              button.action,
              button.action_type,
              button.parameters,
              button.tool_name,
              button.tool_parameters
            )}
          >
            {button.text}
          </Button>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                     */
const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { isUser, timestamp, text, status, kind, body, onButtonClick } = props;

  console.log("ChatMessage props:", props);

  // Avatar component
  const Avatar = (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-wally text-white shadow-md" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isUser ? <User size={16} /> : <Bot size={16} />}
    </div>
  );

  // Parse the button content from JSON string if it's a string
  let buttonContent = null;
  if (kind === "buttons" && body) {
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
    buttonContent = (
      <ButtonsMessage 
        prompt={parsedBody.prompt} 
        buttons={parsedBody.buttons} 
        onButtonClick={onButtonClick || (() => {})} 
      />
    );
  }

  return (
    <div 
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      data-status={status}
    >
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start max-w-[85%] md:max-w-[75%] gap-2`}
      >
        {Avatar}
        <div
          className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
        >
          <Bubble isUser={isUser}>
            {kind === "buttons" ? (
              buttonContent
            ) : text ? (
              <div className={`prose prose-sm max-w-none ${isUser ? "text-white" : "text-gray-800"}`}>
                <ReactMarkdown>
                  {text}
                </ReactMarkdown>
              </div>
            ) : null}
          </Bubble>
          
          <div className="flex items-center space-x-1 mt-1 text-xs text-gray-400">
            <span suppressHydrationWarning>{timestamp}</span>
            {isUser && <StatusIndicator status={status} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;