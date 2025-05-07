import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(!isUser);
  
  useEffect(() => {
    if (isUser) {
      setDisplayedText(message);
      return;
    }
    
    // Reset for new messages
    setDisplayedText('');
    setIsTyping(true);
    
    let i = 0;
    const typingSpeed = 10; // Adjust for faster or slower typing
    
    const typingInterval = setInterval(() => {
      if (i < message.length) {
        setDisplayedText(message.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, typingSpeed);
    
    return () => clearInterval(typingInterval);
  }, [message, isUser]);

  return (
    <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start max-w-[80%] ${isUser ? 'flex-row' : 'flex-row max-w-[100%] '}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full wally-gradient flex items-center justify-center text-white font-bold mr-2 flex-shrink-0">
            W
          </div>
        )}
        
        <div
          className={`px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-wally text-white'
              : 'text-gray-800'
          }`}
        >
          {isUser ? (
            <p className="text-sm">{message}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{displayedText}</ReactMarkdown>
              {isTyping && <span className="typing-cursor">▌</span>}
            </div>
          )}
          
          {actions && actions.length > 0 && !isTyping && (
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
          
          {timestamp && !isTyping && (
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
