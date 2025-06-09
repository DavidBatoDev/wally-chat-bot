// client/src/components/chat/messages/FileCardMessage.tsx
"use client";
import React from "react";
import { FileText } from "lucide-react";

interface FileCardMessageProps {
  body: any;
  onViewFile?: (message: any) => void;
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}

const FileCardMessage: React.FC<FileCardMessageProps> = ({ 
  body, 
  onButtonClick, 
  onViewFile 
}) => {
  const { title, summary, thumbnail, status, actions = [] } = body;
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 m-3">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="File thumbnail" className="w-12 h-12 rounded object-cover" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          {summary && <p className="text-sm text-gray-500 mt-1">{summary}</p>}
          {status && (
            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
              status === 'ready' ? 'bg-green-100 text-green-800' :
              status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {status}
            </span>
          )}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {actions.map((action: any, index: number) => (
            <button
              key={index}
              onClick={() => onButtonClick?.(action.action, {})}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileCardMessage;