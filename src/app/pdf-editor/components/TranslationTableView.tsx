import React, { useCallback, useState, useEffect, useRef } from "react";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";

interface TranslationTableViewProps {
  translatedTextBoxes: TextField[];
  untranslatedTexts: UntranslatedText[];
  onUpdateTextBox: (id: string, updates: Partial<TextField>) => void;
  onDeleteTextBox?: (textboxId: string) => void;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  currentPage: number;
}

export const TranslationTableView: React.FC<TranslationTableViewProps> = ({
  translatedTextBoxes,
  untranslatedTexts,
  onUpdateTextBox,
  onDeleteTextBox,
  pageWidth,
  pageHeight,
  scale,
  currentPage,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});

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

  const handleTextareaFocus = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleTextareaBlur = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleApprove = useCallback((textboxId: string) => {
    // Add visual feedback or mark as approved
    console.log('Approved textbox:', textboxId);
    // You could add an "approved" state or styling here
  }, []);

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
        className="flex items-center justify-center bg-gray-900"
        style={{
          width: pageWidth * scale,
          height: pageHeight * scale,
          minHeight: "400px",
        }}
      >
        <div className="text-center text-gray-300 p-8">
          <div className="text-lg mb-2 text-white">
            No translated text found on page {currentPage}
          </div>
          <div className="text-sm">
            Switch to Layout mode to view and edit text boxes on this page, then return to
            Translate mode to see them here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-gray-900 p-6 overflow-auto"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
        minHeight: "400px",
      }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Translation Table - Page {currentPage}
        </h3>
        <p className="text-sm text-gray-300">
          Edit translated text below. Use Ctrl+Enter to finish editing a text
          area.
        </p>
      </div>

      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <table className="w-full bg-gray-800">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200 border-b border-gray-600">
                Original Text
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200 border-b border-gray-600">
                Translated Text
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-200 border-b border-gray-600 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {textboxesForTable.map((textbox, index) => {
              const originalText = findOriginalText(textbox);
              return (
                <tr
                  key={textbox.id}
                  className={`border-b border-gray-600 hover:bg-gray-700 ${
                    editingId === textbox.id ? "bg-gray-700" : "bg-gray-800"
                  }`}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-gray-200 max-w-xs">
                      {originalText ? (
                        <div className="bg-gray-700 p-2 rounded text-sm text-gray-200">
                          {originalText}
                        </div>
                      ) : (
                        <div className="bg-gray-700 p-2 rounded text-xs italic text-gray-400">
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
                      onKeyDown={(e) => handleKeyDown(e, textbox.id)}
                      onInput={(e) =>
                        autoResizeTextarea(e.target as HTMLTextAreaElement)
                      }
                      className={`w-full p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white ${
                        editingId === textbox.id
                          ? "border-blue-400 bg-gray-700"
                          : "border-gray-600 bg-gray-800 hover:border-gray-500"
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
                    <div className="mt-1 text-xs text-gray-400 flex justify-between">
                      <span>Page {textbox.page}</span>
                      <span className="text-gray-500">
                        {textbox.fontFamily || "Arial"} •{" "}
                        {textbox.fontSize || 12}px
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2">
                      {/* Approve Button */}
                      <button
                        onClick={() => handleApprove(textbox.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors duration-200 group"
                        title="Approve translation"
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
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors duration-200 group"
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

      <div className="mt-4 text-sm text-gray-300">
        <div className="flex items-center justify-between">
          <span>{textboxesForTable.length} text boxes found on page {currentPage}</span>
          <span className="text-xs text-gray-500">
            Switch to Layout mode to modify text box positions and styling
          </span>
        </div>
      </div>
    </div>
  );
};
