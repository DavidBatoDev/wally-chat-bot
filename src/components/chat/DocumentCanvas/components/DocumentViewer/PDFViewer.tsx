import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { TemplateMapping, WorkflowField } from '../../types/workflow';
import TemplateMappingOverlay from '../TemplateMappingOverlay';

// Set workerSrc for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
// https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
interface PDFViewerProps {
  url: string;
  templateMappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  showMappings?: boolean;
  onFieldUpdate?: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
  workflowData: any;
  conversationId: string;
  onMappingUpdate?: (fieldKey: string, newMapping: TemplateMapping) => void;
  onMappingAdd?: (fieldKey: string, mapping: TemplateMapping) => void;
  onMappingDelete?: (fieldKey: string) => void;
  onSaveChanges?: () => void;
  onCancelChanges?: () => void;
  unsavedChanges?: boolean;
  isEditingMode?: boolean;
  setIsEditingMode?: (v: boolean) => void;
  requiredFields?: Record<string, string>;
  editingField?: string | null;
  setEditingField?: (fieldKey: string | null) => void;
  onUpdateLayout?: (newMappings: Record<string, TemplateMapping>) => void;
  onScaleChange?: (scale: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ 
  url, 
  templateMappings = {},
  fields = {}, 
  showMappings = false, 
  onFieldUpdate, 
  isTranslatedView = false,
  workflowData,
  conversationId,
  onMappingUpdate,
  onMappingAdd,
  onMappingDelete,
  onSaveChanges,
  onCancelChanges,
  unsavedChanges,
  isEditingMode,
  setIsEditingMode,
  requiredFields,
  editingField,
  setEditingField,
  onUpdateLayout,
  onScaleChange
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNum, setPageNum] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pageDims, setPageDims] = useState<{width: number, height: number}>({width: 0, height: 0});

  // Call onScaleChange whenever scale changes
  useEffect(() => {
    if (onScaleChange) onScaleChange(scale);
  }, [scale, onScaleChange]);

  const onDocumentLoadSuccess = (pdf: any) => {
    console.log('[PDF DEBUG] PDF loaded successfully:', pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
  };

  const onDocumentLoadError = (err: any) => {
    console.error('[PDF DEBUG] PDF load error:', err);
    if (err && err.message) {
      console.error('[PDF DEBUG] Error message:', err.message);
        }
    if (err && err.name) {
      console.error('[PDF DEBUG] Error name:', err.name);
    }
    if (err && err.stack) {
      console.error('[PDF DEBUG] Error stack:', err.stack);
    }
  };

  // Called when a page is rendered
  const onPageRenderSuccess = (page: any) => {
    setPageDims(prev =>
      prev.width !== page.width || prev.height !== page.height
        ? { width: page.width, height: page.height }
        : prev
    );
  };

  // Overlay box helpers
  const getBoxStyle = (mapping: TemplateMapping) => {
    // mapping.position is in PDF points; scale to rendered size
    const { x0, y0, x1, y1 } = mapping.position;
    const width = (x1 - x0) * scale;
    const height = (y1 - y0) * scale;
    const x = x0 * scale;
    const y = y0 * scale;
    return { x, y, width, height };
  };

  const handleBoxDragStop = (key: string, d: any) => {
    const mapping = templateMappings[key];
    if (!mapping) return;
    // Convert back to PDF points
    const newX0 = d.x / scale;
    const newY0 = d.y / scale;
    const width = mapping.position.x1 - mapping.position.x0;
    const height = mapping.position.y1 - mapping.position.y0;
    const newMapping = {
      ...mapping,
      position: {
        x0: newX0,
        y0: newY0,
        x1: newX0 + width,
        y1: newY0 + height
      },
      bbox_center: {
        x: newX0 + width / 2,
        y: newY0 + height / 2
      }
    };
    if (onMappingUpdate) onMappingUpdate(key, newMapping);
  };

  const handleBoxResizeStop = (key: string, dir: any, ref: any, delta: any, pos: any) => {
    const mapping = templateMappings[key];
    if (!mapping) return;
    // Convert back to PDF points
    const newX0 = pos.x / scale;
    const newY0 = pos.y / scale;
    const newWidth = ref.offsetWidth / scale;
    const newHeight = ref.offsetHeight / scale;
    const newMapping = {
      ...mapping,
      position: {
        x0: newX0,
        y0: newY0,
        x1: newX0 + newWidth,
        y1: newY0 + newHeight
      },
      bbox_center: {
        x: newX0 + newWidth / 2,
        y: newY0 + newHeight / 2
      }
    };
    if (onMappingUpdate) onMappingUpdate(key, newMapping);
  };

  const handleZoomChange = (newScale: number) => {
    setScale(Math.max(0.5, Math.min(3, newScale)));
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      {/* Main PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div className="relative mx-auto flex items-center justify-center min-h-full py-4" style={{ width: pageDims.width * scale, minWidth: '100%' }}>
          <div className="relative bg-white shadow-lg" style={{ width: pageDims.width * scale, height: pageDims.height * scale }}>
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading PDF...</div>
              </div>}
            >
              <Page
                pageNumber={pageNum}
                scale={scale}
                onRenderSuccess={onPageRenderSuccess}
              />
              {/* Overlay boxes */}
              {showMappings && (
                <TemplateMappingOverlay
                  mappings={templateMappings}
                  fields={fields}
                  pageNum={pageNum}
                  scale={scale}
                  canvasWidth={pageDims.width * scale}
                  canvasHeight={pageDims.height * scale}
                  visible={showMappings}
                  onFieldUpdate={onFieldUpdate || (() => {})}
                  workflowData={workflowData}
                  conversationId={conversationId}
                  isEditingLayout={isEditingMode}
                  onUpdateLayout={onUpdateLayout}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  isTranslatedView={isTranslatedView}
                />
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-50">
        <div className="flex items-end justify-between p-4 pointer-events-auto">
          {/* Zoom Slider - Bottom Left */}
          <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleZoomChange(scale - 0.1)}
              disabled={scale <= 0.5}
              className="h-7 w-7 p-0"
            >
              <ZoomOut size={14} />
            </Button>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((scale - 0.5) / 2.5) * 100}%, #e5e7eb ${((scale - 0.5) / 2.5) * 100}%, #e5e7eb 100%)`
                }}
              />
              <span className="text-xs font-medium text-gray-700 min-w-[3rem]">
                {Math.round(scale * 100)}%
              </span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleZoomChange(scale + 0.1)}
              disabled={scale >= 3}
              className="h-7 w-7 p-0"
            >
              <ZoomIn size={14} />
            </Button>
          </div>

          {/* Pagination - Bottom Center */}
          {numPages > 1 && (
            <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setPageNum(Math.max(1, pageNum - 1))} 
                disabled={pageNum <= 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm font-medium text-gray-700 px-2">
                {pageNum} of {numPages}
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setPageNum(Math.min(numPages, pageNum + 1))} 
                disabled={pageNum >= numPages}
                className="h-7 w-7 p-0"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}

          {/* Spacer for balance */}
          <div className="w-32"></div>
        </div>
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

export default PDFViewer;