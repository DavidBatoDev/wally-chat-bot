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
  Settings,
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
  currentWorkflowStep?: string;
  onToolChange: (tool: string, enabled: boolean) => void;
  onViewChange: (view: ViewMode) => void;
  onEditModeToggle: () => void;
  onDeletionToggle: () => void;
  onImageUpload?: () => void;
  showFinalLayoutSettings?: boolean;
  onToggleFinalLayoutSettings?: () => void;
  onErasureStateChange?: (erasureState: ErasureState) => void;
  documentState?: any; // For background color updates
  onPdfBackgroundColorChange?: (color: string) => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorState,
  toolState,
  erasureState,
  currentView,
  showDeletionRectangles,
  isSidebarCollapsed,
  currentWorkflowStep,
  onToolChange,
  onViewChange,
  onEditModeToggle,
  onDeletionToggle,
  onImageUpload,
  showFinalLayoutSettings,
  onToggleFinalLayoutSettings,
  onErasureStateChange,
  documentState,
  onPdfBackgroundColorChange,
}) => {
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isErasureMenuOpen, setIsErasureMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const erasureMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        shapeMenuRef.current &&
        !shapeMenuRef.current.contains(event.target as Node)
      ) {
        setIsShapeMenuOpen(false);
      }
      if (
        viewMenuRef.current &&
        !viewMenuRef.current.contains(event.target as Node)
      ) {
        setIsViewMenuOpen(false);
      }
      if (
        erasureMenuRef.current &&
        !erasureMenuRef.current.contains(event.target as Node)
      ) {
        setIsErasureMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Turn off edit mode if entering translate step
  useEffect(() => {
    if (currentWorkflowStep === "translate" && editorState.isEditMode) {
      onEditModeToggle();
    }
  }, [currentWorkflowStep, editorState.isEditMode, onEditModeToggle]);

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

  // Helper function to convert RGB string to hex
  const rgbStringToHex = (rgb: string): string => {
    if (rgb.startsWith("#")) return rgb;
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return "#ffffff";
    const [, r, g, b] = match;
    return `#${[r, g, b]
      .map((x) => parseInt(x).toString(16).padStart(2, "0"))
      .join("")}`;
  };

  // Get current view icon
  const getCurrentViewIcon = () => {
    switch (currentView) {
      case "original":
        return <FileText className="w-5 h-5" />;
      case "translated":
        return <Globe className="w-5 h-5" />;
      case "split":
        return <SplitSquareHorizontal className="w-5 h-5" />;
      case "final-layout":
        return <Eye className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  // Get current view display name
  const getCurrentViewName = () => {
    switch (currentView) {
      case "original":
        return "Original";
      case "translated":
        return "Translated";
      case "split":
        return "Split Screen";
      case "final-layout":
        return "Final Layout";
      default:
        return "View";
    }
  };

  // Tooltip component for hover popovers
  const ToolbarTooltip: React.FC<{
    id: string;
    text: string;
    children: React.ReactNode;
    disabled?: boolean;
  }> = ({ id, text, children, disabled = false }) => (
    <div
      className="relative"
      onMouseEnter={() => !disabled && setHoveredButton(id)}
      onMouseLeave={() => setHoveredButton(null)}
    >
      {children}
      {hoveredButton === id && !disabled && (
        <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-60">
          <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap animate-in slide-in-from-right-2 duration-200">
            {text}
            {/* Arrow pointing right */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-y-4 border-y-transparent"></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Combined Right Floating Toolbar - Tools and View Controls */}
      <div
        className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300"
        style={rightToolbarStyle}
      >
        <div className="bg-white rounded-lg shadow-lg border border-primary/20 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
          {/* --- EDITING TOOLS SECTION --- */}
          {/* Show editing tools in all workflow states except translate */}
          {currentWorkflowStep !== "translate" && (
            <>
              {/* Edit Mode Toggle - always visible with expand indicator */}
              <ToolbarTooltip id="edit-mode-tools" text="Toggle Edit Mode">
                <button
                  onClick={onEditModeToggle}
                  className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 flex items-center gap-1 text-gray-700 hover:text-primary ${
                    editorState.isEditMode ? "bg-gray-200" : ""
                  }`}
                >
                  <Edit2 className="w-5 h-5" />
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      editorState.isEditMode ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </ToolbarTooltip>

              {/* Editing Tools - only show when edit mode is enabled with slide-down animation */}
              {editorState.isEditMode && (
                <div className="animate-in slide-in-from-top-2 duration-300 flex flex-col space-y-1">
                  <ToolbarTooltip
                    id="selection"
                    text="Multi-Element Selection"
                    disabled={!shouldEnableControls}
                  >
                    <button
                      onClick={() =>
                        onToolChange("selection", !editorState.isSelectionMode)
                      }
                      disabled={!shouldEnableControls}
                      className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 ${
                        editorState.isSelectionMode
                          ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                          : "text-gray-700 hover:text-primary"
                      } ${
                        !shouldEnableControls
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <MousePointer className="w-5 h-5" />
                    </button>
                  </ToolbarTooltip>

                  <ToolbarTooltip
                    id="textbox"
                    text="Add Text Field"
                    disabled={!shouldEnableControls}
                  >
                    <button
                      onClick={() =>
                        onToolChange(
                          "addTextBox",
                          !editorState.isAddTextBoxMode
                        )
                      }
                      disabled={!shouldEnableControls}
                      className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 ${
                        editorState.isAddTextBoxMode
                          ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                          : "text-gray-700 hover:text-primary"
                      } ${
                        !shouldEnableControls
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <Type className="w-5 h-5" />
                    </button>
                  </ToolbarTooltip>

                  {/* Shape Tool with Dropdown Menu */}
                  <ToolbarTooltip
                    id="shapes"
                    text="Draw Shapes"
                    disabled={!shouldEnableControls}
                  >
                    <div className="relative" ref={shapeMenuRef}>
                      <button
                        onClick={() => setIsShapeMenuOpen(!isShapeMenuOpen)}
                        disabled={!shouldEnableControls}
                        className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 flex items-center gap-1 ${
                          toolState.shapeDrawingMode === "rectangle" ||
                          toolState.shapeDrawingMode === "circle" ||
                          toolState.shapeDrawingMode === "line"
                            ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                            : "text-gray-700 hover:text-primary"
                        } ${
                          !shouldEnableControls
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {toolState.shapeDrawingMode === "circle" ? (
                          <Circle className="w-5 h-5" />
                        ) : toolState.shapeDrawingMode === "line" ? (
                          <svg
                            className="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="4" y1="20" x2="20" y2="4" />
                          </svg>
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {/* Dropdown Menu - positioned to open to the left since toolbar is on the right */}
                      {isShapeMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-primary/20 py-1 min-w-[120px] z-50">
                          <button
                            onClick={() => {
                              onToolChange(
                                "rectangle",
                                toolState.shapeDrawingMode !== "rectangle"
                              );
                              setIsShapeMenuOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                              toolState.shapeDrawingMode === "rectangle"
                                ? "bg-primary/10 text-primary"
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
                            className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                              toolState.shapeDrawingMode === "circle"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700"
                            }`}
                          >
                            <Circle className="w-4 h-4" />
                            Circle
                          </button>
                          <button
                            onClick={() => {
                              onToolChange(
                                "line",
                                toolState.shapeDrawingMode !== "line"
                              );
                              setIsShapeMenuOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                              toolState.shapeDrawingMode === "line"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700"
                            }`}
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <line x1="4" y1="20" x2="20" y2="4" />
                            </svg>
                            Line
                          </button>
                        </div>
                      )}
                    </div>
                  </ToolbarTooltip>

                  {/* Erasure Tool with Settings Dropdown */}
                  <ToolbarTooltip
                    id="erasure"
                    text="Erasure Tool"
                    disabled={!shouldEnableControls}
                  >
                    <div className="relative" ref={erasureMenuRef}>
                      <button
                        onClick={() => {
                          onToolChange("erasure", !erasureState.isErasureMode);
                          if (!erasureState.isErasureMode) {
                            setIsErasureMenuOpen(true);
                          }
                        }}
                        disabled={!shouldEnableControls}
                        className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 flex items-center gap-1 ${
                          erasureState.isErasureMode
                            ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                            : "text-gray-700 hover:text-primary"
                        } ${
                          !shouldEnableControls
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <Eraser className="w-5 h-5" />
                        {erasureState.isErasureMode && (
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isErasureMenuOpen ? "rotate-180" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsErasureMenuOpen(!isErasureMenuOpen);
                            }}
                          />
                        )}
                      </button>

                      {/* Erasure Settings Dropdown */}
                      {isErasureMenuOpen && erasureState.isErasureMode && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-primary/20 p-4 min-w-[280px] z-50">
                          <div className="space-y-3">
                            {/* Opacity */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600 w-20">
                                Opacity:
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={erasureState.erasureSettings.opacity}
                                onChange={(e) => {
                                  if (onErasureStateChange) {
                                    onErasureStateChange({
                                      ...erasureState,
                                      erasureSettings: {
                                        ...erasureState.erasureSettings,
                                        opacity: parseFloat(e.target.value),
                                      },
                                    });
                                  }
                                }}
                                className="flex-1 w-5"
                              />
                              <span className="text-xs text-gray-500 w-10">
                                {Math.round(
                                  erasureState.erasureSettings.opacity * 100
                                )}
                                %
                              </span>
                            </div>

                            {/* Page Background Color Picker */}
                            {documentState && onPdfBackgroundColorChange && (
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-600 w-20">
                                  Page BG:
                                </label>
                                <input
                                  type="color"
                                  value={
                                    documentState.pdfBackgroundColor?.startsWith(
                                      "#"
                                    )
                                      ? documentState.pdfBackgroundColor
                                      : rgbStringToHex(
                                          documentState.pdfBackgroundColor ||
                                            "#ffffff"
                                        )
                                  }
                                  onChange={(e) => {
                                    const newColor = e.target.value;
                                    onPdfBackgroundColorChange(newColor);
                                  }}
                                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">
                                  {documentState.pdfBackgroundColor ||
                                    "#ffffff"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ToolbarTooltip>

                  {/* Only show image upload button when not in split view */}
                  {onImageUpload && (
                    <ToolbarTooltip id="image" text="Add Image to Document">
                      <button
                        onClick={onImageUpload}
                        className="p-2 rounded-md transition-all duration-200 hover:bg-primary/10 text-gray-700 hover:text-primary"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </ToolbarTooltip>
                  )}
                </div>
              )}

              {/* Divider between tools and view controls - always show */}
              <div className="w-full h-px bg-gray-200 my-1"></div>
            </>
          )}

          {/* --- VIEW CONTROLS - CONSOLIDATED INTO SINGLE BUTTON WITH POPOVER --- */}

          {/* Single View Button with Popover */}
          <ToolbarTooltip
            id="view-selector"
            text={`Current View: ${getCurrentViewName()}`}
          >
            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 flex items-center gap-1 text-gray-700 hover:text-primary`}
              >
                {getCurrentViewIcon()}
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* View Options Popover */}
              {isViewMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-primary/20 py-1 min-w-[160px] z-50">
                  {/* Original View - Available in all workflow steps */}
                  <button
                    onClick={() => {
                      onViewChange("original");
                      setIsViewMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                      currentView === "original"
                        ? "bg-primary/10 text-primary"
                        : "text-gray-700"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Original Document
                  </button>

                  {/* Translated View - Available in layout step only */}
                  {currentWorkflowStep === "layout" && (
                    <button
                      onClick={() => {
                        onViewChange("translated");
                        setIsViewMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                        currentView === "translated"
                          ? "bg-primary/10 text-primary"
                          : "text-gray-700"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Translated Document
                    </button>
                  )}

                  {/* Split View - Available in translate and layout steps */}
                  {(currentWorkflowStep === "translate" ||
                    currentWorkflowStep === "layout") && (
                    <button
                      onClick={() => {
                        onViewChange("split");
                        setIsViewMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                        currentView === "split"
                          ? "bg-primary/10 text-primary"
                          : "text-gray-700"
                      }`}
                    >
                      <SplitSquareHorizontal className="w-4 h-4" />
                      Split Screen View
                    </button>
                  )}

                  {/* Final Layout View - Available in final-layout step only */}
                  {currentWorkflowStep === "final-layout" && (
                    <button
                      onClick={() => {
                        onViewChange("final-layout");
                        setIsViewMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                        currentView === "final-layout"
                          ? "bg-primary/10 text-primary"
                          : "text-gray-700"
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Final Layout Document
                    </button>
                  )}
                </div>
              )}
            </div>
          </ToolbarTooltip>

          {/* Additional Controls */}
          {/* Final Layout Settings - Available in final-layout step only */}
          {currentWorkflowStep === "final-layout" &&
            onToggleFinalLayoutSettings && (
              <ToolbarTooltip
                id="final-layout-settings"
                text="Toggle Final Layout Settings"
              >
                <button
                  onClick={onToggleFinalLayoutSettings}
                  className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 ${
                    showFinalLayoutSettings
                      ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                      : "text-gray-700 hover:text-primary"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                </button>
              </ToolbarTooltip>
            )}

          {/* Deletion Areas Toggle - Available in layout and final-layout steps */}
          {(currentWorkflowStep === "layout" ||
            currentWorkflowStep === "final-layout") && (
            <>
              {/* Divider before deletion toggle */}
              <div className="w-full h-px bg-gray-200 my-1"></div>

              <ToolbarTooltip
                id="deletion-toggle"
                text={
                  showDeletionRectangles
                    ? "Hide Deletion Areas"
                    : "Show Deletion Areas"
                }
              >
                <button
                  onClick={onDeletionToggle}
                  className={`p-2 rounded-md transition-all duration-200 hover:bg-primary/10 ${
                    showDeletionRectangles
                      ? "bg-primary text-white hover:bg-primaryLight shadow-md"
                      : "text-gray-700 hover:text-primary"
                  }`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </ToolbarTooltip>
            </>
          )}
        </div>
      </div>
    </>
  );
};
