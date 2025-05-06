import React, { useState, useRef, useEffect } from 'react';
import ChatMessage, { ChatMessageProps } from './ChatMessage';
import ChatInput from './ChatInput';
import { useGenAI } from '@/hooks/useGenAI';

interface ChatContainerProps {
  onDocumentStateChange?: (isActive: boolean) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ onDocumentStateChange }) => {
  const { messages: genAIMessages, isLoading, sendMessage: sendGenAIMessage } = useGenAI();
  const [documentActive, setDocumentActive] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [genAIMessages]);

  // Convert GenAI messages to ChatMessage UI props
  const chatMessages: ChatMessageProps[] = genAIMessages.map(msg => ({
    message: msg.content,
    isUser: msg.role === 'user',
    timestamp: "Just now",
    // Add upload action to the initial bot message
    actions: msg.role === 'model' && genAIMessages.length === 1 
      ? [
          {
            type: 'upload',
            label: 'Upload Document',
            onClick: () => handleUploadClick()
          }
        ] 
      : undefined
  }));

  const handleSendMessage = async (message: string) => {
    // Check if message is related to document upload
    if (message.toLowerCase().includes('document') || message.toLowerCase().includes('upload')) {
      // Add user message
      const userMessage: ChatMessageProps = {
        message,
        isUser: true,
        timestamp: "Just now"
      };
      
      // Special handling for document requests
      const botResponse: ChatMessageProps = {
        message: "I see you want to work with a document. Please upload one using the button below, and I'll help you process it.",
        isUser: false,
        timestamp: "Just now",
        actions: [
          {
            type: 'upload',
            label: 'Upload Document',
            onClick: () => handleUploadClick()
          }
        ]
      };

      // We're manually handling this special case
      await sendGenAIMessage(message);
      
      // Skip the rest of the function since we've handled the message manually
      return;
    }
    
    // For normal messages, use the GenAI service
    await sendGenAIMessage(message);
  };

  const handleUploadClick = () => {
    // Create a hidden file input if it doesn't exist
    if (!fileInputRef) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
      input.style.display = 'none';
      
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          handleFileUpload(target.files[0]);
        }
      };
      
      document.body.appendChild(input);
      setFileInputRef(input);
      input.click();
    } else {
      fileInputRef.click();
    }
  };

  const handleFileUpload = (file: File) => {
    // Simulate file upload success
    const newDocumentActive = true;
    setDocumentActive(newDocumentActive);
    
    if (onDocumentStateChange) {
      onDocumentStateChange(newDocumentActive);
    }
    
    // Add a bot message acknowledging the upload
    sendGenAIMessage(`Great! I've received your document "${file.name}". You can now see it in the document panel. What would you like me to do with it?`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-medium">Chat with Wally</h2>
        <p className="text-sm text-gray-500">Ask questions about your document</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {chatMessages.map((msg, index) => (
          <ChatMessage
            key={index}
            message={msg.message}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
            actions={msg.actions}
          />
        ))}
        {isLoading && (
          <div className="flex items-center mt-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full mr-1 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full mr-1 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
        {/* Invisible div at the end of messages to scroll to */}
        <div ref={messagesEndRef} />
      </div>
      
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatContainer;
