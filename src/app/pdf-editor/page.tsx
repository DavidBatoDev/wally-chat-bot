"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  memo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Type,
  Square,
  Circle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Save,
  FileText,
  Palette,
  Settings,
  Move,
  MoreHorizontal,
  X,
  Minus,
  Menu,
  MousePointer,
  Languages,
  Scan,
  MessageSquare,
  FileSearch,
  Globe,
  Files,
  Wrench,
  Eye,
  SplitSquareHorizontal,
} from "lucide-react";
import { toast } from "sonner";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set up PDF.js worker - match DocumentCanvas setup
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Utility functions
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getCleanExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase() || "";
    return extension;
  } catch {
    return url.split(".").pop()?.toLowerCase() || "";
  }
};

const getFileType = (url: string): "pdf" | "image" => {
  const extension = getCleanExtension(url);
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  return imageExtensions.includes(extension) ? "image" : "pdf";
};

const isPdfFile = (url: string): boolean => {
  return getFileType(url) === "pdf";
};

const isImageFile = (url: string): boolean => {
  return getFileType(url) === "image";
};

const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing: number = 0
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: fontSize };

  context.font = `${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  const width = metrics.width + characterSpacing * Math.max(0, text.length - 1);
  const height = fontSize * 1.2; // Approximate line height

  return { width, height };
};

const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${opacity})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Interfaces
interface TextField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  page: number;
  characterSpacing?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  rotation?: number;
}

interface Shape {
  id: string;
  type: "circle" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
}

interface DeletionRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  background?: string;
}

interface TextSelectionPopupState {
  texts: {
    text: string;
    position: { top: number; left: number };
    pagePosition: { x: number; y: number };
  }[];
  popupPosition: {
    top: number;
    left: number;
    position: "above" | "below";
  };
}

// Memoized TextBox component to prevent unnecessary re-renders
const MemoizedTextBox = memo(
  ({
    textBox,
    isSelected,
    isEditMode,
    settingsPopupFor,
    scale,
    onSelect,
    onUpdate,
    onDelete,
    onSettingsToggle,
  }: {
    textBox: TextField;
    isSelected: boolean;
    isEditMode: boolean;
    settingsPopupFor: string | null;
    scale: number;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<TextField>) => void;
    onDelete: (id: string) => void;
    onSettingsToggle: (id: string | null) => void;
  }) => {
    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(textBox.id, { value: e.target.value });
      },
      [textBox.id, onUpdate]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(textBox.id);
      },
      [textBox.id, onSelect]
    );

    const handleFocus = useCallback(() => {
      onSelect(textBox.id);
    }, [textBox.id, onSelect]);

    return (
      <Rnd
        key={textBox.id}
        position={{ x: textBox.x * scale, y: textBox.y * scale }}
        size={{ width: textBox.width * scale, height: textBox.height * scale }}
        bounds="parent"
        onDragStop={(e, d) => {
          onUpdate(textBox.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(textBox.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`${isSelected ? "ring-2 ring-blue-500" : ""}`}
        style={{ zIndex: 30, transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Controls and settings UI */}
          {isEditMode && isSelected && (
            <>
              {/* Move handle and font size input */}
              <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
                <div className="drag-handle bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                  <Move size={10} />
                </div>
                <div className="flex items-center bg-white rounded-md shadow-lg overflow-hidden">
                  <input
                    type="number"
                    value={Math.round(textBox.fontSize * 10) / 10}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newSize = parseFloat(e.target.value) || 5;
                      onUpdate(textBox.id, {
                        fontSize: Math.max(5, Math.min(72, newSize)),
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => {
                      e.stopPropagation();
                      e.target.select();
                    }}
                    className="text-black text-xs font-medium px-2 py-1 w-12 text-center border-none outline-none bg-transparent"
                    min="5"
                    max="72"
                    step="0.1"
                    title="Font size"
                  />
                  <span className="text-gray-500 text-xs pr-1">px</span>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(textBox.id);
                }}
                className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                title="Delete text field"
              >
                <Trash2 size={10} />
              </button>

              {/* Settings button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSettingsToggle(textBox.id);
                }}
                className={`absolute top-0 right-0 transform -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors z-10 ${
                  settingsPopupFor === textBox.id
                    ? "bg-gray-100 border-gray-400"
                    : ""
                }`}
              >
                <MoreHorizontal size={14} className="text-gray-600" />
              </button>

              {/* Settings popup */}
              {settingsPopupFor === textBox.id && (
                <div
                  className="absolute top-0 right-0 transform translate-y-8 translate-x-1 bg-white shadow-xl rounded-lg p-4 z-[9999999999] border border-gray-200 w-64 settings-popup"
                  style={{
                    transform: "translate(0.25rem, 2rem)",
                    transformOrigin: "top right",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800">
                      Field Settings
                    </h3>
                    <button
                      onClick={() => onSettingsToggle(null)}
                      className="text-gray-500 hover:text-gray-800"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Font Family */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Font Family
                      </label>
                      <select
                        value={textBox.fontFamily}
                        onChange={(e) =>
                          onUpdate(textBox.id, {
                            fontFamily: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                        <option value="Times New Roman, serif">
                          Times New Roman
                        </option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Courier New, monospace">
                          Courier New
                        </option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="Tahoma, sans-serif">Tahoma</option>
                        <option value="Trebuchet MS, sans-serif">
                          Trebuchet MS
                        </option>
                        <option value="Palatino, serif">Palatino</option>
                        <option value="Lucida Console, monospace">
                          Lucida Console
                        </option>
                      </select>
                    </div>

                    {/* Font Color */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Font Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={textBox.fontColor}
                          onChange={(e) =>
                            onUpdate(textBox.id, {
                              fontColor: e.target.value,
                            })
                          }
                          className="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          value={textBox.fontColor}
                          onChange={(e) =>
                            onUpdate(textBox.id, {
                              fontColor: e.target.value,
                            })
                          }
                          className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                          placeholder="#000000"
                        />
                      </div>
                    </div>

                    {/* Bold and Italic */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Text Style
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            onUpdate(textBox.id, {
                              fontWeight:
                                textBox.fontWeight === "bold"
                                  ? "normal"
                                  : "bold",
                            })
                          }
                          className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                            textBox.fontWeight === "bold"
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          onClick={() =>
                            onUpdate(textBox.id, {
                              fontStyle:
                                textBox.fontStyle === "italic"
                                  ? "normal"
                                  : "italic",
                            })
                          }
                          className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center italic text-lg transition-all duration-200 ${
                            textBox.fontStyle === "italic"
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                          title="Italic"
                        >
                          I
                        </button>
                      </div>
                    </div>

                    {/* Character Spacing */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Character Spacing
                      </label>
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            const current = textBox.characterSpacing || 0;
                            onUpdate(textBox.id, {
                              characterSpacing: Math.max(0, current - 0.5),
                            });
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-l-lg hover:bg-gray-200 transition-colors"
                        >
                          <Minus size={14} />
                        </button>

                        <div className="w-16 h-8 flex items-center justify-center border-t border-b border-gray-300 bg-white">
                          {textBox.characterSpacing || 0}px
                        </div>

                        <button
                          onClick={() => {
                            const current = textBox.characterSpacing || 0;
                            onUpdate(textBox.id, {
                              characterSpacing: Math.min(20, current + 0.5),
                            });
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Rotation */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-red-500"
                        >
                          <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9" />
                          <path d="M9 12l2 2 4-4" />
                        </svg>
                        Rotation
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={textBox.rotation || 0}
                          onChange={(e) =>
                            onUpdate(textBox.id, {
                              rotation: parseInt(e.target.value),
                            })
                          }
                          className="flex-1 rotation-slider"
                          style={{
                            background: `linear-gradient(to right, #fee2e2 0%, #fecaca ${
                              ((textBox.rotation || 0) / 360) * 100
                            }%, #f3f4f6 ${
                              ((textBox.rotation || 0) / 360) * 100
                            }%, #f3f4f6 100%)`,
                          }}
                        />
                        <span className="text-sm font-bold text-red-600 min-w-[40px] text-center bg-white px-2 py-1 rounded border border-red-200 shadow-sm">
                          {textBox.rotation || 0}°
                        </span>
                      </div>
                    </div>

                    {/* Delete Field */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          onSettingsToggle(null);
                          onDelete(textBox.id);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 font-medium"
                      >
                        <Trash2 size={16} />
                        Delete Field
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Text content */}
          <div
            className="w-full h-full absolute"
            style={{
              transform: textBox.rotation
                ? `rotate(${textBox.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          >
            <textarea
              value={textBox.value}
              onChange={handleTextChange}
              onClick={handleClick}
              onFocus={handleFocus}
              className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none cursor-pointer resize-none"
              style={{
                fontSize: `${textBox.fontSize * scale}px`,
                fontFamily: textBox.fontFamily,
                fontWeight: textBox.fontWeight,
                fontStyle: textBox.fontStyle,
                color: textBox.fontColor,
                letterSpacing: `${(textBox.characterSpacing || 0) * scale}px`,
                backgroundColor: isSelected
                  ? "rgba(59, 130, 246, 0.1)"
                  : "transparent",
                textAlign: "left",
                // padding: "2px 4px",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            />
          </div>
        </div>
      </Rnd>
    );
  }
);

MemoizedTextBox.displayName = "MemoizedTextBox";

// Memoized Shape component to prevent unnecessary re-renders
const MemoizedShape = memo(
  ({
    shape,
    isSelected,
    isEditMode,
    scale,
    onSelect,
    onUpdate,
    onDelete,
  }: {
    shape: Shape;
    isSelected: boolean;
    isEditMode: boolean;
    scale: number;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Shape>) => void;
    onDelete: (id: string) => void;
  }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(shape.id);
      },
      [shape.id, onSelect]
    );

    return (
      <Rnd
        key={shape.id}
        position={{ x: shape.x * scale, y: shape.y * scale }}
        size={{ width: shape.width * scale, height: shape.height * scale }}
        bounds="parent"
        onDragStop={(e, d) => {
          onUpdate(shape.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(shape.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`${isSelected ? "ring-2 ring-red-500" : ""}`}
        style={{ zIndex: isSelected ? 1000 : 200, transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Shape Element */}
          <div
            className="w-full h-full"
            style={{
              backgroundColor: hexToRgba(shape.fillColor, shape.fillOpacity),
              border: `${shape.borderWidth * scale}px solid ${
                shape.borderColor
              }`,
              borderRadius: shape.type === "circle" ? "50%" : "0",
              transform: shape.rotation
                ? `rotate(${shape.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          />

          {/* Shape Controls */}
          {isEditMode && isSelected && (
            <>
              {/* Move handle */}
              <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
                <div className="drag-handle bg-red-500 hover:bg-red-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                  <Move size={10} />
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shape.id);
                }}
                className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                title="Delete shape"
              >
                <Trash2 size={10} />
              </button>

              {/* Resize indicator */}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-tl-md opacity-75"></div>
            </>
          )}
        </div>
      </Rnd>
    );
  }
);

