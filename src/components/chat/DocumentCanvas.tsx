// client/src/components/chat/DocumentCanvas.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, HelpCircle, Save, Loader2, FileText, Image, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface WorkflowData {
  file_id: string;
  base_file_public_url?: string;
  template_id: string;
  template_file_public_url?: string;
  template_required_fields?: Record<string, string>;
  extracted_fields_from_raw_ocr?: Record<string, string>;
  filled_fields?: Record<string, string>;
  translated_fields?: Record<string, string>;
}

interface FieldRowProps {
  label: string;
  name: string;
  description?: string;
  filledValue: string;
  translatedValue: string;
  onFilledChange: (value: string) => void;
  onTranslatedChange: (value: string) => void;
}

type ViewType = 'forms' | 'original' | 'template';

const FieldRow: React.FC<FieldRowProps> = ({
  label,
  name,
  description,
  filledValue,
  translatedValue,
  onFilledChange,
  onTranslatedChange
}) => {
  // Check if values end with [UNEDITED]
  const isFilledUnedited = filledValue.endsWith('[UNEDITED]');
  const isTranslatedUnedited = translatedValue.endsWith('[UNEDITED]');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Field Label with Tooltip */}
      <div className="flex items-center space-x-2 mb-3">
        <Label htmlFor={`filled_${name}`} className="text-base font-medium text-gray-800">
          {label}
        </Label>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle 
                size={16} 
                className="text-gray-400 hover:text-gray-600 cursor-help transition-colors"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Filled Field Input */}
      <div className="mb-3">
        <Label 
          htmlFor={`filled_${name}`} 
          className="text-sm text-gray-600 mb-2 block font-medium"
        >
          Filled Field
        </Label>
        <Input
          id={`filled_${name}`}
          value={filledValue}
          onChange={(e) => onFilledChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className={`w-full text-sm transition-colors duration-200 focus:border-red-500 focus:ring-2 focus:ring-blue-200 hover:border-gray-400 ${
            isFilledUnedited ? 'text-red-500' : ''
          }`}
          aria-label={`Filled field for ${label}`}
        />
      </div>

      {/* Translated Field Input */}
      <div>
        <Label 
          htmlFor={`translated_${name}`} 
          className="text-sm text-gray-600 mb-2 block font-medium"
        >
          Translated Field
        </Label>
        <Input
          id={`translated_${name}`}
          value={translatedValue}
          onChange={(e) => onTranslatedChange(e.target.value)}
          placeholder={`Enter translated ${label.toLowerCase()}...`}
          className={`w-full text-sm transition-colors duration-200 focus:border-red-500 focus:ring-2 focus:ring-blue-200 hover:border-gray-400 ${
            isTranslatedUnedited ? 'text-red-500' : ''
          }`}
          aria-label={`Translated field for ${label}`}
        />
      </div>
    </div>
  );
};

