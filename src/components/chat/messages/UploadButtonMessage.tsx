// client/src/components/chat/messages/UploadButtonMessage.tsx
"use client";
import React, { useRef, useState } from "react";
import { AlertCircle, Upload, X } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import api from '@/lib/api';

interface UploadButtonMessageProps {
  body: any;
  conversationId?: string;
  onFileUploaded?: (message: any) => void;
}

const UploadButtonMessage: React.FC<UploadButtonMessageProps> = ({ 
  body, 
  conversationId, 
  onFileUploaded 
}) => {
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
        onFileUploaded?.(fileMessage);
        
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

export default UploadButtonMessage;