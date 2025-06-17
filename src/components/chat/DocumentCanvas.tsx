// client/src/components/chat/DocumentCanvas.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, FileText, Image, File, Eye, EyeOff, Check, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

// Add PDF.js types
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface DocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

interface TemplateMappingFont {
  name: string;
  size: number;
  color: string;
}

interface TemplateMappingPosition {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TemplateMappingBboxCenter {
  x: number;
  y: number;
}

interface TemplateMapping {
  label: string;
  font: TemplateMappingFont;
  position: TemplateMappingPosition;
  bbox_center: TemplateMappingBboxCenter;
  alignment: string;
  page_number: number;
}

interface WorkflowField {
  value: string;
  value_status: 'ocr' | 'pending' | 'edited' | 'confirmed';
  translated_value: string | null;
  translated_status: 'pending'| 'translated' | 'completed' | 'edited';
}

interface WorkflowData {
  file_id: string;
  base_file_public_url?: string;
  template_id: string;
  template_file_public_url?: string;
  origin_template_mappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  template_translated_file_public_url?: string;
  translated_template_mappings?: Record<string, TemplateMapping>;

  
}

type ViewType = 'original' | 'template' | 'translated_template';

// Editable Input Component
const EditableInput: React.FC<{
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onSave, onCancel, placeholder, className }) => {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className={`absolute z-50 bg-white rounded-lg shadow-lg border border-gray-300 p-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
        />
        <Button
          size="sm"
          onClick={handleSave}
          className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600 text-white"
        >
          <Check size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-7 w-7 p-0"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
};

// Template Mapping Overlay Component with Editable Fields
const TemplateMappingOverlay: React.FC<{
  mappings: Record<string, TemplateMapping>;
  fields: Record<string, WorkflowField>;
  pageNum: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
  onFieldUpdate: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
}> = ({ mappings, fields, pageNum, scale, canvasWidth, canvasHeight, visible, onFieldUpdate, isTranslatedView = false }) => {
  const [hoveredMapping, setHoveredMapping] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editInputPosition, setEditInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState<boolean>(false);

  if (!visible || !mappings) return null;

  // Color schemes for different statuses
  const getStatusColors = (field: WorkflowField | undefined, isTranslatedView: boolean) => {
    if (!field) {
      return {
        border: '#9ca3af',      // gray-400 - no data
        background: 'rgba(156, 163, 175, 0.1)',
        label: 'No Data',
        priority: 0
      };
    }

    const status = isTranslatedView ? field.translated_status : field.value_status;
    const value = isTranslatedView ? field.translated_value : field.value;
    const hasValue = value && value.trim().length > 0;

    // Priority system: higher numbers = higher priority for display
    switch (status) {
      // case 'confirmed':
      //   return {
      //     border: '#10b981',      // green-500 - confirmed
      //     background: 'rgba(16, 185, 129, 0.15)',
      //     label: 'Confirmed',
      //     priority: 4
      //   };
      case 'edited':
        return {
          border: '#3b82f6',      // blue-500 - manually edited
          background: 'rgba(59, 130, 246, 0.15)',
          label: 'Edited',
          priority: 3
        };
      case 'ocr':
      case 'translated':
        return {
          border: '#f59e0b',      // amber-500 - OCR extracted or translated
          background: 'rgba(245, 158, 11, 0.15)',
          label: isTranslatedView ? 'Translated' : 'OCR Extracted',
          priority: 2
        };
      case 'pending':
      default:
        return {
          border: '#6b7280',    // gray-500 - has value but pending
          background: 'rgba(107, 114, 128, 0.15)',
          label: 'Pending',
          priority: 1
        };
    }
  };

  // Filter mappings for current page
  const currentPageMappings = Object.entries(mappings).filter(
    ([_, mapping]) => mapping.page_number === pageNum
  );

  if (currentPageMappings.length === 0) return null;

  // Handle clicking outside to close popup
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && editingField) {
      setEditingField(null);
      setEditInputPosition(null);
    }
  };

  const handleFieldClick = (fieldKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (editingField === fieldKey) {
      return;
    }
    
    if (editingField) {
      setEditingField(null);
      setEditInputPosition(null);
      return;
    }
    
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const overlayContainer = target.parentElement;
    
    if (overlayContainer) {
      const containerRect = overlayContainer.getBoundingClientRect();
      setEditInputPosition({
        x: rect.left - containerRect.left,
        y: rect.bottom - containerRect.top + 4
      });
    } else {
      setEditInputPosition({
        x: target.offsetLeft,
        y: target.offsetTop + target.offsetHeight + 4
      });
    }
    
    setEditingField(fieldKey);
  };

  const handleFieldSave = (fieldKey: string, newValue: string) => {
    onFieldUpdate(fieldKey, newValue);
    setEditingField(null);
    setEditInputPosition(null);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditInputPosition(null);
  };

  return (
    <>
      {/* Main overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {currentPageMappings.map(([key, mapping]) => {
          // Convert coordinates
          const x = mapping.position.x0 * scale;
          const y = mapping.position.y0 * scale;
          const width = (mapping.position.x1 - mapping.position.x0) * scale;
          const height = (mapping.position.y1 - mapping.position.y0) * scale;

          const isHovered = hoveredMapping === key;
          const isEditing = editingField === key;
          const field = fields[key];
          const fieldValue = isTranslatedView 
            ? (field?.translated_value || '') 
            : (field?.value || '');
          
          // Get status-based colors
          const statusColors = getStatusColors(field, isTranslatedView);
          
          // Override colors for hover and edit states
          let borderColor = statusColors.border;
          let backgroundColor = statusColors.background;
          
          if (isEditing) {
            borderColor = '#10b981'; // green-500
            backgroundColor = 'rgba(16, 185, 129, 0.2)';
          } else if (isHovered) {
            borderColor = '#8b5cf6'; // violet-500 for hover
            backgroundColor = 'rgba(139, 92, 246, 0.2)';
          }

          return (
            <div
              key={key}
              className="absolute pointer-events-auto cursor-pointer transition-all duration-200"
              style={{
                left: x,
                top: y,
                width: Math.max(width, 4),
                height: Math.max(height, 4),
                border: `2px solid ${borderColor}`,
                backgroundColor: backgroundColor,
                borderRadius: '2px',
                zIndex: isEditing ? 30 : isHovered ? 20 : statusColors.priority + 10,
              }}
              onMouseEnter={() => !editingField && setHoveredMapping(key)}
              onMouseLeave={() => !editingField && setHoveredMapping(null)}
              onClick={(e) => handleFieldClick(key, e)}
              title={`${key}: ${mapping.label}${fieldValue ? ` - "${fieldValue}"` : ''} (${statusColors.label})`}
            >
              {/* Field Value Display */}
              {fieldValue && fieldValue.trim().length > 0 && !isEditing && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-800 bg-white bg-opacity-90 rounded"
                  style={{
                    fontSize: Math.max(8, Math.min(12, height * 0.6)),
                    padding: '1px 2px',
                  }}
                >
                  <span className="truncate max-w-full">
                    {fieldValue}
                  </span>
                </div>
              )}

              {/* Enhanced tooltip */}
              {isHovered && !isEditing && (
                <div
                  className="absolute bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-40"
                  style={{
                    top: height + 8,
                    left: 0,
                    maxWidth: '300px',
                  }}
                >
                  <div className="font-semibold text-yellow-300">{key}</div>
                  <div className="text-gray-300">{mapping.label}</div>
                  
                  {/* Status Information */}
                  <div className="flex items-center mt-1 space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusColors.border }}
                    />
                    <span className="text-sm font-medium">{statusColors.label}</span>
                  </div>
                  
                  {/* Field Values */}
                  {field && (
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      {field.value && (
                        <div className="text-blue-300">
                          <span className="text-gray-400">Original:</span> "{field.value}"
                          <span className="text-xs text-gray-500 ml-2">({field.value_status})</span>
                        </div>
                      )}
                      {field.translated_value && (
                        <div className="text-green-300 mt-1">
                          <span className="text-gray-400">Translated:</span> "{field.translated_value}"
                          <span className="text-xs text-gray-500 ml-2">({field.translated_status})</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-gray-400 text-xs mt-2">
                    Font: {mapping.font.name}, Size: {mapping.font.size}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Click to edit
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapsible Status Legend */}
      <div className="absolute top-4 left-4 z-40">
        <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
          {/* Legend Header - Always visible */}
          <div 
            className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setLegendCollapsed(!legendCollapsed)}
          >
            <div className="text-xs font-semibold text-gray-700">Field Status</div>
            <div 
              className="w-4 h-4 flex items-center justify-center text-gray-500 transform transition-transform"
              style={{ transform: legendCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            >
              ▼
            </div>
          </div>
          
          {/* Legend Content - Collapsible */}
          {!legendCollapsed && (
            <div className="px-3 pb-3 border-t border-gray-200">
              <div className="space-y-1 mt-2">
                {/* <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                  <span className="text-xs text-gray-600">Confirmed</span>
                </div> */}
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span className="text-xs text-gray-600">Edited</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                  <span className="text-xs text-gray-600">{isTranslatedView ? 'Translated' : 'OCR'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6b7280' }}></div>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editable Input - Rendered separately with backdrop */}
      {editingField && editInputPosition && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              handleEditCancel();
            }}
          />
          
          <div
            className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-300 p-2"
            style={{
              left: editInputPosition.x,
              top: editInputPosition.y,
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2">
              <input
                ref={(input) => input?.focus()}
                type="text"
                defaultValue={isTranslatedView 
                ? (fields[editingField]?.translated_value || '') 
                : (fields[editingField]?.value || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFieldSave(editingField, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    handleEditCancel();
                  }
                }}
                placeholder={`Enter ${isTranslatedView ? 'translated ' : ''}${mappings[editingField]?.label || 'value'}`}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const inputElement = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                  handleFieldSave(editingField, inputElement?.value || '');
                }}
                className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600 text-white flex-shrink-0"
              >
                <Check size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCancel();
                }}
                className="h-7 w-7 p-0 flex-shrink-0"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// PDF Viewer Component with Template Overlay Support
const PDFViewer: React.FC<{ 
  url: string; 
  templateMappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  showMappings?: boolean;
  onFieldUpdate?: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
}> = ({ url, templateMappings, fields = {}, showMappings = false, onFieldUpdate, isTranslatedView = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState(1.2);
  const [isRendering, setIsRendering] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Cleanup function
  const cleanup = () => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    if (pdfDoc) {
      pdfDoc.destroy();
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadPDF = async () => {
      if (!isMounted) return;
      
      // Cleanup previous PDF
      cleanup();
      
      setLoading(true);
      setError(null);
      setPageNum(1);
      setNumPages(0);
      setPdfDoc(null);
      setIsRendering(false);

      try {
        // Load PDF.js if not already loaded
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            if (isMounted) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              loadDocument();
            }
          };
          script.onerror = () => {
            if (isMounted) setError('Failed to load PDF.js');
          };
          document.head.appendChild(script);
        } else {
          loadDocument();
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    };

    const loadDocument = async () => {
      if (!isMounted) return;
      
      try {
        const loadingTask = window.pdfjsLib.getDocument({
          url: url,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        
        if (!isMounted) {
          pdf.destroy();
          return;
        }
        
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
        await renderPage(pdf, 1, scale);
      } catch (err) {
        console.error('PDF loading error:', err);
        if (isMounted) {
          setError('Failed to load PDF document');
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [url]);

  // Re-render when scale changes
  useEffect(() => {
    if (pdfDoc && pageNum && !loading) {
      renderPage(pdfDoc, pageNum, scale);
    }
  }, [scale, pdfDoc, pageNum]);

  const renderPage = async (pdf: any, pageNumber: number, currentScale: number = scale) => {
    if (!pdf || !canvasRef.current) return;
    
    try {
      setIsRendering(true);
      setLoading(true);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: currentScale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Update canvas dimensions state for overlay positioning
      setCanvasDimensions({ width: viewport.width, height: viewport.height });
      
      // Clear canvas with white background
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      // Start rendering and store the task reference
      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      
      // Clear the reference after successful render
      renderTaskRef.current = null;
      setLoading(false);
      setIsRendering(false);
      
    } catch (err: any) {
      console.error('PDF render error:', err);
      if (err.name !== 'RenderingCancelledException') {
        setError('Failed to render PDF page');
        setLoading(false);
        setIsRendering(false);
      }
    }
  };

  const goToPage = async (newPageNum: number) => {
    if (newPageNum >= 1 && newPageNum <= numPages && pdfDoc && !isRendering) {
      setPageNum(newPageNum);
      await renderPage(pdfDoc, newPageNum, scale);
    }
  };

  const handleZoom = async (newScale: number) => {
    // Clamp scale between reasonable bounds
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale));
    
    if (clampedScale !== scale && pdfDoc && !isRendering) {
      setScale(clampedScale);
      // The useEffect will handle re-rendering with new scale
    }
  };

  // Predefined zoom levels for more accurate zooming
  const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
  
  const zoomIn = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= scale);
    const nextIndex = currentIndex < zoomLevels.length - 1 ? currentIndex + 1 : zoomLevels.length - 1;
    handleZoom(zoomLevels[nextIndex]);
  };

  const zoomOut = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= scale);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    handleZoom(zoomLevels[prevIndex]);
  };

  const resetZoom = () => {
    handleZoom(1.0);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-red-500">
          <FileText size={48} className="mx-auto mb-4" />
          <p className="font-medium">Error loading PDF</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* PDF Controls */}
      {numPages > 0 && (
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1 || isRendering}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {pageNum} of {numPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= numPages || isRendering}
            >
              Next
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={zoomOut}
              disabled={scale <= 0.5 || isRendering}
              title="Zoom Out"
            >
              Zoom Out
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resetZoom}
              disabled={isRendering}
              title="Reset Zoom (100%)"
              className="min-w-[60px]"
            >
              {Math.round(scale * 100)}%
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={zoomIn}
              disabled={scale >= 3 || isRendering}
              title="Zoom In"
            >
              Zoom In
            </Button>
          </div>
        </div>
      )}

      {/* PDF Canvas Container */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">
              {isRendering ? 'Rendering PDF...' : 'Loading PDF...'}
            </span>
          </div>
        )}
        
        <div 
          ref={containerRef}
          className="relative"
          style={{ 
            width: canvasDimensions.width || 'auto',
            height: canvasDimensions.height || 'auto',
            minWidth: canvasDimensions.width || 'auto',
            margin: canvasDimensions.width < (containerRef.current?.parentElement?.clientWidth || 0) ? '0 auto' : '0'
          }}
        >
          <canvas
            ref={canvasRef}
            className={`border border-gray-300 shadow-lg transition-opacity duration-200 ${
              loading ? 'hidden' : 'block'
            }`}
            style={{ 
              display: loading ? 'none' : 'block',
              width: canvasDimensions.width || 'auto',
              height: canvasDimensions.height || 'auto'
            }}
          />
          
          {/* Template Mappings Overlay */}
          {templateMappings && (
            <TemplateMappingOverlay
              mappings={templateMappings}
              fields={fields}
              pageNum={pageNum}
              scale={scale}
              canvasWidth={canvasDimensions.width}
              canvasHeight={canvasDimensions.height}
              visible={showMappings && !loading}
              onFieldUpdate={onFieldUpdate || (() => {})}
              isTranslatedView={isTranslatedView}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Image Viewer Component
const ImageViewer: React.FC<{ url: string }> = ({ url }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading image...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-500">
              <Image size={48} className="mx-auto mb-4" />
              <p className="font-medium">Error loading image</p>
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <img
            src={url}
            alt="Document"
            className={`max-w-full h-auto border border-gray-300 shadow-lg ${loading ? 'hidden' : ''}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </div>
      </div>
    </div>
  );
};

