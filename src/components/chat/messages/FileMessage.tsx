// client/src/components/chat/messages/FileMessage.tsx
"use client";
import React, { useState } from "react";
import { Download, FileText, X, ZoomIn } from "lucide-react";

interface FileMessageProps {
  body: any;
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}

const FileMessage: React.FC<FileMessageProps> = ({ 
  body, 
  onButtonClick
}) => {
  const { file_id, filename, mime_type, size_bytes, public_url } = body;
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if file is an image
  const isImage = mime_type?.startsWith('image/');
  const isPDF = mime_type === 'application/pdf';
  
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

  const handleViewFile = () => {
    if (isImage) {
      setShowImageModal(true);
    } else if (isPDF) {
      // Open PDF in new tab
      window.open(public_url, '_blank');
    } else {
      // For other file types, trigger download or show unsupported message
      handleDownloadClick();
    }
  };

  const handleDownloadClick = () => {
    if (public_url) {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = public_url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      onButtonClick?.('download', { file_id, public_url, filename });
    }
  };

  // Image Modal Component
  const ImageModal = () => {
    if (!showImageModal || !isImage) return null;

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
        onClick={() => setShowImageModal(false)}
      >
        <div className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
          >
            <X size={20} />
          </button>
          
          {/* Image container */}
          <div className="relative w-full h-full flex items-center justify-center p-16">
            <img
              src={public_url}
              alt={filename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* File info overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-60 text-white px-4 py-3 rounded-lg backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{filename}</p>
                <p className="text-xs text-gray-300 mt-1">{fileSize} • {mime_type?.split('/')[1]?.toUpperCase()}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadClick();
                }}
                className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-md transition-all duration-200 text-sm"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg bg-gray-50 max-w-sm overflow-hidden">
        {/* Image Preview */}
        {isImage && public_url && (
          <div className="relative group cursor-pointer" onClick={handleViewFile}>
            <img
              src={public_url}
              alt={filename}
              className="w-full h-48 object-cover bg-white transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
              <ZoomIn 
                size={24} 
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity" 
              />
            </div>
          </div>
        )}

        {/* File Info */}
        <div className="p-4">
          <div className="flex items-start space-x-3">
            {!isImage && (
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm">
                  {fileIcon}
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate" title={filename}>
                {filename}
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                {fileSize} • {mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
              </p>
            </div>
          </div>
          

        </div>
      </div>

      {/* Image Modal */}
      <ImageModal />
    </>
  );
};

export default FileMessage;