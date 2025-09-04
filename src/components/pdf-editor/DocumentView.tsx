import React, { useState, useMemo, useCallback } from "react";
import { Document, Page } from "react-pdf";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewProps {
  viewType: "original" | "translated" | "final-layout";
  documentUrl: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  pdfRenderScale: number; // Add PDF render 1
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
  const renderDocumentContent = () => {
    const isTranslatedView = viewType === "translated";
    // For translated view, render once at highest needed resolution (max zoom * device pixel ratio)
    const deviceRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const maxUiZoom = 5.0; // Editor's max zoom
    const backingScale = isTranslatedView
      ? Math.max(pdfRenderScale, maxUiZoom) * deviceRatio
      : 1;
    const targetPdfWidth = isTranslatedView
      ? pageWidth * backingScale
      : pageWidth;
    const targetPdfHeight = isTranslatedView
      ? pageHeight * backingScale
      : pageHeight;
    const effectiveCssScale = isTranslatedView ? 1 / backingScale : 1;
    if (isPdfFile(documentUrl)) {
      return (
        <div
          className="pdf-container relative"
          style={{
            width: pageWidth,
            height: pageHeight,
            overflow: "hidden",
          }}
        >
          <div
            className="pdf-content"
            style={{
              transform: `scale(${effectiveCssScale})`,
              transformOrigin: "top left",
              width: targetPdfWidth,
              height: targetPdfHeight,
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <Document
              key={documentUrl}
              file={documentUrl}
              onLoadSuccess={
                viewType === "original"
                  ? handlers.handleDocumentLoadSuccess
                  : () => {}
              }
              onLoadError={
                viewType === "original"
                  ? handlers.handleDocumentLoadError
                  : () => {}
              }
              loading={null}
            >
              <Page
                pageNumber={viewType === "translated" ? 1 : currentPage}
                scale={1.0} // Render at base scale; width controls render resolution
                onLoadSuccess={(page) => {
                  if (viewType === "original") {
                    handlers.handlePageLoadSuccess(page);
                  } else if (
                    viewType === "translated" &&
                    onTemplateLoadSuccess
                  ) {
                    const viewport = page.getViewport({ scale: 1 });
                    onTemplateLoadSuccess(
                      currentPage,
                      viewport.width,
                      viewport.height
                    );
                  } else if (viewType === "final-layout") {
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
                      width: targetPdfWidth,
                      height: targetPdfHeight,
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
                width={targetPdfWidth}
              />
            </Document>
          </div>
        </div>
      );
    } else {
      return (
        <div
          style={{
            width: pageWidth,
            height: pageHeight,
            overflow: "hidden",
            position: "relative",
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
        width: pageWidth,
        height: pageHeight,
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
