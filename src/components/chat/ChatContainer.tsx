
import React, { useState } from 'react';
import ChatMessage, { ChatMessageProps } from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatContainerProps {
  onDocumentStateChange?: (isActive: boolean) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ onDocumentStateChange }) => {
  const [messages, setMessages] = useState<ChatMessageProps[]>([
    {
      message: "Hi there! I'm Wally, your document assistant. Upload a document and I can help you understand it, translate it, or extract information from it.",
      isUser: false,
      timestamp: "Just now"
    }
  ]);
  
  const [documentActive, setDocumentActive] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);

  const handleSendMessage = (message: string) => {
    // Add user message
    const userMessage: ChatMessageProps = {
      message,
      isUser: true,
      timestamp: "Just now"
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Simulate bot response
    setTimeout(() => {
      let botResponse: ChatMessageProps;
      
      // Example logic to simulate document interaction prompt
      if (message.toLowerCase().includes('document') || message.toLowerCase().includes('upload')) {
        botResponse = {
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
      } else {
        botResponse = {
          message: "How can I help you with your documents today?",
          isUser: false,
          timestamp: "Just now"
        };
      }
      
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
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
    const botResponse: ChatMessageProps = {
      message: `Great! I've received your document "${file.name}". You can now see it in the document panel. What would you like me to do with it?`,
      isUser: false,
      timestamp: "Just now"
    };
    
    setMessages(prev => [...prev, botResponse]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-medium">Chat with Wally</h2>
        <p className="text-sm text-gray-500">Ask questions about your document</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {messages.map((msg, index) => (
          <ChatMessage
            key={index}
            message={msg.message}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
            actions={msg.actions}
          />
        ))}
      </div>
      
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatContainer;
