import React, { useState, useRef, useEffect } from "react";
import ChatMessage, { ChatMessageProps } from "./ChatMessage";
import ChatInput from "./ChatInput";
import Dropzone from "./Dropzone";
import { useGenAI } from "@/hooks/useGenAI";
import { useAuthStore } from "@/lib/store/auth";
import { uploadFile } from "@/lib/supabase/storage";
import { toast } from "sonner";
import * as Accordion from "@radix-ui/react-accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatContainerProps {
  onDocumentStateChange?: (isActive: boolean) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  onDocumentStateChange,
}) => {
  const {
    messages: genAIMessages,
    isLoading,
    sendMessage: sendGenAIMessage,
  } = useGenAI();
  const { user } = useAuthStore();
  const [documentActive, setDocumentActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [genAIMessages]);

  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast.error("Please sign in to upload documents");
      return;
    }

    try {
      setIsUploading(true);

      // Upload file to Supabase Storage
      const uploadedFile = await uploadFile(file, user.id);

      // Update document state
      const newDocumentActive = true;
      setDocumentActive(newDocumentActive);

      if (onDocumentStateChange) {
        onDocumentStateChange(newDocumentActive);
      }

      // Add a bot message acknowledging the upload
      await sendGenAIMessage(
        `Great! I've received your document "${file.name}". You can now see it in the document panel. What would you like me to do with it?`
      );

      toast.success("Document uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Convert GenAI messages to ChatMessage UI props
  const chatMessages: ChatMessageProps[] = genAIMessages.map((msg) => ({
    message: msg.content,
    isUser: msg.role === "user",
    timestamp: "Just now",
    // Add dropzone to the initial bot message
    dropzone:
      msg.role === "model" && genAIMessages.length === 1 ? (
        <Dropzone onFileDrop={handleFileUpload} isUploading={isUploading} />
      ) : undefined,
  }));

  const handleSendMessage = async (message: string) => {
    // Check if message is related to document upload
    if (
      message.toLowerCase().includes("document") ||
      message.toLowerCase().includes("upload")
    ) {
      // Add user message
      const userMessage: ChatMessageProps = {
        message,
        isUser: true,
        timestamp: "Just now",
      };

      // Special handling for document requests
      const botResponse: ChatMessageProps = {
        message:
          "I see you want to work with a document. Please drag and drop your file below, or click to select one.",
        isUser: false,
        timestamp: "Just now",
        dropzone: (
          <Dropzone onFileDrop={handleFileUpload} isUploading={isUploading} />
        ),
      };

      // We're manually handling this special case
      await sendGenAIMessage(message);

      // Skip the rest of the function since we've handled the message manually
      return;
    }

    // For normal messages, use the GenAI service
    await sendGenAIMessage(message);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-medium">Chat with Wally</h2>
        <p className="text-sm text-gray-500">
          Ask questions about your document
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <div className="max-w-3xl mx-auto">
          {chatMessages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg.message}
              isUser={msg.isUser}
              timestamp={msg.timestamp}
              dropzone={msg.dropzone}
            />
          ))}
          {isLoading && (
            <div className="flex items-center mt-2">
              <div
                className="w-2 h-2 bg-gray-500 rounded-full mr-1 animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-gray-500 rounded-full mr-1 animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </div>
          )}
          {/* Invisible div at the end of messages to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput onSendMessage={handleSendMessage} />

      {/* Accordion for file upload */}
      <Accordion.Root
        type="single"
        collapsible
        value={accordionOpen ? "upload" : undefined}
        onValueChange={(v) => setAccordionOpen(v === "upload")}
        className="w-full max-w-3xl mx-auto"
      >
        <Accordion.Item value="upload">
          <Accordion.Header>
            <Accordion.Trigger className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-left font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              <span>Upload a document</span>
              <svg
                className={`ml-2 transition-transform ${
                  accordionOpen ? "rotate-180" : ""
                }`}
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden animate-accordion-down">
            <Card className="my-4">
              <CardHeader>
                <CardTitle>Upload your document</CardTitle>
              </CardHeader>
              <CardContent>
                <Dropzone
                  onFileDrop={handleFileUpload}
                  isUploading={isUploading}
                />
              </CardContent>
            </Card>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
};

export default ChatContainer;
