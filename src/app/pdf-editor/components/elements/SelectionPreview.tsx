import React, { memo } from "react";

interface SelectionPreviewProps {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  scale: number;
}

const SelectionPreview: React.FC<SelectionPreviewProps> = ({
  start,
  end,
  scale,
}) => {
  if (!start || !end) return null;

  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return (
    <div
      className="absolute border border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none z-50"
      style={{
        transform: `translate(${left * scale}px, ${top * scale}px)`,
        width: width * scale,
        height: height * scale,
        willChange: 'transform',
      }}
    />
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MemoizedSelectionPreview = memo(SelectionPreview);

// Export both for compatibility
export { SelectionPreview };