// File Viewer Component
const FileViewer: React.FC<{ 
  url: string; 
  filename?: string; 
  templateMappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  showMappings?: boolean;
  onFieldUpdate?: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
}> = ({ url, filename, templateMappings, fields = {}, showMappings = false, onFieldUpdate, isTranslatedView = false }) => {
  const getFileType = (url: string): 'pdf' | 'image' | 'other' => {
    try {
      // Handle URLs with query parameters by extracting the pathname
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Get file extension from pathname, not the full URL
      const extension = pathname.split('.').pop()?.toLowerCase();
      
      if (extension === 'pdf') return 'pdf';
      
      // Common image extensions
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(extension || '')) {
        return 'image';
      }
      
      // Common document extensions that might be viewable as images or PDFs
      if (['doc', 'docx', 'txt', 'rtf'].includes(extension || '')) {
        return 'other';
      }
      
      return 'other';
    } catch (error) {
      // If URL parsing fails, fall back to simple extension check
      console.warn('Failed to parse URL for file type detection:', error);
      const extension = url.split('.').pop()?.toLowerCase();
      
      if (extension === 'pdf') return 'pdf';
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(extension || '')) {
        return 'image';
      }
      
      return 'other';
    }
  };

  const fileType = getFileType(url);

  if (fileType === 'pdf') {
    return (
      <PDFViewer 
        url={url} 
        templateMappings={templateMappings}
        fields={fields}
        showMappings={showMappings}
        onFieldUpdate={onFieldUpdate}
        isTranslatedView={isTranslatedView}
      />
    );
  }

  if (fileType === 'image') {
    return <ImageViewer url={url} />;
  }

  // For other file types, show download link
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center">
        <File size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="font-medium text-gray-600 mb-2">
          {filename || 'Document'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          This file type cannot be previewed in the browser
        </p>
        <Button
          onClick={() => window.open(url, '_blank')}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Open File
        </Button>
      </div>
    </div>
  );
};

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  isOpen,
  onClose,
  conversationId
}) => {
  // Local workflow state - managed directly by this component
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [hasWorkflow, setHasWorkflow] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  console.log(workflowData)
  
  // View state - default to 'original' since we removed forms
  const [currentView, setCurrentView] = useState<ViewType>('original');
  
  // Template mappings overlay state
  const [showMappings, setShowMappings] = useState<boolean>(true);

  // Fetch workflow data directly from database
  const fetchWorkflowData = async () => {
    if (!conversationId) {
      setHasWorkflow(false);
      setWorkflowData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('DocumentCanvas: Fetching workflow data for conversation:', conversationId);
      const response = await api.get(`/api/workflow/${conversationId}`);
      
      console.log('DocumentCanvas: Workflow fetch result:', {
        conversationId,
        hasWorkflow: response.data.has_workflow,
        hasData: response.data.workflow_data,
        hasMappings: response.data.workflow_data?.origin_template_mappings,
        hasFields: response.data.workflow_data?.fields
      });
      
      setHasWorkflow(response.data.has_workflow);
      setWorkflowData(response.data.workflow_data);
      
    } catch (err: any) {
      console.error('DocumentCanvas: Error fetching workflow:', err);
      
      // Handle 404 specifically - no workflow exists (this is normal)
      if (err.response?.status === 404) {
        setHasWorkflow(false);
        setWorkflowData(null);
        setError(null); // Clear error for 404
        return;
      }
      
      // For other errors, set error state
      setError(err.response?.data?.message || 'Failed to load workflow');
      setHasWorkflow(false);
      setWorkflowData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle field updates
  const handleFieldUpdate = async (fieldKey: string, newValue: string) => {
    if (!workflowData?.fields) return;

    // Get the existing field data
    const existingField = workflowData.fields[fieldKey] || {
      value: '',
      value_status: 'pending',
      translated_value: null,
      translated_status: 'pending'
    };

    // Determine if we're updating translated value or regular value
    const isUpdatingTranslated = currentView === 'translated_template';

    // Update local state immediately for responsive UI
    const updatedFields = {
      ...workflowData.fields,
      [fieldKey]: {
        ...existingField,
        ...(isUpdatingTranslated 
          ? {
              translated_value: newValue,
              translated_status: 'edited' as const
            }
          : {
              value: newValue,
              value_status: 'edited' as const
            }
        )
      }
    };

    setWorkflowData({
      ...workflowData,
      fields: updatedFields
    });

    // Send update to backend - ALWAYS include all required fields
    try {
      const updateData = {
        field_key: fieldKey,
        // Always include the current value and value_status
        value: isUpdatingTranslated ? existingField.value : newValue,
        value_status: isUpdatingTranslated ? existingField.value_status : 'edited',
        // Always include the current translated_value and translated_status
        translated_value: isUpdatingTranslated ? newValue : existingField.translated_value,
        translated_status: isUpdatingTranslated ? 'edited' : existingField.translated_status
      };

      await api.patch(`/api/workflow/${conversationId}/field`, updateData);
      
      console.log('DocumentCanvas: Field updated successfully:', fieldKey, newValue, isUpdatingTranslated ? '(translated)' : '(original)');
    } catch (err: any) {
      console.error('DocumentCanvas: Error updating field:', err);
      
      // Revert local state on error
      setWorkflowData({
        ...workflowData,
        fields: workflowData.fields // Revert to original state
      });
    }
  };

  // Fetch workflow data whenever the canvas opens or conversationId changes
  useEffect(() => {
    if (isOpen && conversationId) {
      console.log('DocumentCanvas: Opening, fetching fresh workflow data');
      fetchWorkflowData();
    }
  }, [isOpen, conversationId]);

  // Clear state when canvas closes
   // Clear state when canvas closes
  useEffect(() => {
    if (!isOpen) {
      setWorkflowData(null);
      setHasWorkflow(false);
      setError(null);
      setCurrentView('original');
      setShowMappings(true);
    }
  }, [isOpen]);

  const handleShowBaseFile = () => {
    console.log("DocumentCanvas: Show Base File clicked");
    setCurrentView('original');
  };

  const handleShowTemplate = () => {
    console.log("DocumentCanvas: Template clicked");
    setCurrentView('template');
  };

  const handleShowTranslatedTemplate = () => {
    console.log("DocumentCanvas: Translated Template clicked");
    setCurrentView('translated_template');
  };

  const toggleMappings = () => {
    setShowMappings(!showMappings);
  };

  if (!isOpen) return null;

  // Get view title
  const getViewTitle = () => {
    switch (currentView) {
      case 'original': return 'Original File';
      case 'template': return 'Template';
      case 'translated_template': return 'Translated Template';
      default: return 'Original File';
    }
  };

  // Count mappings for current view
  const getMappingsCount = () => {
    if (currentView === 'translated_template') {
      if (!workflowData?.translated_template_mappings) return 0;
      return Object.keys(workflowData.translated_template_mappings).length;
    }
    if (!workflowData?.origin_template_mappings) return 0;
    return Object.keys(workflowData.origin_template_mappings).length;
  };

  // Render content based on current view
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading workflow...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      );
    }

    if (!hasWorkflow) {
      return (
        <div className="text-center text-gray-500 p-8 bg-white rounded-lg border border-gray-200">
          <p className="font-medium">No workflow found</p>
          <p className="text-sm mt-1">No workflow found for this conversation</p>
        </div>
      );
    }

    // Show file views
    if (currentView === 'original' && workflowData?.base_file_public_url) {
      return (
        <div className="h-full">
          <FileViewer 
            url={workflowData.base_file_public_url} 
            filename="Original File" 
          />
        </div>
      );
    }

    if (currentView === 'template' && workflowData?.template_file_public_url) {
      return (
        <div className="h-full">
          <FileViewer 
            url={workflowData.template_file_public_url} 
            filename="Template"
            templateMappings={workflowData.origin_template_mappings}
            fields={workflowData.fields}
            showMappings={showMappings}
            onFieldUpdate={handleFieldUpdate}
          />
        </div>
      );
    }

    if (currentView === 'translated_template' && workflowData?.template_translated_file_public_url) {
    return (
      <FileViewer 
        url={workflowData.template_translated_file_public_url} 
        filename="Translated Template"
        templateMappings={workflowData.translated_template_mappings}
        fields={workflowData.fields}
        showMappings={showMappings}
        onFieldUpdate={handleFieldUpdate}
        isTranslatedView={true}
      />
    );
  }

    return (
      <div className="text-center text-gray-500 p-8 bg-white rounded-lg border border-gray-200">
        <p className="font-medium">File not available</p>
        <p className="text-sm mt-1">The requested file is not available</p>
      </div>
    );
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 lg:w-[600px] xl:w-[700px] bg-gray-50 border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">{getViewTitle()}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 hover:bg-gray-100"
        >
          <X size={16} />
        </Button>
      </div>

      {/* Action Buttons */}
      {!loading && !error && hasWorkflow && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex space-x-3">
            <Button
              onClick={handleShowBaseFile}
              variant={currentView === 'original' ? 'default' : 'outline'}
              disabled={!workflowData?.base_file_public_url}
              className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
                currentView === 'original'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Original File
            </Button>
            
            <Button
              onClick={handleShowTemplate}
              variant={currentView === 'template' ? 'default' : 'outline'}
              disabled={!workflowData?.template_file_public_url}
              className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
                currentView === 'template'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Template
            </Button>

            <Button
              onClick={handleShowTranslatedTemplate}
              variant={currentView === 'translated_template' ? 'default' : 'outline'}
              disabled={!workflowData?.template_translated_file_public_url}
              className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
                currentView === 'translated_template'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Translated Template
            </Button>
          </div>
          
          {/* Template Mappings Toggle */}
          {(currentView === 'template' || currentView === 'translated_template') && 
          ((currentView === 'template' && workflowData?.origin_template_mappings) || 
            (currentView === 'translated_template' && workflowData?.translated_template_mappings)) && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={toggleMappings}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                {showMappings ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>
                  {showMappings ? 'Hide' : 'Show'} Mapp ({getMappingsCount()})
                </span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default DocumentCanvas;