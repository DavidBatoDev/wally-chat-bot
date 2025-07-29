"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Type,
  Palette,
  Text,
  TextCursor,
  Square,
  MoreHorizontal,
  Move3D,
  Layers,
  SendToBack,
  BringToFront,
  ArrowUp,
  ArrowDown,
  Eraser,
} from "lucide-react";
import { useTextFormat } from "./ElementFormatContext";
import {
  TextField,
  Shape,
  Image,
} from "../../app/pdf-editor/types/pdf-editor.types";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import "../../app/pdf-editor/styles/pdf-editor.css";

const fontFamilies = [
  "Arial",
  "Times New Roman",
  "Helvetica",
  "Georgia",
  "Courier New",
  "Verdana",
  "Roboto",
  "Open Sans",
];

// Common font sizes for dropdown (2px to 72px)
const fontSizes = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  24, 26, 28, 30, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72,
];
const borderWidths = [0, 1, 2, 3, 4, 5];
const opacityValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

export const ElementFormatDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    currentFormat,
    onFormatChange,
    selectedElementId,
    selectedElementType,
    showPaddingPopup,
    setShowPaddingPopup,
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    isElementAtFront,
    isElementAtBack,
  } = useTextFormat();

  const [showSpacingTooltip, setShowSpacingTooltip] = useState(false);
  const [showCharSpacingTooltip, setShowCharSpacingTooltip] = useState(false);
  const [showAlignmentPopup, setShowAlignmentPopup] = useState(false);
  const [showBorderRadiusPopup, setShowBorderRadiusPopup] = useState(false);
  const [showZIndexPopup, setShowZIndexPopup] = useState(false);
  const [showTextStylePopup, setShowTextStylePopup] = useState(false);
  const [showFontSizePopup, setShowFontSizePopup] = useState(false);
  const [borderRadiusMode, setBorderRadiusMode] = useState<"all" | "specific">(
    "all"
  );

  // Refs for positioning popups
  const spacingButtonRef = useRef<HTMLButtonElement>(null);
  const charSpacingButtonRef = useRef<HTMLButtonElement>(null);
  const paddingButtonRef = useRef<HTMLButtonElement>(null);
  const borderRadiusButtonRef = useRef<HTMLButtonElement>(null);
  const zIndexButtonRef = useRef<HTMLButtonElement>(null);
  const textStyleButtonRef = useRef<HTMLButtonElement>(null);
  const fontSizeInputRef = useRef<HTMLInputElement>(null);

  // Refs for popup containers
  const spacingPopupRef = useRef<HTMLDivElement>(null);
  const charSpacingPopupRef = useRef<HTMLDivElement>(null);
  const paddingPopupRef = useRef<HTMLDivElement>(null);
  const borderRadiusPopupRef = useRef<HTMLDivElement>(null);
  const zIndexPopupRef = useRef<HTMLDivElement>(null);
  const textStylePopupRef = useRef<HTMLDivElement>(null);
  const fontSizePopupRef = useRef<HTMLDivElement>(null);
  const alignmentButtonRef = useRef<HTMLButtonElement>(null);
  const alignmentPopupRef = useRef<HTMLDivElement>(null);

  // Add slider styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #4f46e5;
        cursor: pointer;
        border: 2px solid #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
      }
      .slider::-webkit-slider-thumb:hover {
        background: #4338ca;
        transform: scale(1.1);
      }
      .slider::-webkit-slider-thumb:active {
        background: #3730a3;
        transform: scale(0.95);
      }
      .slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #4f46e5;
        cursor: pointer;
        border: 2px solid #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
      }
      .slider::-moz-range-thumb:hover {
        background: #4338ca;
        transform: scale(1.1);
      }
      .slider::-moz-range-thumb:active {
        background: #3730a3;
        transform: scale(0.95);
      }
      .slider::-moz-range-track {
        background: #e5e7eb;
        height: 2px;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showSpacingTooltip &&
        spacingButtonRef.current &&
        spacingPopupRef.current &&
        !spacingButtonRef.current.contains(target) &&
        !spacingPopupRef.current.contains(target)
      ) {
        setShowSpacingTooltip(false);
      }

      if (
        showCharSpacingTooltip &&
        charSpacingButtonRef.current &&
        charSpacingPopupRef.current &&
        !charSpacingButtonRef.current.contains(target) &&
        !charSpacingPopupRef.current.contains(target)
      ) {
        setShowCharSpacingTooltip(false);
      }

      if (
        showPaddingPopup &&
        paddingButtonRef.current &&
        paddingPopupRef.current &&
        !paddingButtonRef.current.contains(target) &&
        !paddingPopupRef.current.contains(target)
      ) {
        setShowPaddingPopup(false);
      }

      if (
        showBorderRadiusPopup &&
        borderRadiusButtonRef.current &&
        borderRadiusPopupRef.current &&
        !borderRadiusButtonRef.current.contains(target) &&
        !borderRadiusPopupRef.current.contains(target)
      ) {
        setShowBorderRadiusPopup(false);
      }

      if (
        showAlignmentPopup &&
        alignmentButtonRef.current &&
        alignmentPopupRef.current &&
        !alignmentButtonRef.current.contains(target) &&
        !alignmentPopupRef.current.contains(target)
      ) {
        setShowAlignmentPopup(false);
      }

      if (
        showZIndexPopup &&
        zIndexButtonRef.current &&
        zIndexPopupRef.current &&
        !zIndexButtonRef.current.contains(target) &&
        !zIndexPopupRef.current.contains(target)
      ) {
        setShowZIndexPopup(false);
      }

      if (
        showTextStylePopup &&
        textStyleButtonRef.current &&
        textStylePopupRef.current &&
        !textStyleButtonRef.current.contains(target) &&
        !textStylePopupRef.current.contains(target)
      ) {
        setShowTextStylePopup(false);
      }

      if (
        showFontSizePopup &&
        fontSizeInputRef.current &&
        fontSizePopupRef.current &&
        !fontSizeInputRef.current.contains(target) &&
        !fontSizePopupRef.current.contains(target)
      ) {
        setShowFontSizePopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showSpacingTooltip,
    showCharSpacingTooltip,
    showPaddingPopup,
    showBorderRadiusPopup,
    showAlignmentPopup,
    showZIndexPopup,
    showTextStylePopup,
    showFontSizePopup,
  ]);

  // Update borderRadiusMode when currentFormat changes
  useEffect(() => {
    if (
      currentFormat &&
      selectedElementType === "textbox" &&
      isTextField(currentFormat)
    ) {
      const isAllEqual =
        (currentFormat.borderTopLeftRadius || 0) ===
          (currentFormat.borderTopRightRadius || 0) &&
        (currentFormat.borderTopLeftRadius || 0) ===
          (currentFormat.borderBottomLeftRadius || 0) &&
        (currentFormat.borderTopLeftRadius || 0) ===
          (currentFormat.borderBottomRightRadius || 0);
      setBorderRadiusMode(isAllEqual ? "all" : "specific");
    }
  }, [currentFormat, selectedElementType]);

  // Add type guard functions
  const isTextField = (
    format: TextField | Shape | Image
  ): format is TextField => {
    return "fontFamily" in format;
  };

  const isShape = (format: TextField | Shape | Image): format is Shape => {
    return "type" in format && format.type !== undefined;
  };

  const isImage = (format: TextField | Shape | Image): format is Image => {
    return "src" in format;
  };

  // Helper function to check if padding would cause text clipping
  const checkPaddingValidation = (
    textBox: TextField,
    newPadding: { top?: number; right?: number; bottom?: number; left?: number }
  ): {
    isValid: boolean;
    maxPadding: { top: number; right: number; bottom: number; left: number };
  } => {
    if (!isTextField(textBox)) {
      return {
        isValid: true,
        maxPadding: { top: 50, right: 50, bottom: 50, left: 50 },
      };
    }

    // Import the measurement functions dynamically to avoid circular dependencies
    const {
      measureWrappedTextHeight,
      measureText,
    } = require("@/app/pdf-editor/utils/measurements");

    // Calculate the actual text height using the current padding
    const currentPadding = {
      top: textBox.paddingTop || 0,
      right: textBox.paddingRight || 0,
      bottom: textBox.paddingBottom || 0,
      left: textBox.paddingLeft || 0,
    };

    // Calculate available space for text (accounting for current padding)
    const availableWidth =
      textBox.width - currentPadding.left - currentPadding.right;
    const availableHeight =
      textBox.height - currentPadding.top - currentPadding.bottom;

    // Calculate the actual text dimensions
    const textHeight = measureWrappedTextHeight(
      textBox.value,
      textBox.fontSize,
      textBox.fontFamily,
      availableWidth,
      currentPadding
    );

    // Get accurate text width using measureText without any constraints
    const { width: textWidth } = measureText(
      textBox.value,
      textBox.fontSize,
      textBox.fontFamily,
      textBox.letterSpacing || 0
      // Don't pass maxWidth or padding to get the actual text width
    );

    // Calculate maximum allowed padding for each side
    // Top/Bottom padding is based on text height
    // Left/Right padding is based on available space after accounting for text width
    // For left/right, we need to ensure that left + right padding doesn't exceed available space
    const availableWidthForPadding = Math.max(0, textBox.width - textWidth);
    const maxPadding = {
      top: Math.max(0, Math.floor((textBox.height - textHeight) / 2)),
      right: Math.floor(availableWidthForPadding / 2), // Allow up to half the available space for right padding
      bottom: Math.max(0, Math.floor((textBox.height - textHeight) / 2)),
      left: Math.floor(availableWidthForPadding / 2), // Allow up to half the available space for left padding
    };

    // Ensure we don't exceed reasonable limits (50px max)
    const maxReasonablePadding = 50;
    const finalMaxPadding = {
      top: Math.min(maxPadding.top, maxReasonablePadding),
      right: Math.min(maxPadding.right, maxReasonablePadding),
      bottom: Math.min(maxPadding.bottom, maxReasonablePadding),
      left: Math.min(maxPadding.left, maxReasonablePadding),
    };

    // Check if the new padding values would cause clipping
    const proposedPadding = {
      top: newPadding.top !== undefined ? newPadding.top : currentPadding.top,
      right:
        newPadding.right !== undefined
          ? newPadding.right
          : currentPadding.right,
      bottom:
        newPadding.bottom !== undefined
          ? newPadding.bottom
          : currentPadding.bottom,
      left:
        newPadding.left !== undefined ? newPadding.left : currentPadding.left,
    };

    // Check if padding would cause clipping
    const isValid =
      proposedPadding.top <= finalMaxPadding.top &&
      proposedPadding.right <= finalMaxPadding.right &&
      proposedPadding.bottom <= finalMaxPadding.bottom &&
      proposedPadding.left <= finalMaxPadding.left;

    return { isValid, maxPadding: finalMaxPadding };
  };

  // Helper function to check if current padding would cause text clipping
  const checkCurrentPaddingClipping = (textBox: TextField): boolean => {
    // Padding clipping check is now disabled
    return false;
  };

  // Helper to check if any padding is nonzero
  const hasAnyPadding = (format: any) => {
    if (!format) return false;
    return (
      (format.paddingTop || 0) > 0 ||
      (format.paddingRight || 0) > 0 ||
      (format.paddingBottom || 0) > 0 ||
      (format.paddingLeft || 0) > 0
    );
  };

  // Don't render if drawer is not open or no format is available
  // Allow multi-selection (selectedElementId can be null for multi-selection)
  if (!isDrawerOpen || !currentFormat) {
    return null;
  }

  // Add additional safety checks for required properties based on element type
  const safeFormat =
    selectedElementType === "textbox" && isTextField(currentFormat)
      ? {
          // Text box properties
          fontFamily: currentFormat.fontFamily || "Arial",
          fontSize: currentFormat.fontSize || 12,
          bold: currentFormat.bold || false,
          italic: currentFormat.italic || false,
          underline: currentFormat.underline || false,
          textAlign: currentFormat.textAlign || "left",
          color: currentFormat.color || "#000000",
          borderColor: currentFormat.borderColor || "#000000",
          borderWidth: currentFormat.borderWidth || 0,
          lineHeight: currentFormat.lineHeight || 1.1,
          letterSpacing: currentFormat.letterSpacing || 0,
          paddingTop: currentFormat.paddingTop || 0,
          paddingRight: currentFormat.paddingRight || 0,
          paddingBottom: currentFormat.paddingBottom || 0,
          paddingLeft: currentFormat.paddingLeft || 0,
          borderRadius: currentFormat.borderRadius || 0,
          borderTopLeftRadius: currentFormat.borderTopLeftRadius || 0,
          borderTopRightRadius: currentFormat.borderTopRightRadius || 0,
          borderBottomLeftRadius: currentFormat.borderBottomLeftRadius || 0,
          borderBottomRightRadius: currentFormat.borderBottomRightRadius || 0,
          textOpacity:
            currentFormat.textOpacity !== undefined
              ? currentFormat.textOpacity
              : 1,
          backgroundOpacity:
            currentFormat.backgroundOpacity !== undefined
              ? currentFormat.backgroundOpacity
              : 1,
          backgroundColor: currentFormat.backgroundColor || "transparent",
        }
      : selectedElementType === "shape" && isShape(currentFormat)
      ? {
          // Shape properties
          type: currentFormat.type || "rectangle",
          borderColor: currentFormat.borderColor || "#000000",
          borderWidth: currentFormat.borderWidth || 1,
          fillColor: currentFormat.fillColor || "#ffffff",
          fillOpacity: currentFormat.fillOpacity || 0.5,
          rotation: currentFormat.rotation || 0,
          borderRadius: currentFormat.borderRadius || 0, // Add border radius support
        }
      : selectedElementType === "image" && isImage(currentFormat)
      ? {
          // Image properties
          opacity: currentFormat.opacity || 1,
          borderColor: currentFormat.borderColor || "#000000",
          borderWidth: currentFormat.borderWidth || 0,
          borderRadius: currentFormat.borderRadius || 0,
          rotation: currentFormat.rotation || 0,
        }
      : null;

  // Don't render if we couldn't determine the format type
  if (!safeFormat) {
    return null;
  }

  // Compute if all paddings are equal
  const allPaddings = [
    safeFormat.paddingTop || 0,
    safeFormat.paddingRight || 0,
    safeFormat.paddingBottom || 0,
    safeFormat.paddingLeft || 0,
  ];
  const allEqual = allPaddings.every((v) => v === allPaddings[0]);
  const unifiedPaddingValue = allEqual ? allPaddings[0] : "--";

  return (
    <div className="z-[99999909999] absolute w-full flex justify-center bg-transparent">
      <div className="element-format-drawer z-[99999909999] mt-2 overflow-visible bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-3 flex flex-row items-center gap-4 min-h-[60px] w-max rounded-full relative">
        {/* Multi-selection indicator */}
        {!selectedElementId &&
          currentFormat &&
          "isMultiSelection" in currentFormat &&
          (currentFormat as any).isMultiSelection &&
          "selectedCount" in currentFormat && (
            <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-md">
              {(currentFormat as any).selectedCount || 0} selected
            </div>
          )}
        {selectedElementType === "textbox" ? (
          <>
            {/* Text Content Input - Only show for single selection */}
            {selectedElementId && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={isTextField(currentFormat) ? currentFormat.value : ""}
                  onChange={(e) => onFormatChange({ value: e.target.value })}
                  placeholder="Enter text..."
                  disabled
                  className="w-32 sm:w-48 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200"
                />
              </div>
            )}

            {/* Font Family */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200">
                <select
                  className="w-20 sm:w-32 bg-transparent outline-none p-2 text-sm rounded-lg"
                  value={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.fontFamily
                      ? ""
                      : safeFormat.fontFamily
                  }
                  onChange={(e) =>
                    onFormatChange({ fontFamily: e.target.value })
                  }
                >
                  <option value="">
                    {!selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.fontFamily
                      ? "--"
                      : "Select font"}
                  </option>
                  {fontFamilies.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <input
                  ref={fontSizeInputRef}
                  type="number"
                  min="0.1"
                  max="500"
                  step="0.1"
                  value={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.fontSize
                      ? ""
                      : safeFormat.fontSize
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0.1 && value <= 500) {
                      onFormatChange({ fontSize: value });
                    }
                  }}
                  onFocus={() => setShowFontSizePopup(true)}
                  className="w-16 sm:w-20 bg-transparent outline-none p-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.fontSize
                      ? "--"
                      : "12"
                  }
                />
              </div>
            </div>

            {/* Text Style Buttons */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={textStyleButtonRef}
                  className={`p-2 flex items-center gap-2 rounded-lg transition-all duration-200 ${
                    showTextStylePopup
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowTextStylePopup(!showTextStylePopup)}
                  title={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    (!(currentFormat as any).consistentProperties.bold ||
                      !(currentFormat as any).consistentProperties.italic ||
                      !(currentFormat as any).consistentProperties.underline)
                      ? "Text Style (Mixed)"
                      : "Text Style"
                  }
                >
                  <Type size={16} /> v
                </button>
              </div>
            </div>

            {/* Spacing Controls - Hidden on small screens */}
            <div className="hidden lg:flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={spacingButtonRef}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all duration-200"
                  onClick={() => setShowSpacingTooltip(!showSpacingTooltip)}
                  title="Line Spacing"
                >
                  <Text size={16} />
                </button>
              </div>
              <div className="relative">
                <button
                  ref={charSpacingButtonRef}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all duration-200"
                  onClick={() =>
                    setShowCharSpacingTooltip(!showCharSpacingTooltip)
                  }
                  title="Character Spacing"
                >
                  <TextCursor size={16} />
                </button>
              </div>
            </div>

            {/* Text Alignment - Popup Menu */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={alignmentButtonRef}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    showAlignmentPopup
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowAlignmentPopup(!showAlignmentPopup)}
                  title={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.textAlign
                      ? "Text Alignment (Mixed)"
                      : "Text Alignment"
                  }
                >
                  {safeFormat.textAlign === "left" && <AlignLeft size={16} />}
                  {safeFormat.textAlign === "center" && (
                    <AlignCenter size={16} />
                  )}
                  {safeFormat.textAlign === "right" && <AlignRight size={16} />}
                  {safeFormat.textAlign === "justify" && (
                    <AlignJustify size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Colors Popup Trigger */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                  title="Text & Background Colors"
                >
                  <Palette size={18} />
                  <span className="hidden sm:inline text-xs">Colors</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="flex flex-col gap-4">
                  {/* Text Color Picker with Transparent and Opacity */}
                  <div className="flex flex-col items-start gap-2">
                    <label className="text-xs font-medium text-gray-700 mb-1">
                      Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          !selectedElementId &&
                          currentFormat &&
                          "consistentProperties" in currentFormat &&
                          !(currentFormat as any).consistentProperties.color
                            ? "#000000"
                            : safeFormat.color
                        }
                        onChange={(e) =>
                          onFormatChange({ color: e.target.value })
                        }
                        className="w-7 h-7 rounded cursor-pointer"
                        title="Text Color"
                      />
                      <button
                        type="button"
                        className="ml-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 border border-gray-300"
                        onClick={() => onFormatChange({ color: "transparent" })}
                      >
                        Transparent
                      </button>
                      <span className="text-xs text-gray-500 ml-2">
                        Opacity
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={
                            safeFormat.textOpacity !== undefined
                              ? safeFormat.textOpacity
                              : 1
                          }
                          onChange={(e) => {
                            onFormatChange({
                              textOpacity: parseFloat(e.target.value),
                            });
                          }}
                          className="h-1 w-14 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={
                            safeFormat.textOpacity !== undefined
                              ? safeFormat.textOpacity
                              : 1
                          }
                          onChange={(e) => {
                            onFormatChange({
                              textOpacity: parseFloat(e.target.value),
                            });
                          }}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Background Color Picker with Transparent and Opacity */}
                  <div className="flex flex-col items-start gap-2">
                    <label className="text-xs font-medium text-gray-700 mb-1">
                      Background Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          !selectedElementId &&
                          currentFormat &&
                          "consistentProperties" in currentFormat &&
                          !(currentFormat as any).consistentProperties
                            .backgroundColor
                            ? "#ffffff"
                            : (isTextField(safeFormat as any) &&
                                (safeFormat as TextField).backgroundColor) ||
                              "#ffffff"
                        }
                        onChange={(e) =>
                          onFormatChange({ backgroundColor: e.target.value })
                        }
                        className="w-7 h-7 rounded cursor-pointer"
                        title="Background Color"
                      />
                      <button
                        type="button"
                        className="ml-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 border border-gray-300"
                        onClick={() =>
                          onFormatChange({ backgroundColor: "transparent" })
                        }
                      >
                        Transparent
                      </button>
                      <span className="text-xs text-gray-500 ml-2">
                        Opacity
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={
                            safeFormat.backgroundOpacity !== undefined
                              ? safeFormat.backgroundOpacity
                              : 1
                          }
                          onChange={(e) => {
                            onFormatChange({
                              backgroundOpacity: parseFloat(e.target.value),
                            });
                          }}
                          className="h-1 w-14 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={
                            safeFormat.backgroundOpacity !== undefined
                              ? safeFormat.backgroundOpacity
                              : 1
                          }
                          onChange={(e) => {
                            onFormatChange({
                              backgroundOpacity: parseFloat(e.target.value),
                            });
                          }}
                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Border Color & Width Popup Trigger */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                  title="Border Color & Width"
                >
                  <Square size={18} />
                  <span className="hidden sm:inline text-xs">Border</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="flex flex-col gap-4">
                  {/* Border Color Picker */}
                  <div className="flex flex-col items-start gap-2">
                    <label className="text-xs font-medium text-gray-700 mb-1">
                      Border Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          !selectedElementId &&
                          currentFormat &&
                          "consistentProperties" in currentFormat &&
                          !(currentFormat as any).consistentProperties
                            .borderColor
                            ? "#000000"
                            : safeFormat.borderColor
                        }
                        onChange={(e) =>
                          onFormatChange({ borderColor: e.target.value })
                        }
                        className="w-7 h-7 rounded cursor-pointer"
                        title="Border Color"
                      />
                    </div>
                  </div>
                  {/* Border Width Select */}
                  <div className="flex flex-col items-start gap-2">
                    <label className="text-xs font-medium text-gray-700 mb-1">
                      Border Width
                    </label>
                    <select
                      className="w-24 bg-transparent outline-none p-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 hover:bg-gray-50"
                      value={
                        !selectedElementId &&
                        currentFormat &&
                        "consistentProperties" in currentFormat &&
                        !(currentFormat as any).consistentProperties.borderWidth
                          ? ""
                          : safeFormat.borderWidth
                      }
                      onChange={(e) =>
                        onFormatChange({ borderWidth: Number(e.target.value) })
                      }
                    >
                      <option value="">
                        {!selectedElementId &&
                        currentFormat &&
                        "consistentProperties" in currentFormat &&
                        !(currentFormat as any).consistentProperties.borderWidth
                          ? "--"
                          : "Select width"}
                      </option>
                      {borderWidths.map((width) => (
                        <option key={width} value={width}>
                          {width}px
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Border Radius Control - Hidden on small screens */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <button
                  ref={borderRadiusButtonRef}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all duration-200 flex items-center gap-1"
                  onClick={() =>
                    setShowBorderRadiusPopup(!showBorderRadiusPopup)
                  }
                  title={
                    !selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.borderRadius
                      ? "Border Radius (Mixed)"
                      : "Border Radius"
                  }
                >
                  <Square size={16} className="rounded" />
                  <span className="text-xs">
                    {!selectedElementId &&
                    currentFormat &&
                    "consistentProperties" in currentFormat &&
                    !(currentFormat as any).consistentProperties.borderRadius
                      ? "--"
                      : `${safeFormat.borderRadius}px`}
                  </span>
                </button>
              </div>
            </div>

            {/* Padding Control - Icon only */}
            <div className="hidden xl:flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={paddingButtonRef}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    showPaddingPopup
                      ? "bg-blue-500 text-white shadow-md"
                      : isTextField(currentFormat) &&
                        checkCurrentPaddingClipping(currentFormat) &&
                        hasAnyPadding(currentFormat)
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowPaddingPopup(!showPaddingPopup)}
                  title={
                    isTextField(currentFormat) &&
                    checkCurrentPaddingClipping(currentFormat) &&
                    hasAnyPadding(currentFormat)
                      ? "Padding - Text may be clipped. Reduce padding to ensure text fits."
                      : "Padding"
                  }
                >
                  <Move3D size={16} />
                  {/* Warning indicator */}
                  {isTextField(currentFormat) &&
                    checkCurrentPaddingClipping(currentFormat) &&
                    hasAnyPadding(currentFormat) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                    )}
                </button>
              </div>
            </div>

            {/* Z-Index Controls */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={zIndexButtonRef}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    showZIndexPopup
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowZIndexPopup(!showZIndexPopup)}
                  title="Layer Order"
                >
                  <Layers size={16} />
                </button>
              </div>
            </div>
          </>
        ) : selectedElementType === "shape" ? (
          <>
            {/* Fill Color */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <Palette size={14} />
                <input
                  type="color"
                  value={safeFormat.fillColor}
                  onChange={(e) =>
                    onFormatChange({ fillColor: e.target.value })
                  }
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer"
                  title="Fill Color"
                />
              </div>
            </div>

            {/* Fill Opacity */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                className="w-20 bg-transparent outline-none p-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 hover:bg-gray-50"
                value={safeFormat.fillOpacity}
                onChange={(e) =>
                  onFormatChange({ fillOpacity: parseFloat(e.target.value) })
                }
              >
                {opacityValues.map((opacity) => (
                  <option key={opacity} value={opacity}>
                    {Math.round(opacity * 100)}%
                  </option>
                ))}
              </select>
            </div>

            {/* Border Color */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <Square size={14} />
                <input
                  type="color"
                  value={safeFormat.borderColor}
                  onChange={(e) =>
                    onFormatChange({ borderColor: e.target.value })
                  }
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer"
                  title="Border Color"
                />
              </div>
            </div>

            {/* Border Width */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                className="w-16 sm:w-20 bg-transparent outline-none p-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 hover:bg-gray-50"
                value={safeFormat.borderWidth}
                onChange={(e) =>
                  onFormatChange({ borderWidth: Number(e.target.value) })
                }
              >
                {borderWidths.map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </div>

            {/* Border Radius Control - Only show for rectangles */}
            {safeFormat.type === "rectangle" && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                  <div className="text-xs text-gray-600">Radius</div>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={safeFormat.borderRadius || 0}
                    onChange={(e) =>
                      onFormatChange({ borderRadius: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
              </div>
            )}

            {/* Z-Index Controls for Shapes */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={zIndexButtonRef}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    showZIndexPopup
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowZIndexPopup(!showZIndexPopup)}
                  title="Layer Order"
                >
                  <Layers size={16} />
                </button>
              </div>
            </div>
          </>
        ) : selectedElementType === "image" ? (
          <>
            {/* Image Opacity */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <div className="text-xs text-gray-600">Opacity</div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={safeFormat.opacity}
                  onChange={(e) =>
                    onFormatChange({ opacity: parseFloat(e.target.value) })
                  }
                  className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={safeFormat.opacity}
                  onChange={(e) =>
                    onFormatChange({ opacity: parseFloat(e.target.value) })
                  }
                  className="w-12 px-1 py-1 text-xs border border-gray-300 rounded text-center"
                />
              </div>
            </div>

            {/* Border Color */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <Square size={14} />
                <input
                  type="color"
                  value={safeFormat.borderColor}
                  onChange={(e) =>
                    onFormatChange({ borderColor: e.target.value })
                  }
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer"
                  title="Border Color"
                />
              </div>
            </div>

            {/* Border Width */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                className="w-16 sm:w-20 bg-transparent outline-none p-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 hover:bg-gray-50"
                value={safeFormat.borderWidth}
                onChange={(e) =>
                  onFormatChange({ borderWidth: Number(e.target.value) })
                }
              >
                {borderWidths.map((width) => (
                  <option key={width} value={width}>
                    {width}px
                  </option>
                ))}
              </select>
            </div>

            {/* Border Radius */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <div className="text-xs text-gray-600">Radius</div>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={safeFormat.borderRadius || 0}
                  onChange={(e) =>
                    onFormatChange({ borderRadius: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                />
                <span className="text-xs text-gray-500">px</span>
              </div>
            </div>

            {/* Rotation Control */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
                <div className="text-xs text-gray-600">Rotate</div>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={safeFormat.rotation || 0}
                  onChange={(e) =>
                    onFormatChange({ rotation: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                />
                <span className="text-xs text-gray-500">°</span>
              </div>
            </div>

            {/* Aspect Ratio Button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all duration-200 flex items-center gap-1"
                onClick={() => onFormatChange({ resetAspectRatio: true })}
                title="Reset to Original Aspect Ratio"
              >
                <div className="w-4 h-4 border border-gray-600 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-600 rounded-sm"></div>
                </div>
                <span className="text-xs">Fit Ratio</span>
              </button>
            </div>

            {/* Z-Index Controls for Images */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
              <div className="relative">
                <button
                  ref={zIndexButtonRef}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    showZIndexPopup
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setShowZIndexPopup(!showZIndexPopup)}
                  title="Layer Order"
                >
                  <Layers size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Line Spacing Popup - Outside drawer */}
      {showSpacingTooltip && (
        <div
          ref={spacingPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-4 min-w-[250px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: spacingButtonRef.current
              ? spacingButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: spacingButtonRef.current
              ? spacingButtonRef.current.getBoundingClientRect().left - 100
              : 0,
          }}
        >
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              Line Spacing
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={safeFormat.lineHeight}
                onChange={(e) =>
                  onFormatChange({ lineHeight: Number(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">1.0</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="3"
                    step="0.1"
                    value={safeFormat.lineHeight}
                    onChange={(e) =>
                      onFormatChange({ lineHeight: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                  />
                </div>
                <span className="text-xs text-gray-500">3.0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Character Spacing Popup - Outside drawer */}
      {showCharSpacingTooltip && (
        <div
          ref={charSpacingPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-4 min-w-[250px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: charSpacingButtonRef.current
              ? charSpacingButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: charSpacingButtonRef.current
              ? charSpacingButtonRef.current.getBoundingClientRect().left - 100
              : 0,
          }}
        >
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              Character Spacing
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={safeFormat.letterSpacing}
                onChange={(e) =>
                  onFormatChange({ letterSpacing: Number(e.target.value) })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">0px</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={safeFormat.letterSpacing}
                    onChange={(e) =>
                      onFormatChange({ letterSpacing: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <span className="text-xs text-gray-500">10px</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Padding Popup - WordPress style */}
      {showPaddingPopup && (
        <div
          ref={paddingPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-4 min-w-[30px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: paddingButtonRef.current
              ? paddingButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: paddingButtonRef.current
              ? paddingButtonRef.current.getBoundingClientRect().left - 120
              : 0,
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Padding</div>
              <button
                type="button"
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-red-500 transition-all duration-150"
                title="Clear Paddings"
                onClick={() =>
                  onFormatChange({
                    paddingTop: 0,
                    paddingRight: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                  })
                }
              >
                <Eraser size={16} />
              </button>
            </div>
            {/* Warning if current padding would cause clipping */}
            {isTextField(currentFormat) &&
              checkCurrentPaddingClipping(currentFormat) &&
              hasAnyPadding(currentFormat) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs text-red-700">
                      Text may be clipped. Reduce padding to ensure text fits.
                    </span>
                  </div>
                </div>
              )}
            {/* Padding controls */}
            <div className="flex flex-col items-center gap-2">
              <div className="grid grid-cols-3 gap-1">
                {/* Top row: Top padding */}
                <input
                  type="number"
                  min="0"
                  max={1000}
                  step={0.1}
                  value={safeFormat.paddingTop || 0}
                  onChange={(e) =>
                    onFormatChange({ paddingTop: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border rounded-lg text-center border-gray-300 bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 shadow-sm hover:bg-blue-50"
                  placeholder="Top"
                  title="Top Padding"
                  style={{ gridColumn: 2, gridRow: 1 }}
                />
                <div style={{ gridColumn: 1, gridRow: 1 }}></div>
                <div style={{ gridColumn: 3, gridRow: 1 }}></div>
                {/* Middle row: Left, Center unified padding input, Right */}
                <input
                  type="number"
                  min="0"
                  max={1000}
                  step={0.1}
                  value={safeFormat.paddingLeft || 0}
                  onChange={(e) =>
                    onFormatChange({ paddingLeft: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border rounded-lg text-center border-gray-300 bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 shadow-sm hover:bg-blue-50"
                  placeholder="Left"
                  title="Left Padding"
                  style={{ gridColumn: 1, gridRow: 2 }}
                />
                {/* Unified padding input in the center */}
                <input
                  type="number"
                  min="0"
                  max={1000}
                  step={0.1}
                  value={unifiedPaddingValue}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    onFormatChange({
                      paddingTop: value,
                      paddingRight: value,
                      paddingBottom: value,
                      paddingLeft: value,
                    });
                  }}
                  className="w-16 px-2 py-1 text-sm border rounded-lg text-center border-gray-300 bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 shadow-sm hover:bg-blue-50"
                  placeholder="All"
                  title="Set all paddings"
                  style={{ gridColumn: 2, gridRow: 2 }}
                />
                <input
                  type="number"
                  min="0"
                  max={1000}
                  step={0.1}
                  value={safeFormat.paddingRight || 0}
                  onChange={(e) =>
                    onFormatChange({ paddingRight: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border rounded-lg text-center border-gray-300 bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 shadow-sm hover:bg-blue-50"
                  placeholder="Right"
                  title="Right Padding"
                  style={{ gridColumn: 3, gridRow: 2 }}
                />
                {/* Bottom row: Bottom padding */}
                <div style={{ gridColumn: 1, gridRow: 3 }}></div>
                <input
                  type="number"
                  min="0"
                  max={1000}
                  step={0.1}
                  value={safeFormat.paddingBottom || 0}
                  onChange={(e) =>
                    onFormatChange({ paddingBottom: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 text-sm border rounded-lg text-center border-gray-300 bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-150 shadow-sm hover:bg-blue-50"
                  placeholder="Bottom"
                  title="Bottom Padding"
                  style={{ gridColumn: 2, gridRow: 3 }}
                />
                <div style={{ gridColumn: 3, gridRow: 3 }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Border Radius Popup */}
      {showBorderRadiusPopup && (
        <div
          ref={borderRadiusPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-4 min-w-[250px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: borderRadiusButtonRef.current
              ? borderRadiusButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: borderRadiusButtonRef.current
              ? borderRadiusButtonRef.current.getBoundingClientRect().left - 100
              : 0,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button
                className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                  borderRadiusMode === "all"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  setBorderRadiusMode("all");
                  // If switching to all, set all corners to the current borderRadius
                  onFormatChange({
                    borderTopLeftRadius: safeFormat.borderRadius,
                    borderTopRightRadius: safeFormat.borderRadius,
                    borderBottomLeftRadius: safeFormat.borderRadius,
                    borderBottomRightRadius: safeFormat.borderRadius,
                  });
                }}
              >
                All Sides
              </button>
              <button
                className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                  borderRadiusMode === "specific"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => setBorderRadiusMode("specific")}
              >
                Specific Sides
              </button>
            </div>
            {borderRadiusMode === "all" ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">
                  Border Radius (All Sides)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={safeFormat.borderRadius || 0}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      onFormatChange({
                        borderRadius: value,
                        borderTopLeftRadius: value,
                        borderTopRightRadius: value,
                        borderBottomLeftRadius: value,
                        borderBottomRightRadius: value,
                      });
                    }}
                    className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safeFormat.borderRadius || 0}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      onFormatChange({
                        borderRadius: value,
                        borderTopLeftRadius: value,
                        borderTopRightRadius: value,
                        borderBottomLeftRadius: value,
                        borderBottomRightRadius: value,
                      });
                    }}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Top Left</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={safeFormat.borderTopLeftRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderTopLeftRadius: Number(e.target.value),
                        })
                      }
                      className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={safeFormat.borderTopLeftRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderTopLeftRadius: Number(e.target.value),
                        })
                      }
                      className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Top Right</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={safeFormat.borderTopRightRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderTopRightRadius: Number(e.target.value),
                        })
                      }
                      className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={safeFormat.borderTopRightRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderTopRightRadius: Number(e.target.value),
                        })
                      }
                      className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Bottom Left</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={safeFormat.borderBottomLeftRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderBottomLeftRadius: Number(e.target.value),
                        })
                      }
                      className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={safeFormat.borderBottomLeftRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderBottomLeftRadius: Number(e.target.value),
                        })
                      }
                      className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Bottom Right</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={safeFormat.borderBottomRightRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderBottomRightRadius: Number(e.target.value),
                        })
                      }
                      className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={safeFormat.borderBottomRightRadius || 0}
                      onChange={(e) =>
                        onFormatChange({
                          borderBottomRightRadius: Number(e.target.value),
                        })
                      }
                      className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Alignment Popup */}
      {showAlignmentPopup && (
        <div
          ref={alignmentPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[200px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: alignmentButtonRef.current
              ? alignmentButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: alignmentButtonRef.current
              ? alignmentButtonRef.current.getBoundingClientRect().left - 50
              : 0,
          }}
        >
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Text Alignment
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  safeFormat.textAlign === "left"
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
                onClick={() => {
                  onFormatChange({ textAlign: "left" });
                  setShowAlignmentPopup(false);
                }}
                title="Align Left"
              >
                <AlignLeft size={18} />
              </button>
              <button
                className={`p-3 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  safeFormat.textAlign === "center"
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
                onClick={() => {
                  onFormatChange({ textAlign: "center" });
                  setShowAlignmentPopup(false);
                }}
                title="Align Center"
              >
                <AlignCenter size={18} />
              </button>
              <button
                className={`p-3 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  safeFormat.textAlign === "right"
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
                onClick={() => {
                  onFormatChange({ textAlign: "right" });
                  setShowAlignmentPopup(false);
                }}
                title="Align Right"
              >
                <AlignRight size={18} />
              </button>
              <button
                className={`p-3 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  safeFormat.textAlign === "justify"
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
                onClick={() => {
                  onFormatChange({ textAlign: "justify" });
                  setShowAlignmentPopup(false);
                }}
                title="Justify"
              >
                <AlignJustify size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Z-Index Popup */}
      {showZIndexPopup && (
        <div
          ref={zIndexPopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[200px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: zIndexButtonRef.current
              ? zIndexButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: zIndexButtonRef.current
              ? zIndexButtonRef.current.getBoundingClientRect().left - 50
              : 0,
          }}
        >
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Layer Order
            </div>
            <div className="space-y-1">
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  selectedElementId && isElementAtFront(selectedElementId)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  if (
                    selectedElementId &&
                    !isElementAtFront(selectedElementId)
                  ) {
                    moveToFront(selectedElementId);
                    setShowZIndexPopup(false);
                  }
                }}
                disabled={
                  selectedElementId ? isElementAtFront(selectedElementId) : true
                }
                title="Bring to Front"
              >
                <BringToFront size={16} />
                <span className="text-sm">Bring to Front</span>
              </button>
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  selectedElementId && isElementAtBack(selectedElementId)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  if (
                    selectedElementId &&
                    !isElementAtBack(selectedElementId)
                  ) {
                    moveToBack(selectedElementId);
                    setShowZIndexPopup(false);
                  }
                }}
                disabled={
                  selectedElementId ? isElementAtBack(selectedElementId) : true
                }
                title="Bring to Back"
              >
                <SendToBack size={16} />
                <span className="text-sm">Bring to Back</span>
              </button>
              <div className="border-t border-gray-200 my-2"></div>
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  selectedElementId && isElementAtFront(selectedElementId)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  if (
                    selectedElementId &&
                    !isElementAtFront(selectedElementId)
                  ) {
                    moveForward(selectedElementId);
                    setShowZIndexPopup(false);
                  }
                }}
                disabled={
                  selectedElementId ? isElementAtFront(selectedElementId) : true
                }
                title="Forward"
              >
                <ArrowUp size={16} />
                <span className="text-sm">Forward</span>
              </button>
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  selectedElementId && isElementAtBack(selectedElementId)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  if (
                    selectedElementId &&
                    !isElementAtBack(selectedElementId)
                  ) {
                    moveBackward(selectedElementId);
                    setShowZIndexPopup(false);
                  }
                }}
                disabled={
                  selectedElementId ? isElementAtBack(selectedElementId) : true
                }
                title="Backward"
              >
                <ArrowDown size={16} />
                <span className="text-sm">Backward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Font Size Popup */}
      {showFontSizePopup && (
        <div
          ref={fontSizePopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[200px] max-h-[300px] overflow-y-auto z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: fontSizeInputRef.current
              ? fontSizeInputRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: fontSizeInputRef.current
              ? fontSizeInputRef.current.getBoundingClientRect().left
              : 0,
          }}
        >
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Font Size
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
              {fontSizes.map((size) => (
                <button
                  key={size}
                  className={`p-2 rounded-lg transition-all duration-200 text-sm ${
                    Math.abs((safeFormat.fontSize || 12) - size) < 0.1
                      ? "bg-blue-500 text-white shadow-md"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => {
                    onFormatChange({ fontSize: size });
                    setShowFontSizePopup(false);
                  }}
                  title={`${size}px`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Text Style Popup */}
      {showTextStylePopup && (
        <div
          ref={textStylePopupRef}
          className="fixed bg-white shadow-xl rounded-lg border border-gray-200 p-3 min-w-[200px] z-[60] animate-in slide-in-from-top-2 duration-200"
          style={{
            top: textStyleButtonRef.current
              ? textStyleButtonRef.current.getBoundingClientRect().bottom + 8
              : 0,
            left: textStyleButtonRef.current
              ? textStyleButtonRef.current.getBoundingClientRect().left - 50
              : 0,
          }}
        >
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Text Style
            </div>
            <div className="space-y-1">
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.bold
                    ? "bg-gray-300 text-gray-600"
                    : safeFormat.bold
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  onFormatChange({ bold: !safeFormat.bold });
                  setShowTextStylePopup(false);
                }}
                title={
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.bold
                    ? "Bold (Mixed)"
                    : "Bold"
                }
              >
                <Bold size={16} />
                <span className="text-sm">
                  {!selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.bold
                    ? "Bold (Mixed)"
                    : "Bold"}
                </span>
              </button>
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.italic
                    ? "bg-gray-300 text-gray-600"
                    : safeFormat.italic
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  onFormatChange({ italic: !safeFormat.italic });
                  setShowTextStylePopup(false);
                }}
                title={
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.italic
                    ? "Italic (Mixed)"
                    : "Italic"
                }
              >
                <Italic size={16} />
                <span className="text-sm">
                  {!selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.italic
                    ? "Italic (Mixed)"
                    : "Italic"}
                </span>
              </button>
              <button
                className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.underline
                    ? "bg-gray-300 text-gray-600"
                    : safeFormat.underline
                    ? "bg-blue-500 text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => {
                  onFormatChange({ underline: !safeFormat.underline });
                  setShowTextStylePopup(false);
                }}
                title={
                  !selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.underline
                    ? "Underline (Mixed)"
                    : "Underline"
                }
              >
                <Underline size={16} />
                <span className="text-sm">
                  {!selectedElementId &&
                  currentFormat &&
                  "consistentProperties" in currentFormat &&
                  !(currentFormat as any).consistentProperties.underline
                    ? "Underline (Mixed)"
                    : "Underline"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for sliders */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        .slider::-webkit-slider-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #e5e7eb;
          border-radius: 4px;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }

        .slider::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        .slider::-moz-range-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #e5e7eb;
          border-radius: 4px;
        }

        @keyframes slide-in-from-top {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: slide-in-from-top 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