MemoizedShape.displayName = "MemoizedShape";

const PDFEditor: React.FC = () => {
  // Document state
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(612);
  const [pageHeight, setPageHeight] = useState<number>(792);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [isScaleChanging, setIsScaleChanging] = useState<boolean>(false);

  // Editor state
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isAddTextBoxMode, setIsAddTextBoxMode] = useState<boolean>(false);
  const [isTextSelectionMode, setIsTextSelectionMode] =
    useState<boolean>(false);
  const [settingsPopupFor, setSettingsPopupFor] = useState<string | null>(null);
  const [textSelectionPopup, setTextSelectionPopup] =
    useState<TextSelectionPopupState | null>(null);

  // Shape drawing state
  const [isDrawingShape, setIsDrawingShape] = useState<boolean>(false);
  const [shapeDrawingMode, setShapeDrawingMode] = useState<
    "circle" | "rectangle" | null
  >(null);
  const [selectedShapeType, setSelectedShapeType] = useState<
    "circle" | "rectangle"
  >("rectangle");
  const [shapeDrawStart, setShapeDrawStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [shapeDrawEnd, setShapeDrawEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDrawingInProgress, setIsDrawingInProgress] =
    useState<boolean>(false);

  // Drag and interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotatingFieldId, setRotatingFieldId] = useState<string | null>(null);
  const [initialRotation, setInitialRotation] = useState<number>(0);
  const [rotationCenter, setRotationCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Zoom and view state
  const [zoomMode, setZoomMode] = useState<"page" | "width">("page");
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
  const [transformOrigin, setTransformOrigin] =
    useState<string>("center center");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"pages" | "tools">(
    "pages"
  );

  // Document view state
  const [currentView, setCurrentView] = useState<
    "original" | "translated" | "split"
  >("original");

  // SEPARATE STATE ARRAYS FOR ORIGINAL AND TRANSLATED DOCUMENTS
  const [originalTextBoxes, setOriginalTextBoxes] = useState<TextField[]>([]);
  const [originalShapes, setOriginalShapes] = useState<Shape[]>([]);
  const [originalDeletionRectangles, setOriginalDeletionRectangles] = useState<
    DeletionRectangle[]
  >([]);

  const [translatedTextBoxes, setTranslatedTextBoxes] = useState<TextField[]>(
    []
  );
  const [translatedShapes, setTranslatedShapes] = useState<Shape[]>([]);
  const [translatedDeletionRectangles, setTranslatedDeletionRectangles] =
    useState<DeletionRectangle[]>([]);

  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());

  // Helper functions to get current state arrays based on view
  const getCurrentTextBoxes = () => {
    return currentView === "original" ? originalTextBoxes : translatedTextBoxes;
  };

  const getCurrentShapes = () => {
    return currentView === "original" ? originalShapes : translatedShapes;
  };

  const getCurrentDeletionRectangles = () => {
    return currentView === "original"
      ? originalDeletionRectangles
      : translatedDeletionRectangles;
  };

  const setCurrentTextBoxes = (updater: React.SetStateAction<TextField[]>) => {
    if (currentView === "original") {
      setOriginalTextBoxes(updater);
    } else {
      setTranslatedTextBoxes(updater);
    }
  };

  const setCurrentShapes = (updater: React.SetStateAction<Shape[]>) => {
    if (currentView === "original") {
      setOriginalShapes(updater);
    } else {
      setTranslatedShapes(updater);
    }
  };

  const setCurrentDeletionRectangles = (
    updater: React.SetStateAction<DeletionRectangle[]>
  ) => {
    if (currentView === "original") {
      setOriginalDeletionRectangles(updater);
    } else {
      setTranslatedDeletionRectangles(updater);
    }
  };

  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to reset scale changing state with debounce
  const resetScaleChanging = useCallback(() => {
    if (scaleTimeoutRef.current) {
      clearTimeout(scaleTimeoutRef.current);
    }
    scaleTimeoutRef.current = setTimeout(() => {
      setIsScaleChanging(false);
      scaleTimeoutRef.current = null;
    }, 150);
  }, []);

  // Drag state refs for performance
  const dragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const isDraggingRef = useRef<Record<string, boolean>>({});

  // Shape drag state refs
  const shapeDragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const shapeDragRafRef = useRef<number | null>(null);
  const isShapeDraggingRef = useRef<Record<string, boolean>>({});

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Clear all active field drags
      Object.keys(isDraggingRef.current).forEach((fieldId) => {
        if (isDraggingRef.current[fieldId]) {
          try {
            const dragState = dragStatesRef.current[fieldId];
            if (dragState?.element) {
              const element = dragState.element;
              if (element && element.style) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn("Error cleaning up field transform:", error);
          }
          delete dragStatesRef.current[fieldId];
          delete isDraggingRef.current[fieldId];
        }
      });

      // Clear all active shape drags
      Object.keys(isShapeDraggingRef.current).forEach((shapeId) => {
        if (isShapeDraggingRef.current[shapeId]) {
          try {
            const dragState = shapeDragStatesRef.current[shapeId];
            if (dragState?.element) {
              const element = dragState.element;
              if (element && element.style) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn("Error cleaning up shape transform:", error);
          }
          delete shapeDragStatesRef.current[shapeId];
          delete isShapeDraggingRef.current[shapeId];
        }
      });

      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (shapeDragRafRef.current) {
        cancelAnimationFrame(shapeDragRafRef.current);
        shapeDragRafRef.current = null;
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mouseleave", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mouseleave", handleGlobalMouseUp);
    };
  }, []);

  // Container width tracking
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-switch to tools tab when no document is loaded
  useEffect(() => {
    if (!documentUrl && activeSidebarTab === "pages") {
      setActiveSidebarTab("tools");
    }
  }, [documentUrl, activeSidebarTab]);

  // Zoom adjustment
  useEffect(() => {
    if (zoomMode === "width" && containerWidth > 0 && pageWidth > 0) {
      const calculatedScale = containerWidth / pageWidth;
      setScale(Math.min(calculatedScale, 3.0));
    }
  }, [containerWidth, pageWidth, zoomMode]);

  // Add wheel event listener directly to container for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      console.log("Wheel event detected:", {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        deltaY: e.deltaY,
      });

      if (e.ctrlKey || e.metaKey) {
        console.log("Ctrl+wheel detected - preventing default and zooming");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always zoom to center
        setTransformOrigin("center center");

        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;

        setIsScaleChanging(true);
        setScale((prevScale) => {
          const newScale = Math.max(0.1, Math.min(5.0, prevScale + delta));
          console.log("Scale changed from", prevScale, "to", newScale);
          return newScale;
        });

        setZoomMode("page");

        resetScaleChanging();
        return false;
      }
    };

    // Add the event listener with aggressive options
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    // Also try adding to document as backup
    const documentHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        console.log("Document-level wheel handler triggered");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleWheel(e);
      }
    };

    document.addEventListener("wheel", documentHandler, {
      passive: false,
      capture: true,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("wheel", documentHandler, { capture: true });
    };
  }, []);

  // Track scale changes to trigger loading state
  useEffect(() => {
    setIsPageLoading(true);
  }, [scale, currentPage]);

  // Track Ctrl key state for zoom indicator and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);

        // Ctrl+0 to reset zoom
        if (e.key === "0") {
          e.preventDefault();
          setIsScaleChanging(true);
          setScale(1.0);
          setZoomMode("page");
          setTransformOrigin("center center"); // Reset to center
          resetScaleChanging();
          toast.success("Zoom reset to 100%");
        }

        // Ctrl+= or Ctrl++ to zoom in
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setIsScaleChanging(true);
          setTransformOrigin("center center"); // Always zoom to center
          setScale((prevScale) => Math.min(5.0, prevScale + 0.1));
          setZoomMode("page");
          resetScaleChanging();
        }

        // Ctrl+- to zoom out
        if (e.key === "-") {
          e.preventDefault();
          setIsScaleChanging(true);
          setTransformOrigin("center center"); // Always zoom to center
          setScale((prevScale) => Math.max(0.1, prevScale - 0.1));
          setZoomMode("page");
          resetScaleChanging();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Document loading handlers
  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsDocumentLoaded(true);
    setError("");
  };

  const handleDocumentLoadError = (error: Error) => {
    setError(`Failed to load document: ${error.message}`);
    setIsDocumentLoaded(false);
  };

  const handlePageLoadSuccess = (page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageWidth(viewport.width);
    setPageHeight(viewport.height);
    setIsPageLoading(false);
  };

  const handleImageLoadSuccess = (
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const img = event.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setPageWidth(img.naturalWidth);
    setPageHeight(img.naturalHeight);
    setIsDocumentLoaded(true);
    setError("");
  };

  const handleImageLoadError = () => {
    setError("Failed to load image");
    setIsDocumentLoaded(false);
  };

  // Calculate popup position for text selection
  const calculatePopupPosition = (
    top: number,
    height: number
  ): { top: number; position: "above" | "below" } => {
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - top - height;
    const spaceAbove = top;

    // If there's more space below, position below
    if (spaceBelow > spaceAbove) {
      return { top: top + height + 5, position: "below" };
    } else {
      return { top: top - 5, position: "above" };
    }
  };

  // Handle text span click during selection mode
  const handleTextSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!isTextSelectionMode) return;
      e.stopPropagation();

      const span = e.currentTarget;
      const textContent = span.textContent || "";

      if (!textContent.trim()) return;

      const pdfPage = documentRef.current?.querySelector(".react-pdf__Page");
      if (!pdfPage) return;

      const spanRect = span.getBoundingClientRect();

      // Calculate position relative to viewport
      const popupTop = spanRect.bottom + 5;
      const popupLeft = spanRect.left + spanRect.width / 2;

      // Calculate position relative to PDF page (convert to original coordinate system)
      const pageRect = pdfPage.getBoundingClientRect();
      const pageX = (spanRect.left - pageRect.left) / scale;
      const pageY = (spanRect.top - pageRect.top) / scale;

      const popupPosition = calculatePopupPosition(
        spanRect.top,
        spanRect.height
      );

      setTextSelectionPopup((prev) => {
        const newSelection = {
          text: textContent,
          position: { top: spanRect.top, left: spanRect.left },
          pagePosition: { x: pageX, y: pageY },
        };

        // If shift key is pressed, add to existing selections
        if (e.shiftKey && prev) {
          return {
            texts: [...prev.texts, newSelection],
            popupPosition: {
              top: popupTop,
              left: popupLeft,
              position: "below",
            },
          };
        }

        // Otherwise, create new selection
        return {
          texts: [newSelection],
          popupPosition: {
            top: popupPosition.top,
            left: popupLeft,
            position: popupPosition.position || "below",
          },
        };
      });
    },
    [isTextSelectionMode, scale]
  );

  // Attach click handlers to text spans
  useEffect(() => {
    if (!isTextSelectionMode || !documentUrl) return;

    const attachHandlers = () => {
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );

      textSpans.forEach((span) => {
        // Only attach handler once
        if (!(span as any).hasListener) {
          span.addEventListener("click", handleTextSpanClick as any);
          (span as any).hasListener = true;
        }
      });
    };

    // Create a mutation observer to detect when text layer updates
    const observer = new MutationObserver(attachHandlers);

    if (documentRef.current) {
      const config = { childList: true, subtree: true };
      observer.observe(documentRef.current, config);

      // Initial attachment
      attachHandlers();
    }

    return () => {
      observer.disconnect();
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      textSpans.forEach((span) => {
        span.removeEventListener("click", handleTextSpanClick as any);
        delete (span as any).hasListener;
      });
    };
  }, [isTextSelectionMode, documentUrl, currentPage, handleTextSpanClick]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        textSelectionPopup &&
        !(e.target as Element).closest(".text-selection-popup")
      ) {
        setTextSelectionPopup(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [textSelectionPopup]);

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDocumentUrl(url);
      setFileType(getFileType(file.name));
      setIsLoading(true);
      setCurrentPage(1);

      // Reset editor state
      setOriginalTextBoxes([]);
      setOriginalShapes([]);
      setOriginalDeletionRectangles([]);
      setTranslatedTextBoxes([]);
      setTranslatedShapes([]);
      setTranslatedDeletionRectangles([]);
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setDeletedPages(new Set());

      // Switch to pages tab when document is uploaded
      setActiveSidebarTab("pages");

      setTimeout(() => setIsLoading(false), 500);
    }
  };

  // Handle page deletion
  const handleDeletePage = (pageNumber: number) => {
    const remainingPages = numPages - deletedPages.size;

    if (remainingPages <= 1) {
      toast.error("Cannot delete the last remaining page");
      return;
    }

    // Add page to deleted pages set
    setDeletedPages((prev) => new Set([...prev, pageNumber]));

    // Remove all elements from the deleted page (both original and translated)
    setOriginalTextBoxes((prev) =>
      prev.filter((box) => box.page !== pageNumber)
    );
    setOriginalShapes((prev) =>
      prev.filter((shape) => shape.page !== pageNumber)
    );
    setOriginalDeletionRectangles((prev) =>
      prev.filter((rect) => rect.page !== pageNumber)
    );
    setTranslatedTextBoxes((prev) =>
      prev.filter((box) => box.page !== pageNumber)
    );
    setTranslatedShapes((prev) =>
      prev.filter((shape) => shape.page !== pageNumber)
    );
    setTranslatedDeletionRectangles((prev) =>
      prev.filter((rect) => rect.page !== pageNumber)
    );

    // If current page is being deleted, switch to the first available page
    if (currentPage === pageNumber) {
      const availablePages = Array.from(
        { length: numPages },
        (_, i) => i + 1
      ).filter((page) => !deletedPages.has(page) && page !== pageNumber);

      if (availablePages.length > 0) {
        setCurrentPage(availablePages[0]);
      }
    }

    toast.success(`Page ${pageNumber} deleted`);
  };

  // Create text field from selected text
  const createTextFieldFromSelection = useCallback(
    (selection: { text: string; pagePosition: { x: number; y: number } }) => {
      const value = selection.text;
      const fontSize = 8;
      const fontFamily = "Arial, sans-serif";
      const fieldId = generateUUID();

      const { width, height } = measureText(value, fontSize, fontFamily);

      const newTextBox: TextField = {
        id: fieldId,
        x: selection.pagePosition.x,
        y: selection.pagePosition.y,
        width: width,
        height: height,
        value: value,
        fontSize: fontSize,
        fontColor: "#000000",
        fontFamily: fontFamily,
        page: currentPage,
        characterSpacing: 0,
        fontWeight: "normal",
        fontStyle: "normal",
        rotation: 0,
      };

      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedFieldId(fieldId);
    },
    [currentPage, currentView]
  );

  // Create deletion rectangle from selected text
  const createDeletionFromSelection = useCallback(
    (selection: { text: string; pagePosition: { x: number; y: number } }) => {
      // Estimate dimensions based on text and font size
      const fontSize = 12; // Estimate based on typical PDF text
      const { width, height } = measureText(selection.text, fontSize, "Arial");

      const newRectangle: DeletionRectangle = {
        id: generateUUID(),
        x: selection.pagePosition.x,
        y: selection.pagePosition.y,
        width: Math.max(width, 50), // Minimum width
        height: Math.max(height, 20), // Minimum height
        page: currentPage,
        background: "#ffffff",
      };

      setCurrentDeletionRectangles((prev) => [...prev, newRectangle]);
    },
    [currentPage, currentView]
  );

  // Text box management
  const addTextBox = useCallback(
    (x: number, y: number) => {
      const value = "New Text Field";
      const fontSize = 8;
      const fontFamily = "Arial, sans-serif";
      const fieldId = generateUUID();

      const { width, height } = measureText(value, fontSize, fontFamily);

      const newTextBox: TextField = {
        id: fieldId,
        x: x,
        y: y,
        width: width,
        height: height,
        value: value,
        fontSize: fontSize,
        fontColor: "#000000",
        fontFamily: fontFamily,
        page: currentPage,
        characterSpacing: 0,
        fontWeight: "normal",
        fontStyle: "normal",
        rotation: 0,
      };

      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedFieldId(fieldId);
      setIsAddTextBoxMode(false);
      setIsTextSelectionMode(false);
      setTextSelectionPopup(null);
    },
    [currentPage, currentView]
  );

  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextField>) => {
      setCurrentTextBoxes((prev) =>
        prev.map((box) => (box.id === id ? { ...box, ...updates } : box))
      );
    },
    [currentView]
  );

  const deleteTextBox = useCallback(
    (id: string) => {
      setCurrentTextBoxes((prev) => prev.filter((box) => box.id !== id));
      setSelectedFieldId((current) => (current === id ? null : current));
    },
    [currentView]
  );

  // Memoized callbacks for text box interactions to prevent re-renders
  const handleTextBoxSelect = useCallback((id: string) => {
    setSelectedFieldId(id);
  }, []);

  const handleSettingsToggle = useCallback((id: string | null) => {
    setSettingsPopupFor(id);
  }, []);

  // Memoized callbacks for shape interactions to prevent re-renders
  const handleShapeSelect = useCallback((id: string) => {
    setSelectedShapeId(id);
    setSelectedFieldId(null); // Clear text field selection
  }, []);

  const updateShapeCallback = useCallback(
    (id: string, updates: Partial<Shape>) => {
      setCurrentShapes((prev) =>
        prev.map((shape) =>
          shape.id === id ? { ...shape, ...updates } : shape
        )
      );
    },
    [currentView]
  );

  const deleteShapeCallback = useCallback(
    (id: string) => {
      setCurrentShapes((prev) => prev.filter((shape) => shape.id !== id));
      setSelectedShapeId((current) => (current === id ? null : current));
    },
    [currentView]
  );

  // Shape management
  const addShape = useCallback(
    (
      type: "circle" | "rectangle",
      x: number,
      y: number,
      width: number,
      height: number
    ) => {
      const newShape: Shape = {
        id: generateUUID(),
        type,
        x,
        y,
        width,
        height,
        page: currentPage,
        borderColor: "#000000",
        borderWidth: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.5,
        rotation: 0,
      };

      setCurrentShapes((prev) => [...prev, newShape]);
      setSelectedShapeId(newShape.id);
    },
    [currentPage, currentView]
  );

  const updateShape = useCallback(
    (id: string, updates: Partial<Shape>) => {
      setCurrentShapes((prev) =>
        prev.map((shape) =>
          shape.id === id ? { ...shape, ...updates } : shape
        )
      );
    },
    [currentView]
  );

  const deleteShape = useCallback(
    (id: string) => {
      setCurrentShapes((prev) => prev.filter((shape) => shape.id !== id));
      if (selectedShapeId === id) {
        setSelectedShapeId(null);
      }
    },
    [currentView, selectedShapeId]
  );

  // Deletion rectangle management
  const addDeletionRectangle = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const newRectangle: DeletionRectangle = {
        id: generateUUID(),
        x,
        y,
        width,
        height,
        page: currentPage,
        background: "#ffffff",
      };

      setCurrentDeletionRectangles((prev) => [...prev, newRectangle]);
    },
    [currentPage, currentView]
  );

  const updateDeletionRectangle = useCallback(
    (id: string, updates: Partial<DeletionRectangle>) => {
      setCurrentDeletionRectangles((prev) =>
        prev.map((rect) => (rect.id === id ? { ...rect, ...updates } : rect))
      );
    },
    [currentView]
  );

  const deleteDeletionRectangle = useCallback(
    (id: string) => {
      setCurrentDeletionRectangles((prev) =>
        prev.filter((rect) => rect.id !== id)
      );
    },
    [currentView]
  );

  // Document container click handler
  const handleDocumentContainerClick = (e: React.MouseEvent) => {
    if (!documentRef.current) return;

    // Don't handle clicks on text boxes or other interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest(".rnd")
    ) {
      return;
    }

    const rect = documentRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (isAddTextBoxMode) {
      addTextBox(x, y);
    } else if (shapeDrawingMode) {
      if (!isDrawingInProgress) {
        setShapeDrawStart({ x, y });
        setIsDrawingInProgress(true);
      }
    } else {
      // Clear selections only if clicking on empty space
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setSettingsPopupFor(null);
    }
  };

  // Shape drawing handlers
  const handleShapeDrawStart = (e: React.MouseEvent) => {
    if (!shapeDrawingMode) return;

    const rect = documentRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setShapeDrawStart({ x, y });
    setIsDrawingInProgress(true);
  };

  const handleShapeDrawMove = (e: React.MouseEvent) => {
    if (!isDrawingInProgress || !shapeDrawStart) return;

    const rect = documentRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setShapeDrawEnd({ x, y });
  };

  const handleShapeDrawEnd = () => {
    if (!isDrawingInProgress || !shapeDrawStart || !shapeDrawEnd) return;

    const width = Math.abs(shapeDrawEnd.x - shapeDrawStart.x);
    const height = Math.abs(shapeDrawEnd.y - shapeDrawStart.y);

    if (width > 10 && height > 10) {
      const x = Math.min(shapeDrawStart.x, shapeDrawEnd.x);
      const y = Math.min(shapeDrawStart.y, shapeDrawEnd.y);

      if (shapeDrawingMode) {
        addShape(shapeDrawingMode, x, y, width, height);
      }
    }

    setShapeDrawStart(null);
    setShapeDrawEnd(null);
    setIsDrawingInProgress(false);
    setShapeDrawingMode(null);
  };

  // Export functionality
  const exportData = () => {
    const data = {
      originalTextBoxes,
      originalShapes,
      originalDeletionRectangles,
      translatedTextBoxes,
      translatedShapes,
      translatedDeletionRectangles,
      documentInfo: {
        url: documentUrl,
        currentPage,
        numPages,
        scale,
        pageWidth,
        pageHeight,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-editor-data.json";
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Data exported successfully!");
  };

  const saveProject = () => {
    // This would typically save to a backend
    localStorage.setItem(
      "pdf-editor-project",
      JSON.stringify({
        originalTextBoxes,
        originalShapes,
        originalDeletionRectangles,
        translatedTextBoxes,
        translatedShapes,
        translatedDeletionRectangles,
        documentUrl,
        currentPage,
      })
    );
    toast.success("Project saved!");
  };

  const loadProject = () => {
    const saved = localStorage.getItem("pdf-editor-project");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setOriginalTextBoxes(data.originalTextBoxes || data.textBoxes || []);
        setOriginalShapes(data.originalShapes || data.shapes || []);
        setOriginalDeletionRectangles(
          data.originalDeletionRectangles || data.deletionRectangles || []
        );
        setTranslatedTextBoxes(data.translatedTextBoxes || []);
        setTranslatedShapes(data.translatedShapes || []);
        setTranslatedDeletionRectangles(
          data.translatedDeletionRectangles || []
        );
        if (data.documentUrl) {
          setDocumentUrl(data.documentUrl);
          setCurrentPage(data.currentPage || 1);
        }
        toast.success("Project loaded!");
      } catch (error) {
        toast.error("Failed to load project");
      }
    }
  };

  // Get current page items - memoized for performance
  const getCurrentPageTextBoxes = useMemo(
    () => getCurrentTextBoxes().filter((box) => box.page === currentPage),
    [currentView, originalTextBoxes, translatedTextBoxes, currentPage]
  );
  const getCurrentPageShapes = useMemo(
    () => getCurrentShapes().filter((shape) => shape.page === currentPage),
    [currentView, originalShapes, translatedShapes, currentPage]
  );
  const getCurrentPageDeletionRectangles = useMemo(
    () =>
      getCurrentDeletionRectangles().filter(
        (rect) => rect.page === currentPage
      ),
    [
      currentView,
      originalDeletionRectangles,
      translatedDeletionRectangles,
      currentPage,
    ]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-red-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
              title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <Menu className="w-4 h-4" />
            </Button>

            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              {/* Circular W Logo */}
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  Wally
                </h1>
                <p className="text-sm text-red-600 font-medium">
                  Multimodal Translation
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              className="hidden"
            />
            <Button
              onClick={saveProject}
              variant="outline"
              size="sm"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={exportData}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`bg-white border-r border-red-100 p-4 overflow-y-auto transition-all duration-300 shadow-sm ${
            isSidebarCollapsed ? "w-0 p-0 border-r-0" : "w-80"
          }`}
        >
          {!isSidebarCollapsed && (
            <div className="flex flex-col h-full">
              {/* Tab Navigation */}
              <div className="flex border-b border-red-100 mb-4">
                <button
                  onClick={() => setActiveSidebarTab("tools")}
                  className={`${
                    documentUrl ? "flex-1" : "w-full"
                  } px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
                    activeSidebarTab === "tools"
                      ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                      : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Wrench className="w-4 h-4" />
                    <span>Tools</span>
                  </div>
                </button>
                {documentUrl && (
                  <button
                    onClick={() => setActiveSidebarTab("pages")}
                    className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
                      activeSidebarTab === "pages"
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
                {activeSidebarTab === "pages" ? (
                  <div className="flex flex-col h-full">
                    {/* Pages Preview */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-3">Pages</h3>

                      {!documentUrl ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <div className="text-gray-400 mb-2">
                            No document loaded
                          </div>
                          <div className="text-sm text-gray-500">
                            Upload a document to get started
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {Array.from({ length: numPages }, (_, index) => {
                            const pageNum = index + 1;

                            // Skip deleted pages
                            if (deletedPages.has(pageNum)) {
                              return null;
                            }

                            const pageTextBoxes = [
                              ...originalTextBoxes,
                              ...translatedTextBoxes,
                            ].filter((box) => box.page === pageNum);
                            const pageShapes = [
                              ...originalShapes,
                              ...translatedShapes,
                            ].filter((shape) => shape.page === pageNum);
                            const pageDeletions = [
                              ...originalDeletionRectangles,
                              ...translatedDeletionRectangles,
                            ].filter((rect) => rect.page === pageNum);
                            const totalElements =
                              pageTextBoxes.length +
                              pageShapes.length +
                              pageDeletions.length;

                            return (
                              <div
                                key={pageNum}
                                className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md group relative ${
                                  currentPage === pageNum
                                    ? "border-red-500 bg-red-50 shadow-sm ring-1 ring-red-200"
                                    : "border-gray-200 hover:border-red-300 hover:bg-red-25"
                                }`}
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {/* Delete Button - Only show on hover and if more than 1 page */}
                                {numPages - deletedPages.size > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePage(pageNum);
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
                                      aspectRatio: "8.5/11", // Letter size ratio
                                      height: "120px",
                                    }}
                                  >
                                    {/* Mini document preview */}
                                    {isPdfFile(documentUrl) ? (
                                      <div className="w-full h-full bg-white relative">
                                        <Document
                                          file={documentUrl}
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
                                        src={documentUrl}
                                        alt={`Page ${pageNum}`}
                                        className="w-full h-full object-contain"
                                      />
                                    )}

                                    {/* Page number overlay */}
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                                      {pageNum}
                                    </div>

                                    {/* Current page indicator */}
                                    {currentPage === pageNum && (
                                      <div className="absolute inset-0 bg-red-500 bg-opacity-10 rounded" />
                                    )}
                                  </div>
                                </div>

                                {/* Page Info */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">
                                      Page {pageNum}
                                    </span>
                                    {totalElements > 0 && (
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                        {totalElements} element
                                        {totalElements !== 1 ? "s" : ""}
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
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Upload Button at Bottom */}
                    <div className="border-t border-red-100 pt-4 mt-4">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {documentUrl
                          ? "Upload New Document"
                          : "Upload Document"}
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Toolbar */}
        <div
          className={`absolute top-4 z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300 ${
            isSidebarCollapsed ? "left-4" : "left-80"
          }`}
          style={{
            left: isSidebarCollapsed ? "16px" : "336px", // 320px sidebar + 16px margin
          }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
            <button
              onClick={() => setIsTextSelectionMode(!isTextSelectionMode)}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                isTextSelectionMode
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                  : "text-gray-700 hover:text-red-600"
              }`}
              title="Select Text from Document"
            >
              <MousePointer className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsAddTextBoxMode(!isAddTextBoxMode)}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                isAddTextBoxMode
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                  : "text-gray-700 hover:text-red-600"
              }`}
              title="Add Text Field"
            >
              <Type className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShapeDrawingMode(
                  shapeDrawingMode === "rectangle" ? null : "rectangle"
                );
                setSelectedShapeType("rectangle");
              }}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                shapeDrawingMode === "rectangle"
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                  : "text-gray-700 hover:text-red-600"
              }`}
              title="Draw Rectangle"
            >
              <Square className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShapeDrawingMode(
                  shapeDrawingMode === "circle" ? null : "circle"
                );
                setSelectedShapeType("circle");
              }}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                shapeDrawingMode === "circle"
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                  : "text-gray-700 hover:text-red-600"
              }`}
              title="Draw Circle"
            >
              <Circle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Floating Toolbar - View Controls */}
        <div className="absolute top-4 right-4 z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300">
          <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
            <button
              onClick={() => setCurrentView("original")}
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
              onClick={() => setCurrentView("translated")}
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
              onClick={() => setCurrentView("split")}
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
              onClick={() => setIsEditMode(!isEditMode)}
              className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                isEditMode
                  ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                  : "text-gray-700 hover:text-red-600"
              }`}
              title="Toggle Edit Mode"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Viewer */}
        <div
          className="flex-1 document-viewer document-container"
          ref={containerRef}
          style={{
            scrollBehavior: "smooth",
            overflow: "auto",
            overflowX: "auto",
            overflowY: "auto",
          }}
        >
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-500 text-lg mb-2">Error</div>
                <div className="text-gray-600">{error}</div>
              </div>
            </div>
          )}

          {!documentUrl && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-500 text-lg mb-2">
                  No document loaded
                </div>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </div>
          )}

          {documentUrl && !error && (
            <div
              className="document-wrapper"
              style={{
                minHeight: `${Math.max(100, pageHeight * scale + 80)}px`,
                height: `${Math.max(100, pageHeight * scale + 80)}px`,
                width: `${Math.max(100, pageWidth * scale + 80)}px`,
                minWidth: `${Math.max(100, pageWidth * scale + 80)}px`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                paddingTop: "40px",
                paddingBottom: "40px",
                paddingLeft: "40px",
                paddingRight: "40px",
                margin: "0 auto",
              }}
            >
              <div
                ref={documentRef}
                className={`relative bg-white document-page ${
                  isScaleChanging ? "" : "zoom-transition"
                } ${isTextSelectionMode ? "text-selection-mode" : ""} ${
                  isAddTextBoxMode ? "cursor-crosshair" : ""
                } ${shapeDrawingMode ? "cursor-crosshair" : ""} ${
                  isCtrlPressed ? "cursor-zoom-in" : ""
                }`}
                onClick={handleDocumentContainerClick}
                onMouseMove={shapeDrawingMode ? handleShapeDrawMove : undefined}
                onMouseUp={shapeDrawingMode ? handleShapeDrawEnd : undefined}
                style={{
                  width: pageWidth * scale,
                  height: pageHeight * scale,
                  minWidth: pageWidth * scale,
                  minHeight: pageHeight * scale,
                  display: "block",
                }}
              >
                {/* Document Rendering - Show different content based on view */}
                {currentView === "original" && (
                  <>
                    {isPdfFile(documentUrl) ? (
                      <div className="relative">
                        <Document
                          file={documentUrl}
                          onLoadSuccess={handleDocumentLoadSuccess}
                          onLoadError={handleDocumentLoadError}
                          loading={
                            <div className="flex items-center justify-center p-8">
                              <div className="text-center">
                                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <div className="text-gray-600">
                                  Loading PDF...
                                </div>
                              </div>
                            </div>
                          }
                        >
                          <Page
                            pageNumber={currentPage}
                            onLoadSuccess={handlePageLoadSuccess}
                            onRenderSuccess={() => setIsPageLoading(false)}
                            onRenderError={() => setIsPageLoading(false)}
                            renderTextLayer={isTextSelectionMode}
                            renderAnnotationLayer={false}
                            loading={
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
                            }
                            width={pageWidth * scale}
                          />
                        </Document>

                        {/* Loading overlay during scale changes */}
                        {isScaleChanging && (
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
                    ) : (
                      <img
                        src={documentUrl}
                        alt="Document"
                        onLoad={handleImageLoadSuccess}
                        onError={handleImageLoadError}
                        style={{
                          width: pageWidth * scale,
                          height: pageHeight * scale,
                          maxWidth: "none",
                          display: "block",
                        }}
                        className="select-none"
                      />
                    )}
                  </>
                )}

                {/* Translated Document View */}
                {currentView === "translated" && (
                  <div className="relative">
                    {/* Blank document page */}
                    <div
                      className="bg-white border border-gray-200 shadow-sm"
                      style={{
                        width: pageWidth * scale,
                        height: pageHeight * scale,
                      }}
                    />

                    {/* Page number indicator */}
                    <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                      Page {currentPage} of {numPages}
                    </div>
                  </div>
                )}

                {/* Split Screen View */}
                {currentView === "split" && (
                  <div
                    className="flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300"
                    style={{
                      width: pageWidth * scale,
                      height: pageHeight * scale,
                    }}
                  >
                    <div className="text-center p-8">
                      <SplitSquareHorizontal className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-600 mb-2">
                        Split Screen View
                      </h3>
                      <p className="text-gray-500 max-w-md">
                        Split screen functionality will show original and
                        translated documents side by side. Coming soon!
                      </p>
                    </div>
                  </div>
                )}

                {/* Show interactive elements in both original and translated views */}
                {(currentView === "original" ||
                  currentView === "translated") && (
                  <>
                    {/* Deletion Rectangles */}
                    {getCurrentPageDeletionRectangles.map((rect) => (
                      <Rnd
                        key={rect.id}
                        position={{ x: rect.x * scale, y: rect.y * scale }}
                        size={{
                          width: rect.width * scale,
                          height: rect.height * scale,
                        }}
                        bounds="parent"
                        onDragStop={(e, d) => {
                          updateDeletionRectangle(rect.id, {
                            x: d.x / scale,
                            y: d.y / scale,
                          });
                        }}
                        onResizeStop={(e, direction, ref, delta, position) => {
                          updateDeletionRectangle(rect.id, {
                            x: position.x / scale,
                            y: position.y / scale,
                            width: parseInt(ref.style.width) / scale,
                            height: parseInt(ref.style.height) / scale,
                          });
                        }}
                        className="border-2 border-red-500 bg-white bg-opacity-90"
                        style={{ zIndex: 10, transform: "none" }}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-red-500 text-xs font-medium">
                            DELETE
                          </span>
                        </div>
                      </Rnd>
                    ))}

                    {/* Shapes */}
                    {getCurrentPageShapes.map((shape) => (
                      <MemoizedShape
                        key={shape.id}
                        shape={shape}
                        isSelected={selectedShapeId === shape.id}
                        isEditMode={isEditMode}
                        scale={scale}
                        onSelect={handleShapeSelect}
                        onUpdate={updateShapeCallback}
                        onDelete={deleteShapeCallback}
                      />
                    ))}

                    {/* Text Boxes */}
                    {getCurrentPageTextBoxes.map((textBox) => (
                      <MemoizedTextBox
                        key={textBox.id}
                        textBox={textBox}
                        isSelected={selectedFieldId === textBox.id}
                        isEditMode={isEditMode}
                        settingsPopupFor={settingsPopupFor}
                        scale={scale}
                        onSelect={handleTextBoxSelect}
                        onUpdate={updateTextBox}
                        onDelete={deleteTextBox}
                        onSettingsToggle={handleSettingsToggle}
                      />
                    ))}

                    {/* Shape Drawing Preview */}
                    {isDrawingInProgress && shapeDrawStart && shapeDrawEnd && (
                      <div
                        className="absolute border-2 border-dashed border-red-500 bg-red-100 bg-opacity-30 pointer-events-none"
                        style={{
                          left:
                            Math.min(shapeDrawStart.x, shapeDrawEnd.x) * scale,
                          top:
                            Math.min(shapeDrawStart.y, shapeDrawEnd.y) * scale,
                          width:
                            Math.abs(shapeDrawEnd.x - shapeDrawStart.x) * scale,
                          height:
                            Math.abs(shapeDrawEnd.y - shapeDrawStart.y) * scale,
                          borderRadius:
                            shapeDrawingMode === "circle" ? "50%" : "0",
                          zIndex: 50,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Text Selection Popup */}
        {textSelectionPopup && (
          <div
            className={`fixed bg-white shadow-lg rounded-md border border-gray-200 z-[1000] p-2 flex flex-col max-h-60 overflow-y-auto text-selection-popup max-w-xs ${
              textSelectionPopup!.popupPosition.position === "above"
                ? "bottom-auto"
                : "top-auto"
            }`}
            style={{
              top:
                textSelectionPopup!.popupPosition.position === "below"
                  ? `${textSelectionPopup!.popupPosition.top}px`
                  : undefined,
              bottom:
                textSelectionPopup!.popupPosition.position === "above"
                  ? `${
                      window.innerHeight - textSelectionPopup!.popupPosition.top
                    }px`
                  : undefined,
              left: `${textSelectionPopup!.popupPosition.left}px`,
              transform: "translateX(-50%)",
              maxWidth: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2 pb-2 border-b">
              <span className="text-sm font-medium">
                {textSelectionPopup!.texts.length} selected
              </span>
              <button
                onClick={() => setTextSelectionPopup(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                <X size={16} />
              </button>
            </div>

            {textSelectionPopup!.texts.map((sel, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm truncate flex-1">{sel.text}</span>
                <div className="flex space-x-1 ml-2">
                  <button
                    onClick={() => {
                      const newSelections = [...textSelectionPopup!.texts];
                      newSelections.splice(index, 1);

                      if (newSelections.length === 0) {
                        setTextSelectionPopup(null);
                      } else {
                        setTextSelectionPopup({
                          texts: newSelections,
                          popupPosition: textSelectionPopup!.popupPosition,
                        });
                      }
                    }}
                    className="p-1 text-gray-500 hover:text-red-500"
                    title="Remove from selection"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-2 space-y-2">
              <button
                onClick={() => {
                  textSelectionPopup!.texts.forEach((sel) => {
                    createTextFieldFromSelection(sel);
                  });
                  setTextSelectionPopup(null);
                  toast.success("Text fields created from selection");
                }}
                className="w-full p-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center justify-center text-sm"
              >
                <Type size={14} className="mr-1" />
                <span>Create Text Fields</span>
              </button>

              <button
                onClick={() => {
                  textSelectionPopup!.texts.forEach((sel) => {
                    createDeletionFromSelection(sel);
                  });
                  setTextSelectionPopup(null);
                  toast.success("Deletion areas created from selection");
                }}
                className="w-full p-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center justify-center text-sm"
              >
                <Trash2 size={14} className="mr-1" />
                <span>Delete Selected Text</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Text Boxes: {getCurrentPageTextBoxes.length}</span>
            <span>Shapes: {getCurrentPageShapes.length}</span>
            <span>
              Deletion Areas: {getCurrentPageDeletionRectangles.length}
            </span>
            {/* Current View Indicator */}
            <span className="flex items-center space-x-1">
              <span>View:</span>
              <span className="font-medium text-red-600 capitalize">
                {currentView === "original"
                  ? "Original"
                  : currentView === "translated"
                  ? "Translated"
                  : "Split Screen"}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {documentUrl && (
              <span>
                Page {currentPage} of {numPages} ({numPages - deletedPages.size}{" "}
                available)
              </span>
            )}
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setIsScaleChanging(true);
                  setTransformOrigin("center center");
                  setScale(Math.max(0.1, scale - 0.1));
                  setZoomMode("page");
                  resetScaleChanging();
                }}
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
                  value={Math.round(scale * 100)}
                  onChange={(e) => {
                    const newScale = parseInt(e.target.value) / 100;
                    setIsScaleChanging(true);
                    setTransformOrigin("center center");
                    setScale(newScale);
                    setZoomMode("page");
                    resetScaleChanging();
                  }}
                  className="zoom-slider w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  title="Zoom level"
                  style={
                    {
                      "--value": `${
                        ((Math.round(scale * 100) - 10) / (500 - 10)) * 100
                      }%`,
                    } as React.CSSProperties
                  }
                />
                <button
                  onClick={() => {
                    setIsScaleChanging(true);
                    setScale(1.0);
                    setZoomMode("page");
                    setTransformOrigin("center center");
                    resetScaleChanging();
                  }}
                  className="text-xs px-2 py-1 hover:bg-gray-100 rounded transition-colors min-w-[40px] text-center"
                  title="Reset zoom to 100% (Ctrl+0)"
                >
                  {Math.round(scale * 100)}%
                </button>
              </div>

              <button
                onClick={() => {
                  setIsScaleChanging(true);
                  setTransformOrigin("center center");
                  setScale(Math.min(5.0, scale + 0.1));
                  setZoomMode("page");
                  resetScaleChanging();
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom in (Ctrl++)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .text-selection-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
          z-index: 50 !important;
        }

        .text-selection-mode .react-pdf__Page__textContent span {
          cursor: pointer !important;
          color: rgba(0, 0, 0, 0.1) !important;
          background-color: rgba(59, 130, 246, 0.2) !important;
          transition: background-color 0.2s !important;
          pointer-events: auto !important;
          border-radius: 2px !important;
        }

        .text-selection-mode .react-pdf__Page__textContent span:hover {
          background-color: rgba(59, 130, 246, 0.4) !important;
          color: rgba(0, 0, 0, 0.3) !important;
        }

        /* Zoom cursor */
        .cursor-zoom-in {
          cursor: zoom-in !important;
        }

        /* Override other cursors when zoom mode is active */
        .cursor-zoom-in * {
          cursor: zoom-in !important;
        }

        /* Smooth zoom transitions */
        .zoom-transition {
          transition: transform 0.1s ease-out, transform-origin 0.05s ease-out;
        }

        /* Prevent flash during scale changes */
        .document-page {
          transition: width 0.05s ease-out, height 0.05s ease-out;
        }

        /* Smooth loading overlay */
        .document-page .loading-overlay {
          backdrop-filter: blur(1px);
          transition: opacity 0.1s ease-out;
        }

        /* Custom Word-like scrollbars */
        .document-viewer {
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 #f1f1f1;
        }

        .document-viewer::-webkit-scrollbar {
          width: 17px;
          height: 17px;
        }

        .document-viewer::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 0;
          border: 1px solid #e5e5e5;
        }

        .document-viewer::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 0;
          border: 1px solid #a8a8a8;
          background-clip: padding-box;
        }

        .document-viewer::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
          border-color: #909090;
        }

        .document-viewer::-webkit-scrollbar-thumb:active {
          background: #909090;
          border-color: #7a7a7a;
        }

        .document-viewer::-webkit-scrollbar-corner {
          background: #f1f1f1;
          border: 1px solid #e5e5e5;
        }

        /* Horizontal scrollbar specific styling */
        .document-viewer::-webkit-scrollbar:horizontal {
          height: 17px;
        }

        .document-viewer::-webkit-scrollbar-track:horizontal {
          background: #f1f1f1;
          border-top: 1px solid #e5e5e5;
          border-bottom: 1px solid #e5e5e5;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal {
          background: #c1c1c1;
          border-top: 1px solid #a8a8a8;
          border-bottom: 1px solid #a8a8a8;
          min-width: 30px;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal:hover {
          background: #a8a8a8;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal:active {
          background: #909090;
        }

        /* Document container styling for better visual feedback */
        .document-container {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          position: relative;
        }

        .document-container::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
              circle at 20% 20%,
              rgba(59, 130, 246, 0.05) 0%,
              transparent 50%
            ),
            radial-gradient(
              circle at 80% 80%,
              rgba(139, 92, 246, 0.05) 0%,
              transparent 50%
            );
          pointer-events: none;
          z-index: 1;
        }

        .document-wrapper {
          position: relative;
          z-index: 2;
        }

        /* Smooth scrolling enhancement */
        .document-viewer {
          scroll-behavior: smooth;
        }

        /* Page shadow enhancement */
        .document-page {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05);
          transition: box-shadow 0.2s ease;
        }

        .document-page:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        .rnd .react-resizable-handle-se {
          background: none !important;
          border: none !important;
          width: 12px !important;
          height: 12px !important;
          bottom: 0 !important;
          right: 0 !important;
        }

        .rnd .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 8px;
          height: 8px;
          background-image: linear-gradient(
              45deg,
              transparent 40%,
              #666 40%,
              #666 60%,
              transparent 60%
            ),
            linear-gradient(
              45deg,
              transparent 40%,
              #666 40%,
              #666 60%,
              transparent 60%
            );
          background-size: 4px 1px, 1px 4px;
          background-position: 2px 6px, 6px 2px;
          background-repeat: no-repeat;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .rnd:hover .react-resizable-handle-se::after {
          opacity: 1;
        }

        .rnd .react-resizable-handle:not(.react-resizable-handle-se) {
          display: none !important;
        }

        /* Floating toolbar styling */
        .floating-toolbar {
          backdrop-filter: blur(10px);
        }

        .floating-toolbar .bg-white {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
        }

        .floating-toolbar button {
          position: relative;
          overflow: hidden;
        }

        .floating-toolbar button::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 50%;
          transition: all 0.3s ease;
          transform: translate(-50%, -50%);
        }

        .floating-toolbar button:hover::before {
          width: 100%;
          height: 100%;
        }

        /* Google Docs-like zoom slider */
        .zoom-slider {
          -webkit-appearance: none;
          appearance: none;
          background: #e5e7eb;
          outline: none;
          border-radius: 2px;
          height: 3px;
        }

        .zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          background: #4338ca;
          transform: scale(1.1);
        }

        .zoom-slider::-webkit-slider-thumb:active {
          background: #3730a3;
          transform: scale(0.95);
        }

        .zoom-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .zoom-slider::-moz-range-thumb:hover {
          background: #4338ca;
          transform: scale(1.1);
        }

        .zoom-slider::-moz-range-thumb:active {
          background: #3730a3;
          transform: scale(0.95);
        }

        .zoom-slider::-moz-range-track {
          background: #e5e7eb;
          height: 3px;
          border-radius: 2px;
        }

        /* Zoom slider track fill effect */
        .zoom-slider {
          background: linear-gradient(
            to right,
            #4f46e5 0%,
            #4f46e5 var(--value, 20%),
            #e5e7eb var(--value, 20%),
            #e5e7eb 100%
          );
        }
      `}</style>
    </div>
  );
};

export default PDFEditor;
