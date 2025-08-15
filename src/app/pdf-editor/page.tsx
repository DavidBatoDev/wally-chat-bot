"use client";

import React, { useEffect, useState } from "react";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { PDFEditorContent } from "./PDFEditorContent";
import { useAuthStore } from "@/lib/store/AuthStore";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getProject } from "./services/projectApiService";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const PDFEditor: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, session } = useAuthStore();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [authError, setAuthError] = useState(false);
  const projectId = searchParams.get("projectId");

  useEffect(() => {
    if (projectId) {
      // Reset error states
      setProjectNotFound(false);
      setAuthError(false);

      // Validate projectId format (basic check)
      if (!projectId.match(/^[a-zA-Z0-9-_]+$/)) {
        console.error("Invalid project ID format:", projectId);
        setProjectNotFound(true);
        setIsLoading(false);
        return;
      }

      // Debug logging
      console.log("DEBUG: Looking for project with ID:", projectId);
      console.log("DEBUG: Current user:", user);

      // Fetch project directly from database
      const fetchProject = async () => {
        try {
          console.log("DEBUG: Fetching project from database...");
          console.log("DEBUG: User authentication status:", !!user, !!session);

          // Try to fetch project regardless of auth; backend should allow public projects
          const projectData = await getProject(projectId);

                     if (projectData) {
             console.log("DEBUG: Project found in database:", projectData);
             // If project is public, cache state in localStorage to allow unauth users to load editor
             try {
               if (projectData.is_public && projectData.project_data) {
                 const storageKey = `pdf-editor-project-${projectData.id}`;
                 localStorage.setItem(storageKey, JSON.stringify(projectData.project_data));
                 localStorage.setItem("pdf-editor-current-project", storageKey);
               }
             } catch {}
             setProject(projectData);
             setProjectNotFound(false);
           } else {
            console.log("DEBUG: Project not found in database");
            setProjectNotFound(true);
          }
        } catch (error) {
          console.error("DEBUG: Error fetching project:", error);

          // Handle different types of errors
          if (error instanceof Error) {
            if (
              error.message.includes("401") ||
              error.message.includes("Unauthorized") ||
              error.message.includes("Not authenticated")
            ) {
              console.log("DEBUG: Authentication required");
              setAuthError(true);
              // Don't set projectNotFound for auth issues, let the user see the auth message
            } else if (
              error.message.includes("404") ||
              error.message.includes("Not Found")
            ) {
              console.log("DEBUG: Project not found");
              setProjectNotFound(true);
            } else if (
              error.message.includes("Network") ||
              error.message.includes("fetch")
            ) {
              console.log("DEBUG: Network error");
              setProjectNotFound(true);
            } else if (
              error.message.includes("403") ||
              error.message.includes("Forbidden")
            ) {
              console.log(
                "DEBUG: Access forbidden - project exists but user lacks permission"
              );
              setProjectNotFound(true);
            } else {
              console.log("DEBUG: Other error, treating as not found");
              setProjectNotFound(true);
            }
          } else {
            setProjectNotFound(false);
          }
        } finally {
          setIsLoading(false);
        }
      };

      fetchProject();
    } else {
      // No projectId provided, allow editor to work without a specific project
      setProjectNotFound(false);
      setAuthError(false);
      setIsLoading(false);
    }
  }, [projectId, user]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (projectId && isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn("Project loading timeout, forcing completion");
          setIsLoading(false);
          // If we still don't have a project after timeout, show 404
          if (!project) {
            setProjectNotFound(true);
          }
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [projectId, isLoading, project]);

  // Watch for authentication changes and retry fetching project if needed
  useEffect(() => {
    if (
      projectId &&
      user &&
      session &&
      !project &&
      !isLoading &&
      !projectNotFound &&
      !authError
    ) {
      console.log("DEBUG: User became authenticated, retrying project fetch");
      // Reset states and retry
      setProjectNotFound(false);
      setAuthError(false);
      setIsLoading(true);

      const fetchProject = async () => {
        try {
          console.log("DEBUG: Retrying project fetch after authentication...");
          const projectData = await getProject(projectId);

          if (projectData) {
            console.log("DEBUG: Project found on retry:", projectData);
            setProject(projectData);
            setProjectNotFound(false);
          } else {
            console.log("DEBUG: Project still not found on retry");
            setProjectNotFound(true);
          }
        } catch (error) {
          console.error("DEBUG: Error on retry:", error);
          setProjectNotFound(true);
        } finally {
          setIsLoading(false);
        }
      };

      fetchProject();
    }
  }, [
    projectId,
    user,
    session,
    project,
    isLoading,
    projectNotFound,
    authError,
  ]);

  // Add keyboard shortcut for back navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleBackToProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project]);

  const handleBackToProject = () => {
    if (project) {
      // Try to determine route based on project metadata if available
      // The project_data field might contain additional metadata
      const projectData = project.project_data;

      if (projectData && projectData.assignedTranslator) {
        console.log("Routing to translator dashboard");
        router.push("/exp/translator");
      } else if (projectData && projectData.projectType === "translation") {
        console.log("Routing to translator dashboard");
        router.push("/exp/translator");
      } else {
        console.log("Routing to project manager dashboard");
        router.push("/exp/project-manager");
      }
    } else {
      // Fallback to main dashboard
      console.log("Routing to main dashboard");
      router.push("/exp");
    }
  };

  const handleBackToDashboard = () => {
    router.push("/exp");
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {projectId ? "Loading project..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show 404 page when project is not found
  if (projectId && projectNotFound) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Project Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              {!user
                ? "Please sign in to access this project, or the project doesn't exist."
                : "The project you're looking for doesn't exist, you don't have access to it, or it may have been deleted."}
            </p>
          </div>

          <div className="space-y-3">
            {!user ? (
              <Button
                onClick={() => router.push("/auth/login")}
                className="w-full"
                size="lg"
              >
                Sign In
              </Button>
            ) : (
              <Button
                onClick={handleBackToDashboard}
                className="w-full"
                size="lg"
              >
                Go to Dashboard
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
              size="lg"
            >
              Go Back
            </Button>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>Project ID: {projectId}</p>
            {!user && (
              <p className="mt-2 text-amber-600">
                You may need to sign in to access this project
              </p>
            )}
            {user && (
              <p className="mt-2 text-blue-600">
                Try refreshing the page or check if the project ID is correct
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Auth error block removed to allow public project viewing by link

  return (
    <div className="h-screen flex flex-col">
      {/* PDF Editor Content */}
      <div className="flex-1">
        <TextFormatProvider>
          <PDFEditorContent projectId={projectId || undefined} />
        </TextFormatProvider>
      </div>
    </div>
  );
};

export default PDFEditor;
