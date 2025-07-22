import React, { useCallback, useState, useEffect, useRef } from "react";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";

interface TranslationTableViewProps {
  translatedTextBoxes: TextField[];
  untranslatedTexts: UntranslatedText[];
  onUpdateTextBox: (id: string, updates: Partial<TextField>) => void;
  onUpdateUntranslatedText?: (id: string, updates: Partial<UntranslatedText>) => void;
  onDeleteTextBox?: (textboxId: string) => void;
  onRowClick?: (textboxId: string) => void;
  onAddTextBox?: (x: number, y: number, page: number, targetView: "original" | "translated", customInitialState?: Partial<TextField>) => string;
  onAddUntranslatedText?: (untranslatedText: Omit<UntranslatedText, "id">) => void;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  currentPage: number;
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
  pageWidth,
  pageHeight,
  scale,
  currentPage,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});
  const originalTextareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});

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
        onUpdateUntranslatedText(untranslatedTextId, { originalText: newValue });
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

  const handleApprove = useCallback((textboxId: string) => {
    // Find the corresponding untranslated text and toggle its status
    const untranslatedText = untranslatedTexts.find(
      (text) => text.translatedTextboxId === textboxId
    );
    
    if (untranslatedText && onUpdateUntranslatedText) {
      // Toggle between checked and needsChecking
      const newStatus = untranslatedText.status === "checked" ? "needsChecking" : "checked";
      onUpdateUntranslatedText(untranslatedText.id, { status: newStatus });
    }
  }, [untranslatedTexts, onUpdateUntranslatedText]);

  // Helper function to get the effective status based on textbox content
  const getEffectiveStatus = useCallback((textbox: TextField, untranslatedText?: UntranslatedText) => {
    // If translated textbox is empty, status is always isEmpty regardless of stored status
    if (!textbox.value || textbox.value.trim() === "") {
      return "isEmpty";
    }
    // If untranslated text is also empty, status is isEmpty
    if (!untranslatedText?.originalText || untranslatedText.originalText.trim() === "") {
      return "isEmpty";
    }
    // Otherwise, use the stored status
    return untranslatedText?.status || "needsChecking";
  }, []);

  const handleAddCustomTextbox = useCallback(() => {
    if (!onAddTextBox || !onAddUntranslatedText) return;

    // Create a new textbox with custom properties
    const textboxId = onAddTextBox(
      20, // x position
      20, // y position
      currentPage,
      "translated",
      {
        fontSize: 10,
        width: 200,
        height: 30,
        fontFamily: "Arial",
        backgroundColor: "#ffffff",
        color: "#000000",
        value: "", // Initially empty
      }
    );

    // Create corresponding untranslated text
    onAddUntranslatedText({
      translatedTextboxId: textboxId,
      originalText: "",
      page: currentPage,
      x: 20,
      y: 20,
      width: 200,
      height: 30,
      isCustomTextbox: true,
      status: "isEmpty"
    });
  }, [onAddTextBox, onAddUntranslatedText, currentPage]);

  const handleDelete = useCallback((textboxId: string) => {
    // Call the delete handler if provided, otherwise just clear the text
    if (onDeleteTextBox) {
      onDeleteTextBox(textboxId);
    } else {
      // Fallback: just clear the text
      onUpdateTextBox(textboxId, { value: "" });
    }
    console.log('Delete textbox:', textboxId);
  }, [onDeleteTextBox, onUpdateTextBox]);

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
    textarea.style.height = `${Math.max(60, textarea.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(autoResizeTextarea);
  }, [translatedTextBoxes, autoResizeTextarea]);

  if (textboxesForTable.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-blue-50"
        style={{
          width: pageWidth * scale,
          height: pageHeight * scale,
          minHeight: "400px",
        }}
      >
        <div className="text-center text-blue-600 p-8">
          <div className="text-lg mb-2 text-blue-800 font-semibold">
            No translated text found on page {currentPage}
          </div>
          <div className="text-sm text-blue-500">
            Switch to Layout mode to view and edit text boxes on this page, then return to
            Translate mode to see them here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-blue-50 p-6 overflow-auto"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
        minHeight: "400px",
      }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Translation Table - Page {currentPage}
        </h3>
        <p className="text-sm text-blue-600">
          Edit translated text below. Use Ctrl+Enter to finish editing a text
          area.
        </p>
      </div>

      <div className="border border-blue-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full bg-white">
          <thead>
            <tr className="bg-blue-100">
              <th className="px-4 py-3 text-left text-sm font-medium text-blue-800 border-b border-blue-200">
                Original Text
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-blue-800 border-b border-blue-200">
                Translated Text
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-blue-800 border-b border-blue-200 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {textboxesForTable.map((textbox, index) => {
              const originalText = findOriginalText(textbox);
              const untranslatedText = untranslatedTexts.find(
                (text) => text.translatedTextboxId === textbox.id
              );
              return (
                <tr
                  key={textbox.id}
                  className={`border-b border-blue-100 hover:bg-blue-50 cursor-pointer transition-colors ${
                    editingId === textbox.id || editingOriginalId === untranslatedText?.id ? "bg-blue-100" : "bg-white"
                  }`}
                  onClick={() => onRowClick?.(textbox.id)}
                  title="Click to highlight original text location"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-blue-800 max-w-xs">
                      {untranslatedText?.isCustomTextbox ? (
                        <div className="bg-blue-100 p-2 rounded text-sm text-blue-500 border border-blue-200">
                          <span className="italic">Custom Textbox</span>
                        </div>
                      ) : untranslatedText && onUpdateUntranslatedText ? (
                        <textarea
                          ref={(el) => {
                            if (el) {
                              originalTextareaRefs.current[untranslatedText.id] = el;
                              autoResizeTextarea(el);
                            }
                          }}
                          value={originalText || ""}
                          onChange={(e) =>
                            handleOriginalTextChange(untranslatedText.id, e.target.value)
                          }
                          onFocus={() => handleOriginalTextareaFocus(untranslatedText.id)}
                          onBlur={handleOriginalTextareaBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey) {
                              e.preventDefault();
                              (e.target as HTMLTextAreaElement).blur();
                            }
                            e.stopPropagation(); // Prevent row click when editing
                          }}
                          onInput={(e) =>
                            autoResizeTextarea(e.target as HTMLTextAreaElement)
                          }
                          onClick={(e) => e.stopPropagation()} // Prevent row click when clicking textarea
                          className={`w-full p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-blue-800 ${
                            editingOriginalId === untranslatedText.id
                              ? "border-blue-400 bg-blue-50"
                              : "border-blue-200 bg-white hover:border-blue-300"
                          }`}
                          style={{
                            minHeight: "60px",
                            fontFamily: "Arial",
                            fontSize: "12px",
                          }}
                          placeholder="Enter original text..."
                          spellCheck={false}
                        />
                      ) : originalText ? (
                        <div className="bg-blue-50 p-2 rounded text-sm text-blue-700">
                          {originalText}
                        </div>
                      ) : (
                        <div className="bg-blue-50 p-2 rounded text-xs italic text-blue-400">
                          Original text from page {textbox.page}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
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
                        e.stopPropagation(); // Prevent row click when editing
                      }}
                      onInput={(e) =>
                        autoResizeTextarea(e.target as HTMLTextAreaElement)
                      }
                      onClick={(e) => e.stopPropagation()} // Prevent row click when clicking textarea
                      className={`w-full p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-blue-800 ${
                        editingId === textbox.id
                          ? "border-blue-400 bg-blue-50"
                          : "border-blue-200 bg-white hover:border-blue-300"
                      }`}
                      style={{
                        minHeight: "60px",
                        fontFamily: textbox.fontFamily || "Arial",
                        fontSize: `${Math.max(
                          12,
                          (textbox.fontSize || 12) * 0.8
                        )}px`,
                      }}
                      placeholder="Enter translated text..."
                      spellCheck={false}
                    />
                    <div className="mt-1 text-xs text-blue-500 flex justify-between">
                      <span>Page {textbox.page}</span>
                      <span className="text-blue-400">
                        {textbox.fontFamily || "Arial"} •{" "}
                        {textbox.fontSize || 12}px
                      </span>
                    </div>
                    {/* Status indicator below textbox */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {(() => {
                          const effectiveStatus = getEffectiveStatus(textbox, untranslatedText);
                          if (effectiveStatus === "checked") {
                            return (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-green-400">Checked</span>
                              </>
                            );
                          } else if (effectiveStatus === "needsChecking") {
                            return (
                              <>
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-xs text-yellow-400">Needs Check</span>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <span className="text-xs text-gray-400">Empty</span>
                              </>
                            );
                          }
                        })()}
                      </div>
                      {untranslatedText?.isCustomTextbox && (
                        <span className="text-xs px-1 py-0.5 bg-blue-600 text-white rounded">Custom</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2">
                      {/* Approve Button */}
                      <button
                        onClick={() => handleApprove(textbox.id)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200 group ${
                          (() => {
                            const effectiveStatus = getEffectiveStatus(textbox, untranslatedText);
                            const isDisabled = effectiveStatus === "isEmpty";
                            
                            if (isDisabled) {
                              return "bg-gray-300 text-gray-500 cursor-not-allowed";
                            } else if (effectiveStatus === "checked") {
                              return "bg-green-600 text-white hover:bg-green-700";
                            } else {
                              return "bg-green-500 hover:bg-green-600 text-white";
                            }
                          })()
                        }`}
                        disabled={getEffectiveStatus(textbox, untranslatedText) === "isEmpty"}
                        title={(() => {
                          const effectiveStatus = getEffectiveStatus(textbox, untranslatedText);
                          if (effectiveStatus === "isEmpty") {
                            return "Cannot check empty textbox";
                          } else if (effectiveStatus === "checked") {
                            return "Mark as needs checking";
                          } else {
                            return "Mark as checked";
                          }
                        })()}
                      >
                        <svg
                          className="w-4 h-4"
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
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(textbox.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors duration-200 group"
                        title="Delete textbox and original text"
                      >
                        <svg
                          className="w-4 h-4"
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

      <div className="mt-4 text-sm text-blue-600">
        <div className="flex items-center justify-between">
          <span>{textboxesForTable.length} text boxes found on page {currentPage}</span>
          <span className="text-xs text-blue-500">
            Switch to Layout mode to modify text box positions and styling
          </span>
        </div>
      </div>

      {/* Add Custom Textbox Button */}
      {onAddTextBox && onAddUntranslatedText && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleAddCustomTextbox}
            className="group relative flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
            title="Add custom textbox"
          >
            <svg
              className="w-6 h-6 transition-transform group-hover:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-blue-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-blue-600 shadow-lg">
              Add Custom Textbox
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-blue-800"></div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
