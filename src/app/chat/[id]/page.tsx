// client/src/app/chat/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatContainer from "@/components/chat/ChatContainer";
import ConversationList from "@/components/chat/ConversationList";
import useChat from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Plus, Menu, X } from "lucide-react";
import { useAuthStore } from "@/lib/store/AuthStore";
import DocumentCanvas from "@/components/chat/DocumentCanvas";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const conversationId = params?.id as string;

  // Initialize chat with the conversation ID from the URL
  const {
    messages,
    loading,
    error,
    documentState,
    sendMessage,
    sendAction,
    activeConversationId,
    createNewConversation,
    handleFileUploaded,
    onViewFile,
    clearViewFile,
    isConnected
  } = useChat({
    conversationId
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  // On smaller screens, automatically close sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create a new conversation and navigate to it
  const handleNewConversation = async () => {
    try {
      const newConversationId = await createNewConversation();
      router.push(`/chat/${newConversationId}`);
      // Close sidebar on mobile after creating a new conversation
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error("Failed to create new conversation:", error);
    }
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle button clicks and actions
  const handleActionClick = (action: string, values: any) => {
    console.log("Action triggered:", action, values);
    // Send the action to the backend via our hook
    sendAction(action, values);
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
    <div className="flex h-screen">
      {/* Sidebar with conversations list */}
      <div 
        className={`${
          sidebarOpen ? 'w-64 md:w-80' : 'w-0'
        } border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden absolute md:relative z-10 bg-white h-full`}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-bold">Conversations</h1>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNewConversation}
              title="New Conversation"
            >
              <Plus size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="md:hidden"
              title="Close Sidebar"
            >
              <X size={18} />
            </Button>
          </div>
        </div>
        
        {/* Conversation list component */}
        <ConversationList 
          activeConversationId={activeConversationId}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Chat header */}
        <div className="p-4 border-b border-gray-200 flex items-center">
          {!sidebarOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              className="mr-2"
              title="Open Sidebar"
            >
              <Menu size={18} />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/")}
            className="mr-2"
            title="Back to Home"
          >
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-xl font-semibold">Chat</h1>
        </div>
        
        {/* Main content wrapper */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat container */}
          <div className={`${documentState.isOpen ? "w-1/2" : "w-full"} flex flex-col`}>
            <div className="flex-1 overflow-hidden">
              <ChatContainer
                messages={messages}
                onSendMessage={sendMessage}
                onActionClick={handleActionClick}
                loading={loading}
                onFileUploaded={handleFileUploaded}
                onViewFile={onViewFile}
                isConnected={isConnected}
              />
            </div>
          </div>

          {/* Document panel */}
          {documentState.isOpen && (
            <DocumentCanvas 
              fileData={documentState.fileData}
              onClose={clearViewFile}
            />
          )}
        </div>
      </div>
    </div>
  );
}