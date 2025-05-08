import React from "react";
import { User, Bot } from "lucide-react";

export interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: string;
  dropzone?: React.ReactNode;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isUser,
  timestamp,
  dropzone,
}) => {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start max-w-[80%]`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? "bg-wally text-white ml-2"
              : "bg-gray-100 text-gray-600 mr-2"
          }`}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        <div
          className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
        >
          <div
            className={`rounded-lg px-4 py-2 ${
              isUser
                ? "bg-wally text-white rounded-tr-none"
                : "bg-gray-100 text-gray-800 rounded-tl-none"
            }`}
          >
            {message}
          </div>

          {dropzone && <div className="mt-2 w-full max-w-md">{dropzone}</div>}

          <span className="text-xs text-gray-500 mt-1">{timestamp}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
