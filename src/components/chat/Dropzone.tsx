import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";

interface DropzoneProps {
  onFileDrop: (file: File) => void;
  isUploading?: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({
  onFileDrop,
  isUploading = false,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileDrop(acceptedFiles[0]);
      }
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxFiles: 1,
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors ${
        isUploading
          ? "border-gray-300 bg-gray-50 cursor-not-allowed"
          : isDragActive
          ? "border-wally bg-wally-50 cursor-pointer"
          : "border-gray-300 hover:border-wally hover:bg-wally-50 cursor-pointer"
      }`}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <Loader2 className="w-8 h-8 mb-2 text-gray-400 animate-spin" />
      ) : (
        <Upload
          className={`w-8 h-8 mb-2 ${
            isDragActive ? "text-wally" : "text-gray-400"
          }`}
        />
      )}
      <p className="text-sm text-gray-600 text-center">
        {isUploading
          ? "Uploading document..."
          : isDragActive
          ? "Drop your file here"
          : "Drag and drop your document here, or click to select"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Supports PDF, DOC, DOCX, TXT, PNG, JPG
      </p>
    </div>
  );
};

export default Dropzone;
