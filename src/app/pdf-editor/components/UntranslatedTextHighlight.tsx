import React from "react";
import { UntranslatedText } from "../types/pdf-editor.types";

interface UntranslatedTextHighlightProps {
  untranslatedTexts: UntranslatedText[];
  highlightedId: string | null;
  currentPage: number;
  scale: number;
}

export const UntranslatedTextHighlight: React.FC<UntranslatedTextHighlightProps> = ({
  untranslatedTexts,
  highlightedId,
  currentPage,
  scale,
}) => {
  if (!highlightedId) return null;

  const highlightedText = untranslatedTexts.find(
    (text) => text.id === highlightedId && text.page === currentPage
  );

  if (!highlightedText) return null;

  // Add buffer to make the bounding box more visible
  const buffer = 10; // pixels of buffer around the text
  const bufferedLeft = Math.max(0, (highlightedText.x * scale) - buffer);
  const bufferedTop = Math.max(0, (highlightedText.y * scale) - buffer);
  const bufferedWidth = (highlightedText.width * scale) + (buffer * 2);
  const bufferedHeight = (highlightedText.height * scale) + (buffer * 2);

  return (
    <div
      className="absolute pointer-events-none z-50 border-4 border-blue-400 bg-blue-400 bg-opacity-20 animate-pulse"
      style={{
        left: bufferedLeft,
        top: bufferedTop,
        width: bufferedWidth,
        height: bufferedHeight,
        // boxShadow: "0 0 20px rgba(255, 255, 0, 0.8)",
      }}
    >
      {/* Optional: Add a label showing the original text */}
      <div
        className="absolute -top-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
        style={{
          fontSize: Math.max(10, 12 / scale), // Scale font size inversely to maintain readability
          left: buffer, // Adjust label position to account for buffer
        }}
      >
        {highlightedText.originalText}
      </div>
    </div>
  );
};
