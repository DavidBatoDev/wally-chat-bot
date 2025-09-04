import React from "react";
import { StatusBarProps } from "../../types/pdf-editor.types";

export const PDFEditorStatusBar: React.FC<StatusBarProps> = ({
  documentState,
  viewState,
  elementCollections,
  pageState,
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
      } as any;
    } else {
      const textBoxes =
        viewState.currentView === "original"
          ? elementCollections.originalTextBoxes
          : viewState.currentView === "translated"
          ? elementCollections.translatedTextBoxes
          : elementCollections.finalLayoutTextboxes;
      const shapes =
        viewState.currentView === "original"
          ? elementCollections.originalShapes
          : viewState.currentView === "translated"
          ? elementCollections.translatedShapes
          : elementCollections.finalLayoutShapes;
      const images =
        viewState.currentView === "original"
          ? elementCollections.originalImages
          : viewState.currentView === "translated"
          ? elementCollections.translatedImages
          : elementCollections.finalLayoutImages;
      const deletions =
        viewState.currentView === "original"
          ? elementCollections.originalDeletionRectangles
          : elementCollections.translatedDeletionRectangles;

      return {
        textBoxes: textBoxes.filter((box) => box.page === currentPage).length,
        shapes: shapes.filter((shape) => shape.page === currentPage).length,
        images: images.filter((image) => image.page === currentPage).length,
        deletions: deletions.filter((rect) => rect.page === currentPage).length,
      } as any;
    }
  };

  const counts = getCurrentPageCounts();

  // Determine if we're in final layout mode
  const isFinalLayout = viewState.currentView === "final-layout";

  // Get current page and total pages based on view mode
  const currentPage = isFinalLayout
    ? documentState.finalLayoutCurrentPage || 1
    : documentState.currentPage;
  const totalPages = isFinalLayout
    ? documentState.finalLayoutNumPages || 0
    : documentState.numPages || 0;
  const deletedPages = (
    isFinalLayout
      ? documentState.finalLayoutDeletedPages
      : pageState.deletedPages
  ) as Set<number> | undefined;
  const documentUrl = isFinalLayout
    ? documentState.finalLayoutUrl
    : documentState.url;

  const availableCount = Math.max(0, totalPages - (deletedPages?.size || 0));

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          {viewState.currentView === "split" &&
          (counts as any).original &&
          (counts as any).translated ? (
            <>
              <span className="flex items-center space-x-2">
                <span className="text-primary font-medium">Original:</span>
                <span>{(counts as any).original.textBoxes} text</span>
                <span>{(counts as any).original.shapes} shapes</span>
                <span>{(counts as any).original.images} images</span>
                <span>{(counts as any).original.deletions} deletions</span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="flex items-center space-x-2">
                <span className="text-green-600 font-medium">Translated:</span>
                <span>{(counts as any).translated.textBoxes} text</span>
                <span>{(counts as any).translated.shapes} shapes</span>
                <span>{(counts as any).translated.images} images</span>
                <span>{(counts as any).translated.deletions} deletions</span>
              </span>
            </>
          ) : (
            <>
              <span>Text Boxes: {(counts as any).textBoxes}</span>
              <span>Shapes: {(counts as any).shapes}</span>
              <span>Images: {(counts as any).images}</span>
              <span>Deletion Areas: {(counts as any).deletions}</span>
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
                : viewState.currentView === "final-layout"
                ? "Final Layout"
                : "Split Screen"}
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {documentUrl && (
            <span>
              Page {currentPage} of {totalPages} ({availableCount} available)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
