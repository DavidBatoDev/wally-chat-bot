// client/src/components/chat/messages/ButtonsMessage.tsx
"use client";
import React from "react";
import ReactMarkdown from 'react-markdown';

interface ButtonsMessageProps {
  body: any;
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}

const ButtonsMessage: React.FC<ButtonsMessageProps> = ({ body, onButtonClick }) => {
  const { prompt, buttons = [] } = body;
  
  return (
    <div className="space-y-3 p-3">
      {prompt && (
        <div className="text-gray-800 mb-3">
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {buttons.map((button: any, index: number) => (
          <button
            key={index}
            onClick={() => onButtonClick?.(button.action, {})}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              button.style === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-wally text-white hover:bg-wally/90'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ButtonsMessage;