import React from 'react';
import { Document, Page } from 'react-pdf';

interface DocumentViewProps {
  viewType: 'original' | 'translated';
  documentUrl: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  isScaleChanging: boolean;
  isAddTextBoxMode: boolean;
  isTextSpanZooming: boolean;
  isPdfFile: (url: string) => boolean;
  handlers: {
    handleDocumentLoadSuccess: (pdf: any) => void;
    handleDocumentLoadError: (error: any) => void;
    handlePageLoadSuccess: (page: any) => void;
    handlePageLoadError: (error: any) => void;
    handleImageLoadSuccess: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    handleImageLoadError: () => void;
  };
  actions: {
    capturePdfBackgroundColor: () => void;
  };
  setDocumentState: React.Dispatch<React.SetStateAction<any>>;
  header?: React.ReactNode;
  children?: React.ReactNode;
}

const DocumentView: React.FC<DocumentViewProps> = ({
  viewType,
  documentUrl,
  currentPage,
  pageWidth,
  pageHeight,
  scale,
  isScaleChanging,
  isAddTextBoxMode,
  isTextSpanZooming,
  isPdfFile,
  handlers,
  actions,
  setDocumentState,
  header,
  children,
}) => {
  const renderDocumentContent = () => {
    if (isPdfFile(documentUrl)) {
      return (
        <div className="relative w-full h-full">
          <Document
            file={documentUrl}
            onLoadSuccess={handlers.handleDocumentLoadSuccess}
            onLoadError={handlers.handleDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              onLoadSuccess={handlers.handlePageLoadSuccess}
              onLoadError={handlers.handlePageLoadError}
              onRenderSuccess={() => {
                setDocumentState((prev: any) => ({
                  ...prev,
                  isPageLoading: false,
                }));
                actions.capturePdfBackgroundColor();
              }}
              onRenderError={handlers.handlePageLoadError}
              renderTextLayer={isAddTextBoxMode && !isTextSpanZooming}
              renderAnnotationLayer={false}
              loading={
                viewType === 'original' ? (
                  <div
                    className="flex items-center justify-center bg-gray-50"
                    style={{
                      width: pageWidth * scale,
                      height: pageHeight * scale,
                    }}
                  >
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div className="text-gray-500 text-sm">
                        Rendering page...
                      </div>
                    </div>
                  </div>
                ) : null
              }
              width={pageWidth * scale}
            />
          </Document>

          {/* Loading overlay during scale changes */}
          {isScaleChanging && viewType === 'original' && (
            <div
              className="absolute inset-0 bg-gray-50 bg-opacity-50 flex items-center justify-center z-50"
              style={{
                width: pageWidth * scale,
                height: pageHeight * scale,
              }}
            >
              <div className="bg-white rounded-lg shadow-md p-3 flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">
                  Adjusting zoom...
                </span>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <img
          src={documentUrl}
          alt={`${viewType === 'original' ? 'Original' : 'Translated'} Document`}
          onLoad={handlers.handleImageLoadSuccess}
          onError={handlers.handleImageLoadError}
          style={{
            width: pageWidth * scale,
            height: pageHeight * scale,
            maxWidth: "none",
            display: "block",
          }}
          className="select-none"
        />
      );
    }
  };

  return (
    <div
      className="relative bg-white border border-gray-200 shadow-sm"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
      }}
    >
      {/* Header */}
      {header}

      {/* Document Content */}
      {viewType === 'original' ? (
        renderDocumentContent()
      ) : (
        <div className="w-full h-full bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export default DocumentView;
