import React from "react";
import { ZoomIn, ZoomOut, Undo2, Redo2 } from "lucide-react";
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  // Removed element counts display per request

  // Determine if we're in final layout mode
  const isFinalLayout = viewState.currentView === "final-layout";

  // Get current page and total pages based on view mode
  const currentPage = isFinalLayout
    ? documentState.finalLayoutCurrentPage
    : documentState.currentPage;
  const totalPages =
    (isFinalLayout
      ? documentState.finalLayoutNumPages
      : documentState.numPages) ?? 0;
  const deletedPages = isFinalLayout
    ? documentState.finalLayoutDeletedPages
    : pageState.deletedPages;
  const documentUrl = isFinalLayout
    ? documentState.finalLayoutUrl
    : documentState.url;

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
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
          {/* Undo/Redo Buttons moved from header */}
          <button
            onClick={onUndo}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
          >
            <Undo2 className="w-3 h-3" />
          </button>
          <button
            onClick={onRedo}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            disabled={!canRedo}
          >
            <Redo2 className="w-3 h-3" />
          </button>

          {documentUrl && (
            <span>
              Page {currentPage} of {totalPages} (
              {totalPages - (deletedPages?.size || 0)} available)
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
                min="25"
                max="500"
                step="25"
                value={Math.round(documentState.scale * 100)}
                onChange={(e) =>
                  onZoomChange(parseInt(e.target.value, 10) / 100)
                }
                className="zoom-slider w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                title="Zoom level"
                style={
                  {
                    "--value": `${
                      ((Math.round(documentState.scale * 100) - 25) /
                        (500 - 25)) *
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
