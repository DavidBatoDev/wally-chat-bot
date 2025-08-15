"use client";

import React, { useRef, useEffect, useState } from "react";
import Panzoom from "@panzoom/panzoom";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export default function ZoomTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<any>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (elementRef.current && containerRef.current) {
      // Initialize Panzoom
      panzoomRef.current = Panzoom(elementRef.current, {
        minScale: 0.5,
        maxScale: 3,
        startScale: 1,
        disablePan: false,
        contain: "outside",
        animate: true,
        duration: 200,
      });

      // Listen to zoom events
      elementRef.current.addEventListener("panzoomzoom", (e: any) => {
        setScale(e.detail.scale);
      });

      // Handle wheel zoom with ctrl/cmd
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          panzoomRef.current?.zoom(delta, {
            animate: false,
          });
        }
      };

      containerRef.current.addEventListener("wheel", handleWheel, {
        passive: false,
      });

      return () => {
        panzoomRef.current?.destroy();
      };
    }
  }, []);

  const handleZoomIn = () => {
    panzoomRef.current?.zoomIn({ animate: true });
  };

  const handleZoomOut = () => {
    panzoomRef.current?.zoomOut({ animate: true });
  };

  const handleReset = () => {
    panzoomRef.current?.reset({ animate: true });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Panzoom Library Test</h1>
        
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
                  panzoomRef.current?.zoom(newScale, {
                    animate: true,
                    force: true,
                  });
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
            }}
          >
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">
                  Zoomable Content Area
                </h2>
                <p className="mb-4">
                  This content can be zoomed and panned using the panzoom library.
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
                  <li>✓ Pan by dragging</li>
                  <li>✓ Reset to original size</li>
                  <li>✓ Smooth animations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}