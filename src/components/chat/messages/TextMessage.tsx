"use client";
import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, Cpu, FileText } from 'lucide-react';

interface TextMessageProps {
  body: any;
  isUser: boolean;
}

const TextMessage: React.FC<TextMessageProps> = ({ body, isUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = body?.text || (typeof body === 'string' ? body : JSON.stringify(body));
  
  // Check if this is a special step
  const isIntermediateStep = text.startsWith("[Intermediate Step]");
  const isExtractionStep = text.startsWith("[Extraction Step]");
  
  if (isIntermediateStep) {
    // Remove the "[Intermediate Step]" prefix
    const cleanedText = text.replace(/^\[Intermediate Step\]\s*/, '');
    
    return (
      <div className={`max-w-none ${isUser ? "text-white" : "text-gray-800"}`}>
        {/* Intermediate Step Collapsible Header */}
        <div 
          className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-opacity-80 transition-colors ${
            isUser ? "hover:bg-white hover:bg-opacity-10" : "hover:bg-gray-50"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={`p-1.5 rounded-md ${
            isUser ? "bg-white bg-opacity-20" : "bg-blue-100"
          }`}>
            <Cpu size={14} className={isUser ? "text-white" : "text-blue-600"} />
          </div>
          
          <span className={`text-sm font-medium flex-1 ${
            isUser ? "text-white text-opacity-90" : "text-blue-700"
          }`}>
            Thought Process
          </span>
          
          <div className={`transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}>
            {isExpanded ? (
              <ChevronDown size={16} className={isUser ? "text-white text-opacity-70" : "text-blue-500"} />
            ) : (
              <ChevronRight size={16} className={isUser ? "text-white text-opacity-70" : "text-blue-500"} />
            )}
          </div>
        </div>
        
        {/* Intermediate Step Collapsible Content */}
        {isExpanded && (
          <div className={`px-3 pb-3 prose prose-sm max-w-none leading-tight ${
            isUser ? "text-white prose-invert" : "text-gray-800"
          }`}>
            <div className={`border-l-2 pl-3 ${
              isUser ? "border-white border-opacity-30" : "border-blue-200"
            }`}>
              <ReactMarkdown>{cleanedText}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (isExtractionStep) {
    // Remove the "[Extraction Step]" prefix
    const cleanedText = text.replace(/^\[Extraction Step\]\s*/, '');
    
    return (
      <div className={`max-w-none ${isUser ? "text-white" : "text-gray-800"}`}>
        {/* Extraction Step Collapsible Header */}
        <div 
          className={`flex items-center gap-2 p-2.5 cursor-pointer hover:bg-opacity-80 transition-colors ${
            isUser ? "hover:bg-white hover:bg-opacity-10" : "hover:bg-emerald-50"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={`p-1 rounded-md ${
            isUser ? "bg-emerald-200 bg-opacity-30" : "bg-emerald-100"
          }`}>
            <FileText size={12} className={isUser ? "text-emerald-200" : "text-emerald-600"} />
          </div>
          
          <span className={`text-sm font-medium flex-1 ${
            isUser ? "text-emerald-200" : "text-emerald-700"
          }`}>
            Data Extraction
          </span>
          
          <div className={`transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}>
            {isExpanded ? (
              <ChevronDown size={14} className={isUser ? "text-emerald-200 text-opacity-70" : "text-emerald-500"} />
            ) : (
              <ChevronRight size={14} className={isUser ? "text-emerald-200 text-opacity-70" : "text-emerald-500"} />
            )}
          </div>
        </div>
        
        {/* Extraction Step Collapsible Content */}
        {isExpanded && (
          <div className={`px-2.5 pb-2.5 prose prose-xs max-w-none leading-tight text-xs ${
            isUser ? "text-white prose-invert" : "text-gray-800"
          }`}>
            <div className={`border-l-2 pl-2.5 ${
              isUser ? "border-emerald-200 border-opacity-30" : "border-emerald-200"
            }`}>
              <ReactMarkdown>{cleanedText}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Regular message rendering
  return (
    <div className={`prose prose-sm max-w-none p-3 leading-tight ${isUser ? "text-white" : "text-gray-800"}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};

export default TextMessage;