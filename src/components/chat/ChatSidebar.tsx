// components/chat/ChatSidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import ConversationList from "@/components/chat/ConversationList";

interface ChatSidebarProps {
  activeConversationId?: string;
  onNewConversation: () => Promise<void>;
  className?: string;
}

export default function ChatSidebar({
  activeConversationId,
  onNewConversation,
  className = ""
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-close on mobile, auto-open on desktop
      if (mobile) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Create a new conversation and handle mobile sidebar
  const handleNewConversation = async () => {
    try {
      await onNewConversation();
      // Close sidebar on mobile after creating a new conversation
      if (isMobile) {
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to create new conversation:", error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`${
          isOpen ? 'w-64 md:w-80' : 'w-0'
        } border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isMobile ? 'fixed' : 'relative'
        } z-50 bg-white h-full ${className}`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-bold truncate">Conversations</h1>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNewConversation}
              title="New Conversation"
              className="h-8 w-8"
            >
              <Plus size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              title={isOpen ? "Close Sidebar" : "Open Sidebar"}
              className="h-8 w-8"
            >
              {isMobile ? <X size={16} /> : <ChevronLeft size={16} />}
            </Button>
          </div>
        </div>
        
        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList 
            activeConversationId={activeConversationId}
            onNewConversation={handleNewConversation}
          />
        </div>

        {/* Sidebar Footer (optional) */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            {/* You can add user info, settings, or other footer content here */}
          </div>
        </div>
      </div>

      {/* Collapsed sidebar toggle button */}
      {!isOpen && !isMobile && (
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="absolute top-4 left-2 z-10 h-8 w-8 shadow-md border border-gray-200 bg-white hover:bg-gray-50"
            title="Open Sidebar"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Mobile menu button when sidebar is closed */}
      {!isOpen && isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-30 h-10 w-10 shadow-lg border border-gray-200 bg-white hover:bg-gray-50 md:hidden"
          title="Open Menu"
        >
          <Menu size={18} />
        </Button>
      )}
    </>
  );
}