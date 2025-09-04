import React, { useCallback, useState, useEffect, useRef } from "react";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";
import { Languages, Eye, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Document, Page, pdfjs } from "react-pdf";
import { isPdfFile } from "../utils/measurements";

// Configure PDF.js worker to match ProjectPreview behavior
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TranslationTableViewProps {
  translatedTextBoxes: TextField[];
  untranslatedTexts: UntranslatedText[];
  onUpdateTextBox: (id: string, updates: Partial<TextField>) => void;
  onUpdateUntranslatedText?: (
    id: string,
    updates: Partial<UntranslatedText>
  ) => void;
  onDeleteTextBox?: (textboxId: string) => void;
  onRowClick?: (textboxId: string) => void;
  onAddUntranslatedText?: (
    untranslatedText: Omit<UntranslatedText, "id">
  ) => void;
  pageWidth?: number;
  pageHeight?: number;
  scale?: number;
  currentPage: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
  translatedTemplateURL?: string;
  translatedTemplateWidth?: number;
  translatedTemplateHeight?: number;
}

export const TranslationTableView: React.FC<TranslationTableViewProps> = ({
  translatedTextBoxes,
  untranslatedTexts,
  onUpdateTextBox,
  onUpdateUntranslatedText,
  onDeleteTextBox,
  onRowClick,
  onAddUntranslatedText,
  pageWidth = 800,
  pageHeight = 1000,
  scale = 1,
  currentPage,
  sourceLanguage,
  desiredLanguage,
  translatedTemplateURL,
  translatedTemplateWidth,
  translatedTemplateHeight,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(
    null
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [originalColumnWidth, setOriginalColumnWidth] = useState<number>(50); // percentage
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});
  const originalTextareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>(
    {}
  );
  const resizeRef = useRef<HTMLDivElement>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewText, setPreviewText] = useState<UntranslatedText | null>(null);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const updateTimersRef = useRef<{ [key: string]: any }>({});
  const DEBOUNCE_MS = 200;

  useEffect(() => {
    if (!isPreviewOpen) return;
    const update = () => {
      const w = previewContainerRef.current?.clientWidth || 0;
      setContainerWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isPreviewOpen]);

  // Filter textboxes to show only those on the current page
  const textboxesForTable = translatedTextBoxes.filter(
    (textbox) => textbox.page === currentPage
  );

  // Helper function to find corresponding original text
  const findOriginalText = useCallback(
    (translatedBox: TextField): string => {
      const untranslatedText = untranslatedTexts.find(
        (text) => text.translatedTextboxId === translatedBox.id
      );
      return untranslatedText?.originalText || "";
    },
    [untranslatedTexts]
  );

  // Helper function to find corresponding translated textbox
  const findTranslatedTextBox = useCallback(
    (untranslatedText: UntranslatedText): TextField | undefined => {
      return translatedTextBoxes.find(
        (textbox) => textbox.id === untranslatedText.translatedTextboxId
      );
    },
    [translatedTextBoxes]
  );

  const handleTextChange = useCallback(
    (id: string, newValue: string) => {
      const key = `t-${id}`;
      if (updateTimersRef.current[key]) {
        clearTimeout(updateTimersRef.current[key]);
      }
      // Use requestAnimationFrame for smoother coalescing of rapid inputs
      updateTimersRef.current[key] = setTimeout(() => {
        requestAnimationFrame(() => {
          onUpdateTextBox(id, { value: newValue });
          delete updateTimersRef.current[key];
        });
      }, DEBOUNCE_MS);
    },
    [onUpdateTextBox]
  );

  const handleOriginalTextChange = useCallback(
    (untranslatedTextId: string, newValue: string) => {
      if (!onUpdateUntranslatedText) return;
      const key = `o-${untranslatedTextId}`;
      if (updateTimersRef.current[key]) {
        clearTimeout(updateTimersRef.current[key]);
      }
      updateTimersRef.current[key] = setTimeout(() => {
        requestAnimationFrame(() => {
          onUpdateUntranslatedText(untranslatedTextId, {
            originalText: newValue,
          });
          delete updateTimersRef.current[key];
        });
      }, DEBOUNCE_MS);
    },
    [onUpdateUntranslatedText]
  );

  const handleTextareaFocus = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleTextareaBlur = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleOriginalTextareaFocus = useCallback((id: string) => {
    setEditingOriginalId(id);
  }, []);

  const handleOriginalTextareaBlur = useCallback(() => {
    setEditingOriginalId(null);
  }, []);

  const handleApprove = useCallback(
    (textbox: TextField, originalFallback?: string, page?: number) => {
      // Find existing untranslated record for this textbox
      const existing = untranslatedTexts.find(
        (text) => text.translatedTextboxId === textbox.id
      );

      if (existing && onUpdateUntranslatedText) {
        // Toggle between checked and needsChecking
        const newStatus =
          existing.status === "checked" ? "needsChecking" : "checked";
        onUpdateUntranslatedText(existing.id, { status: newStatus });
        return;
      }

      // If missing, create one if we have both original and translation text
      if (!existing && onAddUntranslatedText) {
        const originalTextCandidate = originalFallback || "";
        const translationCandidate = textbox.value || "";
        if (
          originalTextCandidate.trim() !== "" &&
          translationCandidate.trim() !== ""
        ) {
          onAddUntranslatedText({
            translatedTextboxId: textbox.id,
            originalText: originalTextCandidate,
            page: page ?? textbox.page,
            x: textbox.x,
            y: textbox.y,
            width: textbox.width,
            height: textbox.height,
            isCustomTextbox: false,
            status: "checked",
          });
        }
      }
    },
    [untranslatedTexts, onUpdateUntranslatedText, onAddUntranslatedText]
  );

  // Helper function to get the effective status based on textbox content
  const getEffectiveStatus = useCallback(
    (
      textbox: TextField,
      untranslatedText?: UntranslatedText,
      originalFallback?: string
    ) => {
      // If translated textbox is empty, status is always isEmpty regardless of stored status
      if (!textbox.value || textbox.value.trim() === "") {
        return "isEmpty";
      }
      // Determine original content either from untranslatedText or provided fallback
      const originalTextCandidate =
        untranslatedText?.originalText ?? originalFallback ?? "";
      // If original text is empty, status is isEmpty
      if (!originalTextCandidate || originalTextCandidate.trim() === "") {
        return "isEmpty";
      }
      // For custom textboxes, only allow 'isEmpty' or 'checked'
      if (untranslatedText?.isCustomTextbox) {
        return originalTextCandidate.trim() === "" ? "isEmpty" : "checked";
      }
      // Otherwise, use the stored status
      return untranslatedText?.status || "needsChecking";
    },
    []
  );

  // Removed Add Text Box handler and UI per requirement

  const handleDelete = useCallback(
    (textboxId: string) => {
      // Call the delete handler if provided, otherwise just clear the text
      if (onDeleteTextBox) {
        onDeleteTextBox(textboxId);
      } else {
        // Fallback: just clear the text
        onUpdateTextBox(textboxId, { value: "" });
      }
    },
    [onDeleteTextBox, onUpdateTextBox]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      const textarea = textareaRefs.current[id];
      if (textarea) {
        textarea.blur();
      }
    }
  }, []);

  const handleRowClick = useCallback(
    (textboxId: string) => {
      setSelectedRowId(textboxId);
      onRowClick?.(textboxId);
    },
    [onRowClick]
  );

  // Handle column resizing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = originalColumnWidth;
      const tableRect = resizeRef.current
        ?.closest("table")
        ?.getBoundingClientRect();

      if (!tableRect) return;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const tableWidth = tableRect.width - 40; // Account for row number column
        const deltaPercent = (deltaX / tableWidth) * 100;
        const newWidth = Math.min(75, Math.max(25, startWidth + deltaPercent));
        setOriginalColumnWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [originalColumnWidth]
  );

  // Auto-resize textarea
  const resizeRAF = useRef<{ [key: string]: number }>({});
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    const key = (textarea as any).id || (textarea as any).dataset?.rid || "_";
    if (resizeRAF.current[key]) {
      cancelAnimationFrame(resizeRAF.current[key]);
    }
    resizeRAF.current[key] = requestAnimationFrame(() => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(32, textarea.scrollHeight)}px`;
    });
  }, []);

  // Initialize textarea heights once (and when row count changes),
  // avoid resizing all textareas on every keystroke to reduce lag
  useEffect(() => {
    Object.values(textareaRefs.current).forEach(autoResizeTextarea);
  }, [textboxesForTable.length, autoResizeTextarea]);

  if (textboxesForTable.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 flex items-center justify-center bg-gray-50 border border-gray-200 min-h-[400px]">
          <div className="text-center p-8">
            <div className="text-lg mb-2 text-gray-600 font-medium">
              No translations on page {currentPage}
            </div>
            <div className="text-sm text-gray-500 max-w-md">
              Switch to Layout mode to create text boxes, then return here to
              translate them.
            </div>
          </div>
        </div>

        {/* Removed Add Text Box button (empty state) */}
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col border border-gray-300">
      {/* Header - Excel-style toolbar */}
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-800">
              Translation Editor
            </h2>
            <div className="text-xs text-gray-600">
              Page {currentPage} • {textboxesForTable.length} entries
            </div>
          </div>
          {(sourceLanguage || desiredLanguage) && (
            <div className="flex items-center gap-2 bg-white rounded border border-gray-300 px-3 py-1 shadow-sm">
              <Languages className="w-4 h-4 text-gray-600" />
              <span className="text-xs text-gray-700 font-medium">
                {sourceLanguage || "Source"}
              </span>
              <span className="mx-1 text-gray-400">→</span>
              <span className="text-xs text-gray-700 font-medium">
                {desiredLanguage || "Target"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Excel-style table container */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-1 py-0 text-center text-xs font-semibold text-gray-700 border-r border-b border-gray-300 w-8 bg-gray-100">
                  #
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-b border-gray-300 bg-gray-50 relative"
                  style={{ width: `${originalColumnWidth}%` }}
                >
                  Original Text
                  {/* Column resize handle */}
                  <div
                    ref={resizeRef}
                    onMouseDown={handleMouseDown}
                    className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors ${
                      isResizing ? "bg-blue-500" : "bg-transparent"
                    }`}
                    title="Resize column"
                  />
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-300 bg-gray-50"
                  style={{ width: `${100 - originalColumnWidth}%` }}
                >
                  Translation
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {textboxesForTable.map((textbox, index) => {
                const originalText = findOriginalText(textbox);
                const untranslatedText = untranslatedTexts.find(
                  (text) => text.translatedTextboxId === textbox.id
                );

                // Debug logging removed for performance
                const effectiveStatus = getEffectiveStatus(
                  textbox,
                  untranslatedText,
                  originalText
                );
                const isEditing =
                  editingId === textbox.id ||
                  editingOriginalId === untranslatedText?.id;
                const isSelected = selectedRowId === textbox.id;

                return (
                  <tr
                    key={textbox.id}
                    className={`border-b border-gray-200 hover:bg-blue-50 transition-colors cursor-pointer group ${
                      isSelected ? "bg-blue-50" : isEditing ? "bg-blue-25" : ""
                    }`}
                    onClick={() => handleRowClick(textbox.id)}
                    {...(index === 0 && { id: "first-translation-row" })}
                  >
                    {/* Row Number */}
                    <td className="px-1 py-2 text-center text-xs text-gray-500 border-r border-gray-200 bg-gray-50 font-mono">
                      {index + 1}
                    </td>

                    {/* Original Text Column */}
                    <td
                      className="px-0 py-0 align-top border-r border-gray-200 relative"
                      style={{ width: `${originalColumnWidth}%` }}
                    >
                      <div className="p-2">
                        {onUpdateUntranslatedText ? (
                          <textarea
                            {...(index === 0 && {
                              id: "first-original-textarea",
                            })}
                            ref={(el) => {
                              if (el) {
                                originalTextareaRefs.current[
                                  untranslatedText?.id || textbox.id
                                ] = el;
                                autoResizeTextarea(el);
                              }
                            }}
                            defaultValue={originalText || ""}
                            onChange={(e) => {
                              if (untranslatedText) {
                                handleOriginalTextChange(
                                  untranslatedText.id,
                                  e.target.value
                                );
                              } else if (onAddUntranslatedText) {
                                // Create a new untranslated text entry if it doesn't exist
                                onAddUntranslatedText({
                                  translatedTextboxId: textbox.id,
                                  originalText: e.target.value,
                                  page: currentPage,
                                  x: textbox.x,
                                  y: textbox.y,
                                  width: textbox.width,
                                  height: textbox.height,
                                  isCustomTextbox: false,
                                  status:
                                    e.target.value.trim() === ""
                                      ? "isEmpty"
                                      : "needsChecking",
                                });
                              }
                            }}
                            onFocus={() => {
                              if (untranslatedText) {
                                handleOriginalTextareaFocus(
                                  untranslatedText.id
                                );
                              }
                            }}
                            onBlur={handleOriginalTextareaBlur}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.ctrlKey) {
                                e.preventDefault();
                                (e.target as HTMLTextAreaElement).blur();
                              }
                              e.stopPropagation();
                            }}
                            onInput={(e) =>
                              autoResizeTextarea(
                                e.target as HTMLTextAreaElement
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full p-2 text-sm border-0 resize-none bg-transparent focus:outline-none ${
                              editingOriginalId ===
                              (untranslatedText?.id || textbox.id)
                                ? ""
                                : ""
                            }`}
                            style={{
                              minHeight: "32px",
                              fontFamily:
                                "system-ui, -apple-system, sans-serif",
                              lineHeight: "1.3",
                            }}
                            placeholder={(() => {
                              // Debug removed
                              return (
                                untranslatedText?.placeholder ||
                                textbox.placeholder ||
                                "Enter original text..."
                              );
                            })()}
                            spellCheck={false}
                            onCompositionStart={(e) => e.stopPropagation()}
                            onCompositionEnd={(e) => e.stopPropagation()}
                          />
                        ) : originalText ? (
                          <div className="p-2 text-sm text-gray-800 leading-snug min-h-[32px] flex items-start">
                            {originalText}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-8 text-xs text-gray-400 px-2 text-center">
                            {(() => {
                              // Debug removed
                              return (
                                untranslatedText?.placeholder ||
                                textbox.placeholder ||
                                "No original text"
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      {/* Highlight + Preview buttons */}
                      {(onRowClick || translatedTemplateURL) && (
                        <div className="absolute top-1 right-1 flex items-center gap-0.5">
                          {onRowClick && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const existing = untranslatedTexts.find(
                                  (t) => t.translatedTextboxId === textbox.id
                                );
                                if (!existing && onAddUntranslatedText) {
                                  onAddUntranslatedText({
                                    translatedTextboxId: textbox.id,
                                    originalText: "",
                                    page: currentPage,
                                    x: textbox.x,
                                    y: textbox.y,
                                    width: textbox.width,
                                    height: textbox.height,
                                    isCustomTextbox: false,
                                    status: "isEmpty",
                                    placeholder: textbox.placeholder,
                                  });
                                }
                                onRowClick(textbox.id);
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center bg-white border border-gray-300 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200"
                              title="Highlight original text"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}
                          {translatedTemplateURL && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                let ut = untranslatedTexts.find(
                                  (t) => t.translatedTextboxId === textbox.id
                                );
                                if (!ut) {
                                  const temp: UntranslatedText = {
                                    id: `temp-${textbox.id}`,
                                    translatedTextboxId: textbox.id,
                                    originalText: "",
                                    page: currentPage,
                                    x: textbox.x,
                                    y: textbox.y,
                                    width: textbox.width,
                                    height: textbox.height,
                                    isCustomTextbox: false,
                                    status: "isEmpty",
                                    placeholder: textbox.placeholder,
                                  };
                                  ut = temp;
                                  if (onAddUntranslatedText) {
                                    onAddUntranslatedText({
                                      translatedTextboxId: textbox.id,
                                      originalText: "",
                                      page: currentPage,
                                      x: textbox.x,
                                      y: textbox.y,
                                      width: textbox.width,
                                      height: textbox.height,
                                      isCustomTextbox: false,
                                      status: "isEmpty",
                                      placeholder: textbox.placeholder,
                                    });
                                  }
                                }
                                setPreviewText(ut);
                                setIsImageLoading(true);
                                setImageError(null);
                                setIsPreviewOpen(true);
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center bg-white border border-gray-300 text-gray-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-all duration-200"
                              title="Preview on template"
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          )}
                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(textbox.id);
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center bg-white border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200"
                            title="Delete text box"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Translation Column */}
                    <td
                      className="px-0 py-0 align-top relative group"
                      style={{ width: `${100 - originalColumnWidth}%` }}
                    >
                      <div className="p-2 relative">
                        <textarea
                          {...(index === 0 && {
                            id: "first-translated-textarea",
                          })}
                          ref={(el) => {
                            if (el) {
                              textareaRefs.current[textbox.id] = el;
                              autoResizeTextarea(el);
                            }
                          }}
                          defaultValue={textbox.value || ""}
                          onChange={(e) =>
                            handleTextChange(textbox.id, e.target.value)
                          }
                          onFocus={() => handleTextareaFocus(textbox.id)}
                          onBlur={handleTextareaBlur}
                          onKeyDown={(e) => {
                            handleKeyDown(e, textbox.id);
                            e.stopPropagation();
                          }}
                          onInput={(e) =>
                            autoResizeTextarea(e.target as HTMLTextAreaElement)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full p-2 pr-12 text-sm border-0 resize-none bg-transparent focus:outline-none ${
                            editingId === textbox.id ? "" : ""
                          }`}
                          style={{
                            minHeight: "32px",
                            fontFamily:
                              textbox.fontFamily ||
                              "system-ui, -apple-system, sans-serif",
                            fontSize: `${Math.max(
                              12,
                              (textbox.fontSize || 12) * 0.9
                            )}px`,
                            lineHeight: "1.3",
                          }}
                          placeholder="Enter translation..."
                          spellCheck={false}
                          onCompositionStart={(e) => e.stopPropagation()}
                          onCompositionEnd={(e) => e.stopPropagation()}
                        />

                        {/* Action buttons - positioned in top right corner */}
                        <div
                          className="absolute top-1 right-1 flex items-center gap-0.5"
                          {...(index === 0 && { id: "first-action-buttons" })}
                        >
                          {/* Toggle Check/X Button */}
                          {!untranslatedText?.isCustomTextbox && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(
                                  textbox,
                                  originalText,
                                  currentPage
                                );
                              }}
                              disabled={effectiveStatus === "isEmpty"}
                              className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-200 text-xs bg-white border ${
                                effectiveStatus === "isEmpty"
                                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                                  : effectiveStatus === "checked"
                                  ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                                  : "border-gray-300 text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                              }`}
                              title={
                                effectiveStatus === "isEmpty"
                                  ? "Cannot approve empty text"
                                  : effectiveStatus === "checked"
                                  ? "Mark as pending"
                                  : "Approve translation"
                              }
                            >
                              {effectiveStatus === "checked" ? "✗" : "✓"}
                            </button>
                          )}
                        </div>

                        {/* Status indicator in bottom right corner */}
                        <div
                          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
                            effectiveStatus === "checked"
                              ? "bg-green-500"
                              : effectiveStatus === "needsChecking"
                              ? "bg-yellow-500"
                              : "bg-gray-400"
                          }`}
                        ></div>

                        {/* Status bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60">
                          <div
                            className={`h-full ${
                              effectiveStatus === "checked"
                                ? "bg-green-500"
                                : effectiveStatus === "needsChecking"
                                ? "bg-yellow-500"
                                : "bg-gray-400"
                            }`}
                          ></div>
                        </div>

                        {/* Custom textbox indicator */}
                        {untranslatedText?.isCustomTextbox && (
                          <div className="absolute top-1 left-1 px-1 py-0.5 bg-gray-200 text-gray-600 rounded text-xs font-medium opacity-70">
                            Custom
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Removed Add Text Box button (footer) */}

      {/* Footer - Excel-style status bar */}
      <div className="px-4 py-1 border-t border-gray-300 bg-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Use Ctrl+Enter to finish editing • Click rows to highlight text
            location
          </span>
          <span>Ready</span>
        </div>
      </div>

      {/* Modal preview with overlay */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              {(() => {
                const clean = (s?: string) =>
                  (s || "").replace(/^Enter or Remove Text for\s*/i, "").trim();

                const rawLabel = previewText?.placeholder || "Unnamed field";
                const label = clean(rawLabel) || rawLabel;

                const tb = previewText
                  ? findTranslatedTextBox(previewText)
                  : undefined;
                const rawEditorLabel = tb?.placeholder || "";
                const editorLabel =
                  clean(rawEditorLabel) || rawEditorLabel || "";
                const hasEditorLabel = editorLabel.trim() !== "";
                const matches = hasEditorLabel
                  ? editorLabel.trim() === label.trim()
                  : false;

                return (
                  <span>
                    This textarea is located in{" "}
                    <span className="font-medium text-gray-800">{`"${label}"`}</span>{" "}
                    in our template.
                    <span className="ml-1 inline-flex items-center text-gray-700">
                      Please correct the value/translation if wrong, or remove
                      if not in the document.
                    </span>
                  </span>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full" ref={previewContainerRef}>
            {!translatedTemplateURL ? (
              <div className="p-4 text-sm text-gray-600">
                No template available for this page.
              </div>
            ) : !previewText ? (
              <div className="p-4 text-sm text-gray-600">
                No selection to preview.
              </div>
            ) : (
              <div className="w-full">
                {(() => {
                  const isPdf = isPdfFile(translatedTemplateURL);
                  const tplW = translatedTemplateWidth || pageWidth || 1;
                  const tplH = translatedTemplateHeight || pageHeight || 1;
                  const ratio = tplW > 0 ? tplH / tplW : 1;
                  const containerW = Math.max(
                    1,
                    previewContainerRef.current?.clientWidth ||
                      containerWidth ||
                      600
                  );
                  const padding = 24; // inner padding for visual spacing
                  const desiredScale = 0.6; // scale down further
                  const maxRenderableW = Math.max(1, containerW - padding * 2);
                  const displayW = Math.round(maxRenderableW * desiredScale);
                  const displayH = Math.max(1, Math.round(displayW * ratio));

                  // Compute bounding box in display space
                  const bx =
                    ((previewText.x || 0) / (pageWidth || 1)) * displayW;
                  const by =
                    ((previewText.y || 0) / (pageHeight || 1)) * displayH;
                  const bw =
                    ((previewText.width || 0) / (pageWidth || 1)) * displayW;
                  const bh =
                    ((previewText.height || 0) / (pageHeight || 1)) * displayH;

                  // Determine zoom to make bbox fill ~40% of viewport (zoomed out more)
                  const targetFill = 0.2;
                  const zoomX = bw > 0 ? (displayW * targetFill) / bw : 1;
                  const zoomY = bh > 0 ? (displayH * targetFill) / bh : 1;
                  const zoom = Math.max(
                    0.4,
                    Math.min(4, Math.min(zoomX, zoomY))
                  );

                  // Center the bbox
                  const cx = bx + bw / 2;
                  const cy = by + bh / 2;
                  let tx = Math.round(displayW / 2 - cx * zoom);
                  let ty = Math.round(displayH / 2 - cy * zoom);
                  const minTx = displayW - displayW * zoom;
                  const minTy = displayH - displayH * zoom;
                  tx = Math.max(minTx, Math.min(0, tx));
                  ty = Math.max(minTy, Math.min(0, ty));

                  // High resolution render space (render larger, scale down)
                  const qualityScale = 4; // increase for crisper PDF/image
                  const renderW = Math.round(displayW * qualityScale);
                  const renderH = Math.round(displayH * qualityScale);
                  const rbx = Math.round(bx * qualityScale);
                  const rby = Math.round(by * qualityScale);
                  const rbw = Math.round(bw * qualityScale);
                  const rbh = Math.round(bh * qualityScale);

                  return (
                    <div className="w-full flex justify-center">
                      <div
                        className="relative border border-gray-300 rounded-md bg-white overflow-hidden"
                        style={{ width: displayW, height: displayH }}
                      >
                        <div
                          className="absolute left-0 top-0"
                          style={{
                            width: displayW,
                            height: displayH,
                            transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
                            transformOrigin: "0 0",
                            willChange: "transform",
                          }}
                        >
                          <div
                            className="relative"
                            style={{
                              width: renderW,
                              height: renderH,
                              transform: `scale(${1 / qualityScale})`,
                              transformOrigin: "0 0",
                            }}
                          >
                            {isPdf ? (
                              <Document
                                file={translatedTemplateURL}
                                loading={null}
                                error={null}
                              >
                                <Page
                                  pageNumber={1}
                                  width={renderW}
                                  renderAnnotationLayer={false}
                                  renderTextLayer={false}
                                  loading={null}
                                  error={null}
                                />
                              </Document>
                            ) : imageError ? (
                              <div className="p-4 text-sm text-red-600">
                                Failed to load template image.
                                {translatedTemplateURL && (
                                  <div className="mt-2 text-xs break-all text-gray-700">
                                    <div className="mb-1">URL:</div>
                                    <a
                                      href={translatedTemplateURL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline text-blue-600 hover:text-blue-700"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {translatedTemplateURL}
                                    </a>
                                    <button
                                      className="ml-2 px-2 py-0.5 text-xs border rounded hover:bg-gray-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard?.writeText(
                                          translatedTemplateURL
                                        );
                                      }}
                                    >
                                      Copy
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                {isImageLoading && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-xs text-gray-500">
                                      Loading…
                                    </div>
                                  </div>
                                )}
                                <img
                                  src={translatedTemplateURL}
                                  alt="Translated template"
                                  style={{
                                    width: renderW,
                                    height: renderH,
                                    display: "block",
                                  }}
                                  onLoad={() => setIsImageLoading(false)}
                                  onError={() => {
                                    setIsImageLoading(false);
                                    setImageError("error");
                                  }}
                                />
                              </>
                            )}
                            <div
                              className="absolute border-2 border-blue-500 bg-blue-400/20 animate-pulse pointer-events-none z-10"
                              style={{
                                left: `${rbx}px`,
                                top: `${rby}px`,
                                width: `${rbw}px`,
                                height: `${rbh}px`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
