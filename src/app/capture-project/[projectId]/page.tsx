"use client";

import React, { useEffect, useState, use } from "react";
import { Document, Page } from "react-pdf";
import {
  TextField,
  Shape,
  Image,
  ElementCollections,
} from "../../pdf-editor/types/pdf-editor.types";
import { ProjectState } from "../../pdf-editor/hooks/states/useProjectState";
import { colorToRgba } from "../../pdf-editor/utils/colors";
import { isPdfFile } from "../../pdf-editor/utils/measurements";
import { FileText, Loader2 } from "lucide-react";
import { getProject } from "../../pdf-editor/services/projectApiService";
import { useAuthStore } from "@/lib/store/AuthStore";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProjectPageViewProps {
  params: Promise<{
    projectId: string;
  }>;
}

// Helper function to render text box
const renderTextBox = (tb: TextField, scale: number = 1) => (
  <div
    key={tb.id}
    style={{
      position: "absolute",
      left: tb.x * scale,
      top: tb.y * scale,
      width: tb.width * scale,
      height: tb.height * scale,
      fontSize: (tb.fontSize || 16) * scale,
      fontFamily: tb.fontFamily || "Arial",
      fontWeight: tb.bold ? "bold" : "normal",
      fontStyle: tb.italic ? "italic" : "normal",
      textDecoration: tb.underline ? "underline" : "none",
      color: tb.color || "#000",
      background: colorToRgba(tb.backgroundColor, tb.backgroundOpacity ?? 0),
      border: tb.borderWidth
        ? `${tb.borderWidth * scale}px solid ${tb.borderColor || "#000"}`
        : "none",
      borderRadius: (tb.borderRadius || 0) * scale,
      padding: `${(tb.paddingTop || 0) * scale}px ${
        (tb.paddingRight || 0) * scale
      }px ${(tb.paddingBottom || 0) * scale}px ${
        (tb.paddingLeft || 0) * scale
      }px`,
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      textAlign: tb.textAlign || "left",
      lineHeight: tb.lineHeight || 1.1,
      opacity: tb.textOpacity ?? 1,
      zIndex: tb.zIndex ?? 1,
      pointerEvents: "none",
    }}
    title={tb.value}
  >
    {tb.value}
  </div>
);

