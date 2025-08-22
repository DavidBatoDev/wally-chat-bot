import React from "react";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";
import { Languages, Eye } from "lucide-react";

interface ViewerTranslationTableProps {
  translatedTextBoxes: TextField[];
  untranslatedTexts: UntranslatedText[];
  currentPage: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
}

export const ViewerTranslationTable: React.FC<ViewerTranslationTableProps> = ({
  translatedTextBoxes,
  untranslatedTexts,
  currentPage,
  sourceLanguage,
  desiredLanguage,
}) => {
  // Filter content for current page
  const currentPageTextBoxes = translatedTextBoxes.filter(
    (textBox) => textBox.page === currentPage
  );
  const currentPageUntranslatedTexts = untranslatedTexts.filter(
    (text) => text.page === currentPage
  );

  return (
    <div className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300" 
         style={{ left: `${8}px`, top: `${140}px`, maxWidth: "400px" }}>
      <div className="bg-white rounded-lg shadow-lg border border-yellow-200 backdrop-blur-sm bg-white/95 max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              Translation View - Page {currentPage}
            </span>
          </div>
          {(sourceLanguage || desiredLanguage) && (
            <div className="flex items-center space-x-2 mt-1">
              <Languages className="w-3 h-3 text-yellow-600" />
              <span className="text-xs text-yellow-700">
                {sourceLanguage} → {desiredLanguage}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentPageTextBoxes.length === 0 && currentPageUntranslatedTexts.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <Languages className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No translations on this page</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Translated Text Boxes */}
              {currentPageTextBoxes.map((textBox) => (
                <div
                  key={textBox.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Original
                      </label>
                      <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                        {textBox.originalText || textBox.value || "(No original text)"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Translation
                      </label>
                      <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                        {textBox.value || "(No translation)"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Untranslated Texts */}
              {currentPageUntranslatedTexts.map((text) => (
                <div
                  key={text.id}
                  className="p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-orange-600 mb-1">
                        Untranslated Text
                      </label>
                      <div className="text-sm text-gray-800 bg-white p-2 rounded border">
                        {text.text}
                      </div>
                    </div>
                    <div className="text-xs text-orange-600">
                      Position: ({Math.round(text.x)}, {Math.round(text.y)})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};