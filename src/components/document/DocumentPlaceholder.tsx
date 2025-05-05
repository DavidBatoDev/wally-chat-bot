
import React from 'react';
import { Upload } from 'lucide-react';

const DocumentPlaceholder = () => {
  return (
    <div className="canvas-placeholder h-full flex flex-col items-center justify-center text-gray-500">
      <Upload size={48} className="mb-4 text-wally-300" />
      <h3 className="font-medium mb-2">No document uploaded</h3>
      <p className="text-sm text-center max-w-xs mb-6">
        Upload a document to start working with Wally. We support various formats including PDF, DOCX, and images.
      </p>
      
      <div className="flex space-x-4">
        <button className="bg-wally text-white px-4 py-2 rounded-md hover:bg-wally-dark transition-colors">
          Upload Document
        </button>
        <button className="border border-gray-200 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
          Try Demo
        </button>
      </div>
    </div>
  );
};

export default DocumentPlaceholder;
