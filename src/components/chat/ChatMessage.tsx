// client/src/components/chat/ChatMessage.tsx
"use client";
import React, { useRef, useState } from "react";
import { User, Bot, CheckCheck, Check, AlertCircle, FileText, Download, Upload, X } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import api from '@/lib/api';

export type MessageStatus = "sending" | "sent" | "error";

/* ------------------------------------------------------------------ */
/* Types for chat messages                                            */
export interface ChatMessageProps {
  isUser: boolean;
  timestamp: string;
  status?: MessageStatus;
  kind?: string;
  body?: any; 
  conversationId?: string;
  onButtonClick?: (action: string, values: Record<string, any>) => void;
  onFileUploaded?: (message: any) => void; 
  onViewFile?: (message: any) => void;
}


/* ------------------------------------------------------------------ */
/* Status Indicator component                                         */
const StatusIndicator: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  if (status === "sent") {
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
  status?: MessageStatus;
}> = ({ children, isUser, status }) => (
  <div
    className={`rounded-2xl ${
      isUser
        ? `bg-wally text-white rounded-tr-none shadow-md ${
            status === 'error' ? 'bg-red-500' : ''
          }`
        : "bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100"
    }`}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Message content renderers based on kind                           */
const TextMessage: React.FC<{ body: any; isUser: boolean }> = ({ body, isUser }) => {
  const text = body?.text || (typeof body === 'string' ? body : JSON.stringify(body));
  
  return (
    <div className={`prose prose-sm max-w-none p-3 ${isUser ? "text-white" : "text-gray-800"}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};

const ButtonsMessage: React.FC<{ 
  body: any; 
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}> = ({ body, onButtonClick }) => {
  const { prompt, buttons = [] } = body;
  
  return (
    <div className="space-y-3">
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

const UploadButtonMessage: React.FC<{ 
  body: any;
  conversationId?: string;
  onFileUploaded?: (message: any) => void;
}> = ({ body, conversationId, onFileUploaded }) => {
  const { prompt, config, ui } = body;
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (config.accepted_types && !config.accepted_types.includes(file.type)) {
      setUploadError(`File type ${file.type} is not accepted`);
      return;
    }

    // Validate file size
    const maxSizeBytes = (config.max_size_mb || 10) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError(`File size exceeds ${config.max_size_mb || 10}MB limit`);
      return;
    }

    setUploadError(null);
    uploadFile(file);
  };

  const handleFileUploaded = (message: any) => {
      if (onFileUploaded) {
        onFileUploaded(message);
      }
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', conversationId ?? '');

      const response = await api.post(config.upload_endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        console.log('File uploaded successfully:', response.data);
        
        // Create the file message object that matches the backend response
        const fileMessage = {
          id: response.data.message.id,
          conversation_id: conversationId,
          sender: 'user',
          kind: 'file',
          body: {
            file_id: response.data.file_id,
            filename: file.name,
            mime_type: response.data.mime_type,
            size_bytes: response.data.size_bytes,
            public_url: response.data.public_url
          },
          created_at: response.data.message.created_at || new Date().toISOString(),
          status: 'sent'
        };
        
        // Call the callback to add the message to the chat
        handleFileUploaded?.(fileMessage);
        
      } else {
        setUploadError(response.data.message || 'Failed to upload file');
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(
        error.response?.data?.message || 
        error.message || 
        'Failed to upload file'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const formatAcceptedTypes = () => {
    if (!config.accepted_types) return '';
    return config.accepted_types.join(',');
  };

  return (
    <div className="p-4 space-y-3">
      {prompt && (
        <div className="text-gray-800 mb-3">
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      )}
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragging 
            ? 'border-wally bg-wally/5 scale-105' 
            : 'border-gray-300 hover:border-wally hover:bg-gray-50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={formatAcceptedTypes()}
          multiple={config.multiple || false}
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center space-y-2">
          {isUploading ? (
            <>
              <div className="w-8 h-8 border-2 border-wally border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">
                  {ui?.button_text || 'Choose File'}
                </p>
                <p className="text-xs text-gray-500">
                  {ui?.drag_drop_text || 'Drag and drop a file here or click to browse'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File constraints info */}
      <div className="text-xs text-gray-500 space-y-1">
        {ui?.max_size_text && (
          <p>{ui.max_size_text}</p>
        )}
        {ui?.accepted_types_text && (
          <p>{ui.accepted_types_text}</p>
        )}
      </div>

      {/* Error display */}
      {uploadError && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{uploadError}</p>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const FileCardMessage: React.FC<{ body: any; onButtonClick?: (action: string, values: Record<string, any>) => void }> = ({ body, onButtonClick }) => {
  const { title, summary, thumbnail, status, actions = [] } = body;
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
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

const ActionMessage: React.FC<{ body: any }> = ({ body }) => {
  const { action, values } = body;
  
  return (
    <div className="text-sm text-gray-600 italic">
      Action: {action} {values && Object.keys(values).length > 0 && `(${JSON.stringify(values)})`}
    </div>
  );
};

const FileMessage: React.FC<{ 
  body: any; 
  onButtonClick?: (action: string, values: Record<string, any>) => void;
  onViewFile?: (message: any) => void;
  messageData?: any; 
}> = ({ body, onButtonClick, onViewFile }) => {
  const { file_id, filename, mime_type, size_bytes, public_url } = body;
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file extension and type icon
  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('video')) return '🎥';
    if (mimeType?.includes('audio')) return '🎵';
    if (mimeType?.includes('text') || filename?.endsWith('.txt')) return '📝';
    if (filename?.endsWith('.doc') || filename?.endsWith('.docx')) return '📄';
    if (filename?.endsWith('.xls') || filename?.endsWith('.xlsx')) return '📊';
    if (filename?.endsWith('.ppt') || filename?.endsWith('.pptx')) return '📽️';
    return '📎';
  };

  const fileIcon = getFileIcon(mime_type, filename);
  const fileSize = formatFileSize(size_bytes);

  const handleViewClick = () => {
    onViewFile?.(body);
  };

  const handleDownloadClick = () => {
    onButtonClick?.('download', { file_id, public_url, filename });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-w-sm">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm">
            {fileIcon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate" title={filename}>
            {filename}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {fileSize} • {mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={handleDownloadClick}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white text-gray-700 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <Download size={12} />
          Download
        </button>
        <button
          onClick={handleViewClick}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-wally text-white rounded-md hover:bg-wally/90 transition-colors"
        >
          <FileText size={12} />
          View
        </button>
      </div>
    </div>
  );
};


/* ------------------------------------------------------------------ */
/* Main component                                                     */
const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { isUser, timestamp, status, kind, conversationId, body, onButtonClick, onViewFile, onFileUploaded } = props;

  // Render content based on message kind
  const renderContent = () => {
    switch (kind) {
      case 'text':
        return <TextMessage body={body} isUser={isUser} />;
      case 'buttons':
        return <ButtonsMessage body={body} onButtonClick={onButtonClick} />;
      case 'upload_button':
        return <UploadButtonMessage body={body} conversationId={conversationId} onFileUploaded={onFileUploaded} />;
      case 'file_card':
        return <FileCardMessage body={body} onButtonClick={onButtonClick} />;
      case 'action':
        return <ActionMessage body={body} />;
      case 'file':
        return <FileMessage body={body} onButtonClick={onButtonClick} onViewFile={onViewFile} />;
      default:
        // Fallback for unknown kinds - treat as text
        return <TextMessage body={body} isUser={isUser} />;
    }
  };

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
          <Bubble isUser={isUser} status={status}>
            {renderContent()}
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