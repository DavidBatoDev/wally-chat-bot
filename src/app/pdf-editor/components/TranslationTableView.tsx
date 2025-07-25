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
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});
  const originalTextareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>(
    {}
  );

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
      console.log("Delete textbox:", textboxId);
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

  // Auto-resize textarea
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(48, textarea.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(autoResizeTextarea);
  }, [translatedTextBoxes, autoResizeTextarea]);

  if (textboxesForTable.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-[400px]">
          <div className="text-center p-8">
            <div className="text-xl mb-3 text-gray-600 font-medium">
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
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0 flex items-start justify-between min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Translation Editor
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Page {currentPage} • {textboxesForTable.length} text{" "}
            {textboxesForTable.length === 1 ? "box" : "boxes"}
          </p>
        </div>
        {(sourceLanguage || desiredLanguage) && (
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 shadow-sm border border-gray-200 flex-nowrap min-w-0">
            <Languages className="w-5 h-5 text-blue-500 mr-1 flex-shrink-0" />
            <span className="text-xs text-gray-700 font-medium whitespace-nowrap overflow-hidden">
              {sourceLanguage || "Source"}
            </span>
            <span className="mx-1 text-gray-400 flex-shrink-0">→</span>
            <span className="text-xs text-gray-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {desiredLanguage || "Target"}
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/2">
                  Original Text
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-1/2">
                  Translation
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
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

                return (
                  <tr
                    key={textbox.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      isEditing ? "bg-gray-50" : ""
                    }`}
                    onClick={() => onRowClick?.(textbox.id)}
                  >
                    {/* Original Text Column */}
                    <td className="px-6 py-2 align-top">
                      <div className="relative">
                        {untranslatedText?.isCustomTextbox &&
                        untranslatedText &&
                        onUpdateUntranslatedText ? (
                          <textarea
                            ref={(el) => {
                              if (el) {
                                originalTextareaRefs.current[
                                  untranslatedText.id
                                ] = el;
                                autoResizeTextarea(el);
                              }
                            }}
                            value={originalText || ""}
                            onChange={(e) =>
                              handleOriginalTextChange(
                                untranslatedText.id,
                                e.target.value
                              )
                            }
                            onFocus={() =>
                              handleOriginalTextareaFocus(untranslatedText.id)
                            }
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
                            className={`w-full p-3 text-sm border rounded-lg resize-none transition-all duration-200 ${
                              editingOriginalId === untranslatedText.id
                                ? "border-gray-400 bg-white shadow-sm ring-1 ring-gray-400"
                                : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
                            } focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent`}
                            style={{
                              minHeight: "48px",
                              fontFamily:
                                "system-ui, -apple-system, sans-serif",
                              lineHeight: "1.4",
                            }}
                            placeholder="Enter original text..."
                            spellCheck={false}
                          />
                        ) : originalText ? (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed">
                            {originalText}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-12 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-400">
                              No original text
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Translation Column */}
                    <td className="px-6 py-2 align-top">
                      <div className="space-y-1">
                        <div className="relative">
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
                              autoResizeTextarea(
                                e.target as HTMLTextAreaElement
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full p-3 text-sm border rounded-lg resize-none transition-all duration-200 ${
                              editingId === textbox.id
                                ? "border-gray-400 bg-white shadow-sm ring-1 ring-gray-400"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            } focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent`}
                            style={{
                              minHeight: "48px",
                              fontFamily:
                                textbox.fontFamily ||
                                "system-ui, -apple-system, sans-serif",
                              fontSize: `${Math.max(
                                13,
                                (textbox.fontSize || 13) * 0.9
                              )}px`,
                              lineHeight: "1.4",
                            }}
                            placeholder="Enter translation..."
                            spellCheck={false}
                          />
                          {/* Status indicator circle */}
                          <div
                            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                              effectiveStatus === "checked"
                                ? "bg-green-500"
                                : effectiveStatus === "needsChecking"
                                ? "bg-yellow-500"
                                : "bg-gray-400"
                            }`}
                          ></div>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-medium ${
                                effectiveStatus === "checked"
                                  ? "text-green-600"
                                  : effectiveStatus === "needsChecking"
                                  ? "text-yellow-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {effectiveStatus === "checked"
                                ? "Approved"
                                : effectiveStatus === "needsChecking"
                                ? "Pending"
                                : "Empty"}
                            </span>
                            {untranslatedText?.isCustomTextbox && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-2 align-top">
                      <div className="flex items-center gap-1">
                        {/* Toggle Check/X Button */}
                        {!untranslatedText?.isCustomTextbox && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(textbox.id);
                            }}
                            disabled={effectiveStatus === "isEmpty"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                              effectiveStatus === "isEmpty"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : effectiveStatus === "checked"
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700"
                            }`}
                            title={
                              effectiveStatus === "isEmpty"
                                ? "Cannot approve empty text"
                                : effectiveStatus === "checked"
                                ? "Mark as pending"
                                : "Approve translation"
                            }
                          >
                            {effectiveStatus === "checked" ? (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(textbox.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 transition-all duration-200"
                          title="Delete text box"
                        >
                          <svg
                            className="w-3.5 h-3.5"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {/* Footer */}
      <div className="px-6 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Use Ctrl+Enter to finish editing • Click rows to highlight text
            location
          </span>
          <span>Switch to Layout mode to modify positions and styling</span>
        </div>
      </div>
    </div>
  );
};
