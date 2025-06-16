import React, { useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageViewerProps {
  url: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ url }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading image...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-500">
              <ImageIcon size={48} className="mx-auto mb-4" />
              <p className="font-medium">Error loading image</p>
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <img
            src={url}
            alt="Document"
            className={`max-w-full h-auto border border-gray-300 shadow-lg ${loading ? 'hidden' : ''}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;