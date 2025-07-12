import React from "react";
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
    editorState.selectedElementId;

  return (
    <>
      {/* Left Floating Toolbar - Tools */}
      <div
        className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300"
        style={leftToolbarStyle}
      >
        <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
          <button
            onClick={() =>
              onToolChange("textSelection", !editorState.isTextSelectionMode)
            }
            disabled={!!isElementSelected}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              editorState.isTextSelectionMode
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            } ${isElementSelected ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Add Text Field from Document (Click text to create editable field)"
          >
            <MousePointer className="w-5 h-5" />
          </button>

          <button
            onClick={() =>
              onToolChange("addTextBox", !editorState.isAddTextBoxMode)
            }
            disabled={!!isElementSelected}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              editorState.isAddTextBoxMode
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            } ${isElementSelected ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Add Text Field"
          >
            <Type className="w-5 h-5" />
          </button>

          <button
            onClick={() =>
              onToolChange(
                "rectangle",
                toolState.shapeDrawingMode === "rectangle"
              )
            }
            disabled={!!isElementSelected}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              toolState.shapeDrawingMode === "rectangle"
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            } ${isElementSelected ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Draw Rectangle"
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={() =>
              onToolChange("circle", toolState.shapeDrawingMode === "circle")
            }
            disabled={!!isElementSelected}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              toolState.shapeDrawingMode === "circle"
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            } ${isElementSelected ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Draw Circle"
          >
            <Circle className="w-5 h-5" />
          </button>

          <button
            onClick={() => onToolChange("erasure", !erasureState.isErasureMode)}
            disabled={!!isElementSelected}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              erasureState.isErasureMode
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            } ${isElementSelected ? "opacity-50 cursor-not-allowed" : ""}`}
            title="Erasure Tool (Draw deletion rectangles)"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={onImageUpload}
            className="p-2 rounded-md transition-all duration-200 hover:bg-red-50 text-gray-700 hover:text-red-600"
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
        <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
          <button
            onClick={() => onViewChange("original")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              currentView === "original"
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            }`}
            title="Original Document"
          >
            <FileText className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange("translated")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              currentView === "translated"
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            }`}
            title="Translated Document"
          >
            <Globe className="w-5 h-5" />
          </button>

          <button
            onClick={() => onViewChange("split")}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              currentView === "split"
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            }`}
            title="Split Screen"
          >
            <SplitSquareHorizontal className="w-5 h-5" />
          </button>

          <button
            onClick={onEditModeToggle}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              editorState.isEditMode
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
            }`}
            title="Toggle Edit Mode"
          >
            <Edit2 className="w-5 h-5" />
          </button>

          <button
            onClick={onDeletionToggle}
            className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
              showDeletionRectangles
                ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                : "text-gray-700 hover:text-red-600"
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
