// client/src/app/chat/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatContainer from "@/components/chat/ChatContainer";
import ChatSidebar from "@/components/chat/ChatSidebar";
import DocumentCanvas from "@/components/chat/DocumentCanvas";
import useChat from "@/hooks/useChat";
import useWorkflow from "@/hooks/useWorkflow";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { useAuthStore } from "@/lib/store/AuthStore";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const conversationId = params?.id as string;
  const [isDocumentCanvasOpen, setIsDocumentCanvasOpen] = useState(false);
  const [showWorkflowButton, setShowWorkflowButton] = useState(false);

  // Initialize chat with the conversation ID from the URL
  const {
    messages,
    loading,
    error,
    activeConversationId,
    sendMessage,
    sendAction,
    createNewConversation,
    handleFileUploaded,
    isConnected
  } = useChat({
    conversationId
  });

  // Initialize workflow detection
  const {
    hasWorkflow,
    workflowData,
    loading: workflowLoading,
    error: workflowError,
    checkWorkflow
  } = useWorkflow(conversationId);

  // Check for workflow after messages change (when new messages arrive)
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      // Small delay to ensure any workflow creation process is complete
      const timeoutId = setTimeout(() => {
        checkWorkflow();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, conversationId, checkWorkflow]);

  // Handle workflow button animation when workflow is detected
  useEffect(() => {
    if (hasWorkflow && !workflowLoading) {
      // Delay the button appearance for a smooth animation
      const timeoutId = setTimeout(() => {
        setShowWorkflowButton(true);
      }, 200);

      return () => clearTimeout(timeoutId);
    } else {
      setShowWorkflowButton(false);
    }
  }, [hasWorkflow, workflowLoading]);

  // Debug logging for workflow state
  useEffect(() => {
    console.log('ChatPage workflow state:', {
      conversationId,
      hasWorkflow,
      workflowData: workflowData ? 'present' : 'none',
      messagesCount: messages.length
    });
  }, [conversationId, hasWorkflow, workflowData, messages.length]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  // Create a new conversation and navigate to it
  const handleNewConversation = async () => {
    try {
      const newConversationId = await createNewConversation();
      router.push(`/chat/${newConversationId}`);
    } catch (error) {
      console.error("Failed to create new conversation:", error);
    }
  };

  // Handle button clicks and actions
  const handleActionClick = (action: string, values: any) => {
    console.log("Action triggered:", action, values);
    sendAction(action, values);
    
    // Check for workflow after action is sent
    setTimeout(() => {
      checkWorkflow();
    }, 1500);
  };

  // Enhanced send message handler that checks for workflow
  const handleSendMessage = async (text: string) => {
    await sendMessage(text);
    
    // Check for workflow after sending message
    setTimeout(() => {
      checkWorkflow();
    }, 1500);
  };

  // Enhanced file upload handler that checks for workflow
  const handleFileUploadedWithWorkflowCheck = async (fileMessage: any) => {
    await handleFileUploaded(fileMessage);
    
    // Check for workflow after file upload (workflows often created after file uploads)
    setTimeout(() => {
      checkWorkflow();
    }, 2000); // Longer delay for file processing
  };

  // Toggle document canvas
  const toggleDocumentCanvas = () => {
    console.log('Toggling document canvas, current hasWorkflow:', hasWorkflow);
    setIsDocumentCanvasOpen(!isDocumentCanvasOpen);
  };

  // If we're loading initially
  if (!activeConversationId && loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-wally" />
      </div>
    );
  }

  // If there's an error loading the conversation
  if (error && !messages.length) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => router.push("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat Sidebar Component */}
      <ChatSidebar
        activeConversationId={activeConversationId}
        onNewConversation={handleNewConversation}
      />

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDocumentCanvasOpen ? 'mr-96' : ''}`}>
        {/* Chat header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push("/")}
              className="mr-2 h-9 w-9"
              title="Back to Home"
            >
              <ArrowLeft size={18} />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-800">Chat</h1>
              {!isConnected && (
                <div className="text-sm text-red-500">Disconnected</div>
              )}
              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 mt-1">
                  Workflow: {hasWorkflow ? 'Yes' : 'No'} | Messages: {messages.length}
                  {workflowLoading && ' (Checking...)'}
                  {workflowError && ` (Error: ${workflowError})`}
                </div>
              )}
            </div>
          </div>
          
          {/* Document Canvas Toggle Button - Show if workflow exists with animation */}
          {showWorkflowButton && (
            <div className="relative">
              <Button
                variant={isDocumentCanvasOpen ? "default" : "outline"}
                size="icon"
                onClick={toggleDocumentCanvas}
                className={`
                  h-9 w-9 transition-all duration-300 transform
                  ${isDocumentCanvasOpen 
                    ? 'scale-100 shadow-lg' 
                    : 'scale-100 hover:scale-105 animate-pulse-glow'
                  }
                `}
                title={isDocumentCanvasOpen ? "Close Document Fields" : "Open Document Fields"}
              >
                <FileText size={18} />
              </Button>
              
              {/* Notification glow effect */}
              {!isDocumentCanvasOpen && (
                <div className="absolute inset-0 rounded-md animate-ping-slow bg-blue-400 opacity-20 pointer-events-none"></div>
              )}
              
              {/* Notification dot */}
              {!isDocumentCanvasOpen && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-lg"></div>
              )}
            </div>
          )}
        </div>
        
        {/* Chat container */}
        <div className="flex-1 overflow-hidden">
          <ChatContainer
            messages={messages}
            onSendMessage={handleSendMessage}
            onActionClick={handleActionClick}
            loading={loading}
            onFileUploaded={handleFileUploadedWithWorkflowCheck}
            isConnected={isConnected}
            conversationId={conversationId}
          />
        </div>
      </div>

      {/* Document Canvas - appears on the right when open */}
      <DocumentCanvas
        isOpen={isDocumentCanvasOpen}
        onClose={() => setIsDocumentCanvasOpen(false)}
        conversationId={conversationId}
      />

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.6), 0 0 24px rgba(59, 130, 246, 0.3);
          }
        }
        
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.1;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}