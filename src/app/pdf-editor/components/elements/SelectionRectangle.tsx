import React, { useRef, useState, useCallback } from "react";
import { Rnd, DraggableData, RndDragCallback } from "react-rnd";
import { Move } from "lucide-react";

interface SelectionRectangleProps {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onMove: () => void;
  onDelete: () => void;
  isMoving: boolean;
  onDragStopSelection: (deltaX: number, deltaY: number) => void;
  onDragSelection: (deltaX: number, deltaY: number) => void;
}

export const SelectionRectangle: React.FC<SelectionRectangleProps> = ({
  bounds,
  onMove,
  onDelete,
  isMoving,
  onDragStopSelection,
  onDragSelection,
}) => {
  const iconSize = 20;
  const iconOffset = 10;
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [localOffset, setLocalOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const handleDragStart: RndDragCallback = useCallback(
    (e, data) => {
      startXRef.current = bounds.x;
      startYRef.current = bounds.y;
      setLocalOffset({ x: 0, y: 0 });
    },
    [bounds.x, bounds.y, 1]
  );

  // Called during drag - update position in real time
  const handleDrag: RndDragCallback = (e, data) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const deltaX = data.x - startXRef.current;
    const deltaY = data.y - startYRef.current;
    setLocalOffset({
      x: data.x - startXRef.current,
      y: data.y - startYRef.current,
    });
    onDragSelection(deltaX, deltaY);
  };

  // Called when drag stops - only update position when drag ends, like textbox
  const handleDragStop: RndDragCallback = (e, data) => {
    const effectiveStartX = startXRef.current ?? bounds.x;
    const effectiveStartY = startYRef.current ?? bounds.y;
    const deltaX = data.x - effectiveStartX;
    const deltaY = data.y - effectiveStartY;
    onDragStopSelection(deltaX, deltaY);
    // Reset for next drag
    startXRef.current = null;
    startYRef.current = null;
    setLocalOffset({ x: 0, y: 0 });
  };

  return (
    <Rnd
      position={{
        x: bounds.x + localOffset.x,
        y: bounds.y + localOffset.y,
      }}
      size={{ width: bounds.width, height: bounds.height }}
      disableDragging={false}
      enableResizing={false}
      className="selection-rectangle-rnd"
      style={{ zIndex: 1000, pointerEvents: "none" }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div className="w-full h-full relative">
        {/* Selection rectangle outline */}
        <div
          className="absolute border-2 border-blue-500 bg-blue-50 bg-opacity-20 pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
          }}
        />

        {/* Move handle - similar to textbox move handle */}
        <div
          className={`absolute transform transition-all duration-300 z-20 flex items-center space-x-1 ${
            isMoving ? "opacity-75" : ""
          }`}
          style={{
            left: -5,
            top: bounds.height + 5,
            pointerEvents: "auto",
          }}
        >
          <div
            className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:1-105 transition-all duration-200 cursor-move"
            title="Click and drag to move selection"
          >
            <Move size={10} />
          </div>
        </div>

        {/* Delete icon */}
        <div
          className="absolute cursor-pointer bg-white border border-gray-300 rounded shadow-md hover:shadow-lg hover:bg-red-50 hover:border-red-300 transition-all"
          style={{
            left: bounds.width + iconOffset,
            top: -iconOffset,
            width: iconSize,
            height: iconSize,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          title="Delete selection"
        >
          <svg
            className="w-full h-full p-1 text-gray-600 hover:text-red-600"
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
        </div>
      </div>
    </Rnd>
  );
};
