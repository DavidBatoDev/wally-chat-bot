"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { getSharedProject } from "../../services/projectApiService";
import { PDFEditorContent } from "../../PDFEditorContent";
import { LoadingModal } from "@/components/ui/loading-modal";
import { useAuthStore } from "@/lib/store/AuthStore";
import { Shield, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SharedProjectPage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [permissions, setPermissions] = useState<"viewer" | "editor">("viewer");
  const { user, session } = useAuthStore();

  useEffect(() => {
    if (!shareId) {
      setError("Invalid share link");
      setIsLoading(false);
      return;
    }

    loadSharedProject();
  }, [shareId, user]);

  const loadSharedProject = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the shared project
      const project = await getSharedProject(shareId);
      
      if (!project) {
        throw new Error("Project not found");
      }

      // Check if authentication is required
      if (project.requires_auth && !user) {
        setRequiresAuth(true);
        setError("This project requires authentication to view");
        setIsLoading(false);
        return;
      }

      // Set permissions
      setPermissions(project.share_permissions || "viewer");
      
      // Set project data
      setProjectData(project);
      
      // Store the project data in localStorage for the PDF editor to load
      const projectState = project.project_data;
      if (projectState) {
        // Create a temporary storage key for the shared project
        const storageKey = `pdf-editor-shared-${shareId}`;
        localStorage.setItem(storageKey, JSON.stringify(projectState));
        localStorage.setItem("pdf-editor-current-project", storageKey);
        
        // Set a flag to indicate this is a shared project
        localStorage.setItem("pdf-editor-shared-mode", "true");
        localStorage.setItem("pdf-editor-shared-permissions", permissions);
      }

      toast.success(`Loaded shared project: ${project.name}`);
      
    } catch (error) {
      console.error("Error loading shared project:", error);
      setError(error instanceof Error ? error.message : "Failed to load shared project");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    // Store the share ID to return after authentication
    localStorage.setItem("pdf-editor-pending-share", shareId);
    // Redirect to login page
    window.location.href = `/auth/login?redirect=/pdf-editor/shared/${shareId}`;
  };

  if (isLoading) {
    return (
      <LoadingModal
        isOpen={true}
        title="Loading Shared Project"
        message="Please wait while we load the shared project..."
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            {requiresAuth ? (
              <>
                <Shield className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Authentication Required
                </h2>
                <p className="text-gray-600 mb-6">
                  This project requires you to sign in to view its contents.
                </p>
                <Button
                  onClick={handleSignIn}
                  className="w-full bg-primary hover:bg-primaryLight"
                >
                  Sign In to Continue
                </Button>
              </>
            ) : (
              <>
                <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Access Denied
                </h2>
                <p className="text-gray-600">
                  {error || "You don't have permission to view this project."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show permission indicator
  if (projectData && permissions === "viewer") {
    return (
      <div className="relative">
        {/* View-only banner */}
        <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 z-50">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-2">
              <Eye className="w-4 h-4 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-800">
                You are viewing this project in read-only mode
              </p>
            </div>
          </div>
        </div>
        
        {/* PDF Editor with viewer restrictions */}
        <div className="pt-10">
          <PDFEditorContent />
        </div>
      </div>
    );
  }

  // Full editor mode
  return <PDFEditorContent />;
}