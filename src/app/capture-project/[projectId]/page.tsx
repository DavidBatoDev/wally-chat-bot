"use client";

import React, { useEffect, useState, use, useRef, useCallback } from "react";
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
import { FileText, Loader2, Download } from "lucide-react";
import { getPublicProject } from "../../pdf-editor/services/projectApiService";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Add these imports at the top
import JSZip from "jszip";
import domtoimage from "dom-to-image";
import { PDFDocument } from "pdf-lib";

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
      background:
        tb.backgroundColor &&
        tb.backgroundColor !== "transparent" &&
        (tb.backgroundOpacity ?? 0) > 0
          ? colorToRgba(tb.backgroundColor, tb.backgroundOpacity ?? 1)
          : "transparent",
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
    <div
      className={className}
      style={{
        marginBottom: "20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <div
        data-page-number={pageNum}
        data-page-width={pageWidth}
        data-page-height={pageHeight}
        data-view-type={
          // Always tag by the container/view being rendered so Puppeteer can target reliably
          className?.includes("translated-page-container")
            ? "translated"
            : className?.includes("final-view-page-container") || finalLayoutUrl
            ? "final-layout"
            : "original"
        }
        className="react-pdf__Page"
        style={{
          position: "relative",
          width: pageWidth,
          height: pageHeight,
          background: pdfBackgroundColor,
          border: "2px solid #e5e7eb",
          borderRadius: 8,
          overflow: finalLayoutUrl ? "visible" : "hidden",
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
                scale={1}
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
                scale={1}
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
                scale={1}
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
          <>
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
            {/* Placeholder canvas to satisfy capture waiters that expect a canvas */}
            <canvas
              className="react-pdf__Page__canvas"
              style={{
                display: "block",
                userSelect: "none",
                width: pageWidth,
                height: pageHeight,
                position: "absolute",
                left: 0,
                top: 0,
                opacity: 0.001, // practically invisible, keeps white background visible
              }}
              width={Math.round(pageWidth * 1.5)}
              height={Math.round(pageHeight * 1.5)}
            />
          </>
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

  // Add new state for download functionality
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  // Ref for OCR service to find pages
  const documentRef = useRef<HTMLDivElement>(null);

  // Function to download a single page from a specific view type
  const downloadSinglePage = useCallback(
    async (viewType: string, pageNum: number) => {
      if (!project || !documentRef.current) return;

      try {
        setIsDownloading(true);
        setDownloadProgress(0);

        let pageElement: HTMLElement | null = null;
        let pageWidth: number;
        let pageHeight: number;
        let pdfUrl: string;
        let pdfBackgroundColor: string;
        let elements: {
          deletions: any[];
          shapes: Shape[];
          images: Image[];
          textboxes: TextField[];
        };
        let title: string;
        let showPdfBackground: boolean;
        let translatedTemplateURL: string | undefined;
        let finalLayoutUrl: string | undefined;

        if (viewType === "original") {
          pageElement = documentRef.current!.querySelector(
            `.original-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
          ) as HTMLElement;
          pageWidth = project.documentState.pageWidth;
          pageHeight = project.documentState.pageHeight;
          pdfUrl = project.documentState.url;
          pdfBackgroundColor = project.documentState.pdfBackgroundColor;
          elements = {
            deletions:
              project.elementCollections.originalDeletionRectangles.filter(
                (r: any) => r.page === pageNum
              ),
            shapes: project.elementCollections.originalShapes.filter(
              (s: Shape) => s.page === pageNum
            ),
            images: project.elementCollections.originalImages.filter(
              (img: Image) => img.page === pageNum
            ),
            textboxes: project.elementCollections.originalTextBoxes.filter(
              (tb: TextField) => tb.page === pageNum
            ),
          };
          title = `Original View - Page ${pageNum}`;
          showPdfBackground = true;
          translatedTemplateURL = undefined;
          finalLayoutUrl = undefined;
        } else if (viewType === "translated") {
          pageElement = documentRef.current!.querySelector(
            `.translated-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
          ) as HTMLElement;
          pageWidth =
            project.documentState.pages?.[pageNum - 1]
              ?.translatedTemplateWidth || project.documentState.pageWidth;
          pageHeight =
            project.documentState.pages?.[pageNum - 1]
              ?.translatedTemplateHeight || project.documentState.pageHeight;
          pdfUrl = project.documentState.url;
          pdfBackgroundColor = project.documentState.pdfBackgroundColor;
          elements = {
            deletions:
              project.elementCollections.translatedDeletionRectangles.filter(
                (r: any) => r.page === pageNum
              ),
            shapes: project.elementCollections.translatedShapes.filter(
              (s: Shape) => s.page === pageNum
            ),
            images: project.elementCollections.translatedImages.filter(
              (img: Image) => img.page === pageNum
            ),
            textboxes: project.elementCollections.translatedTextBoxes.filter(
              (tb: TextField) => tb.page === pageNum
            ),
          };
          title = `Translated View - Page ${pageNum}`;
          showPdfBackground = false;
          translatedTemplateURL =
            project.documentState.pages?.[pageNum - 1]?.translatedTemplateURL;
          finalLayoutUrl = undefined;
        } else if (viewType === "final-layout") {
          pageElement = documentRef.current!.querySelector(
            `.final-view-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
          ) as HTMLElement;
          pageWidth =
            project.documentState.pages?.[pageNum - 1]?.finalLayoutWidth ||
            project.documentState.pageWidth;
          pageHeight =
            project.documentState.pages?.[pageNum - 1]?.finalLayoutHeight ||
            project.documentState.pageHeight;
          pdfUrl =
            project.documentState.finalLayoutUrl || project.documentState.url;
          pdfBackgroundColor = project.documentState.pdfBackgroundColor;
          elements = {
            deletions:
              project.elementCollections.finalLayoutDeletionRectangles.filter(
                (r: any) => r.page === pageNum
              ),
            shapes: project.elementCollections.finalLayoutShapes.filter(
              (s: Shape) => s.page === pageNum
            ),
            images: project.elementCollections.finalLayoutImages.filter(
              (img: Image) => img.page === pageNum
            ),
            textboxes: project.elementCollections.finalLayoutTextboxes.filter(
              (tb: TextField) => tb.page === pageNum
            ),
          };
          title = `Final Layout View - Page ${pageNum}`;
          showPdfBackground = false;
          translatedTemplateURL = undefined;
          finalLayoutUrl = project.documentState.finalLayoutUrl;
        } else {
          return;
        }

        if (!pageElement) {
          alert(
            `Page element for view type "${viewType}" and page ${pageNum} not found.`
          );
          return;
        }

        const image = await domtoimage.toPng(pageElement, {
          quality: 1.0,
          bgcolor: "#ffffff",
          width: (pageElement.scrollWidth || pageElement.offsetWidth) * 2, // 2x scale for high resolution
          height: (pageElement.scrollHeight || pageElement.offsetHeight) * 2, // 2x scale for high resolution
          style: {
            transform: "scale(2)", // Scale up for higher resolution
            transformOrigin: "top left",
          },
          filter: (node: Node): boolean => {
            // Filter out UI elements that shouldn't be captured
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (
                element.classList.contains("drag-handle") ||
                element.tagName === "BUTTON" ||
                element.classList.contains("settings-popup") ||
                element.classList.contains("text-selection-popup") ||
                element.classList.contains("fixed") ||
                element.closest(".fixed") !== null
              ) {
                return false;
              }
            }
            return true;
          },
        });

        const imageBlob = await fetch(image).then((res) => res.blob());
        const url = URL.createObjectURL(imageBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${project.name}-${viewType}-page-${pageNum}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setDownloadProgress(100);
      } catch (error) {
        console.error("Error downloading single page:", error);
      } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    },
    [project]
  );

  // Add the image capture and download function
  const captureAndDownloadAllImages = useCallback(async () => {
    if (!project || !documentRef.current) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const zip = new JSZip();
      const totalPages = project.documentState.numPages;
      const finalLayoutUrl = project.documentState.finalLayoutUrl;
      const finalLayoutNumPages = project.documentState.finalLayoutNumPages;

      // Wait for all pages to render and set optimal scale for high quality
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Capture original pages with high resolution
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setDownloadProgress(((pageNum - 1) / (totalPages * 2)) * 100);

        // Find the original page element (react-pdf__Page) for this page
        const originalPageElement = documentRef.current!.querySelector(
          `.original-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
        ) as HTMLElement;

        if (originalPageElement) {
          // Capture original page with high resolution settings
          const originalImage = await domtoimage.toPng(originalPageElement, {
            quality: 1.0,
            bgcolor: "#ffffff",
            width:
              (originalPageElement.scrollWidth ||
                originalPageElement.offsetWidth) * 2, // 2x scale for high resolution
            height:
              (originalPageElement.scrollHeight ||
                originalPageElement.offsetHeight) * 2, // 2x scale for high resolution
            style: {
              transform: "scale(2)", // Scale up for higher resolution
              transformOrigin: "top left",
            },
            filter: (node: Node): boolean => {
              // Filter out UI elements that shouldn't be captured
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                if (
                  element.classList.contains("drag-handle") ||
                  element.tagName === "BUTTON" ||
                  element.classList.contains("settings-popup") ||
                  element.classList.contains("text-selection-popup") ||
                  element.classList.contains("fixed") ||
                  element.closest(".fixed") !== null
                ) {
                  return false;
                }
              }
              return true;
            },
          });

          // Add to zip
          zip.file(
            `original-page-${pageNum}.png`,
            originalImage.split(",")[1],
            { base64: true }
          );
        } else {
          console.warn(`Original page element not found for page ${pageNum}`);
        }
      }

      // Capture translated pages with high resolution
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setDownloadProgress(
          ((totalPages + pageNum - 1) / (totalPages * 2)) * 100
        );

        // Find the translated page element (react-pdf__Page) for this page
        const translatedPageElement = documentRef.current!.querySelector(
          `.translated-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
        ) as HTMLElement;

        if (translatedPageElement) {
          // Capture translated page with high resolution settings
          const translatedImage = await domtoimage.toPng(
            translatedPageElement,
            {
              quality: 1.0,
              bgcolor: "#ffffff",
              width:
                (translatedPageElement.scrollWidth ||
                  translatedPageElement.offsetWidth) * 2, // 2x scale for high resolution
              height:
                (translatedPageElement.scrollHeight ||
                  translatedPageElement.offsetHeight) * 2, // 2x scale for high resolution
              style: {
                transform: "scale(2)", // Scale up for higher resolution
                transformOrigin: "top left",
              },
              filter: (node: Node): boolean => {
                // Filter out UI elements that shouldn't be captured
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as HTMLElement;
                  if (
                    element.classList.contains("drag-handle") ||
                    element.tagName === "BUTTON" ||
                    element.classList.contains("settings-popup") ||
                    element.classList.contains("text-selection-popup") ||
                    element.classList.contains("fixed") ||
                    element.closest(".fixed") !== null
                  ) {
                    return false;
                  }
                }
                return true;
              },
            }
          );

          // Add to zip
          zip.file(
            `translated-page-${pageNum}.png`,
            translatedImage.split(",")[1],
            { base64: true }
          );
        } else {
          console.warn(`Translated page element not found for page ${pageNum}`);
        }
      }

      // Capture final layout pages if available with high resolution
      if (finalLayoutUrl && finalLayoutNumPages && finalLayoutNumPages > 0) {
        // Wait a bit more for final layout pages to fully render
        await new Promise((resolve) => setTimeout(resolve, 500));

        for (let pageNum = 1; pageNum <= finalLayoutNumPages; pageNum++) {
          setDownloadProgress(
            ((totalPages * 2 + pageNum - 1) /
              (totalPages * 2 + finalLayoutNumPages)) *
              100
          );

          // Try multiple selectors to find the final layout page element (react-pdf__Page)
          let finalLayoutPageElement: HTMLElement | null = null;

          // First try: direct selector for react-pdf__Page
          finalLayoutPageElement = documentRef.current!.querySelector(
            `.final-view-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
          ) as HTMLElement;

          if (!finalLayoutPageElement) {
            // Second try: alternative selector for react-pdf__Page
            finalLayoutPageElement = documentRef.current!.querySelector(
              `.react-pdf__Page[data-page-number="${pageNum}"][data-view-type="final-layout"]`
            ) as HTMLElement;
          }

          if (!finalLayoutPageElement) {
            // Third try: search for any react-pdf__Page with the page number in final layout section
            const finalLayoutSection = documentRef.current!.querySelector(
              ".final-view-page-container"
            );
            if (finalLayoutSection) {
              finalLayoutPageElement = finalLayoutSection.querySelector(
                `.react-pdf__Page[data-page-number="${pageNum}"]`
              ) as HTMLElement;
            }
          }

          if (!finalLayoutPageElement) {
            // Fourth try: manual search through all react-pdf__Page elements
            const allPageElements =
              documentRef.current!.querySelectorAll(".react-pdf__Page");
            for (const element of allPageElements) {
              const elementPageNum = element.getAttribute("data-page-number");
              const elementViewType = element.getAttribute("data-view-type");
              if (
                elementPageNum === pageNum.toString() &&
                elementViewType === "final-layout"
              ) {
                finalLayoutPageElement = element as HTMLElement;
                break;
              }
            }
          }

          if (finalLayoutPageElement) {
            try {
              // Capture final layout page with high resolution settings
              const finalLayoutImage = await domtoimage.toPng(
                finalLayoutPageElement,
                {
                  quality: 1.0,
                  bgcolor: "#ffffff",
                  width:
                    (finalLayoutPageElement.scrollWidth ||
                      finalLayoutPageElement.offsetWidth) * 2, // 2x scale for high resolution
                  height:
                    (finalLayoutPageElement.scrollHeight ||
                      finalLayoutPageElement.offsetHeight) * 2, // 2x scale for high resolution
                  style: {
                    transform: "scale(2)", // Scale up for higher resolution
                    transformOrigin: "top left",
                  },
                  filter: (node: Node): boolean => {
                    // Filter out UI elements that shouldn't be captured
                    if (node.nodeType === Node.ELEMENT_NODE) {
                      const element = node as HTMLElement;
                      if (
                        element.classList.contains("drag-handle") ||
                        element.tagName === "BUTTON" ||
                        element.classList.contains("settings-popup") ||
                        element.classList.contains("text-selection-popup") ||
                        element.classList.contains("fixed") ||
                        element.closest(".fixed") !== null
                      ) {
                        return false;
                      }
                    }
                    return true;
                  },
                }
              );

              // Add to zip
              zip.file(
                `final-layout-page-${pageNum}.png`,
                finalLayoutImage.split(",")[1],
                { base64: true }
              );
            } catch (captureError) {
              console.error(
                `Error capturing final layout page ${pageNum}:`,
                captureError
              );
            }
          } else {
            console.warn(
              `Final layout page element not found for page ${pageNum}`
            );
          }
        }
      }

      // Generate and download zip file
      setDownloadProgress(95);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name}-all-pages-images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);
      setDownloadProgress(100);
    } catch (error) {
      console.error("Error capturing images:", error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [project]);

  const generateFinalLayoutPdf = useCallback(async () => {
    if (!project?.documentState.finalLayoutUrl || !documentRef.current) {
      console.warn(
        "No final layout PDF URL available or document ref not ready"
      );
      return;
    }

    try {
      setIsPdfDownloading(true);

      // Wait for final layout pages to render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalLayoutNumPages = project.documentState.finalLayoutNumPages;
      if (!finalLayoutNumPages || finalLayoutNumPages <= 0) {
        throw new Error("No final layout pages available");
      }

      // Capture all final layout pages using dom-to-image
      const capturedImages: string[] = [];

      for (let pageNum = 1; pageNum <= finalLayoutNumPages; pageNum++) {
        // Try multiple selectors to find the final layout page element
        let finalLayoutPageElement: HTMLElement | null = null;

        // First try: direct selector for react-pdf__Page
        finalLayoutPageElement = documentRef.current!.querySelector(
          `.final-view-page-container .react-pdf__Page[data-page-number="${pageNum}"]`
        ) as HTMLElement;

        if (!finalLayoutPageElement) {
          // Second try: alternative selector for react-pdf__Page
          finalLayoutPageElement = documentRef.current!.querySelector(
            `.react-pdf__Page[data-page-number="${pageNum}"][data-view-type="final-layout"]`
          ) as HTMLElement;
        }

        if (!finalLayoutPageElement) {
          // Third try: search for any react-pdf__Page with the page number in final layout section
          const finalLayoutSection = documentRef.current!.querySelector(
            ".final-view-page-container"
          );
          if (finalLayoutSection) {
            finalLayoutPageElement = finalLayoutSection.querySelector(
              `.react-pdf__Page[data-page-number="${pageNum}"]`
            ) as HTMLElement;
          }
        }

        if (!finalLayoutPageElement) {
          // Fourth try: manual search through all react-pdf__Page elements
          const allPageElements =
            documentRef.current!.querySelectorAll(".react-pdf__Page");
          for (const element of allPageElements) {
            const elementPageNum = element.getAttribute("data-page-number");
            const elementViewType = element.getAttribute("data-view-type");
            if (
              elementPageNum === pageNum.toString() &&
              elementViewType === "final-layout"
            ) {
              finalLayoutPageElement = element as HTMLElement;
              break;
            }
          }
        }

        if (finalLayoutPageElement) {
          try {
            // Capture final layout page with high resolution settings
            const finalLayoutImage = await domtoimage.toPng(
              finalLayoutPageElement,
              {
                quality: 1.0,
                bgcolor: "#ffffff",
                width:
                  (finalLayoutPageElement.scrollWidth ||
                    finalLayoutPageElement.offsetWidth) * 2, // 2x scale for high resolution
                height:
                  (finalLayoutPageElement.scrollHeight ||
                    finalLayoutPageElement.offsetHeight) * 2, // 2x scale for high resolution
                style: {
                  transform: "scale(2)", // Scale up for higher resolution
                  transformOrigin: "top left",
                },
                filter: (node: Node): boolean => {
                  // Filter out UI elements that shouldn't be captured
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;
                    if (
                      element.classList.contains("drag-handle") ||
                      element.tagName === "BUTTON" ||
                      element.classList.contains("settings-popup") ||
                      element.classList.contains("text-selection-popup") ||
                      element.classList.contains("fixed") ||
                      element.closest(".fixed") !== null
                    ) {
                      return false;
                    }
                  }
                  return true;
                },
              }
            );

            capturedImages.push(finalLayoutImage);
          } catch (captureError) {
            console.error(
              `Error capturing final layout page ${pageNum}:`,
              captureError
            );
            throw new Error(`Failed to capture page ${pageNum}`);
          }
        } else {
          throw new Error(
            `Final layout page element not found for page ${pageNum}`
          );
        }
      }

      if (capturedImages.length === 0) {
        throw new Error("No images were captured");
      }

      // Convert captured images to a PDF
      const pdfDoc = await PDFDocument.create();

      // Add each captured image as a page
      for (let i = 0; i < capturedImages.length; i++) {
        const imageDataUrl = capturedImages[i];
        const pageNumber = i + 1;

        try {
          // Convert data URL to array buffer
          const imageBytes = await fetch(imageDataUrl).then((res) =>
            res.arrayBuffer()
          );

          // Embed the PNG image
          const embeddedImage = await pdfDoc.embedPng(imageBytes);
          const imageDims = embeddedImage.scale(1);

          // Create a new page (Letter size: 612 x 792 points)
          const page = pdfDoc.addPage([612, 792]);
          const { width: pageWidth, height: pageHeight } = page.getSize();

          // Calculate scaling to fit the page with margins
          const margin = 20;
          const availableWidth = pageWidth - margin * 2;
          const availableHeight = pageHeight - margin * 2;

          const scaleX = availableWidth / imageDims.width;
          const scaleY = availableHeight / imageDims.height;
          const imageScale = Math.min(scaleX, scaleY);

          // Calculate centered position
          const scaledWidth = imageDims.width * imageScale;
          const scaledHeight = imageDims.height * imageScale;
          const x = (pageWidth - scaledWidth) / 2;
          const y = (pageHeight - scaledHeight) / 2;

          // Draw the final-layout page image
          page.drawImage(embeddedImage, {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
          });

          console.log(
            `Successfully added final-layout page ${pageNumber} to PDF`
          );
        } catch (imageError) {
          console.error(
            `Error processing image for page ${pageNumber}:`,
            imageError
          );
        }
      }

      // Save and download the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name}-final-layout-captured.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      console.log(
        `Successfully captured ${capturedImages.length} final layout pages`
      );
    } catch (error) {
      console.error("Error capturing final layout pages:", error);
    } finally {
      setIsPdfDownloading(false);
    }
  }, [project]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);

        // Always try to fetch project - no authentication required
        const apiResponse = await getPublicProject(unwrappedParams.projectId);

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
      } catch (err) {
        console.error("Error fetching project:", err);

        // Handle specific errors
        if (err instanceof Error) {
          if (
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

    // Always fetch project - no authentication required
    fetchProject();
  }, [unwrappedParams.projectId]);

  // Function to get current page dimensions for OCR service
  const getCurrentPageDimensions = useCallback(
    (pageNumber: number) => {
      if (documentRef.current) {
        // Get original page dimensions - look for the inner page div with data attributes
        const originalPageElement = documentRef.current.querySelector(
          `.original-page-container [data-page-number="${pageNumber}"]`
        ) as HTMLElement;

        // Get translated page dimensions - look for the inner page div with data attributes
        const translatedPageElement = documentRef.current.querySelector(
          `.translated-page-container [data-page-number="${pageNumber}"]`
        ) as HTMLElement;

        // Use original page element for main dimensions (or first available)
        const pageElement = originalPageElement || translatedPageElement;

        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          const pageWidth = parseInt(
            pageElement.getAttribute("data-page-width") || "0"
          );
          const pageHeight = parseInt(
            pageElement.getAttribute("data-page-height") || "0"
          );

          return {
            width: pageWidth || rect.width,
            height: pageHeight || rect.height,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
          };
        }
      }

      // Fallback to document state dimensions
      return {
        width: project?.documentState.pageWidth || 800,
        height: project?.documentState.pageHeight || 1000,
        renderedWidth: project?.documentState.pageWidth || 800,
        renderedHeight: project?.documentState.pageHeight || 1000,
      };
    },
    [project]
  );

  // Expose function globally for OCR service to access
  useEffect(() => {
    if (project) {
      (window as any).getCaptureProjectPageDimensions =
        getCurrentPageDimensions;
    }
  }, [project, getCurrentPageDimensions]);

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

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error || "Project not found"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
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
            Project ID: {project.id} | Pages: {numPages} | Public Project View
          </p>

          {/* Debug: Test page dimensions */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              OCR Service Integration
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              Each page now has proper data attributes for OCR service to find
              correct dimensions.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              OCR service can access page dimensions via:
              window.getCaptureProjectPageDimensions(pageNumber)
            </p>
          </div>

          {/* Individual Page Download Section */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-2">
              Individual Page Downloads
            </h3>
            <p className="text-sm text-green-700 mb-3">
              Download specific pages from each view type. Enter a page number
              and click download.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Original View Download */}
              <div className="p-3 bg-white rounded border">
                <h4 className="text-sm font-medium text-gray-800 mb-2">
                  Original View
                </h4>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    placeholder="Page #"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    id="original-page-input"
                  />
                  <button
                    onClick={() => {
                      const pageInput = document.getElementById(
                        "original-page-input"
                      ) as HTMLInputElement;
                      const pageNum = parseInt(pageInput.value);
                      if (pageNum >= 1 && pageNum <= numPages) {
                        downloadSinglePage("original", pageNum);
                      } else {
                        alert(
                          `Please enter a valid page number between 1 and ${numPages}`
                        );
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Translated View Download */}
              <div className="p-3 bg-white rounded border">
                <h4 className="text-sm font-medium text-gray-800 mb-2">
                  Translated View
                </h4>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    placeholder="Page #"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    id="translated-page-input"
                  />
                  <button
                    onClick={() => {
                      const pageInput = document.getElementById(
                        "translated-page-input"
                      ) as HTMLInputElement;
                      const pageNum = parseInt(pageInput.value);
                      if (pageNum >= 1 && pageNum <= numPages) {
                        downloadSinglePage("translated", pageNum);
                      } else {
                        alert(
                          `Please enter a valid page number between 1 and ${numPages}`
                        );
                      }
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Final Layout View Download */}
              <div className="p-3 bg-white rounded border">
                <h4 className="text-sm font-medium text-gray-800 mb-2">
                  Final Layout View
                </h4>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="1"
                    max={documentState.finalLayoutNumPages || numPages}
                    placeholder="Page #"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    id="final-layout-page-input"
                    disabled={!documentState.finalLayoutUrl}
                  />
                  <button
                    onClick={() => {
                      const pageInput = document.getElementById(
                        "final-layout-page-input"
                      ) as HTMLInputElement;
                      const pageNum = parseInt(pageInput.value);
                      const maxPages =
                        documentState.finalLayoutNumPages || numPages;
                      if (pageNum >= 1 && pageNum <= maxPages) {
                        downloadSinglePage("final-layout", pageNum);
                      } else {
                        alert(
                          `Please enter a valid page number between 1 and ${maxPages}`
                        );
                      }
                    }}
                    disabled={!documentState.finalLayoutUrl}
                    className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Download
                  </button>
                </div>
                {!documentState.finalLayoutUrl && (
                  <p className="text-xs text-gray-500 mt-1">
                    Final layout not available
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-green-600 mt-2">
              Downloads a single PNG image of the specified page from the
              selected view.
            </p>
          </div>

          {/* Final Layout PDF Download Section */}
          {project?.documentState.finalLayoutUrl && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                Final Layout PDF Generation
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                Capture all final layout pages using dom-to-image and generate a
                PDF file.
              </p>

              <button
                onClick={generateFinalLayoutPdf}
                disabled={isPdfDownloading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isPdfDownloading ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isPdfDownloading
                    ? "Generating PDF..."
                    : "Generate Final Layout PDF"}
                </span>
              </button>

              <p className="text-xs text-blue-600 mt-2">
                Downloads: {project.name}-final-layout-captured.pdf
              </p>
            </div>
          )}
        </div>

        <div className="document-wrapper flex justify-center" ref={documentRef}>
          {/* Original and Translated Pages - Paired Side by Side */}
          <div className="space-y-8 mb-12 max-w-6xl">
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
                deletions:
                  elementCollections.translatedDeletionRectangles.filter(
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
                  className="border rounded-lg p-6 bg-white shadow-sm flex flex-col items-center"
                >
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                    Page {pageNum}
                  </h3>
                  <div className="space-y-6 w-full">
                    {/* Original View */}
                    <div className="flex flex-col items-center">
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
                    <div className="flex flex-col items-center">
                      <h4 className="text-lg font-medium text-gray-700 mb-3 text-center">
                        Translated
                      </h4>
                      <PageView
                        pageNum={pageNum}
                        pageWidth={
                          project.documentState.pages?.[pageNum - 1]
                            ?.translatedTemplateWidth || documentState.pageWidth
                        }
                        pageHeight={
                          project.documentState.pages?.[pageNum - 1]
                            ?.translatedTemplateHeight ||
                          documentState.pageHeight
                        }
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

          {/* Final Layout Pages - Now Inside document-wrapper */}
          <div className="blmt-12 max-w-6xl">
            <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2 mb-6">
              Final Layout Pages
            </h2>
            {(() => {
              // Only render if we actually have final layout data
              if (
                !documentState.finalLayoutUrl ||
                !documentState.finalLayoutNumPages ||
                documentState.finalLayoutNumPages <= 0
              ) {
                return (
                  <div className="text-center text-gray-500 py-8">
                    <p>No final layout pages available for this project.</p>
                    <p className="text-sm mt-2">
                      Final Layout URL:{" "}
                      {documentState.finalLayoutUrl
                        ? "✅ Available"
                        : "❌ Not Available"}{" "}
                      | Final Layout Pages:{" "}
                      {documentState.finalLayoutNumPages || 0}
                    </p>
                  </div>
                );
              }

              try {
                const pagesToRender = Array.from(
                  { length: documentState.finalLayoutNumPages },
                  (_, i) => {
                    const pageNum = i + 1;

                    // Skip deleted pages in final layout
                    if (documentState.finalLayoutDeletedPages) {
                      if (
                        Array.isArray(documentState.finalLayoutDeletedPages)
                      ) {
                        if (
                          documentState.finalLayoutDeletedPages.includes(
                            pageNum
                          )
                        ) {
                          return null;
                        }
                      } else if (
                        (
                          documentState.finalLayoutDeletedPages as Set<number>
                        ).has(pageNum)
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
                        className="border rounded-lg p-6 bg-white shadow-sm flex flex-col items-center mb-8"
                      >
                        <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                          Final Layout - Page {pageNum}
                        </h3>
                        <div className="flex flex-col items-center w-full overflow-visible">
                          <PageView
                            pageNum={pageNum}
                            pageWidth={
                              project.documentState.pages?.[pageNum - 1]
                                ?.finalLayoutWidth || documentState.pageWidth
                            }
                            pageHeight={
                              project.documentState.pages?.[pageNum - 1]
                                ?.finalLayoutHeight || documentState.pageHeight
                            }
                            pdfUrl={
                              documentState.finalLayoutUrl || documentState.url
                            }
                            pdfBackgroundColor={
                              documentState.pdfBackgroundColor
                            }
                            elements={pageElements}
                            className="final-view-page-container"
                            title=""
                            showPdfBackground={false}
                            finalLayoutUrl={documentState.finalLayoutUrl}
                          />
                        </div>
                      </div>
                    );
                  }
                ).filter(Boolean);

                return pagesToRender;
              } catch (error) {
                console.error("❌ Error rendering final layout pages:", error);
                return (
                  <div className="text-center text-red-500 py-8">
                    <p>Error rendering final layout pages:</p>
                    <p className="text-sm mt-2">
                      {error instanceof Error ? error.message : String(error)}
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPageView;
