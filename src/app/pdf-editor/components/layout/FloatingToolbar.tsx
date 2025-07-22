import React, { useState, useRef, useEffect } from "react";
import {
  MousePointer,
  Type,
  Square,
  Circle,
  Eraser,
  Image as ImageIcon,
  FileText,
  Globe,
  SplitSquareHorizontal,
  Edit2,
  Trash2,
  Eye,
  ChevronDown,
} from "lucide-react";
import {
  EditorState,
  ToolState,
  ErasureState,
  ViewMode,
} from "../../types/pdf-editor.types";

interface FloatingToolbarProps {
  editorState: EditorState;
  toolState: ToolState;
  erasureState: ErasureState;
  currentView: ViewMode;
  showDeletionRectangles: boolean;
  isSidebarCollapsed: boolean;
  onToolChange: (tool: string, enabled: boolean) => void;
  onViewChange: (view: ViewMode) => void;
  onEditModeToggle: () => void;
  onDeletionToggle: () => void;
  onImageUpload: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorState,
  toolState,
  erasureState,
  currentView,
  showDeletionRectangles,
  isSidebarCollapsed,
  onToolChange,
  onViewChange,
  onEditModeToggle,
  onDeletionToggle,
  onImageUpload,
}) => {
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  // Close shape menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        shapeMenuRef.current &&
        !shapeMenuRef.current.contains(event.target as Node)
      ) {
        setIsShapeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const leftToolbarStyle = {
    top: "80px",
    left: isSidebarCollapsed ? "16px" : "16px",
  };

  const rightToolbarStyle = {
    top: "80px",
    right: "16px",
  };

  const isElementSelected =
    editorState.selectedFieldId ||
    editorState.selectedShapeId ||
    editorState.multiSelection.selectedElements.length > 0;

  // Always enable controls when there's no selected element
  const shouldEnableControls = !isElementSelected;

  return (
    <>
      {/* Left Floating Toolbar - Tools */}
      <div
        className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300"
        style={leftToolbarStyle}
      >
        <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
          <button
            onClick={() =>
              onToolChange("selection", !editorState.isSelectionMode)
            }
            disabled={!shouldEnableControls}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              editorState.isSelectionMode
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            } ${!shouldEnableControls ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Multi-Element Selection (Drag to select multiple elements)"
          >
            <MousePointer className="w-5 h-5" />
          </button>

          <button
            onClick={() =>
              onToolChange("addTextBox", !editorState.isAddTextBoxMode)
            }
            disabled={!shouldEnableControls}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              editorState.isAddTextBoxMode
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            } ${!shouldEnableControls ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Add Text Field"
          >
            <Type className="w-5 h-5" />
          </button>

          {/* Shape Tool with Dropdown Menu */}
          <div className="relative" ref={shapeMenuRef}>
            <button
              onClick={() => setIsShapeMenuOpen(!isShapeMenuOpen)}
              disabled={!shouldEnableControls}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 flex items-center gap-1 ${
                toolState.shapeDrawingMode === "rectangle" ||
                toolState.shapeDrawingMode === "circle"
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  : "text-gray-700 hover:text-blue-600"
              } ${
                !shouldEnableControls ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Draw Shapes"
            >
              {toolState.shapeDrawingMode === "circle" ? (
                <Circle className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Dropdown Menu */}
            {isShapeMenuOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-blue-100 py-1 min-w-[120px] z-50">
                <button
                  onClick={() => {
                    onToolChange(
                      "rectangle",
                      toolState.shapeDrawingMode !== "rectangle"
                    );
                    setIsShapeMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                    toolState.shapeDrawingMode === "rectangle"
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700"
                  }`}
                >
                  <Square className="w-4 h-4" />
                  Rectangle
                </button>
                <button
                  onClick={() => {
                    onToolChange(
                      "circle",
                      toolState.shapeDrawingMode !== "circle"
                    );
                    setIsShapeMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                    toolState.shapeDrawingMode === "circle"
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700"
                  }`}
                >
                  <Circle className="w-4 h-4" />
                  Circle
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onToolChange("erasure", !erasureState.isErasureMode)}
            disabled={!shouldEnableControls}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              erasureState.isErasureMode
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            } ${!shouldEnableControls ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Erasure Tool (Draw deletion rectangles)"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={onImageUpload}
            className="p-2 rounded-md transition-all duration-200 hover:bg-blue-50 text-gray-700 hover:text-blue-600"
            title="Add Image to Document"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Right Floating Toolbar - View Controls */}
      <div
        className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300"
        style={rightToolbarStyle}
      >
        <div className="bg-white rounded-lg shadow-lg border border-blue-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
          <button
            onClick={() => onViewChange("original")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              currentView === "original"
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            }`}
            title="Original Document"
          >
            <FileText className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange("translated")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              currentView === "translated"
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            }`}
            title="Translated Document"
          >
            <Globe className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange("split")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              currentView === "split"
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            }`}
            title="Split Screen"
          >
            <SplitSquareHorizontal className="w-5 h-5" />
          </button>

          <button
            onClick={onEditModeToggle}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              editorState.isEditMode
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            }`}
            title="Toggle Edit Mode"
          >
            <Edit2 className="w-5 h-5" />
          </button>

          <button
            onClick={onDeletionToggle}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-blue-50 ${
              showDeletionRectangles
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                : "text-gray-700 hover:text-blue-600"
            }`}
            title={
              showDeletionRectangles
                ? "Hide Deletion Areas"
                : "Show Deletion Areas"
            }
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
};
