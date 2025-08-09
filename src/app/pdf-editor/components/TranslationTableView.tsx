import React, { useCallback, useState, useEffect, useRef } from "react";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";
import { Languages } from "lucide-react";

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
  onAddTextBox?: (
    x: number,
    y: number,
    page: number,
    targetView: "original" | "translated",
    customInitialState?: Partial<TextField>
  ) => string;
  onAddUntranslatedText?: (
    untranslatedText: Omit<UntranslatedText, "id">
  ) => void;
  pageWidth?: number;
  pageHeight?: number;
  scale?: number;
  currentPage: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
}

export const TranslationTableView: React.FC<TranslationTableViewProps> = ({
  translatedTextBoxes,
  untranslatedTexts,
  onUpdateTextBox,
  onUpdateUntranslatedText,
  onDeleteTextBox,
  onRowClick,
  onAddTextBox,
  onAddUntranslatedText,
  pageWidth = 800,
  pageHeight = 1000,
  scale = 1,
  currentPage,
  sourceLanguage,
  desiredLanguage,
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
      onUpdateTextBox(id, { value: newValue });
    },
    [onUpdateTextBox]
  );

  const handleOriginalTextChange = useCallback(
    (untranslatedTextId: string, newValue: string) => {
      if (onUpdateUntranslatedText) {
        onUpdateUntranslatedText(untranslatedTextId, {
          originalText: newValue,
        });
      }
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
    (textboxId: string) => {
      // Find the corresponding untranslated text and toggle its status
      const untranslatedText = untranslatedTexts.find(
        (text) => text.translatedTextboxId === textboxId
      );

      if (untranslatedText && onUpdateUntranslatedText) {
        // Toggle between checked and needsChecking
        const newStatus =
          untranslatedText.status === "checked" ? "needsChecking" : "checked";
        onUpdateUntranslatedText(untranslatedText.id, { status: newStatus });
      }
    },
    [untranslatedTexts, onUpdateUntranslatedText]
  );

  // Helper function to get the effective status based on textbox content
  const getEffectiveStatus = useCallback(
    (textbox: TextField, untranslatedText?: UntranslatedText) => {
      // If translated textbox is empty, status is always isEmpty regardless of stored status
      if (!textbox.value || textbox.value.trim() === "") {
        return "isEmpty";
      }
      // If untranslated text is also empty, status is isEmpty
      if (
        !untranslatedText?.originalText ||
        untranslatedText.originalText.trim() === ""
      ) {
        return "isEmpty";
      }
      // For custom textboxes, only allow 'isEmpty' or 'checked'
      if (untranslatedText?.isCustomTextbox) {
        return untranslatedText.originalText.trim() === ""
          ? "isEmpty"
          : "checked";
      }
      // Otherwise, use the stored status
      return untranslatedText?.status || "needsChecking";
    },
    []
  );

  const handleAddCustomTextbox = useCallback(() => {
    if (!onAddTextBox || !onAddUntranslatedText) return;

    // Count how many custom textboxes are on the current page
    const customCount = untranslatedTexts.filter(
      (t) => t.isCustomTextbox && t.page === currentPage
    ).length;

    // Apply offset based on count
    const offset = 20 + customCount * 10;

    // Create a new textbox with custom properties
    const textboxId = onAddTextBox(
      offset, // x position
      offset, // y position
      currentPage,
      "translated",
      {
        fontSize: 10,
        width: 200,
        height: 30,
        fontFamily: "Arial",
        backgroundColor: "transparent", // Use transparent background by default
        backgroundOpacity: 0, // Ensure full transparency
        color: "#000000",
        value: "", // Initially empty
      }
    );

    // Create corresponding untranslated text with 'Custom Textbox' as value
    onAddUntranslatedText({
      translatedTextboxId: textboxId,
      originalText: `Custom Textbox ${customCount + 1}`,
      page: currentPage,
      x: offset,
      y: offset,
      width: 30,
      height: 10,
      isCustomTextbox: true,
      status: "isEmpty",
    });
  }, [onAddTextBox, onAddUntranslatedText, untranslatedTexts, currentPage]);

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
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(32, textarea.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(autoResizeTextarea);
  }, [translatedTextBoxes, autoResizeTextarea]);

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

        {/* Add Button at Bottom */}
        {onAddTextBox && onAddUntranslatedText && (
          <div className="p-6 border-t border-gray-200 bg-white flex-shrink-0">
            <button
              onClick={handleAddCustomTextbox}
              className="w-full inline-flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium rounded-lg hover:border-gray-400 hover:text-gray-600 transition-colors bg-transparent"
              title="Add custom text box"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Text Box
            </button>
          </div>
        )}
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
                const effectiveStatus = getEffectiveStatus(
                  textbox,
                  untranslatedText
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
                            ref={(el) => {
                              if (el) {
                                originalTextareaRefs.current[
                                  untranslatedText?.id || textbox.id
                                ] = el;
                                autoResizeTextarea(el);
                              }
                            }}
                            value={originalText || ""}
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
                            placeholder={
                              textbox.placeholder || "Enter original text..."
                            }
                            spellCheck={false}
                          />
                        ) : originalText ? (
                          <div className="p-2 text-sm text-gray-800 leading-snug min-h-[32px] flex items-start">
                            {originalText}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-8 text-xs text-gray-400">
                            No original text
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Translation Column */}
                    <td
                      className="px-0 py-0 align-top relative group"
                      style={{ width: `${100 - originalColumnWidth}%` }}
                    >
                      <div className="p-2 relative">
                        <textarea
                          ref={(el) => {
                            if (el) {
                              textareaRefs.current[textbox.id] = el;
                              autoResizeTextarea(el);
                            }
                          }}
                          value={textbox.value || ""}
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
                        />

                        {/* Action buttons - positioned in top right corner */}
                        <div className="absolute top-1 right-1 flex items-center gap-0.5">
                          {/* Toggle Check/X Button */}
                          {!untranslatedText?.isCustomTextbox && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(textbox.id);
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

      {/* Add Button - Original style */}
      {onAddTextBox && onAddUntranslatedText && (
        <div className="p-6 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={handleAddCustomTextbox}
            className="w-full inline-flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium rounded-lg hover:border-gray-400 hover:text-gray-600 transition-colors bg-transparent"
            title="Add custom text box"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Text Box
          </button>
        </div>
      )}

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
    </div>
  );
};
