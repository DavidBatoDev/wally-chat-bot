
import React from 'react';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';

export interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  actions?: {
    type: 'upload';
    label: string;
    onClick: () => void;
  }[];
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, timestamp, actions }) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex items-start max-w-[80%]">
        {!isUser && (
          <div className="w-8 h-8 rounded-full wally-gradient flex items-center justify-center text-white font-bold mr-2 flex-shrink-0">
            W
          </div>
        )}
        
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-wally text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-800 rounded-tl-none'
          }`}
        >
          <p className="text-sm">{message}</p>
          
          {actions && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                action.type === 'upload' && (
                  <Button 
                    key={index}
                    onClick={action.onClick}
                    className="bg-wally hover:bg-wally-dark text-white flex items-center gap-2"
                    size="sm"
                  >
                    <Upload size={16} />
                    {action.label}
                  </Button>
                )
              ))}
            </div>
          )}
          
          {timestamp && (
            <p className={`text-xs mt-1 ${isUser ? 'text-wally-100' : 'text-gray-500'}`}>
              {timestamp}
            </p>
          )}
        </div>
        
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0">
            <span className="text-sm text-gray-600">You</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
