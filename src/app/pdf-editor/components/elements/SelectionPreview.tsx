import React from "react";

interface SelectionPreviewProps {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  scale: number;
}

export const SelectionPreview: React.FC<SelectionPreviewProps> = ({
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
        left: left * scale,
        top: top * scale,
        width: width * scale,
        height: height * scale,
      }}
    />
  );
};
