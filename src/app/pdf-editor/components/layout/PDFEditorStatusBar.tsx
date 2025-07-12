import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { StatusBarProps } from "../../types/pdf-editor.types";

export const PDFEditorStatusBar: React.FC<StatusBarProps> = ({
  documentState,
  viewState,
  elementCollections,
  pageState,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  // Calculate element counts for current page
  const getCurrentPageCounts = () => {
    const currentPage = documentState.currentPage;

    if (viewState.currentView === "split") {
      const originalTextBoxes = elementCollections.originalTextBoxes.filter(
        (box) => box.page === currentPage
      ).length;
      const originalShapes = elementCollections.originalShapes.filter(
        (shape) => shape.page === currentPage
      ).length;
      const originalImages = elementCollections.originalImages.filter(
        (image) => image.page === currentPage
      ).length;
      const originalDeletions =
        elementCollections.originalDeletionRectangles.filter(
          (rect) => rect.page === currentPage
        ).length;

      const translatedTextBoxes = elementCollections.translatedTextBoxes.filter(
        (box) => box.page === currentPage
      ).length;
      const translatedShapes = elementCollections.translatedShapes.filter(
        (shape) => shape.page === currentPage
      ).length;
      const translatedImages = elementCollections.translatedImages.filter(
        (image) => image.page === currentPage
      ).length;
      const translatedDeletions =
        elementCollections.translatedDeletionRectangles.filter(
          (rect) => rect.page === currentPage
        ).length;

      return {
        original: {
          textBoxes: originalTextBoxes,
          shapes: originalShapes,
          images: originalImages,
          deletions: originalDeletions,
        },
        translated: {
          textBoxes: translatedTextBoxes,
          shapes: translatedShapes,
          images: translatedImages,
          deletions: translatedDeletions,
        },
      };
    } else {
      const textBoxes =
        viewState.currentView === "original"
          ? elementCollections.originalTextBoxes
          : elementCollections.translatedTextBoxes;
      const shapes =
        viewState.currentView === "original"
          ? elementCollections.originalShapes
          : elementCollections.translatedShapes;
      const images =
        viewState.currentView === "original"
          ? elementCollections.originalImages
          : elementCollections.translatedImages;
      const deletions =
        viewState.currentView === "original"
          ? elementCollections.originalDeletionRectangles
          : elementCollections.translatedDeletionRectangles;

      return {
        textBoxes: textBoxes.filter((box) => box.page === currentPage).length,
        shapes: shapes.filter((shape) => shape.page === currentPage).length,
        images: images.filter((image) => image.page === currentPage).length,
        deletions: deletions.filter((rect) => rect.page === currentPage).length,
      };
    }
  };

  const counts = getCurrentPageCounts();

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          {viewState.currentView === "split" ? (
            <>
              <span className="flex items-center space-x-2">
                <span className="text-blue-600 font-medium">Original:</span>
                <span>{counts.original.textBoxes} text</span>
                <span>{counts.original.shapes} shapes</span>
                <span>{counts.original.images} images</span>
                <span>{counts.original.deletions} deletions</span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="flex items-center space-x-2">
                <span className="text-green-600 font-medium">Translated:</span>
                <span>{counts.translated.textBoxes} text</span>
                <span>{counts.translated.shapes} shapes</span>
                <span>{counts.translated.images} images</span>
                <span>{counts.translated.deletions} deletions</span>
              </span>
            </>
          ) : (
            <>
              <span>Text Boxes: {counts.textBoxes}</span>
              <span>Shapes: {counts.shapes}</span>
              <span>Images: {counts.images}</span>
              <span>Deletion Areas: {counts.deletions}</span>
            </>
          )}

          {/* Current View Indicator */}
          <span className="flex items-center space-x-1">
            <span>View:</span>
            <span className="font-medium text-red-600 capitalize">
              {viewState.currentView === "original"
                ? "Original"
                : viewState.currentView === "translated"
                ? "Translated"
                : "Split Screen"}
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {documentState.url && (
            <span>
              Page {documentState.currentPage} of {documentState.numPages} (
              {documentState.numPages - pageState.deletedPages.size} available)
            </span>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onZoomOut}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Zoom out (Ctrl+-)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>

            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={Math.round(documentState.scale * 100)}
                onChange={(e) => onZoomChange(parseInt(e.target.value) / 100)}
                className="zoom-slider w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                title="Zoom level"
                style={
                  {
                    "--value": `${
                      ((Math.round(documentState.scale * 100) - 10) /
                        (500 - 10)) *
                      100
                    }%`,
                  } as React.CSSProperties
                }
              />
              <button
                onClick={onZoomReset}
                className="text-xs px-2 py-1 hover:bg-gray-100 rounded transition-colors min-w-[40px] text-center"
                title="Reset zoom to 100% (Ctrl+0)"
              >
                {Math.round(documentState.scale * 100)}%
              </button>
            </div>

            <button
              onClick={onZoomIn}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Zoom in (Ctrl++)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
