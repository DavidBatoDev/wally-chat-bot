"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/AuthStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  User,
  Globe,
  Lock,
  Eye,
  Upload,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectState } from "./hooks/states/useProjectState";
import { useProjectCreation } from "./hooks/useProjectCreation";
import { PageTemplateSelectionModal } from "./components/PageTemplateSelectionModal";
import { runBulkOcrAndSaveToDb } from "./services/ocrService";
import { getProject, updateProject } from "./services/projectApiService";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { PDFEditorContent } from "./PDFEditorContent";
import ProjectPreview from "./components/ProjectPreview";
import PDFTransformationLoader from "./components/PDFTransformationLoader";
import UploadLoader from "./components/UploadLoader";
import { toast } from "sonner";
import {
  transformPdfToA4Balanced,
  needsA4Transformation,
  convertImageToA4Pdf,
  convertDocxToA4Pdf,
  TransformationProgress,
} from "./services/pdfTransformService";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Project {
  id: string;
  name: string;
  createdAt: string;
  storageKey: string;
  source: "database" | "localStorage";
}

const PDFEditorDashboard: React.FC = () => {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectPreviews, setProjectPreviews] = useState<Record<string, any>>(
    {}
  );
  const [previewsLoading, setPreviewsLoading] = useState<
    Record<string, boolean>
  >({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // PDF Transformation state
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformationProgress, setTransformationProgress] =
    useState<TransformationProgress>({
      stage: "loading",
      message: "Initializing...",
    });
  const [currentFileName, setCurrentFileName] = useState<string>("");

  // Upload state
  const [uploadStage, setUploadStage] = useState<
    "uploading" | "processing" | "complete" | "error"
  >("uploading");
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Minimal project state setup just for getting saved projects
  const { getSavedProjects, deleteProject, loadProject } = useProjectState({
    documentState: {
      url: "",
      currentPage: 1,
      numPages: 0,
      scale: 1,
      pageWidth: 600,
      pageHeight: 800,
      isDocumentLoaded: false,
      isTransforming: false,
      fileType: null,
      deletedPages: new Set(),
      pdfBackgroundColor: "#ffffff",
      pdfRenderScale: 1,
      pages: [],
      isSupabaseUrl: false,
      finalLayoutUrl: undefined,
      finalLayoutCurrentPage: 1,
      finalLayoutNumPages: 0,
      finalLayoutDeletedPages: new Set(),
      isLoading: false,
      error: "",
      imageDimensions: null,
      isPageLoading: false,
      isScaleChanging: false,
      detectedPageBackgrounds: new Map(),
      supabaseFilePath: undefined,
    },
    setDocumentState: () => {},
    elementCollections: {
      originalTextBoxes: [],
      originalShapes: [],
      originalDeletionRectangles: [],
      originalImages: [],
      translatedTextBoxes: [],
      translatedShapes: [],
      translatedDeletionRectangles: [],
      translatedImages: [],
      untranslatedTexts: [],
      finalLayoutTextboxes: [],
      finalLayoutShapes: [],
      finalLayoutDeletionRectangles: [],
      finalLayoutImages: [],
    },
    setElementCollections: () => {},
    layerState: {
      originalLayerOrder: [],
      translatedLayerOrder: [],
      finalLayoutLayerOrder: [],
    },
    setLayerState: () => {},
    viewState: {
      currentView: "original",
      currentWorkflowStep: "translate",
      activeSidebarTab: "pages",
      isSidebarCollapsed: false,
      isCtrlPressed: false,
      zoomMode: "page",
      containerWidth: 1200,
      transformOrigin: "center",
    },
    setViewState: () => {},
    editorState: {
      selectedFieldId: null,
      selectedShapeId: null,
      selectedImageId: null,
      isEditMode: false,
      isAddTextBoxMode: false,
      isTextSelectionMode: false,
      showDeletionRectangles: false,
      isImageUploadMode: false,
      selectedTextBoxes: { textBoxIds: [] },
      isDrawingSelection: false,
      selectionStart: null,
      selectionEnd: null,
      selectionRect: null,
      multiSelection: {
        selectedElements: [],
        selectionBounds: null,
        isDrawingSelection: false,
        selectionStart: null,
        selectionEnd: null,
        isMovingSelection: false,
        moveStart: null,
        targetView: null,
        dragOffsets: {},
        isDragging: false,
      },
      isSelectionMode: false,
    },
    setEditorState: () => {},
    sourceLanguage: "auto",
    setSourceLanguage: () => {},
    desiredLanguage: "en",
    setDesiredLanguage: () => {},
  });

  // Project creation hook for handling file uploads
  const {
    isCreatingProject: isCreatingProjectFromUpload,
    createProjectOnUpload,
    projectCreationError,
  } = useProjectCreation({
    documentState: {
      url: "",
      currentPage: 1,
      numPages: 0,
      scale: 1,
      pageWidth: 600,
      pageHeight: 800,
      isDocumentLoaded: false,
      isTransforming: false,
      fileType: null,
      deletedPages: new Set(),
      pdfBackgroundColor: "#ffffff",
      pdfRenderScale: 1,
      pages: [],
      isSupabaseUrl: false,
      finalLayoutUrl: undefined,
      finalLayoutCurrentPage: 1,
      finalLayoutNumPages: 0,
      finalLayoutDeletedPages: new Set(),
      isLoading: false,
      error: "",
      imageDimensions: null,
      isPageLoading: false,
      isScaleChanging: false,
      detectedPageBackgrounds: new Map(),
      supabaseFilePath: undefined,
    },
    viewState: {
      currentView: "original",
      currentWorkflowStep: "translate",
      activeSidebarTab: "pages",
      isSidebarCollapsed: false,
      isCtrlPressed: false,
      zoomMode: "page",
      containerWidth: 1200,
      transformOrigin: "center",
    },
    elementCollections: {
      originalTextBoxes: [],
      originalShapes: [],
      originalDeletionRectangles: [],
      originalImages: [],
      translatedTextBoxes: [],
      translatedShapes: [],
      translatedDeletionRectangles: [],
      translatedImages: [],
      untranslatedTexts: [],
      finalLayoutTextboxes: [],
      finalLayoutShapes: [],
      finalLayoutDeletionRectangles: [],
      finalLayoutImages: [],
    },
    layerState: {
      originalLayerOrder: [],
      translatedLayerOrder: [],
      finalLayoutLayerOrder: [],
    },
    editorState: {
      selectedFieldId: null,
      selectedShapeId: null,
      selectedImageId: null,
      isEditMode: false,
      isAddTextBoxMode: false,
      isTextSelectionMode: false,
      showDeletionRectangles: false,
      isImageUploadMode: false,
      selectedTextBoxes: { textBoxIds: [] },
      isDrawingSelection: false,
      selectionStart: null,
      selectionEnd: null,
      selectionRect: null,
      multiSelection: {
        selectedElements: [],
        selectionBounds: null,
        isDrawingSelection: false,
        selectionStart: null,
        selectionEnd: null,
        isMovingSelection: false,
        moveStart: null,
        targetView: null,
        dragOffsets: {},
        isDragging: false,
      },
      isSelectionMode: false,
    },
    sourceLanguage: "auto",
    desiredLanguage: "en",
  });

  // Load projects on component mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        const savedProjects = await getSavedProjects();
        setProjects(savedProjects);
      } catch (error) {
        console.error("Error loading projects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [getSavedProjects]);

  // Load previews for database projects automatically
  useEffect(() => {
    const loadAllPreviews = async () => {
      const databaseProjects = projects.filter((p) => p.source === "database");

      // Load previews for first few projects to avoid overwhelming the API
      const projectsToLoad = databaseProjects.slice(0, 6);

      for (const project of projectsToLoad) {
        if (!projectPreviews[project.id] && !previewsLoading[project.id]) {
          loadProjectPreview(project.id);
          // Add a small delay between requests to avoid overwhelming the server
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };

    if (projects.length > 0) {
      loadAllPreviews();
    }
  }, [projects]);

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load project preview data
  const loadProjectPreview = async (projectId: string) => {
    if (projectPreviews[projectId] || previewsLoading[projectId]) {
      return; // Already loaded or loading
    }

    setPreviewsLoading((prev) => ({ ...prev, [projectId]: true }));

    try {
      const project = await getProject(projectId);
      if (project?.project_data) {
        setProjectPreviews((prev) => ({
          ...prev,
          [projectId]: project.project_data,
        }));
      }
    } catch (error) {
      console.error("Error loading project preview:", error);
    } finally {
      setPreviewsLoading((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const handleUploadNewFile = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentFileName(file.name);
    let finalFile = file;

    // Show initial upload toast
    toast.info("Processing file upload...", {
      description: `Preparing ${file.name} for upload`,
      duration: 2000,
    });

    try {
      // Check if image needs conversion to A4 PDF
      if (file.type.startsWith("image/")) {
        setIsTransforming(true);
        toast.info("Converting image to A4 PDF format...", {
          description: "This will ensure optimal viewing and editing",
          duration: 3000,
        });

        // Convert image to A4 PDF
        const result = await convertImageToA4Pdf(file, (progress) => {
          setTransformationProgress(progress);
        });

        finalFile = result.transformedFile;
        setIsTransforming(false);

        toast.success("Image converted to A4 PDF successfully!", {
          description: `Converted to PDF format for processing`,
          duration: 3000,
        });
      }
      // Check if DOCX needs conversion to A4 PDF
      else if (
        file.type.includes("officedocument.wordprocessingml") ||
        file.name.toLowerCase().endsWith(".docx")
      ) {
        setIsTransforming(true);
        toast.info("Converting DOCX to A4 PDF format...", {
          description: "This will ensure optimal viewing and editing",
          duration: 3000,
        });

        // Convert DOCX to A4 PDF
        const result = await convertDocxToA4Pdf(file, (progress) => {
          setTransformationProgress(progress);
        });

        finalFile = result.transformedFile;
        setIsTransforming(false);

        toast.success("DOCX converted to A4 PDF successfully!", {
          description: `Converted to PDF format for processing`,
          duration: 3000,
        });
      }
      // Check if PDF needs A4 transformation
      else if (file.type === "application/pdf") {
        const needsTransformation = await needsA4Transformation(file);

        if (needsTransformation) {
          setIsTransforming(true);
          toast.info("Converting PDF to A4 format...", {
            description: "This will ensure optimal viewing and editing",
            duration: 3000,
          });

          // Transform PDF to A4 with balanced compression
          const result = await transformPdfToA4Balanced(file, (progress) => {
            setTransformationProgress(progress);
          });

          finalFile = result.transformedFile;
          setIsTransforming(false);

          // Show compression results
          const compressionMessage =
            result.compressionRatio > 0
              ? `File size reduced by ${result.compressionRatio}%`
              : "File optimized for upload";

          toast.success("PDF transformed to A4 successfully!", {
            description: compressionMessage,
            duration: 3000,
          });
        }
      }

      // Now proceed with project creation
      setIsCreatingProject(true);
      setUploadStage("uploading");
      setUploadMessage("Uploading file to cloud storage...");

      // Wait for the complete upload process to Supabase before redirecting
      const projectId = await createProjectOnUpload(finalFile, (progress) => {
        // Update upload stage based on Supabase upload progress
        setUploadProgress(progress.percentage);

        if (progress.stage === "preparing") {
          setUploadStage("uploading");
          setUploadMessage("Preparing file for upload...");
        } else if (progress.stage === "uploading") {
          setUploadStage("uploading");
          setUploadMessage(
            `Uploading to cloud storage... ${progress.percentage}%`
          );
        } else if (progress.stage === "finalizing") {
          setUploadStage("processing");
          setUploadMessage(progress.message);
        } else if (progress.stage === "complete") {
          setUploadStage("processing");
          setUploadMessage("File uploaded successfully, setting up project...");
        }
      });
      if (projectId) {
        setUploadStage("processing");
        setUploadMessage("Setting up your project...");

        // Refresh projects list to show the new project
        const savedProjects = await getSavedProjects();
        setProjects(savedProjects);

        setUploadStage("complete");
        setUploadMessage("Project created successfully!");

        toast.success("File uploaded successfully!", {
          description: "Redirecting to your new project...",
          duration: 2000,
        });

        // Open modal to select page types/templates then run OCR into DB
        try {
          const project = await getProject(projectId);
          const totalPages =
            project?.project_data?.documentState?.numPages || 1;
          const existingPages =
            project?.project_data?.documentState?.pages || [];

          // Local state-driven inline modal handler
          const ModalLauncher: React.FC<{ pid: string }> = ({ pid }) => {
            const [open, setOpen] = React.useState(true);
            const initial = existingPages.map((p: any) => ({
              pageNumber: p.pageNumber,
              pageType: p.pageType || null,
              templateId: p.template?.id || null,
            }));
            return (
              <PageTemplateSelectionModal
                open={open}
                onClose={() => setOpen(false)}
                totalPages={totalPages}
                initialPages={initial}
                onConfirm={async (pages) => {
                  // Build projectData.pages payload for template-aware OCR
                  // Fetch templates to enrich with metadata (variation, file_url)
                  let templateIndex: Record<string, any> = {};
                  try {
                    const res = await fetch("/api/proxy/templates/");
                    if (res.ok) {
                      const all = await res.json();
                      if (Array.isArray(all)) {
                        templateIndex = Object.fromEntries(
                          all.map((t: any) => [t.id, t])
                        );
                      }
                    }
                  } catch {}

                  const pagesData = pages.map((p) => {
                    const base: any = {
                      pageNumber: p.pageNumber,
                      pageType: p.pageType || "dynamic_content",
                    };
                    if (p.templateId) {
                      const t = templateIndex[p.templateId];
                      base.template = t
                        ? {
                            id: t.id,
                            doc_type: t.doc_type,
                            variation: t.variation,
                            file_url: t.file_url,
                          }
                        : { id: p.templateId };
                      if (t) {
                        base.templateType = t.variation;
                        base.translatedTemplateURL = t.file_url;
                        // Dimensions will be detected on load and saved later
                      }
                    } else {
                      base.template = null;
                    }
                    return base;
                  });

                  // 1) Save updated pages to DB and wait
                  const updatedProjectData = {
                    ...(project?.project_data || {}),
                    documentState: {
                      ...((project?.project_data?.documentState as any) || {}),
                      pages: pagesData,
                    },
                  };
                  const updateResp = await updateProject(pid, {
                    project_data: updatedProjectData,
                  });
                  if (!updateResp?.id) {
                    toast.error("Failed to save page settings", {
                      description: "Could not update project in database",
                    });
                    throw new Error("updateProject failed");
                  }

                  // 2) Run capture + OCR into Supabase and wait
                  const result = await runBulkOcrAndSaveToDb({
                    projectId: pid,
                    pageNumbers: pages.map((p) => p.pageNumber),
                    viewTypes: ["original", "translated"],
                    projectData: updatedProjectData,
                  });
                  if (!result.success) {
                    toast.error("OCR failed", {
                      description:
                        result.error || "Capture and OCR did not complete",
                    });
                    throw new Error(result.error || "OCR failed");
                  }
                  toast.success("OCR complete", {
                    description: "Results saved to project",
                  });
                  // After OCR save, navigate to editor
                  router.push(`/pdf-editor/${pid}`);
                }}
              />
            );
          };

          // Mount a temporary portal-root for the modal
          const container = document.createElement("div");
          document.body.appendChild(container);
          const root = (await import("react-dom/client")).createRoot(container);
          root.render(<ModalLauncher pid={projectId} />);
        } catch (e) {
          console.error("Failed to open page/template modal:", e);
          router.push(`/pdf-editor/${projectId}`);
        }
      } else {
        // If projectId is null, the upload failed or user is not authenticated
        console.warn("Project creation failed - no project ID returned");
        setUploadStage("error");
        setUploadMessage("Project creation failed");

        toast.error("Upload failed", {
          description: "Please check your connection and try again",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadStage("error");
      setUploadMessage("Upload failed - please try again");

      toast.error("Upload failed", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        duration: 5000,
      });

      // Auto-hide error state after a delay
      setTimeout(() => {
        setIsCreatingProject(false);
      }, 3000);
    } finally {
      // Only reset states if not showing error (to allow user to see error state)
      setTimeout(
        () => {
          setIsTransforming(false);
          setCurrentFileName("");
          setUploadMessage("");
          setUploadProgress(0);
          // Reset file input
          if (event.target) {
            event.target.value = "";
          }
        },
        uploadStage === "error" ? 3000 : 0
      );
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/pdf-editor/${projectId}`);
  };

  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ) => {
    if (window.confirm(`Are you sure you want to delete "${projectName}"?`)) {
      try {
        await deleteProject(projectId);
        // Refresh projects list
        const savedProjects = await getSavedProjects();
        setProjects(savedProjects);
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Wally Editor</h1>
              <Badge variant="secondary">Documents</Badge>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{user.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleUploadNewFile}
              disabled={
                isCreatingProject ||
                isCreatingProjectFromUpload ||
                isTransforming
              }
              className="flex items-center space-x-2"
            >
              {isTransforming ||
              isCreatingProject ||
              isCreatingProjectFromUpload ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>
                {isTransforming
                  ? "Transforming PDF..."
                  : isCreatingProject || isCreatingProjectFromUpload
                  ? "Uploading..."
                  : "Upload New File"}
              </span>
            </Button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your projects...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredProjects.length === 0 && searchQuery === "" && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-600 mb-6">
              Get started by uploading your first document.
            </p>
            <Button
              onClick={handleUploadNewFile}
              disabled={
                isCreatingProject ||
                isCreatingProjectFromUpload ||
                isTransforming
              }
            >
              {isTransforming ||
              isCreatingProject ||
              isCreatingProjectFromUpload ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isTransforming
                ? "Transforming PDF..."
                : isCreatingProject || isCreatingProjectFromUpload
                ? "Uploading..."
                : "Upload New File"}
            </Button>
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && filteredProjects.length === 0 && searchQuery !== "" && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No projects found
            </h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search terms or upload a new file.
            </p>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Clear Search
            </Button>
          </div>
        )}

        {/* Projects Grid */}
        {!isLoading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group cursor-pointer"
                onClick={() => handleOpenProject(project.id)}
              >
                {/* Document Preview Card */}
                <div className="relative border border-gray-300 rounded-tl-lg rounded-tr-lg  bg-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-blue-300">
                  {/* Document Preview */}
                  <div className="aspect-[8.5/11]">
                    {project.source === "database" ? (
                      previewsLoading[project.id] ? (
                        <div className="w-full h-full bg-gray-100 rounded border flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      ) : projectPreviews[project.id] ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <ProjectPreview
                            projectData={projectPreviews[project.id]}
                            scale={0.25}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-50 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                          <div className="text-center">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <span className="text-xs">Loading Preview...</span>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-50 rounded border flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <Lock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <span className="text-xs">Local File</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 w-7 p-0 bg-white/90 hover:bg-white shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProject(project.id);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id, project.name);
                          }}
                          className="text-red-600"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* File Type Badge */}
                  <div className="absolute top-2 left-2">
                    {project.source === "database" ? (
                      <Badge
                        variant="default"
                        className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 border-blue-200"
                      >
                        <Globe className="h-2.5 w-2.5 mr-1" />
                        Cloud
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0.5"
                      >
                        <Lock className="h-2.5 w-2.5 mr-1" />
                        Local
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Document Info */}
                <div className="p-3 border border-gray-300 rounded-bl-lg rounded-br-lg">
                  <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input for uploading files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.docx"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />

        {/* PDF Transformation Loader */}
        <PDFTransformationLoader
          isVisible={isTransforming}
          progress={transformationProgress}
          fileName={currentFileName}
        />

        {/* Upload Loader */}
        <UploadLoader
          isVisible={isCreatingProject && !isTransforming}
          fileName={currentFileName}
          stage={uploadStage}
          message={uploadMessage}
          progress={uploadStage === "uploading" ? uploadProgress : undefined}
        />
      </div>
    </div>
  );
};

const PDFEditor: React.FC = () => {
  return <PDFEditorDashboard />;
};

export default PDFEditor;
