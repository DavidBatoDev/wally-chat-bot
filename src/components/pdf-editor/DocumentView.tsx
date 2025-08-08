import React, { useState, useMemo, useCallback } from "react";
import { Document, Page } from "react-pdf";

interface DocumentViewProps {
  viewType: "original" | "translated" | "final-layout";
  documentUrl: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  pdfRenderScale: number; // Add PDF render scale
  isScaleChanging: boolean;
  isAddTextBoxMode: boolean;
  isTextSpanZooming: boolean;
  isPdfFile: (url: string) => boolean;
  handlers: {
    handleDocumentLoadSuccess: (pdf: any) => void;
    handleDocumentLoadError: (error: any) => void;
    handlePageLoadSuccess: (page: any) => void;
    handlePageLoadError: (error: any) => void;
    handleImageLoadSuccess: (
      event: React.SyntheticEvent<HTMLImageElement>
    ) => void;
    handleImageLoadError: () => void;
  };
  actions: {
    capturePdfBackgroundColor: () => void;
    updatePdfRenderScale: (scale: number) => void; // Add PDF render scale action
  };
  setDocumentState: React.Dispatch<React.SetStateAction<any>>;
  header?: React.ReactNode;
  children?: React.ReactNode;
  // Template dimension update function for translated view
  onTemplateLoadSuccess?: (
    pageNumber: number,
    width: number,
    height: number
  ) => void;
}

const DocumentView: React.FC<DocumentViewProps> = ({
  viewType,
  documentUrl,
  currentPage,
  pageWidth,
  pageHeight,
  scale,
  pdfRenderScale,
  isScaleChanging,
  isAddTextBoxMode,
  isTextSpanZooming,
  isPdfFile,
  handlers,
  actions,
  setDocumentState,
  header,
  children,
  onTemplateLoadSuccess,
}) => {
  // Determine if we need to re-render PDF at higher resolution
  const shouldUpdatePdfRenderScale = useMemo(() => {
    // Only update render scale if current scale significantly exceeds our render scale
    // This prevents constant re-rendering while maintaining quality
    return scale > pdfRenderScale * 0.9; // Re-render if zoom exceeds 90% of render scale
  }, [scale, pdfRenderScale]);
  
  // Update PDF render scale when necessary (this will cause a re-render, but only when needed)
  React.useEffect(() => {
    if (shouldUpdatePdfRenderScale) {
      const newRenderScale = Math.min(5.0, Math.max(2.0, Math.ceil(scale * 1.2))); // 20% buffer
      if (newRenderScale !== pdfRenderScale) {
        actions.updatePdfRenderScale(newRenderScale);
      }
    }
  }, [shouldUpdatePdfRenderScale, scale, pdfRenderScale, actions]);
  const renderDocumentContent = () => {
    // Use the state-managed PDF render scale for high quality rendering
    // Visual scale adjusts the CSS transform to match the desired zoom level
    const baseScale = pdfRenderScale;
    const visualScale = scale / baseScale;
    
    if (isPdfFile(documentUrl)) {
      return (
        <div className="relative w-full h-full">
          <Document
            key={`${documentUrl}-${pdfRenderScale}`} // Force re-render when render scale changes
            file={documentUrl}
            onLoadSuccess={
              // Only the original document should trigger main load success
              viewType === "original"
                ? handlers.handleDocumentLoadSuccess
                : () => {}
            }
            onLoadError={
              // Avoid mutating main doc error state from final-layout/translated loads
              viewType === "original"
                ? handlers.handleDocumentLoadError
                : () => {}
            }
            loading={null}
          >
            <div
              style={{
                transform: `scale(${visualScale})`,
                transformOrigin: 'top left',
                width: pageWidth * baseScale,
                height: pageHeight * baseScale,
                transition: isScaleChanging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <Page
                pageNumber={currentPage}
                onLoadSuccess={(page) => {
                  if (viewType === "original") {
                    handlers.handlePageLoadSuccess(page);
                  } else if (viewType === "translated" && onTemplateLoadSuccess) {
                    // For translated view, update template dimensions
                    const viewport = page.getViewport({ scale: 1 });
                    onTemplateLoadSuccess(
                      currentPage,
                      viewport.width,
                      viewport.height
                    );
                  } else if (viewType === "final-layout") {
                    // For final-layout view, handle page load success (page size only)
                    handlers.handlePageLoadSuccess(page);
                  }
                }}
                onLoadError={
                  viewType === "original" || viewType === "final-layout"
                    ? handlers.handlePageLoadError
                    : () => {}
                }
                onRenderSuccess={() => {
                  if (viewType === "original" || viewType === "final-layout") {
                    setDocumentState((prev: any) => ({
                      ...prev,
                      isPageLoading: false,
                    }));
                    actions.capturePdfBackgroundColor();
                  }
                }}
                onRenderError={
                  viewType === "original" || viewType === "final-layout"
                    ? handlers.handlePageLoadError
                    : () => {}
                }
                renderTextLayer={isAddTextBoxMode && !isTextSpanZooming}
                renderAnnotationLayer={false}
                loading={
                  <div
                    className="flex items-center justify-center bg-gray-50"
                    style={{
                      width: pageWidth * baseScale,
                      height: pageHeight * baseScale,
                    }}
                  >
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div className="text-gray-500 text-sm">
                        Rendering page...
                      </div>
                    </div>
                  </div>
                }
                width={pageWidth * baseScale}
              />
            </div>
          </Document>

          {/* Loading overlay during scale changes */}
          {isScaleChanging && (
            <div
              className="absolute inset-0 bg-gray-50 bg-opacity-50 flex items-center justify-center z-50"
              style={{
                width: pageWidth * visualScale,
                height: pageHeight * visualScale,
              }}
            >
              <div className="bg-white rounded-lg shadow-md p-3 flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Adjusting zoom...</span>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: pageWidth,
            height: pageHeight,
            transition: isScaleChanging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <img
            src={documentUrl}
            alt={`${
              viewType === "original" ? "Original" : "Translated"
            } Document`}
            onLoad={handlers.handleImageLoadSuccess}
            onError={handlers.handleImageLoadError}
            style={{
              width: pageWidth,
              height: pageHeight,
              maxWidth: "none",
              display: "block",
            }}
            className="select-none"
          />
        </div>
      );
    }
  };

  return (
    <div
      className="relative bg-white border border-gray-200 shadow-sm"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
        overflow: 'hidden', // Prevent overflow from the transform
      }}
    >
      {/* Header */}
      {header}

      {/* Document Content */}
      {viewType === "original" ? (
        renderDocumentContent()
      ) : viewType === "final-layout" ? (
        <div className="w-full h-full bg-white">
          {/* For final-layout, render document content and children (interactive elements) */}
          {documentUrl && documentUrl !== "" ? (
            <>
              {renderDocumentContent()}
              {children}
            </>
          ) : (
            children
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-white">
          {/* Render template document in translated view if available, otherwise show children (blank view) */}
          {documentUrl && documentUrl !== "" ? (
            renderDocumentContent()
          ) : (
            <div></div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentView;
