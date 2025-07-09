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
  List,
  ListOrdered,
  ChevronDown,
  Type,
  Palette,
  Text,
  TextCursor,
  Square,
  MoreHorizontal,
  Move3D,
} from "lucide-react";
import { useTextFormat } from "./TextFormatContext";

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

const fontSizes = Array.from({ length: 20 }, (_, i) => i + 8); // 8px to 28px

const borderWidths = [0, 1, 2, 3, 4, 5];

export const TextFormatDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    currentFormat,
    onFormatChange,
    selectedElementId,
    showPaddingPopup,
    setShowPaddingPopup,
  } = useTextFormat();

  const [showSpacingTooltip, setShowSpacingTooltip] = useState(false);
  const [showCharSpacingTooltip, setShowCharSpacingTooltip] = useState(false);
  const [showAlignmentPopup, setShowAlignmentPopup] = useState(false);

  // Refs for positioning popups
  const spacingButtonRef = useRef<HTMLButtonElement>(null);
  const charSpacingButtonRef = useRef<HTMLButtonElement>(null);
  const paddingButtonRef = useRef<HTMLButtonElement>(null);

  // Refs for popup containers
  const spacingPopupRef = useRef<HTMLDivElement>(null);
  const charSpacingPopupRef = useRef<HTMLDivElement>(null);
  const paddingPopupRef = useRef<HTMLDivElement>(null);
  const alignmentButtonRef = useRef<HTMLButtonElement>(null);
  const alignmentPopupRef = useRef<HTMLDivElement>(null);

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
        showAlignmentPopup &&
        alignmentButtonRef.current &&
        alignmentPopupRef.current &&
        !alignmentButtonRef.current.contains(target) &&
        !alignmentPopupRef.current.contains(target)
      ) {
        setShowAlignmentPopup(false);
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
    showAlignmentPopup,
  ]);

  // Don't render if drawer is not open or no element is selected
  if (!isDrawerOpen || !selectedElementId || !currentFormat) {
    return null;
  }

  // Add additional safety checks for required properties
  const safeFormat = {
    fontFamily: currentFormat.fontFamily || "Arial",
    fontSize: currentFormat.fontSize || 12,
    bold: currentFormat.bold || false,
    italic: currentFormat.italic || false,
    underline: currentFormat.underline || false,
    textAlign: currentFormat.textAlign || "left",
    listType: currentFormat.listType || "none",
    color: currentFormat.color || "#000000",
    borderColor: currentFormat.borderColor || "#000000",
    borderWidth: currentFormat.borderWidth || 0,
    lineHeight: currentFormat.lineHeight || 1.2,
    letterSpacing: currentFormat.letterSpacing || 0,
    paddingTop: currentFormat.paddingTop || 0,
    paddingRight: currentFormat.paddingRight || 0,
    paddingBottom: currentFormat.paddingBottom || 0,
    paddingLeft: currentFormat.paddingLeft || 0,
  };

  return (
    <div className="absolute w-full flex justify-center bg-transparent">
      <div className="mt-2 overflow-visible bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-3 z-50 flex flex-row items-center gap-4 min-h-[60px] w-max rounded-full relative">
        {/* Text Content Input */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={currentFormat.value || ""}
            onChange={(e) => onFormatChange({ value: e.target.value })}
            placeholder="Enter text..."
            className="w-32 sm:w-48 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200"
          />
        </div>

        {/* Font Family */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200">
            <select
              className="w-20 sm:w-32 bg-transparent outline-none p-2 text-sm rounded-lg"
              value={safeFormat.fontFamily}
              onChange={(e) => onFormatChange({ fontFamily: e.target.value })}
            >
              {fontFamilies.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex-shrink-0 transition-all duration-200">
          <select
            className="w-16 sm:w-20 bg-transparent outline-none p-2 text-sm rounded-lg"
            value={safeFormat.fontSize}
            onChange={(e) =>
              onFormatChange({ fontSize: Number(e.target.value) })
            }
          >
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </div>

        {/* Text Style Buttons */}
        <div className="flex items-center gap-1 border-l border-gray-300 pl-4 flex-shrink-0">
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              safeFormat.bold
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => onFormatChange({ bold: !safeFormat.bold })}
          >
            <Bold size={16} />
          </button>
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              safeFormat.italic
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => onFormatChange({ italic: !safeFormat.italic })}
          >
            <Italic size={16} />
          </button>
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              safeFormat.underline
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() => onFormatChange({ underline: !safeFormat.underline })}
          >
            <Underline size={16} />
          </button>
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
              title="Text Alignment"
            >
              {safeFormat.textAlign === "left" && <AlignLeft size={16} />}
              {safeFormat.textAlign === "center" && <AlignCenter size={16} />}
              {safeFormat.textAlign === "right" && <AlignRight size={16} />}
              {safeFormat.textAlign === "justify" && <AlignJustify size={16} />}
            </button>
          </div>
        </div>

        {/* List Style - Hidden on small screens */}
        <div className="hidden md:flex items-center gap-1 border-l border-gray-300 pl-4 flex-shrink-0">
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              safeFormat.listType === "unordered"
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() =>
              onFormatChange({
                listType:
                  safeFormat.listType === "unordered" ? "none" : "unordered",
              })
            }
          >
            <List size={16} />
          </button>
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              safeFormat.listType === "ordered"
                ? "bg-blue-500 text-white shadow-md"
                : "hover:bg-gray-100 text-gray-700"
            }`}
            onClick={() =>
              onFormatChange({
                listType:
                  safeFormat.listType === "ordered" ? "none" : "ordered",
              })
            }
          >
            <ListOrdered size={16} />
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
          <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
            <Palette size={14} />
            <input
              type="color"
              value={safeFormat.color}
              onChange={(e) => onFormatChange({ color: e.target.value })}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer"
              title="Text Color"
            />
          </div>
          <div className="flex items-center gap-1 p-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">
            <Square size={14} />
            <input
              type="color"
              value={safeFormat.borderColor}
              onChange={(e) => onFormatChange({ borderColor: e.target.value })}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer"
              title="Border Color"
            />
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
              onClick={() => setShowCharSpacingTooltip(!showCharSpacingTooltip)}
              title="Character Spacing"
            >
              <TextCursor size={16} />
            </button>
          </div>
        </div>

        {/* Border Width - Hidden on small screens */}
        <div className="hidden md:flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
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

        {/* Padding Control - Icon only */}
        <div className="hidden xl:flex items-center gap-2 border-l border-gray-300 pl-4 flex-shrink-0">
          <div className="relative">
            <button
              ref={paddingButtonRef}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all duration-200"
              onClick={() => setShowPaddingPopup(!showPaddingPopup)}
              title="Padding"
            >
              <Move3D size={16} />
            </button>
          </div>
        </div>
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
            <div className="text-sm font-medium text-gray-700">Padding</div>
            {/* Padding controls */}
            <div className="flex flex-col gap-2">
              {/* Top Padding */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Top</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={safeFormat.paddingTop}
                    onChange={(e) =>
                      onFormatChange({ paddingTop: Number(e.target.value) })
                    }
                    className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safeFormat.paddingTop}
                    onChange={(e) =>
                      onFormatChange({ paddingTop: Number(e.target.value) })
                    }
                    className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Right Padding */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Right</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={safeFormat.paddingRight}
                    onChange={(e) =>
                      onFormatChange({ paddingRight: Number(e.target.value) })
                    }
                    className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safeFormat.paddingRight}
                    onChange={(e) =>
                      onFormatChange({ paddingRight: Number(e.target.value) })
                    }
                    className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Bottom Padding */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Bottom</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={safeFormat.paddingBottom}
                    onChange={(e) =>
                      onFormatChange({ paddingBottom: Number(e.target.value) })
                    }
                    className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safeFormat.paddingBottom}
                    onChange={(e) =>
                      onFormatChange({ paddingBottom: Number(e.target.value) })
                    }
                    className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Left Padding */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Left</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={safeFormat.paddingLeft}
                    onChange={(e) =>
                      onFormatChange({ paddingLeft: Number(e.target.value) })
                    }
                    className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safeFormat.paddingLeft}
                    onChange={(e) =>
                      onFormatChange({ paddingLeft: Number(e.target.value) })
                    }
                    className="w-8 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  />
                </div>
              </div>
            </div>
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
