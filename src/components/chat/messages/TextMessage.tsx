"use client";
import React from "react";
import ReactMarkdown from 'react-markdown';

interface TextMessageProps {
  body: any;
  isUser: boolean;
}

const TextMessage: React.FC<TextMessageProps> = ({ body, isUser }) => {
  const text = body?.text || (typeof body === 'string' ? body : JSON.stringify(body));
  
  return (
    <div className={`prose prose-sm max-w-none p-3 leading-tight ${isUser ? "text-white" : "text-gray-800"}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};

export default TextMessage;