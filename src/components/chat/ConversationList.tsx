// client/src/components/chat/ConversationList.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import chatApi, { Conversation } from "@/lib/api/chatApi";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  activeConversationId?: string;
  onNewConversation: () => Promise<void>;
}

export default function ConversationList({
  activeConversationId,
  onNewConversation
}: ConversationListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load conversations on component mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load conversations from API
  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.listConversations(50, 0);
      setConversations(data.filter(conv => conv.is_active));
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  // Handle conversation deletion
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    try {
      setDeleteLoading(id);
      await chatApi.deleteConversation(id);
      // Filter out the deleted conversation
      setConversations(conversations.filter(conv => conv.id !== id));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      setError("Failed to delete conversation");
    } finally {
      setDeleteLoading(null);
    }
  };

  // Navigate to a conversation
  const navigateToConversation = (id: string) => {
    router.push(`/chat/${id}`);
  };

  // Format the date for display
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Unknown date";
    }
  };

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(conv => 
    conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-wally" />
      </div>
    );
  }

  if (error && !conversations.length) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-500 text-sm mb-2">{error}</div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadConversations} 
          className="text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search box */}
      <div className="p-3">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
          <Input
            placeholder="Search conversations"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>
      </div>

      {/* Empty state */}
      {!loading && filteredConversations.length === 0 && (
        <div className="flex flex-col items-center justify-center p-4 h-40 text-center">
          {searchTerm ? (
            <>
              <p className="text-sm text-gray-500 mb-2">No conversations match your search</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchTerm("")} 
                className="text-xs"
              >
                Clear search
              </Button>
            </>
          ) : (
            <>
              <MessageSquare size={24} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-2">No conversations yet</p>
              <Button 
                size="sm" 
                onClick={onNewConversation} 
                className="bg-wally hover:bg-wally-dark text-xs"
              >
                Start a new conversation
              </Button>
            </>
          )}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => navigateToConversation(conversation.id)}
            className={`p-3 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition-colors border-l-2 ${
              conversation.id === activeConversationId 
                ? "border-l-wally bg-gray-50" 
                : "border-l-transparent"
            }`}
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                conversation.id === activeConversationId 
                  ? "bg-wally text-white" 
                  : "bg-gray-100 text-gray-500"
              }`}>
                <MessageSquare size={14} />
              </div>
              <div className="overflow-hidden">
                <h3 className="font-medium text-sm truncate">
                  {conversation.title || "Untitled Conversation"}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {formatDate(conversation.updated_at)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleDeleteConversation(conversation.id, e)}
              disabled={deleteLoading === conversation.id}
              className="opacity-0 group-hover:opacity-100 h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-transparent"
            >
              {deleteLoading === conversation.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}