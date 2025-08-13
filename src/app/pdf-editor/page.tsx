"use client";

import React, { useEffect, useState } from "react";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { PDFEditorContent } from "./PDFEditorContent";
import { useTranslationStore } from "@/lib/store/TranslationStore";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from '@supabase/ssr';
import { LoadingModal } from "@/components/ui/loading-modal";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const PDFEditor: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projects, currentUser } = useTranslationStore();
  const [project, setProject] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const projectId = searchParams.get("projectId");

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Redirect to login if not authenticated
          router.push('/auth/login');
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/auth/login');
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (projectId && isAuthenticated) {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      }
    }
  }, [projectId, projects, isAuthenticated]);

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
    if (project && currentUser) {
      // Route based on current user's role
      const userRole = currentUser.role;
      console.log("Routing to user role:", userRole);
      router.push(`/exp/${userRole}`);
    } else if (project) {
      // Fallback: determine route based on project assignment
      const userRole = project.assignedTranslator
        ? "translator"
        : "project-manager";
      console.log("Routing to fallback role:", userRole);
      router.push(`/exp/${userRole}`);
    } else {
      // Fallback to main dashboard
      console.log("Routing to main dashboard");
      router.push("/exp");
    }
  };

  const handleBackToDashboard = () => {
    router.push("/exp");
  };

  // Show loading while checking authentication
  if (isAuthChecking) {
    return (
      <LoadingModal
        isOpen={true}
        message="Checking authentication..."
      />
    );
  }

  // Only render content if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Project Header */}
      {project && (
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToProject}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Project
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="flex items-center gap-2"
              >
                Dashboard
              </Button>
            </div>
            <div>
              <h1 className="text-lg font-semibold">{project.qCode}</h1>
              <p className="text-sm text-muted-foreground">
                {project.clientName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {project.sourceLanguage} → {project.targetLanguages.join(", ")}
            </span>
          </div>
        </div>
      )}

      {/* PDF Editor Content */}
      <div className="flex-1">
        <TextFormatProvider>
          <PDFEditorContent />
        </TextFormatProvider>
      </div>
    </div>
  );
};

export default PDFEditor;
