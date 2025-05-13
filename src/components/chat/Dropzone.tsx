// src/components/chat/Dropzone.tsx
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";

interface DropzoneProps {
  onFileDrop: (file: File) => void;
  isUploading: boolean;
  acceptedFileTypes?: string[];
  maxSizeMB?: number;
}

const Dropzone: React.FC<DropzoneProps> = ({
  onFileDrop,
  isUploading,
  acceptedFileTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ],
  maxSizeMB = 10
}) => {
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  
  const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  
  // Format accepted types for dropzone
  const acceptObject = acceptedFileTypes.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as Record<string, string[]>);
  
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setRejectionMessage(null);
      if (acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    },
    [onFileDrop]
  );
  
  const onDropRejected = useCallback((fileRejections: any[]) => {
    const rejection = fileRejections[0];
    if (rejection?.errors?.[0]?.code === "file-too-large") {
      setRejectionMessage(`File is too large. Maximum size is ${maxSizeMB}MB.`);
    } else if (rejection?.errors?.[0]?.code === "file-invalid-type") {
      setRejectionMessage("File type not supported.");
    } else {
      setRejectionMessage("File couldn't be uploaded.");
    }
  }, [maxSizeMB]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: false,
    accept: acceptObject,
    maxSize
  });
  
  // Create readable list of accepted file types for display
  const readableFileTypes = acceptedFileTypes.map(type => {
    return type
      .replace("application/", "")
      .replace("vnd.openxmlformats-officedocument.wordprocessingml.", "")
      .replace("vnd.openxmlformats-officedocument.spreadsheetml.", "")
      .replace("vnd.ms-", "")
      .toUpperCase();
  }).join(", ");
  
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input {...getInputProps()} disabled={isUploading} />
      
      <div className="flex flex-col items-center justify-center space-y-2">
        {isUploading ? (
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-gray-400" />
        )}
        
        <div className="text-sm font-medium">
          {isDragActive
            ? "Drop the file here"
            : isUploading
            ? "Uploading..."
            : "Drag & drop a file or click to select"}
        </div>
        
        <p className="text-xs text-gray-500">
          Supported formats: {readableFileTypes}
        </p>
        <p className="text-xs text-gray-500">Max size: {maxSizeMB}MB</p>
        
        {rejectionMessage && (
          <p className="text-xs text-red-500 mt-2">{rejectionMessage}</p>
        )}
      </div>
    </div>
  );
};

export default Dropzone;