"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { getSharedProject } from "../../../pdf-editor-shared/services/sharedProjectService";
import { ViewerPDFEditorContent } from "../../../pdf-editor-viewer/ViewerPDFEditorContent";
import { EditorPDFEditorContent } from "../../../pdf-editor-editor/EditorPDFEditorContent";
import { LoadingModal } from "@/components/ui/loading-modal";
import { useAuthStore } from "@/lib/store/AuthStore";
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SharedProjectPage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [permissions, setPermissions] = useState<"viewer" | "editor">("viewer");
  const { user } = useAuthStore();

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

      // Set permissions from project
      const projectPermissions = project.share_permissions || "viewer";
      setPermissions(projectPermissions);
      
      // Set project data
      setProjectData(project);
      
      console.log("Shared project loaded:", {
        shareId,
        projectId: project.id,
        permissions: projectPermissions,
        requiresAuth: project.requires_auth,
      });

      toast.success(`Loaded: ${project.name}`);
      
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
    // Redirect to login page with return URL
    const returnUrl = encodeURIComponent(`/pdf-editor/shared/${shareId}`);
    window.location.href = `/auth/login?redirect=${returnUrl}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <LoadingModal
        isOpen={true}
        title="Loading Shared Project"
        message="Please wait while we load the shared project..."
      />
    );
  }

  // Error state
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

  // No project data
  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">No project data available</p>
      </div>
    );
  }

  // Route to appropriate implementation based on permissions
  if (permissions === "editor") {
    return (
      <EditorPDFEditorContent
        projectData={projectData}
        projectId={projectData.id}
        shareId={shareId}
        projectName={projectData.name}
      />
    );
  } else {
    return (
      <ViewerPDFEditorContent
        projectData={projectData}
        projectName={projectData.name}
        shareId={shareId}
      />
    );
  }
}