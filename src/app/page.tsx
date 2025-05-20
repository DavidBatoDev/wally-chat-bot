// client/src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/AuthStore";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import chatApi, { Conversation } from "@/lib/api/chatApi";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // use supabase auth state to check if user is logged in
  useEffect(() => {
  // Set up auth state listener
  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_IN') {
        // User has signed in
        console.log('User signed in:', session?.user);
        // loadConversations();
      } else if (event === 'SIGNED_OUT') {
        // User has signed out
        console.log('User signed out');
        // router.push('/auth/login');
      } else if (event === 'TOKEN_REFRESHED') {
        // Session was refreshed
        console.log('Token refreshed');
      } else if (event === 'USER_UPDATED') {
        // User was updated
        console.log('User updated');
      }
    }
  );

  // Clean up subscription on unmount
  return () => {
    authListener?.subscription.unsubscribe();
  };
}, [router]);

  
  // Load conversations on component mount
  useEffect(() => {
    if (user) {
      console.log("User is authenticated, loading conversations...");
      loadConversations();
    } else {
      router.push("/auth/login");
    }
  }, [user, router]);

  // Load conversations from API
  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.listConversations(20, 0);
      setConversations(data.filter(conv => conv.is_active));
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setError("Failed to load conversations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Create a new conversation and navigate to it
  const handleNewConversation = async () => {
    try {
      setLoading(true);
      const conversationId = await chatApi.createConversation("New Conversation");
      router.push(`/chat/${conversationId}`);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      setError("Failed to create conversation. Please try again.");
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
      setError("Failed to delete conversation. Please try again.");
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

  if (loading && !conversations.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-wally" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Your Conversations</h1>
          <Button 
            onClick={handleNewConversation} 
            className="bg-wally hover:bg-wally-dark"
          >
            <Plus size={16} className="mr-2" /> New Conversation
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!loading && conversations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold mb-2">No conversations yet</h2>
            <p className="text-gray-500 mb-4">
              Start a new conversation to get help from your AI assistant.
            </p>
            <Button 
              onClick={handleNewConversation} 
              className="bg-wally hover:bg-wally-dark"
            >
              Start Conversation
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => navigateToConversation(conversation.id)}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center">
                  <div className="bg-gray-100 rounded-full p-2 mr-4">
                    <MessageSquare size={20} className="text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{conversation.title || "Untitled Conversation"}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(conversation.updated_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  disabled={deleteLoading === conversation.id}
                  className="text-gray-400 hover:text-red-500"
                >
                  {deleteLoading === conversation.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}