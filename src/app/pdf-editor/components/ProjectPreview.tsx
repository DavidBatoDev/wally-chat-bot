import React from "react";
import { Document, Page } from "react-pdf";
import { TextField, Shape, Image } from "../types/pdf-editor.types";
import { colorToRgba } from "../utils/colors";
import { isPdfFile } from "../utils/measurements";
import { FileText } from "lucide-react";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProjectPreviewProps {
  projectData: {
    documentState: any;
    elementCollections: {
      originalTextBoxes: TextField[];
      originalShapes: Shape[];
      originalImages: Image[];
      originalDeletionRectangles: any[];
    };
  };
  scale?: number;
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
      background: rect.background ? rect.background : "rgba(255,0,0,0.15)",
      opacity: rect.opacity ?? 0.5,
      border: "none",
      zIndex: 0,
      pointerEvents: "none",
    }}
    title="Deletion Rectangle"
  />
);

const ProjectPreview: React.FC<ProjectPreviewProps> = ({
  projectData,
  scale = 0.2,
}) => {
  const { documentState, elementCollections } = projectData;
  const isOcrRunning = !!documentState?.ocrRunning;

  // Get first page elements only
  const firstPageTextBoxes = elementCollections.originalTextBoxes.filter(
    (tb) => tb.page === 1
  );
  const firstPageShapes = elementCollections.originalShapes.filter(
    (s) => s.page === 1
  );
  const firstPageImages = elementCollections.originalImages.filter(
    (img) => img.page === 1
  );
  const firstPageDeletions =
    elementCollections.originalDeletionRectangles.filter((r) => r.page === 1);

  // Create sorted elements array
  const createSortedElements = () => {
    const allElements: Array<{
      type: "deletion" | "shape" | "image" | "textbox";
      element: any;
      zIndex: number;
    }> = [];

    // Add deletion rectangles with lowest zIndex (rendered first, behind everything)
    firstPageDeletions.forEach((rect) => {
      allElements.push({
        type: "deletion",
        element: rect,
        zIndex: rect.zIndex || 0,
      });
    });

    // Add shapes
    firstPageShapes.forEach((shape) => {
      allElements.push({
        type: "shape",
        element: shape,
        zIndex: (shape as any).zIndex || 2,
      });
    });

    // Add images
    firstPageImages.forEach((image) => {
      allElements.push({
        type: "image",
        element: image,
        zIndex: (image as any).zIndex || 3,
      });
    });

    // Add textboxes with highest zIndex
    firstPageTextBoxes.forEach((textbox) => {
      allElements.push({
        type: "textbox",
        element: textbox,
        zIndex: textbox.zIndex || 4,
      });
    });

    // Sort by zIndex
    return allElements.sort((a, b) => a.zIndex - b.zIndex);
  };

  const sortedElements = createSortedElements();

  // Helper function to render element based on type
  const renderElement = (item: {
    type: string;
    element: any;
    zIndex: number;
  }) => {
    switch (item.type) {
      case "deletion":
        return renderDeletionRectangle(item.element, actualScale);
      case "shape":
        return renderShape(item.element, actualScale);
      case "image":
        return renderImage(item.element, actualScale);
      case "textbox":
        return renderTextBox(item.element, actualScale);
      default:
        return null;
    }
  };

  const isPdf = documentState.url && isPdfFile(documentState.url);

  // Use standard letter size aspect ratio (8.5:11 = 0.773)
  const letterAspectRatio = 8.5 / 11;

  // Max container dimensions for the card
  const maxWidth = 160;
  const maxHeight = 200;

  // Calculate dimensions maintaining letter size aspect ratio
  let previewWidth: number;
  let previewHeight: number;

  if (letterAspectRatio > maxWidth / maxHeight) {
    // Width is the limiting factor
    previewWidth = maxWidth;
    previewHeight = maxWidth / letterAspectRatio;
  } else {
    // Height is the limiting factor
    previewHeight = maxHeight;
    previewWidth = maxHeight * letterAspectRatio;
  }

  // Calculate scale based on the document's actual dimensions
  const originalWidth = documentState.pageWidth || 600;
  const originalHeight = documentState.pageHeight || 800;
  const actualScale = Math.min(
    previewWidth / originalWidth,
    previewHeight / originalHeight
  );

  return (
    <div
      style={{
        position: "relative",
        width: previewWidth,
        height: previewHeight,
        background: documentState.pdfBackgroundColor || "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Document background */}
      {isPdf && documentState.url ? (
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
          <Document file={documentState.url} loading={null} error={null}>
            <Page
              pageNumber={1}
              width={previewWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={null}
              error={null}
            />
          </Document>
        </div>
      ) : documentState.url && !isPdf ? (
        <img
          src={documentState.url}
          alt="Document preview"
          style={{
            width: previewWidth,
            height: previewHeight,
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
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: "12px",
            background: "#f9fafb",
            zIndex: 0,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <FileText size={24} style={{ margin: "0 auto 8px" }} />
            <div>No Preview</div>
          </div>
        </div>
      )}

      {/* Render all elements in correct layering order */}
      {sortedElements.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.element.id || index}`}>
          {renderElement(item)}
        </React.Fragment>
      ))}

      {/* Removed Running OCR overlay per request */}
    </div>
  );
};

export default ProjectPreview;
