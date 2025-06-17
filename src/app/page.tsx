"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/AuthStore";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Loader2, FileText, Languages, Users, Sparkles, TrendingUp, Clock, Bot, Shield, File } from "lucide-react";
import chatApi, { Conversation } from "@/lib/api/chatApi";
// Removed date-fns import - using custom implementation
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
          console.log('User signed in:', session?.user);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        } else if (event === 'USER_UPDATED') {
          console.log('User updated');
        }
      }
    );

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
    e.stopPropagation();
    try {
      setDeleteLoading(id);
      await chatApi.deleteConversation(id);
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
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      
      return date.toLocaleDateString();
    } catch (error) {
      return "Unknown date";
    }
  };

  // Get conversation category icon
  const getConversationIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('chat') || lowerTitle.includes('bot') || lowerTitle.includes('agent')) {
      return <Bot className="w-5 h-5 text-red-500" />;
    }
    if (lowerTitle.includes('translate') || lowerTitle.includes('psa') || lowerTitle.includes('id') || lowerTitle.includes('government')) {
      return <Shield className="w-5 h-5 text-rose-500" />;
    }
    if (lowerTitle.includes('template') || lowerTitle.includes('document') || lowerTitle.includes('form')) {
      return <File className="w-5 h-5 text-pink-500" />;
    }
    return <MessageSquare className="w-5 h-5 text-red-600" />;
  };

  if (loading && !conversations.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mr-4 shadow-lg">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome to Wally</h1>
              <p className="text-gray-600">Your Multi-Agent AI for document processing, translation & templates</p>
            </div>
          </div>
          <Button 
            onClick={handleNewConversation} 
            className="bg-red-600 hover:bg-red-700 shadow-lg px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Plus size={16} className="mr-2" />
            )}
            Start Chatting
          </Button>
        </div>

        {/* Capabilities Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Multi-Agent AI Chatbot</h3>
            <p className="text-gray-600 text-sm">Intelligent conversational AI with specialized agents for different tasks and domains.</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">OCR</h3>
            <p className="text-gray-600 text-sm">Extract text from local documents and translate PSA certificates, IDs, and forms.</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-4">
              <File className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">ranslation</h3>
            <p className="text-gray-600 text-sm">Scan and translate local documents like birth certificates, Local IDs, and government requirements.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
            {error}
          </div>
        )}

        {/* Conversations Section */}
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-red-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Your Workflows</h2>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {conversations.length} active
            </span>
          </div>

          {!loading && conversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to get started?</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first workflow to begin collaborating with Wally's multi-agent AI for document processing, translations, and templates.
              </p>
              <Button 
                onClick={handleNewConversation} 
                className="bg-red-600 hover:bg-red-700 shadow-lg px-8 py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
                disabled={loading}
              >
                <Plus size={16} className="mr-2" />
                Start Your First Workflow
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {conversations.map((conversation, index) => (
                <div
                  key={conversation.id}
                  onClick={() => navigateToConversation(conversation.id)}
                  className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-red-200 transition-all duration-200 cursor-pointer transform hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className="bg-gray-50 group-hover:bg-red-50 rounded-xl p-3 mr-4 transition-colors">
                        {getConversationIcon(conversation.title || "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate group-hover:text-red-900 transition-colors">
                          {conversation.title || "Untitled Workflow"}
                        </h3>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(conversation.updated_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center ml-4">
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-3"></div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        disabled={deleteLoading === conversation.id}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        {deleteLoading === conversation.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}