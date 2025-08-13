import React, { useRef, useEffect, useCallback, memo, useMemo } from "react";

interface ShapePreviewProps {
  isDrawing: boolean;
  shapeType: "circle" | "rectangle" | "line" | null;
  startCoords: { x: number; y: number } | null;
  endCoords: { x: number; y: number } | null;
  targetView: "original" | "translated" | "final-layout" | null;
  currentView: "original" | "translated" | "split" | "final-layout";
  pageWidth: number;
  scale: number;
  templateScaleFactor?: number;
  className?: string;
}

export const ShapePreview = memo(
  ({
    isDrawing,
    shapeType,
    startCoords,
    endCoords,
    targetView,
    currentView,
    pageWidth,
    scale,
    templateScaleFactor,
    className = "",
  }: ShapePreviewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastRenderTimeRef = useRef(0);
    const RENDER_THROTTLE_MS = 8; // ~120fps for smoother rendering

    // Performance optimization: Memoize effective scale calculation
    const effectiveScale = useMemo(() => {
      if (
        currentView === "split" &&
        targetView === "translated" &&
        templateScaleFactor
      ) {
        return scale * templateScaleFactor;
      }
      return scale;
    }, [currentView, targetView, scale, templateScaleFactor]);

    // Performance optimization: Memoize split view check
    const isSplitTranslated = useMemo(() => {
      return currentView === "split" && targetView === "translated";
    }, [currentView, targetView]);

    // Calculate preview position
    const getPreviewPosition = useCallback(() => {
      if (!startCoords || !endCoords) return null;

      let left: number;
      let top: number;

      if (isSplitTranslated) {
        // For split view translated side, offset by page width + gap
        left =
          Math.min(startCoords.x, endCoords.x) * effectiveScale +
          pageWidth * scale +
          20;
        top = Math.min(startCoords.y, endCoords.y) * effectiveScale;
      } else {
        left = Math.min(startCoords.x, endCoords.x) * effectiveScale;
        top = Math.min(startCoords.y, endCoords.y) * effectiveScale;
      }

      const width = Math.abs(endCoords.x - startCoords.x) * effectiveScale;
      const height = Math.abs(endCoords.y - startCoords.y) * effectiveScale;

      return { left, top, width, height };
    }, [
      startCoords,
      endCoords,
      isSplitTranslated,
      pageWidth,
      scale,
      effectiveScale,
    ]);

    // Calculate circle-specific preview position for accurate rendering
    const getCirclePreviewPosition = useCallback(() => {
      if (!startCoords || !endCoords) return null;

      // For circles, we need to calculate the center and dimensions
      const centerX = (startCoords.x + endCoords.x) / 2;
      const centerY = (startCoords.y + endCoords.y) / 2;

      // Use the actual X and Y differences to maintain the user's intended shape
      // This allows for oval circles, just like the actual shape component
      // The preview will now show exactly what the final shape will look like
      const width = Math.abs(endCoords.x - startCoords.x);
      const height = Math.abs(endCoords.y - startCoords.y);

      // Calculate the top-left corner of the bounding box (this matches how the final shape is positioned)
      const boundingBoxX = centerX - width / 2;
      const boundingBoxY = centerY - height / 2;

      let left: number;
      let top: number;

      if (isSplitTranslated) {
        left = boundingBoxX * effectiveScale + pageWidth * scale + 20;
        top = boundingBoxY * effectiveScale;
      } else {
        left = boundingBoxX * effectiveScale;
        top = boundingBoxY * effectiveScale;
      }

      const scaledWidth = width * effectiveScale;
      const scaledHeight = height * effectiveScale;

      return {
        left,
        top,
        width: scaledWidth,
        height: scaledHeight,
        centerX: scaledWidth / 2, // Center within the canvas
        centerY: scaledHeight / 2, // Center within the canvas
        radiusX: scaledWidth / 2, // X radius for oval
        radiusY: scaledHeight / 2, // Y radius for oval
      };
    }, [
      startCoords,
      endCoords,
      isSplitTranslated,
      pageWidth,
      scale,
      effectiveScale,
    ]);

    // Performance optimization: Throttled drawing function
    const drawPreview = useCallback(() => {
      const now = performance.now();
      if (now - lastRenderTimeRef.current < RENDER_THROTTLE_MS) {
        return;
      }
      lastRenderTimeRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas || !isDrawing || !startCoords || !endCoords || !shapeType)
        return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (shapeType === "circle") {
        // Use circle-specific positioning for accurate rendering
        const circlePosition = getCirclePreviewPosition();
        if (!circlePosition) return;

        // Set canvas size and position for circle
        canvas.style.left = `${circlePosition.left}px`;
        canvas.style.top = `${circlePosition.top}px`;
        canvas.width = circlePosition.width;
        canvas.height = circlePosition.height;

        // Clear canvas
        ctx.clearRect(0, 0, circlePosition.width, circlePosition.height);

        // Set drawing styles for circle
        ctx.strokeStyle = "#ef4444";
        ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        // Draw ellipse from center - this allows for both circles and ovals
        // The preview now accurately represents the final shape dimensions
        const centerX = circlePosition.centerX;
        const centerY = circlePosition.centerY;
        const radiusX = circlePosition.radiusX;
        const radiusY = circlePosition.radiusY;

        // Use ellipse for more accurate representation
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else {
        // Use regular positioning for rectangles and lines
        const position = getPreviewPosition();
        if (!position) return;

        // Set canvas size and position
        canvas.style.left = `${position.left}px`;
        canvas.style.top = `${position.top}px`;
        canvas.width = position.width;
        canvas.height = position.height;

        // Clear canvas
        ctx.clearRect(0, 0, position.width, position.height);

        // Set drawing styles
        ctx.strokeStyle = "#ef4444";
        ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (shapeType === "line") {
          // Draw line preview
          const startX = startCoords.x < endCoords.x ? 0 : position.width;
          const startY = startCoords.y < endCoords.y ? 0 : position.height;
          const endX = startCoords.x < endCoords.x ? position.width : 0;
          const endY = startCoords.y < endCoords.y ? position.height : 0;

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Draw anchor points
          ctx.setLineDash([]);
          ctx.fillStyle = "#3b82f6";
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;

          // Start point
          ctx.beginPath();
          ctx.arc(startX, startY, 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          // End point
          ctx.beginPath();
          ctx.arc(endX, endY, 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        } else {
          // Rectangle
          ctx.fillRect(0, 0, position.width, position.height);
          ctx.strokeRect(0, 0, position.width, position.height);
        }
      }
    }, [
      isDrawing,
      startCoords,
      endCoords,
      shapeType,
      getPreviewPosition,
      getCirclePreviewPosition,
    ]);

    // Performance optimization: Use requestAnimationFrame with throttling
    useEffect(() => {
      if (isDrawing && startCoords && endCoords) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(drawPreview);
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isDrawing, startCoords, endCoords, drawPreview]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []);

    if (!isDrawing || !startCoords || !endCoords || !shapeType) {
      return null;
    }

    return (
      <canvas
        ref={canvasRef}
        className={`absolute pointer-events-none ${className}`}
        style={{
          zIndex: 50,
          position: "absolute",
          willChange: "transform", // Performance hint for GPU acceleration
        }}
      />
    );
  }
);

ShapePreview.displayName = "ShapePreview";
