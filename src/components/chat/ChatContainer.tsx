// src/components/chat/ChatContainer.tsx
import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import Dropzone from "./Dropzone";
import { useGenAI } from "@/hooks/useGenAI";
import { useAuthStore } from "@/lib/store/auth";
import { uploadFile } from "@/lib/supabase/storage";
import { toast } from "sonner";
import * as Accordion from "@radix-ui/react-accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dayjs from "dayjs";

interface ChatContainerProps {
  onDocumentStateChange?: (isActive: boolean) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  onDocumentStateChange,
}) => {
  const { messages, isLoading, sendMessage } = useGenAI();
  const { user } = useAuthStore();

  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  /* ─── helpers ─────────────────────────────────────────── */
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(scrollToBottom, [messages]);

  const handleFileUpload = async (file: File) => {
    if (!user) return toast.error("Please sign in");

    try {
      setIsUploading(true);
      const fileData = await uploadFile(file, user.id);

      // Send a file message to inform the LLM about the upload
      await sendMessage({
        role: "user",
        kind: "file",
        content: "",
        body: JSON.stringify({
          file_id: fileData.path,
          display_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });

      // Let the LLM know a document has been uploaded
      await sendMessage({
        role: "user",
        kind: "text",
        content: `I've uploaded a document named "${file.name}". Can you help me with it?`,
      });

      toast.success("Uploaded " + file.name);

      // Notify parent about document state if callback exists
      onDocumentStateChange?.(true);
    } catch (e) {
      console.error("Upload error:", e);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  /* ─── action helpers (buttons / form submit) ──────────── */
  const handleButtonAction = async (action: string) => {
    // Handle specific button actions
    if (action === "upload_document") {
      setAccordionOpen(true);
      return;
    }

    // For other actions, send to backend
    await sendMessage({
      role: "user",
      kind: "action",
      content: "",
      body: JSON.stringify({ action }),
    });
  };

  const handleInputSubmit = async (values: Record<string, string>) => {
    await sendMessage({
      role: "user",
      kind: "action",
      content: "",
      body: JSON.stringify({
        action: "submit_inputs",
        values,
      }),
    });
  };

  const openFileCard = (fileId: string, versionId: string) => {
    // Implement your canvas opener logic here
    console.log("Opening file in canvas:", fileId, versionId);

    // You might want to navigate to another page or open a modal
    // window.open(`/document/${fileId}/${versionId}`, '_blank');

    // Notify parent about document state if callback exists
    onDocumentStateChange?.(true);
  };

  /* ─── map backend msgs → props for ChatMessage ────────── */
  const chatMsgs = messages.map((m, index) => {
    const isLastMessage = index === messages.length - 1;
    const timestamp = m.metadata?.timestamp
      ? dayjs(+m.metadata.timestamp).format("HH:mm")
      : dayjs().format("HH:mm");

    const common = {
      isUser: m.role === "user",
      timestamp: m.metadata?.timestamp
        ? dayjs(+m.metadata.timestamp).format("HH:mm")
        : dayjs().format("HH:mm"),
    };

    switch (m.kind) {
      case "file_card": {
        const j = JSON.parse(m.body || "{}");
        return {
          ...common,
          kind: "file_card" as const,
          fileCard: {
            fileId: j.file_id,
            versionId: j.version_id,
            rev: j.rev,
            title: j.title,
            thumbUrl: j.thumb_url,
          },
          onOpenFileCard: openFileCard,
        };
      }
      case "buttons": {
        const j = JSON.parse(m.body || "{}");
        return {
          ...common,
          kind: "buttons" as const,
          prompt: j.prompt,
          buttons: j.buttons,
          onButton: handleButtonAction,
        };
      }
      case "inputs": {
        const j = JSON.parse(m.body || "{}");
        return {
          ...common,
          kind: "inputs" as const,
          prompt: j.prompt,
          inputs: j.inputs,
          onInputs: handleInputSubmit,
        };
      }
      case "file": {
        const j = JSON.parse(m.body || "{}");
        return {
          ...common,
          kind: "file" as const,
          file: {
            fileId: j.file_id,
            displayName: j.display_name || "File",
          },
        };
      }
      default:
        return {
          ...common,
          kind: "text" as const,
          text: m.content,
          // Only show dropzone for first assistant message or if explicitly requested
          dropzone:
            m.role === "model" &&
            (isLastMessage || messages.length <= 2) &&
            m.content?.includes("upload") ? (
              <Dropzone
                onFileDrop={handleFileUpload}
                isUploading={isUploading}
              />
            ) : undefined,
        };
    }
  });

  /* ─── send user text from input ───────────────────────── */
  const handleSendMessage = async (text: string) => {
    await sendMessage({ role: "user", kind: "text", content: text });
  };

  /* ─── render ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-medium">Chat with Wally</h2>
        <p className="text-sm text-gray-500">Ask about your document</p>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <div className="max-w-3xl mx-auto">
          {chatMsgs.map((p, i) => (
            <ChatMessage key={i} {...p} />
          ))}

          {isLoading && (
            <div className="flex items-center mt-2">
              {["0ms", "150ms", "300ms"].map((d) => (
                <div
                  key={d}
                  className="w-2 h-2 bg-gray-500 rounded-full mr-1 animate-bounce"
                  style={{ animationDelay: d }}
                />
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* User input */}
      <ChatInput onSendMessage={handleSendMessage} />

      {/* Accordion upload (unchanged) */}
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
