"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export default function ZoomTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const animationFrameRef = useRef<number | null>(null);

  // Smooth zoom animation
  const animateZoom = useCallback((targetScale: number, duration: number = 200) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startScale = scale;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);
      
      const newScale = startScale + (targetScale - startScale) * easedProgress;
      
      setScale(newScale);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [scale]);

  // Handle wheel zoom with ctrl/cmd
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let accumulatedDelta = 0;
    let wheelTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Accumulate wheel delta for smoother zooming
        accumulatedDelta += e.deltaY;
        
        // Clear previous timeout
        if (wheelTimeout) clearTimeout(wheelTimeout);
        
        // Debounce wheel events
        wheelTimeout = setTimeout(() => {
          const zoomFactor = 0.002;
          const delta = -accumulatedDelta * zoomFactor;
          const newScale = Math.max(0.5, Math.min(3, scale * (1 + delta)));
          
          animateZoom(newScale, 100);
          
          accumulatedDelta = 0;
          wheelTimeout = null;
        }, 10);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [scale, animateZoom]);

  const handleZoomIn = () => {
    const newScale = Math.min(3, scale * 1.2);
    animateZoom(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.5, scale / 1.2);
    animateZoom(newScale);
  };

  const handleReset = () => {
    animateZoom(1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Enhanced Zoom Control Test</h1>
        
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="50"
                max="300"
                value={scale * 100}
                onChange={(e) => {
                  const newScale = parseInt(e.target.value) / 100;
                  animateZoom(newScale);
                }}
                className="w-32"
              />
              <span className="text-sm font-medium w-12">
                {Math.round(scale * 100)}%
              </span>
            </div>
            
            <button
              onClick={handleZoomIn}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleReset}
              className="p-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-2 text-sm text-gray-600">
            Use Ctrl/Cmd + Mouse Wheel to zoom, or use the controls above
          </div>
        </div>

        {/* Zoomable Content */}
        <div
          ref={containerRef}
          className="bg-white rounded-lg shadow-md overflow-hidden"
          style={{ height: "600px", position: "relative" }}
        >
          <div
            ref={elementRef}
            className="p-8"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              transition: "none",
            }}
          >
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">
                  Zoomable Content Area
                </h2>
                <p className="mb-4">
                  This content can be zoomed using our enhanced zoom controls with smooth animations.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <div
                      key={num}
                      className="bg-white/20 backdrop-blur p-4 rounded"
                    >
                      <div className="text-3xl font-bold">{num}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Test Features:</h3>
                <ul className="text-left text-sm space-y-1">
                  <li>✓ Zoom with buttons or slider</li>
                  <li>✓ Zoom with Ctrl/Cmd + Mouse Wheel</li>
                  <li>✓ Smooth zoom animations with easing</li>
                  <li>✓ Reset to original size</li>
                  <li>✓ Debounced wheel zoom for better performance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}