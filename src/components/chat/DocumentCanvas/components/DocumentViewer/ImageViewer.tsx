import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageViewerProps {
  url: string;
  filename?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ url, filename }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.25, Math.min(5, prev + delta)));
  };

  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      {/* Image Container */}
      <div 
        className="h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          src={url}
          alt={filename || 'Image'}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            maxWidth: scale <= 1 ? '100%' : 'none',
            maxHeight: scale <= 1 ? '100%' : 'none',
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '';
            (e.target as HTMLImageElement).alt = 'Failed to load image';
          }}
        />
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-10">
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleZoomOut}
          disabled={scale <= 0.25}
          className="h-7 w-7 p-0"
        >
          <ZoomOut size={14} />
        </Button>
        
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0.25"
            max="5"
            step="0.25"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((scale - 0.25) / 4.75) * 100}%, #e5e7eb ${((scale - 0.25) / 4.75) * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-xs font-medium text-gray-700 min-w-[3rem]">
            {Math.round(scale * 100)}%
          </span>
        </div>

        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleZoomIn}
          disabled={scale >= 5}
          className="h-7 w-7 p-0"
        >
          <ZoomIn size={14} />
        </Button>

        <div className="w-px h-4 bg-gray-300" />

        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleReset}
          className="h-7 w-7 p-0"
          title="Reset zoom and position"
        >
          <RotateCcw size={14} />
        </Button>
      </div>

      {/* Custom CSS for slider */}
      <style jsx>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
          transition: all 0.2s ease;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        .slider::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }
        .slider::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default ImageViewer;