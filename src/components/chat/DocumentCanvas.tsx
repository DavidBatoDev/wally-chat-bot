// client/src/components/chat/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileText, Image, File, AlertCircle, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface DocumentCanvasProps {
  fileData: any;
  onClose: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({ 
  fileData, 
  onClose, 
  width = 320, 
  onWidthChange 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width);
  
  const resizeRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  console.log('DocumentCanvas fileData:', fileData);

  // Reset state when document changes
  useEffect(() => {
    if (fileData) {
      setZoom(100);
      setRotation(0);
      setError(null);
      setLoading(true);
    }
  }, [fileData]);

  // Update width when prop changes
  useEffect(() => {
    setCurrentWidth(width);
  }, [width]);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [currentWidth]);

  // Handle mouse move during resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = startXRef.current - e.clientX; // Note: reversed because we're resizing from the left
    const newWidth = Math.max(280, Math.min(800, startWidthRef.current + deltaX));
    
    setCurrentWidth(newWidth);
    onWidthChange?.(newWidth);
  }, [isResizing, onWidthChange]);

  // Handle mouse up to end resize
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  // Early return if no file data
  if (!fileData) {
    console.log('DocumentCanvas: No file data provided');
    return (
      <div 
        className="border-l border-gray-200 flex flex-col bg-white relative"
        style={{ width: currentWidth }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-500 transition-colors" />
        </div>
        
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No file selected</p>
            <button
              onClick={onClose}
              className="mt-3 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { filename, mime_type, public_url, size_bytes } = fileData;

  // Additional validation to ensure we have the required data
  if (!filename || !public_url) {
    console.log('DocumentCanvas: Missing required file data', { filename, public_url });
    return (
      <div 
        className="border-l border-gray-200 flex flex-col bg-white relative"
        style={{ width: currentWidth }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-500 transition-colors" />
        </div>
        
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-500">Error loading document</p>
            <p className="text-xs text-gray-500 mt-1">Missing required file information</p>
            <button
              onClick={onClose}
              className="mt-3 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type category
  const getFileType = (mimeType: string) => {
    if (mimeType?.includes('image')) return 'image';
    if (mimeType?.includes('pdf')) return 'pdf';
    if (mimeType?.includes('text')) return 'text';
    if (mimeType?.includes('video')) return 'video';
    if (mimeType?.includes('audio')) return 'audio';
    return 'other';
  };

  const fileType = getFileType(mime_type);

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = public_url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Render file content based on type
  const renderFileContent = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded overflow-hidden">
            <div 
              className="transition-transform duration-200 ease-in-out"
              style={{ 
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            >
              <img
                src={public_url}
                alt={filename}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Failed to load image');
                }}
              />
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="h-full bg-gray-50 rounded overflow-hidden">
            <iframe
              src={`${public_url}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full border-none"
              title={filename}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load PDF');
              }}
            />
          </div>
        );

      case 'text':
        return (
          <div className="h-full bg-white border rounded overflow-auto">
            <iframe
              src={public_url}
              className="w-full h-full border-none"
              title={filename}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load text file');
              }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded">
            <video
              src={public_url}
              controls
              className="max-w-full max-h-full"
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load video');
              }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded">
            <div className="text-center space-y-3 p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm truncate" title={filename}>
                  {filename}
                </h3>
                <audio
                  src={public_url}
                  controls
                  className="mt-3 w-full max-w-xs"
                  onLoadedData={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError('Failed to load audio');
                  }}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded">
            <div className="text-center space-y-3 p-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <File className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm truncate" title={filename}>
                  {filename}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {mime_type} • {formatFileSize(size_bytes)}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Preview not available
                </p>
                <button
                  onClick={handleDownload}
                  className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="border-l border-gray-200 flex flex-col bg-white relative"
      style={{ width: currentWidth }}
      ref={resizeRef}
    >
      {/* Resize handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors group z-10 ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-500'
        }`} />
      </div>

      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {fileType === 'image' && <Image className="w-4 h-4 text-blue-600" />}
            {fileType === 'pdf' && <FileText className="w-4 h-4 text-red-600" />}
            {fileType === 'text' && <FileText className="w-4 h-4 text-green-600" />}
            {(fileType === 'other' || fileType === 'video' || fileType === 'audio') && <File className="w-4 h-4 text-gray-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-gray-900 truncate" title={filename}>
              {filename}
            </h2>
            <p className="text-xs text-gray-500">
              {formatFileSize(size_bytes || 0)}
            </p>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Zoom controls for images */}
          {fileType === 'image' && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Zoom Out"
                disabled={zoom <= 25}
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs text-gray-600 min-w-[2.5rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Zoom In"
                disabled={zoom >= 200}
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={handleRotate}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Rotate"
              >
                <RotateCw size={14} />
              </button>
            </>
          )}
          
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Download"
          >
            <Download size={14} />
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-xs text-gray-600">Loading...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 p-4">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-sm text-red-600 font-medium">Failed to load file</p>
              <p className="text-xs text-gray-500">{error}</p>
              <button
                onClick={handleDownload}
                className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full">
            {renderFileContent()}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;