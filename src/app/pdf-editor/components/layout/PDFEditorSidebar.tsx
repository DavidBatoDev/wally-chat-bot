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
  MessageSquare,
  Settings,
  Share,
  FileText,
  Zap,
} from "lucide-react";
import { SidebarProps } from "../../types/pdf-editor.types";
import { isPdfFile } from "../../utils/measurements";
import { ChatbotSidebar } from "../ChatbotSidebar";
import { SidebarPagePreview } from "./SidebarPagePreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  documentRef,
  sourceLanguage,
  desiredLanguage,
  onPageTypeChange,
  onBirthCertModalOpen,
}) => {
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

          const pageData = documentState.pages.find(
            (p) => p.pageNumber === pageNum
          );
          const currentPageType = pageData?.pageType || "dynamic_content";

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
                  ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-25"
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
                  className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-600 z-10 shadow-md"
                  title={`Delete page ${pageNum}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Page Thumbnail */}
              <div className="relative mb-2">
                <SidebarPagePreview
                  pageNum={pageNum}
                  pageWidth={documentState.pageWidth}
                  pageHeight={documentState.pageHeight}
                  originalTextBoxes={elementCollections.originalTextBoxes}
                  translatedTextBoxes={elementCollections.translatedTextBoxes}
                  originalShapes={elementCollections.originalShapes}
                  translatedShapes={elementCollections.translatedShapes}
                  originalImages={elementCollections.originalImages}
                  translatedImages={elementCollections.translatedImages}
                  pdfBackgroundColor={documentState.pdfBackgroundColor}
                  scale={0.5}
                  pdfUrl={documentState.url}
                  currentWorkflowStep={viewState.currentWorkflowStep}
                  originalDeletionRectangles={
                    elementCollections.originalDeletionRectangles
                  }
                  translatedDeletionRectangles={
                    elementCollections.translatedDeletionRectangles
                  }
                />
                {/* Page number overlay */}
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                  {pageNum}
                </div>
                {/* Current page indicator */}
                {documentState.currentPage === pageNum && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded" />
                )}
              </div>

              {/* Page Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Page {pageNum}</span>
                  {totalElements > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {totalElements} element{totalElements !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Page Type Selector */}
                <div className="flex items-center space-x-2">
                  {currentPageType === "birth_cert" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBirthCertModalOpen?.();
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Configure Birth Certificate Template"
                    >
                      <Settings className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                  <Select
                    value={currentPageType}
                    onValueChange={(value) => {
                      if (onPageTypeChange) {
                        onPageTypeChange(
                          pageNum,
                          value as
                            | "social_media"
                            | "birth_cert"
                            | "dynamic_content"
                        );
                      }
                    }}
                    onOpenChange={(open) => {
                      if (open) {
                        // Prevent page selection when opening dropdown
                        event?.stopPropagation();
                      }
                    }}
                  >
                    <SelectTrigger
                      className={`h-7 text-xs ${
                        currentPageType === "social_media"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : currentPageType === "birth_cert"
                          ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                          : "bg-gray-100 text-gray-800 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center space-x-1">
                        {currentPageType === "social_media" ? (
                          <Share className="w-3 h-3" />
                        ) : currentPageType === "birth_cert" ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        <span>
                          {currentPageType === "social_media"
                            ? "Social Media"
                            : currentPageType === "birth_cert"
                            ? "Birth Certificate"
                            : "Dynamic Content"}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="social_media">
                        <div className="flex items-center space-x-2">
                          <Share className="w-3 h-3" />
                          <span>Social Media</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="birth_cert">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3" />
                          <span>Birth Certificate</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dynamic_content">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-3 h-3" />
                          <span>Dynamic Content</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
          <button
            onClick={() => onTabChange("chat")}
            className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">
                  Chat with Wally
                </div>
                <div className="text-xs text-gray-500">
                  Translation specialist assistant
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`bg-white border-r border-blue-100 overflow-y-auto shadow-sm transition-all duration-500 ease-in-out flex-shrink-0`}
      style={{
        width: viewState.isSidebarCollapsed
          ? "0px"
          : viewState.activeSidebarTab === "chat"
          ? "25rem"
          : "20rem",
        minWidth: viewState.isSidebarCollapsed
          ? "0px"
          : viewState.activeSidebarTab === "chat"
          ? "25rem"
          : "20rem",
        opacity: viewState.isSidebarCollapsed ? 0 : 1,
        padding: viewState.isSidebarCollapsed ? "0px" : "1rem",
        pointerEvents: viewState.isSidebarCollapsed ? "none" : "auto",
        zIndex: 20,
      }}
    >
      <div
        className={`flex flex-col h-full transition-opacity duration-300 ${
          viewState.isSidebarCollapsed ? "opacity-0" : "opacity-100"
        }`}
        style={{ display: viewState.isSidebarCollapsed ? "none" : "flex" }}
      >
        {/* Tab Navigation */}
        <div className="flex border-b border-blue-100 mb-4">
          <button
            onClick={() => onTabChange("tools")}
            className={`${
              documentState.url ? "flex-1" : "w-full"
            } px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
              viewState.activeSidebarTab === "tools"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-900 hover:text-blue-600 hover:bg-blue-50"
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
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-900 hover:text-blue-600 hover:bg-blue-50"
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
                <h3 className="text-lg font-semibold mb-3 text-gray-900">
                  Pages
                </h3>
                {renderPagePreview()}
              </div>

              {/* Upload Buttons at Bottom */}
              <div className="border-t border-blue-100 pt-4 mt-4 space-y-2">
                <Button
                  onClick={onFileUpload}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 shadow-md transition-all duration-200 hover:shadow-lg"
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
                    className="w-full border-blue-200 text-gray-900 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upload More Document/Image
                  </Button>
                )}
              </div>
            </div>
          ) : viewState.activeSidebarTab === "chat" ? (
            <ChatbotSidebar
              onBack={() => onTabChange("tools")}
              documentRef={documentRef}
              sourceLanguage={sourceLanguage}
              desiredLanguage={desiredLanguage}
              documentState={documentState}
            />
          ) : (
            renderToolsTab()
          )}
        </div>
      </div>
    </div>
  );
};
