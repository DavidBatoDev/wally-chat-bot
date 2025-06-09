// client/src/components/chat/NoMessagesComponent.tsx
"use client";
import React, { useState, useRef } from "react";
import { Upload, Globe, MessageCircle, FileText, Loader2 } from "lucide-react";

interface NoMessagesComponentProps {
  onSendMessage: (text: string) => void;
  onFileUploaded: (fileMessage: any) => void;
  conversationId: string;
}

const NoMessagesComponent: React.FC<NoMessagesComponentProps> = ({
  onSendMessage,
  onFileUploaded,
  conversationId,
}) => {
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Import the chatApi dynamically to avoid circular dependencies
      const { default: chatApi } = await import("@/lib/api/chatApi");
      
      const fileMessage = await chatApi.uploadFile(
        conversationId,
        file,
        (progress) => setUploadProgress(progress)
      );
      
      onFileUploaded(fileMessage);
    } catch (error) {
      console.error("File upload failed:", error);
      // You might want to show an error toast here
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetLanguage.trim()) {
      onSendMessage(`I want to translate my document to ${targetLanguage.trim()}`);
      setTargetLanguage("");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center mb-3">
          {/* <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome to Document Translation
          </h2> */}
          <p className="text-gray-600">
            Get started by following these simple steps to translate your document
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-3">
          {/* Card 1: Upload Document */}
          <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-red-400" />
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">1. Upload Document</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload the document you want to translate. Supported formats: PDF, DOCX, TXT
                </p>
              </div>

              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className="w-full bg-red-400 hover:bg-red-500 disabled:bg-red-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Choose File</span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
              />
            </div>
          </div>

          {/* Card 2: Target Language */}
          <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Globe className="w-6 h-6 text-red-400" />
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">2. Choose Language</h3>
                <p className="text-sm text-gray-600 mb-4">
                  What language do you want to translate your document into?
                </p>
              </div>

              <form onSubmit={handleLanguageSubmit} className="w-full space-y-3">
                <input
                  type="text"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  placeholder="e.g., Spanish, French, German..."
                  className="w-full px-3 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!targetLanguage.trim()}
                  className="w-full bg-red-400 hover:bg-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Set Language
                </button>
              </form>
            </div>
          </div>

          {/* Card 3: Start Chatting */}
          <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-red-400" />
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">3. Start Chatting</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Once you've uploaded your document and set your target language, start chatting to begin the translation process!
                </p>
              </div>

              <div className="w-full bg-red-50 border border-red-200 text-gray-700 px-4 py-2 rounded-lg text-sm">
                Ready to help you translate your document!
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center pt-2 border-t border-red-100">
          <p className="text-sm text-gray-500">
            💡 <strong>Tip:</strong> You can upload your document and set your language in any order. 
            I'll guide you through the translation process step by step.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NoMessagesComponent;