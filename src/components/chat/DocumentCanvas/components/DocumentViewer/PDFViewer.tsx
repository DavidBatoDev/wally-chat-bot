import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setPageNum(Math.max(1, pageNum - 1))} disabled={pageNum <= 1}>
              Previous
            </Button>
          <span className="text-sm text-gray-600">Page {pageNum} of {numPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPageNum(Math.min(numPages, pageNum + 1))} disabled={pageNum >= numPages}>
              Next
            </Button>
          </div>
          <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setScale(Math.max(0.5, scale - 0.1))}>Zoom Out</Button>
          <Button size="sm" variant="outline" onClick={() => setScale(1.0)}>{Math.round(scale * 100)}%</Button>
          <Button size="sm" variant="outline" onClick={() => setScale(Math.min(3, scale + 0.1))}>Zoom In</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" style={{ background: '#222' }}>
        <div className="relative mx-auto" style={{ width: pageDims.width * scale, height: pageDims.height * scale }}>
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div>Loading PDF...</div>}
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
              />
            )}
          </Document>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;