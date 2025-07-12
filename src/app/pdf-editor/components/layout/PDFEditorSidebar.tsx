import React from "react";
import { Document, Page } from "react-pdf";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Plus,
  X,
  Type,
  Square,
  Trash2,
  Image as ImageIcon,
  Files,
  Wrench,
  FileSearch,
  MousePointer,
  Scan,
  MessageSquare,
  FileText,
  Globe,
  Languages,
} from "lucide-react";
import { SidebarProps } from "../../types/pdf-editor.types";
import { isPdfFile } from "../../utils/measurements";

export const PDFEditorSidebar: React.FC<SidebarProps> = ({
  viewState,
  documentState,
  pageState,
  elementCollections,
  onPageChange,
  onPageDelete,
  onFileUpload,
  onAppendDocument,
  onSidebarToggle,
  onTabChange,
}) => {
  if (viewState.isSidebarCollapsed) {
    return null;
  }

  const renderPagePreview = () => {
    if (!documentState.url) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <div className="text-gray-400 mb-2">No document loaded</div>
          <div className="text-sm text-gray-500">
            Upload a document to get started
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {Array.from({ length: documentState.numPages }, (_, index) => {
          const pageNum = index + 1;

          // Skip deleted pages
          if (pageState.deletedPages.has(pageNum)) {
            return null;
          }

          const pageTextBoxes = [
            ...elementCollections.originalTextBoxes,
            ...elementCollections.translatedTextBoxes,
          ].filter((box) => box.page === pageNum);

          const pageShapes = [
            ...elementCollections.originalShapes,
            ...elementCollections.translatedShapes,
          ].filter((shape) => shape.page === pageNum);

          const pageDeletions = [
            ...elementCollections.originalDeletionRectangles,
            ...elementCollections.translatedDeletionRectangles,
          ].filter((rect) => rect.page === pageNum);

          const pageImages = [
            ...elementCollections.originalImages,
            ...elementCollections.translatedImages,
          ].filter((image) => image.page === pageNum);

          const totalElements =
            pageTextBoxes.length +
            pageShapes.length +
            pageDeletions.length +
            pageImages.length;

          return (
            <div
              key={pageNum}
              className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md group relative ${
                documentState.currentPage === pageNum
                  ? "border-red-500 bg-red-50 shadow-sm ring-1 ring-red-200"
                  : "border-gray-200 hover:border-red-300 hover:bg-red-25"
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              {/* Delete Button */}
              {documentState.numPages - pageState.deletedPages.size > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPageDelete(pageNum);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 z-10 shadow-md"
                  title={`Delete page ${pageNum}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Page Thumbnail */}
              <div className="relative mb-2">
                <div
                  className="w-full bg-white flex items-center justify-center relative overflow-hidden shadow-sm"
                  style={{
                    aspectRatio: "8.5/11",
                    height: "120px",
                  }}
                >
                  {isPdfFile(documentState.url) ? (
                    <div className="w-full h-full bg-white relative">
                      <Document
                        file={documentState.url}
                        loading={null}
                        error={null}
                      >
                        <Page
                          pageNumber={pageNum}
                          width={200}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={null}
                          error={null}
                        />
                      </Document>
                    </div>
                  ) : (
                    <img
                      src={documentState.url}
                      alt={`Page ${pageNum}`}
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Page number overlay */}
                  <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                    {pageNum}
                  </div>

                  {/* Current page indicator */}
                  {documentState.currentPage === pageNum && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-10 rounded" />
                  )}
                </div>
              </div>

              {/* Page Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Page {pageNum}</span>
                  {totalElements > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {totalElements} element{totalElements !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {totalElements > 0 && (
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    {pageTextBoxes.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <Type className="w-3 h-3" />
                        <span>{pageTextBoxes.length}</span>
                      </span>
                    )}
                    {pageShapes.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <Square className="w-3 h-3" />
                        <span>{pageShapes.length}</span>
                      </span>
                    )}
                    {pageDeletions.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <Trash2 className="w-3 h-3" />
                        <span>{pageDeletions.length}</span>
                      </span>
                    )}
                    {pageImages.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>{pageImages.length}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderToolsTab = () => (
    <div className="space-y-6">
      {/* Tools Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Wrench className="w-5 h-5" />
          <span>Tools</span>
        </h3>
        <div className="space-y-3">
          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <FileSearch className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Document Extraction
                </div>
                <div className="text-xs text-gray-500">
                  Extract data from documents
                </div>
              </div>
            </div>
          </button>

          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <MousePointer className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Select & Translate Field
                </div>
                <div className="text-xs text-gray-500">
                  Select and translate specific fields
                </div>
              </div>
            </div>
          </button>

          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <Scan className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Scan & OCR
                </div>
                <div className="text-xs text-gray-500">
                  Optical character recognition
                </div>
              </div>
            </div>
          </button>

          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <MessageSquare className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Chat with Wally AI Assistant
                </div>
                <div className="text-xs text-gray-500">
                  Get AI-powered assistance
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Translation Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Languages className="w-5 h-5" />
          <span>Translation</span>
        </h3>
        <div className="space-y-3">
          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Translate Birth Certificate
                </div>
                <div className="text-xs text-gray-500">
                  Specialized birth certificate translation
                </div>
              </div>
            </div>
          </button>

          <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                <Globe className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Translate Dynamic Content
                </div>
                <div className="text-xs text-gray-500">
                  Real-time content translation
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white border-r border-red-100 p-4 overflow-y-auto transition-all duration-300 shadow-sm w-80">
      <div className="flex flex-col h-full">
        {/* Tab Navigation */}
        <div className="flex border-b border-red-100 mb-4">
          <button
            onClick={() => onTabChange("tools")}
            className={`${
              documentState.url ? "flex-1" : "w-full"
            } px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
              viewState.activeSidebarTab === "tools"
                ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                : "text-gray-500 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Wrench className="w-4 h-4" />
              <span>Tools</span>
            </div>
          </button>
          {documentState.url && (
            <button
              onClick={() => onTabChange("pages")}
              className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
                viewState.activeSidebarTab === "pages"
                  ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                  : "text-gray-500 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Files className="w-4 h-4" />
                <span>Pages</span>
              </div>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {viewState.activeSidebarTab === "pages" ? (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-3">Pages</h3>
                {renderPagePreview()}
              </div>

              {/* Upload Buttons at Bottom */}
              <div className="border-t border-red-100 pt-4 mt-4 space-y-2">
                <Button
                  onClick={onFileUpload}
                  className="w-full bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {documentState.url
                    ? "Upload New Document"
                    : "Upload Document"}
                </Button>

                {documentState.url && (
                  <Button
                    onClick={onAppendDocument}
                    variant="outline"
                    className="w-full border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upload More Document/Image
                  </Button>
                )}
              </div>
            </div>
          ) : (
            renderToolsTab()
          )}
        </div>
      </div>
    </div>
  );
};
