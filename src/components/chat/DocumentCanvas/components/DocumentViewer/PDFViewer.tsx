import React, { useRef, useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TemplateMappingOverlay from '../TemplateMappingOverlay';
import { WorkflowField, TemplateMapping } from '../../types/workflow';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PDFViewerProps {
  url: string;
  templateMappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  showMappings?: boolean;
  onFieldUpdate?: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
  workflowData: any;
  conversationId: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ 
  url, 
  templateMappings, 
  fields = {}, 
  showMappings = false, 
  onFieldUpdate, 
  isTranslatedView = false,
  workflowData,
  conversationId
}) => {
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
      
      cleanup();
      setLoading(true);
      setError(null);
      setPageNum(1);
      setNumPages(0);
      setPdfDoc(null);
      setIsRendering(false);

      try {
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            if (isMounted) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setCanvasDimensions({ width: viewport.width, height: viewport.height });
      
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      
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
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale));
    
    if (clampedScale !== scale && pdfDoc && !isRendering) {
      setScale(clampedScale);
    }
  };
  
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
                workflowData={workflowData}
                conversationId={conversationId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;