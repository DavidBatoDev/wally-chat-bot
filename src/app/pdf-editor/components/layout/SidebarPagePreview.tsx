import React from "react";
import { Document, Page } from "react-pdf";
import { TextField, Shape, Image } from "../../types/pdf-editor.types";
import { colorToRgba } from "../../utils/colors";
import { isPdfFile } from "../../utils/measurements";

// Configure PDF.js worker
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SidebarPagePreviewProps {
  pageNum: number;
  pageWidth: number;
  pageHeight: number;
  originalTextBoxes: TextField[];
  translatedTextBoxes: TextField[];
  originalShapes: Shape[];
  translatedShapes: Shape[];
  originalImages: Image[];
  translatedImages: Image[];
  pdfBackgroundColor: string;
  scale?: number; // e.g. 0.15 for sidebar
  pdfUrl?: string; // original document URL
  translatedPdfUrl?: string; // translated document URL (template)
  currentWorkflowStep?: string; // new prop
  originalDeletionRectangles?: any[]; // new
  translatedDeletionRectangles?: any[]; // new
  // Template dimensions for translated view
  translatedTemplateWidth?: number;
  translatedTemplateHeight?: number;
}

const renderTextBox = (tb: TextField, scale: number) => (
  <div
    key={tb.id}
    style={{
      position: "absolute",
      left: tb.x * scale,
      top: tb.y * scale,
      width: tb.width * scale,
      height: tb.height * scale,
      fontSize: (tb.fontSize || 12) * scale,
      fontFamily: tb.fontFamily || "Arial",
      fontWeight: tb.bold ? "bold" : "normal",
      fontStyle: tb.italic ? "italic" : "normal",
      color: tb.color || "#000",
      background:
        tb.backgroundColor && tb.backgroundColor !== "transparent"
          ? colorToRgba(tb.backgroundColor, tb.backgroundOpacity ?? 1)
          : "transparent",
      border: tb.borderWidth
        ? `${tb.borderWidth * scale}px solid ${tb.borderColor || "#000"}`
        : undefined,
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

const renderShape = (shape: Shape, scale: number) => {
  if (shape.type === "line") {
    // Render as SVG line
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
  // Rectangle or circle
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

const renderImage = (img: Image, scale: number) => (
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

const renderDeletionRectangle = (rect: any, scale: number) => (
  <div
    key={rect.id}
    style={{
      position: "absolute",
      left: rect.x * scale,
      top: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      background: rect.background ? rect.background : "rgba(255,0,0,0.15)", // fallback to light red
      opacity: rect.opacity ?? 0.5,
      border: "none",
      zIndex: 0,
      pointerEvents: "none",
    }}
    title="Deletion Rectangle"
  />
);

const SidebarPagePreviewComponent: React.FC<SidebarPagePreviewProps> = ({
  pageNum,
  pageWidth,
  pageHeight,
  originalTextBoxes,
  translatedTextBoxes,
  originalShapes,
  translatedShapes,
  originalImages,
  translatedImages,
  pdfBackgroundColor,
  scale = 0.15,
  pdfUrl,
  translatedPdfUrl,
  currentWorkflowStep,
  originalDeletionRectangles = [],
  translatedDeletionRectangles = [],
  translatedTemplateWidth,
  translatedTemplateHeight,
}) => {
  // Only render elements for this page
  const origTextBoxes = originalTextBoxes.filter((tb) => tb.page === pageNum);
  const transTextBoxes = translatedTextBoxes.filter(
    (tb) => tb.page === pageNum
  );
  const origShapes = originalShapes.filter((s) => s.page === pageNum);
  const transShapes = translatedShapes.filter((s) => s.page === pageNum);
  const origImages = originalImages.filter((img) => img.page === pageNum);
  const transImages = translatedImages.filter((img) => img.page === pageNum);
  const origDeletions = originalDeletionRectangles.filter(
    (r) => r.page === pageNum
  );
  const transDeletions = translatedDeletionRectangles.filter(
    (r) => r.page === pageNum
  );

  // Use isPdfFile to check for PDF
  const isPdf = pdfUrl && isPdfFile(pdfUrl);

  // Always show only original view
  const showOnlyOriginal = true;

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

    // Add deletion rectangles with lowest zIndex (rendered first, behind everything)
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

    // Add textboxes with highest zIndex (rendered last)
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

  // Create sorted elements for original view
  const originalSortedElements = createSortedElements({
    deletions: origDeletions,
    shapes: origShapes,
    images: origImages,
    textboxes: origTextBoxes,
  });

  // Create sorted elements for translated view
  const translatedSortedElements = createSortedElements({
    deletions: transDeletions,
    shapes: transShapes,
    images: transImages,
    textboxes: transTextBoxes,
  });

  // Helper function to render element based on type
  const renderElement = (
    item: {
      type: string;
      element: any;
      zIndex: number;
    },
    scale: number,
    effectivePageWidth?: number,
    effectivePageHeight?: number
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

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {/* Original view - always shown */}
      <div
        style={{
          position: "relative",
          width: pageWidth * scale,
          height: pageHeight * scale,
          background: pdfBackgroundColor,
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {/* PDF or image background */}
        {isPdf ? (
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
                width={pageWidth * scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
                error={null}
              />
            </Document>
          </div>
        ) : pdfUrl ? (
          <img
            src={pdfUrl}
            alt="Document preview"
            style={{
              width: pageWidth * scale,
              height: pageHeight * scale,
              maxWidth: "none",
              display: "block",
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 0,
            }}
            draggable={false}
          />
        ) : null}
        {/* Render all elements in correct layering order */}
        {originalSortedElements.map((item) => renderElement(item, scale))}
      </div>
    </div>
  );
};

// Custom comparison function for memoization
const arePropsEqual = (
  prevProps: SidebarPagePreviewProps,
  nextProps: SidebarPagePreviewProps
) => {
  // Always re-render if page number, dimensions, scale, or workflow step changes
  if (
    prevProps.pageNum !== nextProps.pageNum ||
    prevProps.pageWidth !== nextProps.pageWidth ||
    prevProps.pageHeight !== nextProps.pageHeight ||
    prevProps.scale !== nextProps.scale ||
    prevProps.pdfUrl !== nextProps.pdfUrl ||
    prevProps.pdfBackgroundColor !== nextProps.pdfBackgroundColor ||
    prevProps.currentWorkflowStep !== nextProps.currentWorkflowStep
  ) {
    return false;
  }

  // Check if any elements for this page have changed
  const prevOrigTextBoxes = prevProps.originalTextBoxes.filter(
    (tb) => tb.page === prevProps.pageNum
  );
  const nextOrigTextBoxes = nextProps.originalTextBoxes.filter(
    (tb) => tb.page === nextProps.pageNum
  );
  const prevTransTextBoxes = prevProps.translatedTextBoxes.filter(
    (tb) => tb.page === prevProps.pageNum
  );
  const nextTransTextBoxes = nextProps.translatedTextBoxes.filter(
    (tb) => tb.page === nextProps.pageNum
  );
  const prevOrigShapes = prevProps.originalShapes.filter(
    (s) => s.page === prevProps.pageNum
  );
  const nextOrigShapes = nextProps.originalShapes.filter(
    (s) => s.page === nextProps.pageNum
  );
  const prevTransShapes = prevProps.translatedShapes.filter(
    (s) => s.page === prevProps.pageNum
  );
  const nextTransShapes = nextProps.translatedShapes.filter(
    (s) => s.page === nextProps.pageNum
  );
  const prevOrigImages = prevProps.originalImages.filter(
    (img) => img.page === prevProps.pageNum
  );
  const nextOrigImages = nextProps.originalImages.filter(
    (img) => img.page === nextProps.pageNum
  );
  const prevTransImages = prevProps.translatedImages.filter(
    (img) => img.page === prevProps.pageNum
  );
  const nextTransImages = nextProps.translatedImages.filter(
    (img) => img.page === nextProps.pageNum
  );

  // Check if element counts have changed (additions/removals)
  if (
    prevOrigTextBoxes.length !== nextOrigTextBoxes.length ||
    prevTransTextBoxes.length !== nextTransTextBoxes.length ||
    prevOrigShapes.length !== nextOrigShapes.length ||
    prevTransShapes.length !== nextTransShapes.length ||
    prevOrigImages.length !== nextOrigImages.length ||
    prevTransImages.length !== nextTransImages.length
  ) {
    return false;
  }

  // For now, always re-render if there are elements on this page
  // This ensures updates are reflected while still preventing unnecessary re-renders
  const hasElements =
    nextOrigTextBoxes.length > 0 ||
    nextTransTextBoxes.length > 0 ||
    nextOrigShapes.length > 0 ||
    nextTransShapes.length > 0 ||
    nextOrigImages.length > 0 ||
    nextTransImages.length > 0;

  return !hasElements;
};

export const SidebarPagePreview = React.memo(
  SidebarPagePreviewComponent,
  arePropsEqual
);