// Helper function to render shape
const renderShape = (shape: Shape, scale: number = 1) => {
  if (shape.type === "line") {
    const x1 = (shape.x1 ?? shape.x) * scale;
    const y1 = (shape.y1 ?? shape.y) * scale;
    const x2 = (shape.x2 ?? shape.x + shape.width) * scale;
    const y2 = (shape.y2 ?? shape.y + shape.height) * scale;
    return (
      <svg
        key={shape.id}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={shape.borderColor || "#000"}
          strokeWidth={(shape.borderWidth || 2) * scale}
        />
      </svg>
    );
  }
  return (
    <div
      key={shape.id}
      style={{
        position: "absolute",
        left: shape.x * scale,
        top: shape.y * scale,
        width: shape.width * scale,
        height: shape.height * scale,
        background: colorToRgba(shape.fillColor, shape.fillOpacity ?? 1),
        border: `${(shape.borderWidth || 1) * scale}px solid ${
          shape.borderColor || "#000"
        }`,
        borderRadius:
          shape.type === "circle" ? "50%" : (shape.borderRadius || 0) * scale,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
};

// Helper function to render image
const renderImage = (img: Image, scale: number = 1) => (
  <img
    key={img.id}
    src={img.src}
    alt=""
    style={{
      position: "absolute",
      left: img.x * scale,
      top: img.y * scale,
      width: img.width * scale,
      height: img.height * scale,
      border: img.borderWidth
        ? `${img.borderWidth * scale}px solid ${img.borderColor || "#000"}`
        : undefined,
      borderRadius: (img.borderRadius || 0) * scale,
      opacity: img.opacity ?? 1,
      objectFit: "cover",
      zIndex: 3,
      pointerEvents: "none",
    }}
    draggable={false}
  />
);

// Helper function to render deletion rectangle
const renderDeletionRectangle = (rect: any, scale: number = 1) => (
  <div
    key={rect.id}
    style={{
      position: "absolute",
      left: rect.x * scale,
      top: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      background: rect.background ? rect.background : "rgba(255,0,0,0.15)",
      opacity: rect.opacity ?? 0.5,
      border: "none",
      zIndex: 0,
      pointerEvents: "none",
    }}
    title="Deletion Rectangle"
  />
);

// Helper function to create sorted elements array
const createSortedElements = (elements: {
  deletions: any[];
  shapes: Shape[];
  images: Image[];
  textboxes: TextField[];
}) => {
  const allElements: Array<{
    type: "deletion" | "shape" | "image" | "textbox";
    element: any;
    zIndex: number;
  }> = [];

  // Add deletion rectangles with lowest zIndex
  elements.deletions.forEach((rect) => {
    allElements.push({
      type: "deletion",
      element: rect,
      zIndex: rect.zIndex || 0,
    });
  });

  // Add shapes
  elements.shapes.forEach((shape) => {
    allElements.push({
      type: "shape",
      element: shape,
      zIndex: (shape as any).zIndex || 2,
    });
  });

  // Add images
  elements.images.forEach((image) => {
    allElements.push({
      type: "image",
      element: image,
      zIndex: (image as any).zIndex || 3,
    });
  });

  // Add textboxes with highest zIndex
  elements.textboxes.forEach((textbox) => {
    allElements.push({
      type: "textbox",
      element: textbox,
      zIndex: textbox.zIndex || 4,
    });
  });

  // Sort by zIndex
  return allElements.sort((a, b) => a.zIndex - b.zIndex);
};

// Helper function to render element based on type
const renderElement = (
  item: {
    type: string;
    element: any;
    zIndex: number;
  },
  scale: number = 1
) => {
  switch (item.type) {
    case "deletion":
      return renderDeletionRectangle(item.element, scale);
    case "shape":
      return renderShape(item.element, scale);
    case "image":
      return renderImage(item.element, scale);
    case "textbox":
      return renderTextBox(item.element, scale);
    default:
      return null;
  }
};

// Component to render a single page view
const PageView: React.FC<{
  pageNum: number;
  pageWidth: number;
  pageHeight: number;
  pdfUrl: string;
  pdfBackgroundColor: string;
  elements: {
    deletions: any[];
    shapes: Shape[];
    images: Image[];
    textboxes: TextField[];
  };
  className: string;
  title: string;
  showPdfBackground?: boolean;
  translatedTemplateURL?: string;
  finalLayoutUrl?: string;
}> = ({
  pageNum,
  pageWidth,
  pageHeight,
  pdfUrl,
  pdfBackgroundColor,
  elements,
  className,
  title,
  showPdfBackground = true,
  translatedTemplateURL,
  finalLayoutUrl,
}) => {
  const isPdf = pdfUrl && isPdfFile(pdfUrl);
  const sortedElements = createSortedElements(elements);

  // Determine what background to show
  const shouldShowPdf = showPdfBackground && isPdf;
  const shouldShowTranslatedTemplate =
    translatedTemplateURL && isPdfFile(translatedTemplateURL);
  const shouldShowFinalLayout = finalLayoutUrl && isPdfFile(finalLayoutUrl);

  return (
    <div className={className} style={{ marginBottom: "20px" }}>
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div
        style={{
          position: "relative",
          width: pageWidth,
          height: pageHeight,
          background: pdfBackgroundColor,
          border: "2px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Background rendering logic */}
        {shouldShowFinalLayout ? (
          // Show final layout document if available
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
            }}
          >
            <Document file={finalLayoutUrl} loading={null} error={null}>
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
                error={null}
              />
            </Document>
          </div>
        ) : shouldShowTranslatedTemplate ? (
          // Show translated template if available
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
            }}
          >
            <Document file={translatedTemplateURL} loading={null} error={null}>
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
                error={null}
              />
            </Document>
          </div>
        ) : shouldShowPdf ? (
          // Show original PDF if showPdfBackground is true
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
            }}
          >
            <Document file={pdfUrl} loading={null} error={null}>
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
                error={null}
              />
            </Document>
          </div>
        ) : pdfUrl && !isPdf ? (
          // Show image if it's not a PDF
          <img
            src={pdfUrl}
            alt="Document preview"
            style={{
              width: pageWidth,
              height: pageHeight,
              maxWidth: "none",
              display: "block",
              position: "absolute",
              left: 0,
              top: 0,
              objectFit: "cover",
              zIndex: 0,
            }}
            draggable={false}
          />
        ) : (
          // Show white background for translated view or no content
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              background: "#ffffff",
              zIndex: 0,
            }}
          />
        )}

        {/* Render all elements in correct layering order */}
        {sortedElements.map((item, index) => (
          <React.Fragment key={`${item.type}-${item.element.id || index}`}>
            {renderElement(item)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ProjectPageView: React.FC<ProjectPageViewProps> = ({ params }) => {
  // Unwrap params for Next.js 15 compatibility
  const unwrappedParams = use(params);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, session } = useAuthStore();
  const isUserAuthenticated = !!(user && session);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);

        // Try to fetch project - let the API handle authentication

        // Get auth token directly from the store
        let authToken = useAuthStore.getState().getAuthToken();

        // Fallback: try to get token from session if store method fails
        if (!authToken && session?.access_token) {
          authToken = session.access_token;
        }

        console.log(
          "Auth token retrieved:",
          authToken ? "Token exists" : "No token"
        );
        console.log("Auth token value:", authToken);
        console.log("User and session state:", { user, session });
        console.log("Session access token:", session?.access_token);

        // Ensure we have an auth token before proceeding
        if (!authToken) {
          console.error("No auth token available");
          setError("Authentication required. Please log in again.");
          setLoading(false);
          return;
        }

        // Fetch project from API with auth token
        const apiResponse = await getProject(
          unwrappedParams.projectId,
          authToken
        );

        console.log("API Response:", apiResponse);
        console.log("Project Data:", apiResponse.project_data);
        console.log("Document State:", apiResponse.project_data?.documentState);
        console.log("Final Layout Fields:", {
          finalLayoutUrl:
            apiResponse.project_data?.documentState?.finalLayoutUrl,
          finalLayoutNumPages:
            apiResponse.project_data?.documentState?.finalLayoutNumPages,
          finalLayoutDeletedPages:
            apiResponse.project_data?.documentState?.finalLayoutDeletedPages,
        });

        // Transform API response to ProjectState format
        const projectState: ProjectState = {
          id: apiResponse.id,
          name: apiResponse.name,
          createdAt: apiResponse.created_at,
          updatedAt: apiResponse.updated_at,
          version: "1.0.0", // Default version
          documentState: {
            url: apiResponse.project_data?.documentState?.url || "",
            currentPage: apiResponse.current_page || 1,
            numPages: apiResponse.num_pages || 1,
            scale: apiResponse.project_data?.documentState?.scale || 1,
            pageWidth:
              apiResponse.project_data?.documentState?.pageWidth || 800,
            pageHeight:
              apiResponse.project_data?.documentState?.pageHeight || 1000,
            isLoading: false,
            error: "",
            fileType:
              apiResponse.project_data?.documentState?.fileType || "pdf",
            imageDimensions:
              apiResponse.project_data?.documentState?.imageDimensions || null,
            isDocumentLoaded: true,
            isPageLoading: false,
            isScaleChanging: false,
            pdfBackgroundColor:
              apiResponse.project_data?.documentState?.pdfBackgroundColor ||
              "#ffffff",
            detectedPageBackgrounds:
              apiResponse.project_data?.documentState
                ?.detectedPageBackgrounds || {},
            pages: apiResponse.project_data?.documentState?.pages || [],
            deletedPages:
              apiResponse.project_data?.documentState?.deletedPages || [],
            isTransforming: false,
            // Final layout fields
            finalLayoutUrl:
              apiResponse.project_data?.documentState?.finalLayoutUrl ||
              undefined,
            finalLayoutCurrentPage:
              apiResponse.project_data?.documentState?.finalLayoutCurrentPage ||
              undefined,
            finalLayoutNumPages:
              apiResponse.project_data?.documentState?.finalLayoutNumPages ||
              undefined,
            finalLayoutDeletedPages:
              apiResponse.project_data?.documentState
                ?.finalLayoutDeletedPages || undefined,
          },
          viewState: {
            currentView: "original",
            currentWorkflowStep: apiResponse.current_workflow_step || "capture",
            activeSidebarTab: "elements",
            isSidebarCollapsed: false,
            isCtrlPressed: false,
          },
          elementCollections: {
            originalTextBoxes:
              apiResponse.project_data?.elementCollections?.originalTextBoxes ||
              [],
            originalShapes:
              apiResponse.project_data?.elementCollections?.originalShapes ||
              [],
            originalDeletionRectangles:
              apiResponse.project_data?.elementCollections
                ?.originalDeletionRectangles || [],
            originalImages:
              apiResponse.project_data?.elementCollections?.originalImages ||
              [],
            translatedTextBoxes:
              apiResponse.project_data?.elementCollections
                ?.translatedTextBoxes || [],
            translatedShapes:
              apiResponse.project_data?.elementCollections?.translatedShapes ||
              [],
            translatedDeletionRectangles:
              apiResponse.project_data?.elementCollections
                ?.translatedDeletionRectangles || [],
            translatedImages:
              apiResponse.project_data?.elementCollections?.translatedImages ||
              [],
            untranslatedTexts:
              apiResponse.project_data?.elementCollections?.untranslatedTexts ||
              [],
            finalLayoutTextboxes:
              apiResponse.project_data?.elementCollections
                ?.finalLayoutTextboxes || [],
            finalLayoutShapes:
              apiResponse.project_data?.elementCollections?.finalLayoutShapes ||
              [],
            finalLayoutDeletionRectangles:
              apiResponse.project_data?.elementCollections
                ?.finalLayoutDeletionRectangles || [],
            finalLayoutImages:
              apiResponse.project_data?.elementCollections?.finalLayoutImages ||
              [],
          },
          layerState: {
            originalLayerOrder:
              apiResponse.project_data?.layerState?.originalLayerOrder || [],
            translatedLayerOrder:
              apiResponse.project_data?.layerState?.translatedLayerOrder || [],
            finalLayoutLayerOrder:
              apiResponse.project_data?.layerState?.finalLayoutLayerOrder || [],
          },
          editorState: {
            selectedFieldId: null,
            selectedShapeId: null,
            isEditMode: false,
            isAddTextBoxMode: false,
            isTextSelectionMode: false,
            showDeletionRectangles: false,
            isImageUploadMode: false,
            isSelectionMode: false,
          },
          sourceLanguage: apiResponse.source_language || "en",
          desiredLanguage: apiResponse.desired_language || "es",
        };

        setProject(projectState);

        console.log("Transformed Project State:", projectState);
        console.log("Final Layout in Project State:", {
          finalLayoutUrl: projectState.documentState.finalLayoutUrl,
          finalLayoutNumPages: projectState.documentState.finalLayoutNumPages,
          finalLayoutDeletedPages:
            projectState.documentState.finalLayoutDeletedPages,
        });
      } catch (err) {
        console.error("Error fetching project:", err);

        // Handle specific authentication errors
        if (err instanceof Error) {
          if (
            err.message.includes("401") ||
            err.message.includes("Unauthorized")
          ) {
            setError("Please log in to view this project");
          } else if (
            err.message.includes("403") ||
            err.message.includes("Forbidden")
          ) {
            setError("You don't have permission to view this project");
          } else if (
            err.message.includes("404") ||
            err.message.includes("Not found")
          ) {
            setError("Project not found");
          } else {
            setError(err.message || "Failed to fetch project");
          }
        } else {
          setError("Failed to fetch project");
        }
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have auth data
    if (user && session) {
      fetchProject();
    } else {
      console.log("Waiting for auth data to be available");
      setLoading(false);
    }
  }, [unwrappedParams.projectId, user, session, isUserAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  // Show loading state while waiting for auth
  if (!user || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin" />
          <span>Loading authentication...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error || "Project not found"}</p>
        </div>
      </div>
    );
  }

  const { documentState, elementCollections } = project;
  const numPages = documentState.numPages;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {project.name}
          </h1>
          <p className="text-gray-600">
            Project ID: {project.id} | Pages: {numPages} | Source:{" "}
            {project.sourceLanguage} → Target: {project.desiredLanguage}
          </p>
        </div>

        {/* Original and Translated Pages - Paired Side by Side */}
        <div className="space-y-8 mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2">
            Original vs Translated Pages
          </h2>
          {Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1;

            // Original page elements
            const originalPageElements = {
              deletions: elementCollections.originalDeletionRectangles.filter(
                (r: any) => r.page === pageNum
              ),
              shapes: elementCollections.originalShapes.filter(
                (s: Shape) => s.page === pageNum
              ),
              images: elementCollections.originalImages.filter(
                (img: Image) => img.page === pageNum
              ),
              textboxes: elementCollections.originalTextBoxes.filter(
                (tb: TextField) => tb.page === pageNum
              ),
            };

            // Translated page elements
            const translatedPageElements = {
              deletions: elementCollections.translatedDeletionRectangles.filter(
                (r: any) => r.page === pageNum
              ),
              shapes: elementCollections.translatedShapes.filter(
                (s: Shape) => s.page === pageNum
              ),
              images: elementCollections.translatedImages.filter(
                (img: Image) => img.page === pageNum
              ),
              textboxes: elementCollections.translatedTextBoxes.filter(
                (tb: TextField) => tb.page === pageNum
              ),
            };

            return (
              <div
                key={`page-${pageNum}`}
                className="border rounded-lg p-6 bg-white shadow-sm"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Page {pageNum}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Original View */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-3 text-center">
                      Original
                    </h4>
                    <PageView
                      pageNum={pageNum}
                      pageWidth={documentState.pageWidth}
                      pageHeight={documentState.pageHeight}
                      pdfUrl={documentState.url}
                      pdfBackgroundColor={documentState.pdfBackgroundColor}
                      elements={originalPageElements}
                      className="original-page-container"
                      title=""
                      showPdfBackground={true}
                    />
                  </div>

                  {/* Translated View */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-3 text-center">
                      Translated
                    </h4>
                    <PageView
                      pageNum={pageNum}
                      pageWidth={documentState.pageWidth}
                      pageHeight={documentState.pageHeight}
                      pdfUrl={documentState.url}
                      pdfBackgroundColor={documentState.pdfBackgroundColor}
                      elements={translatedPageElements}
                      className="translated-page-container"
                      title=""
                      showPdfBackground={false}
                      translatedTemplateURL={
                        project.documentState.pages?.[pageNum - 1]
                          ?.translatedTemplateURL
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Layout Pages - Separate Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2">
            Final Layout Pages
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from(
              { length: documentState.finalLayoutNumPages || numPages },
              (_, i) => {
                const pageNum = i + 1;

                // Skip deleted pages in final layout
                if (documentState.finalLayoutDeletedPages) {
                  if (Array.isArray(documentState.finalLayoutDeletedPages)) {
                    if (
                      documentState.finalLayoutDeletedPages.includes(pageNum)
                    ) {
                      return null;
                    }
                  } else if (
                    (documentState.finalLayoutDeletedPages as Set<number>).has(
                      pageNum
                    )
                  ) {
                    return null;
                  }
                }

                const pageElements = {
                  deletions:
                    elementCollections.finalLayoutDeletionRectangles.filter(
                      (r: any) => r.page === pageNum
                    ),
                  shapes: elementCollections.finalLayoutShapes.filter(
                    (s: Shape) => s.page === pageNum
                  ),
                  images: elementCollections.finalLayoutImages.filter(
                    (img: Image) => img.page === pageNum
                  ),
                  textboxes: elementCollections.finalLayoutTextboxes.filter(
                    (tb: TextField) => tb.page === pageNum
                  ),
                };

                return (
                  <div
                    key={`final-${pageNum}`}
                    className="bg-white rounded-lg p-4 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">
                      Final Layout - Page {pageNum}
                    </h3>
                    <PageView
                      pageNum={pageNum}
                      pageWidth={documentState.pageWidth}
                      pageHeight={documentState.pageHeight}
                      pdfUrl={documentState.finalLayoutUrl || documentState.url}
                      pdfBackgroundColor={documentState.pdfBackgroundColor}
                      elements={pageElements}
                      className="final-view-page-container"
                      title=""
                      showPdfBackground={false}
                      finalLayoutUrl={documentState.finalLayoutUrl}
                    />
                  </div>
                );
              }
            ).filter(Boolean)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPageView;
