import React, { useRef } from "react";
import { Rnd, DraggableData, RndDragCallback } from "react-rnd";
import { Move } from "lucide-react";

interface SelectionRectangleProps {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scale: number;
  onMove: () => void;
  onDelete: () => void;
  isMoving: boolean;
  // New transform-based handlers instead of real-time updates
  onDragStart?: () => void;
  onDrag?: (deltaX: number, deltaY: number) => void;
  onDragStop?: (deltaX: number, deltaY: number) => void;
  // Keep old handlers for backward compatibility (will be deprecated)
  onDragStopSelection?: (deltaX: number, deltaY: number) => void;
  onDragSelection?: (deltaX: number, deltaY: number) => void;
  // Transform offset for smooth dragging
  dragOffset?: { x: number; y: number } | null;
}

export const SelectionRectangle: React.FC<SelectionRectangleProps> = ({
  bounds,
  scale,
  onMove,
  onDelete,
  isMoving,
  onDragStart,
  onDrag,
  onDragStop,
  onDragStopSelection, // Legacy - will be deprecated
  onDragSelection,     // Legacy - will be deprecated
  dragOffset,
}) => {
  const iconSize = 20;
  const iconOffset = 10;
  const initialDragPosition = useRef<{ x: number; y: number } | null>(null);

  // Called when drag starts
  const handleDragStart: RndDragCallback = (e, data) => {
    // Store initial position for delta calculation
    initialDragPosition.current = { x: data.x, y: data.y };
    
    if (onDragStart) {
      onDragStart();
    }
  };

  // Called during drag - for transform-based approach, we calculate and apply offsets
  const handleDrag: RndDragCallback = (e, data) => {
    if (initialDragPosition.current) {
      const deltaX = (data.x - initialDragPosition.current.x) / scale;
      const deltaY = (data.y - initialDragPosition.current.y) / scale;
      
      if (onDrag) {
        // New transform-based approach
        onDrag(deltaX, deltaY);
      } else if (onDragSelection) {
        // Legacy fallback - will be deprecated
        onDragSelection(deltaX, deltaY);
      }
    }
  };

  // Called when drag stops - apply final positions
  const handleDragStop: RndDragCallback = (e, data) => {
    if (initialDragPosition.current) {
      const deltaX = (data.x - initialDragPosition.current.x) / scale;
      const deltaY = (data.y - initialDragPosition.current.y) / scale;
      
      if (onDragStop) {
        // New transform-based approach
        onDragStop(deltaX, deltaY);
      } else if (onDragStopSelection) {
        // Legacy fallback - will be deprecated
        onDragStopSelection(deltaX, deltaY);
      }
    }
    
    // Clear initial position
    initialDragPosition.current = null;
  };

  return (
    <div
      className="selection-rectangle-container"
      style={{
        position: "absolute",
        left: bounds.x * scale,
        top: bounds.y * scale,
        width: bounds.width * scale,
        height: bounds.height * scale,
        transform: dragOffset 
          ? `translate(${dragOffset.x * scale}px, ${dragOffset.y * scale}px)` 
          : "none",
        zIndex: 1000,
        pointerEvents: "none",
        willChange: dragOffset ? 'transform' : 'auto',
      }}
    >
      <Rnd
        position={{ x: 0, y: 0 }}
        size={{ width: bounds.width * scale, height: bounds.height * scale }}
        disableDragging={false}
        dragHandleClassName="drag-handle"
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
              top: bounds.height * scale + 5,
              pointerEvents: "auto",
            }}
          >
            <div
              className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move"
              title="Click and drag to move selection"
            >
              <Move size={10} />
            </div>
          </div>

          {/* Delete icon */}
          <div
            className="absolute cursor-pointer bg-white border border-gray-300 rounded shadow-md hover:shadow-lg hover:bg-red-50 hover:border-red-300 transition-all"
            style={{
              left: bounds.width * scale + iconOffset,
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
    </div>
  );
};
