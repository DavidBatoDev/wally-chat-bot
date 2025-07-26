import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  ArrowLeft,
  Loader2,
  FileText,
  Globe,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import domtoimage from "dom-to-image";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatbotSidebarProps {
  onBack: () => void;
  documentRef?: React.RefObject<HTMLDivElement | null>;
  sourceLanguage?: string;
  desiredLanguage?: string;
  documentState?: any;
}

export const ChatbotSidebar: React.FC<ChatbotSidebarProps> = ({
  onBack,
  documentRef,
  sourceLanguage,
  desiredLanguage,
  documentState,
}) => {
  const systemPrompt = `You are Wally, a specialized translation assistant. You help users with document translation, language questions, and translation-related tasks. You are knowledgeable about various languages, translation techniques, and document types. Be helpful, professional, and concise in your responses.`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm Wally, your translation specialist assistant. I can help you with document translation, language questions, and translation-related tasks. How can I assist you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentImage, setDocumentImage] = useState<string | null>(null);
  const [isCapturingDocument, setIsCapturingDocument] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const GEMINI_API_KEY = "AIzaSyDuLBe-BMrgc74dbXYjEBmwxdQtPMyN93w";
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  // Capture document image when component mounts or document changes
  useEffect(() => {
    const captureDocument = async () => {
      if (documentRef?.current && documentState?.url) {
        setIsCapturingDocument(true);
        try {
          const dataUrl = await domtoimage.toPng(documentRef.current, {
            quality: 0.8,
            bgcolor: "#ffffff",
            width: documentRef.current.scrollWidth,
            height: documentRef.current.scrollHeight,
          });
          setDocumentImage(dataUrl);
        } catch (error) {
          console.error("Error capturing document:", error);
        } finally {
          setIsCapturingDocument(false);
        }
      }
    };

    captureDocument();
  }, [documentRef, documentState?.url, documentState?.currentPage]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Prepare context information
      const languageContext =
        sourceLanguage && desiredLanguage
          ? `\n\nCurrent translation context:\n- Source language: ${sourceLanguage}\n- Target language: ${desiredLanguage}`
          : "";

      const documentContext = documentState?.url
        ? `\n\nDocument context:\n- Document is loaded and available for reference\n- Current page: ${
            documentState.currentPage || 1
          }`
        : "";

      // Build chat memory (last 10 exchanges, alternating user/bot)
      // Exclude the initial greeting bot message from memory
      const chatHistory = messages.slice(1).slice(-10);
      // Build the parts array
      const parts: any[] = [
        { text: systemPrompt + languageContext + documentContext },
      ];
      // Add previous chat history
      chatHistory.forEach((msg) => {
        parts.push({
          text: `${msg.sender === "user" ? "User" : "Wally"}: ${msg.content}`,
        });
      });
      // Add the new user message
      parts.push({ text: `User: ${userMessage.content}` });
      // Add document image if available
      if (documentImage) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: documentImage.split(",")[1],
          },
        });
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts,
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.candidates[0].content.parts[0].text,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      {/* <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2 hover:bg-blue-100 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Chat with Wally</h3>
              <p className="text-xs text-gray-500">Translation Specialist</p>
            </div>
          </div>
        </div>
      </div> */}

      {/* Document Preview and Language Info */}
      {(documentState?.url || sourceLanguage || desiredLanguage) && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          {/* Document Preview */}
          {documentState?.url && (
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Using this reference
                </span>
                {isCapturingDocument && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                )}
              </div>
              {documentImage ? (
                <div className="relative">
                  <img
                    src={documentImage}
                    alt="Document preview"
                    className="w-full h-32 object-contain border border-gray-200 rounded"
                  />
                  <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                    Page {documentState.currentPage || 1}
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">
                    {isCapturingDocument
                      ? "Capturing document..."
                      : "Document loaded"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.sender === "bot" && (
                    <Bot className="w-4 h-4 mt-1 flex-shrink-0 text-blue-600" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm whitespace-pre-wrap">
                      {message.sender === "bot" ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        message.content
                      )}
                    </div>
                    <p
                      className={`text-xs mt-2 ${
                        message.sender === "user"
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                  {message.sender === "user" && (
                    <User className="w-4 h-4 mt-1 flex-shrink-0 text-blue-100" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <div className="flex items-center space-x-1">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm">Wally is typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Wally about translation..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