// PDF Viewer Component
// Updated PDFViewer Component with Fixed Zoom
const PDFViewer: React.FC<{ url: string }> = ({ url }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState(1.2);
  const [isRendering, setIsRendering] = useState(false);

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
        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
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

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">
              {isRendering ? 'Rendering PDF...' : 'Loading PDF...'}
            </span>
          </div>
        )}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className={`border border-gray-300 shadow-lg transition-opacity duration-200 ${
              loading ? 'hidden' : 'block'
            }`}
            style={{ 
              maxWidth: '100%',
              height: 'auto'
            }}
          />
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
const FileViewer: React.FC<{ url: string; filename?: string }> = ({ url, filename }) => {
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
    return <PDFViewer url={url} />;
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
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // View state
  const [currentView, setCurrentView] = useState<ViewType>('forms');
  
  // Local state for form inputs
  const [filledFields, setFilledFields] = useState<Record<string, string>>({});
  const [translatedFields, setTranslatedFields] = useState<Record<string, string>>({});

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
        hasData: !!response.data.workflow_data
      });
      
      setHasWorkflow(response.data.has_workflow);
      setWorkflowData(response.data.workflow_data);
      
      // Update form fields with fresh data
      if (response.data.workflow_data?.filled_fields) {
        setFilledFields(response.data.workflow_data.filled_fields);
      } else {
        setFilledFields({});
      }
      
      if (response.data.workflow_data?.translated_fields) {
        setTranslatedFields(response.data.workflow_data.translated_fields);
      } else {
        setTranslatedFields({});
      }
      
    } catch (err: any) {
      console.error('DocumentCanvas: Error fetching workflow:', err);
      
      // Handle 404 specifically - no workflow exists (this is normal)
      if (err.response?.status === 404) {
        setHasWorkflow(false);
        setWorkflowData(null);
        setError(null); // Clear error for 404
        setFilledFields({});
        setTranslatedFields({});
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

  // Fetch workflow data whenever the canvas opens or conversationId changes
  useEffect(() => {
    if (isOpen && conversationId) {
      console.log('DocumentCanvas: Opening, fetching fresh workflow data');
      fetchWorkflowData();
    }
  }, [isOpen, conversationId]);

  // Clear state when canvas closes
  useEffect(() => {
    if (!isOpen) {
      setWorkflowData(null);
      setHasWorkflow(false);
      setError(null);
      setFilledFields({});
      setTranslatedFields({});
      setSaveError(null);
      setCurrentView('forms');
    }
  }, [isOpen]);

  const handleSave = async () => {
    console.log("DocumentCanvas: Save clicked");
    setSaving(true);
    setSaveError(null);
    
    try {
      const response = await api.patch(`/api/workflow/${conversationId}/fields`, {
        filled_fields: filledFields,
        translated_fields: translatedFields
      });
      
      if (response.data.success) {
        console.log('DocumentCanvas: Fields saved successfully:', response.data);
        // Refresh workflow data to get the latest state from database
        await fetchWorkflowData();
        // Optionally show a success message
      } else {
        throw new Error(response.data.message || 'Failed to save fields');
      }
      
    } catch (err: any) {
      console.error('DocumentCanvas: Error saving fields:', err);
      setSaveError(err.response?.data?.message || 'Failed to save fields');
    } finally {
      setSaving(false);
    }
  };

  const handleShowForms = () => {
    console.log("DocumentCanvas: Show Forms clicked");
    setCurrentView('forms');
    setSaveError(null);
  };

  const handleShowBaseFile = async () => {
    console.log("DocumentCanvas: Show Base File clicked");
    setCurrentView('original');
    setSaveError(null);
    
    // Re-fetch from database to get the original values
    await fetchWorkflowData();
  };

  const handleShowFilledTemplate = () => {
    console.log("DocumentCanvas: Template clicked");
    setCurrentView('template');
  };

  const handleFilledFieldChange = (key: string, value: string) => {
    setFilledFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleTranslatedFieldChange = (key: string, value: string) => {
    setTranslatedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isOpen) return null;

  const requiredFields = workflowData?.template_required_fields || {};
  const fieldKeys = Object.keys(requiredFields);
  const displayError = error || saveError;

  // Get view title
  const getViewTitle = () => {
    switch (currentView) {
      case 'forms': return 'Document Fields';
      case 'original': return 'Original File';
      case 'template': return 'Template';
      default: return 'Document Fields';
    }
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

    if (displayError) {
      return (
        <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{displayError}</p>
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
          <FileViewer url={workflowData.base_file_public_url} filename="Original File" />
        </div>
      );
    }

    if (currentView === 'template' && workflowData?.template_file_public_url) {
      return (
        <div className="h-full">
          <FileViewer url={workflowData.template_file_public_url} filename="Template" />
        </div>
      );
    }

    // Show forms view
    if (currentView === 'forms') {
      if (fieldKeys.length === 0) {
        return (
          <div className="text-center text-gray-500 p-8 bg-white rounded-lg border border-gray-200">
            <p className="font-medium">No template fields</p>
            <p className="text-sm mt-1">No template fields found for this workflow</p>
          </div>
        );
      }

      return (
        <TooltipProvider>
          {/* Responsive Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-max">
            {fieldKeys.map((key) => (
              <FieldRow
                key={key}
                label={key}
                name={key}
                description={requiredFields[key]}
                filledValue={filledFields[key] || ''}
                translatedValue={translatedFields[key] || ''}
                onFilledChange={(value) => handleFilledFieldChange(key, value)}
                onTranslatedChange={(value) => handleTranslatedFieldChange(key, value)}
              />
            ))}
          </div>
        </TooltipProvider>
      );
    }

    return (
      <div className="text-center text-gray-500 p-8 bg-white rounded-lg border border-gray-200">
        <p className="font-medium">View not available</p>
        <p className="text-sm mt-1">The requested view is not available</p>
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
      {!loading && !displayError && hasWorkflow && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex space-x-3">
            <Button
              onClick={handleShowForms}
              variant={currentView === 'forms' ? 'default' : 'outline'}
              className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
                currentView === 'forms' 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Show Forms
            </Button>
            
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
              Show Original File
            </Button>
            
            <Button
              onClick={handleShowFilledTemplate}
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
          </div>
          <div>
            {currentView === 'forms' && fieldKeys.length > 0 && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-md shadow-sm bg-red-500 hover:bg-red-700 text-white font-medium transition-colors duration-200"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-hidden ${currentView === 'forms' ? 'overflow-y-auto p-4' : ''}`}>
        {renderContent()}
      </div>

      {/* Error Display */}
      {saveError && (
        <div className="p-4 border-t border-gray-200 bg-red-50">
          <div className="text-red-700 text-sm">
            <p className="font-medium">Save Error</p>
            <p>{saveError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentCanvas;