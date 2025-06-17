import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {useWorkflowData} from './hooks/useWorkflowData';
import OriginalFileView from './views/OriginalFileView';
import TemplateView from './views/TemplateView';
import TranslatedTemplateView from './views/TranslatedTemplateView';
import ViewControls from './components/ViewControls';
import { WorkflowData, ViewType } from './types/workflow';
import api from '@/lib/api';

interface DocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  isOpen,
  onClose,
  conversationId
}) => {
  const [currentView, setCurrentView] = useState<ViewType>('original');
  const [showMappings, setShowMappings] = useState<boolean>(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();
  
  const {
    workflowData,
    loading,
    error,
    hasWorkflow,
    handleFieldUpdate,
    fetchWorkflowData
  } = useWorkflowData(conversationId);

  // Clean up preview URL when component unmounts or preview closes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!showPreview && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [showPreview, previewUrl]);

  // Reset preview when view changes
  useEffect(() => {
    if (showPreview) {
      setShowPreview(false);
    }
  }, [currentView]);

  const handleTogglePreview = async () => {
    const newPreviewState = !showPreview;
    setShowPreview(newPreviewState);
    
    if (newPreviewState && !previewUrl) {
      try {
        setPreviewLoading(true);
        const url = await generatePreview();
        setPreviewUrl(url);
      } catch (err) {
        console.error("Preview failed:", err);
        toast({
          title: "Preview Error",
          description: "Failed to generate preview",
          variant: "destructive"
        });
        setShowPreview(false);
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const generatePreview = async (): Promise<string> => {
    if (!conversationId || !workflowData) {
      throw new Error("Missing data for preview");
    }
    
    try {
      // Determine which template to use based on current view
      const isTranslated = currentView === 'translated_template';
      const templateId = isTranslated 
        ? workflowData.template_translated_id || workflowData.template_id
        : workflowData.template_id;
      
      const response = await api.post(
        '/api/workflow/generate/insert-text-enhanced',
        {
          template_id: workflowData.template_id,
          template_translated_id: templateId,
          isTranslated,
          fields: workflowData.fields || {}
        },
        {
          responseType: 'blob'
        }
      );
      
      // Create preview URL from blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
      
    } catch (err: any) {
      console.error("Preview generation error:", err);
      const errorMessage = err.response?.data?.detail || 
                           err.response?.data?.message || 
                           err.message || 
                           "Preview generation failed";
      
      toast({
        title: "Preview Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  };

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchWorkflowData();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentView('original');
      setShowMappings(true);
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getViewTitle = () => {
    if (showPreview) return 'Preview File';
    
    switch (currentView) {
      case 'original': return 'Original File';
      case 'template': return 'Template';
      case 'translated_template': return 'Translated Template';
      default: return 'Original File';
    }
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
      <ViewControls 
        currentView={currentView}
        showMappings={showMappings}
        workflowData={workflowData}
        loading={loading}
        error={error}
        hasWorkflow={hasWorkflow}
        onViewChange={setCurrentView}
        onToggleMappings={() => setShowMappings(!showMappings)}
        conversationId={conversationId}
        fetchWorkflowData={fetchWorkflowData}
        onTogglePreview={handleTogglePreview}
        showPreview={showPreview}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading workflow...</span>
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && !hasWorkflow && (
          <div className="text-center text-gray-500 p-8 bg-white rounded-lg border border-gray-200">
            <p className="font-medium">No workflow found</p>
            <p className="text-sm mt-1">No workflow found for this conversation</p>
          </div>
        )}

        {!loading && !error && hasWorkflow && (
          <>
            {showPreview && previewUrl && !previewLoading ? (
              <div className="h-full w-full">
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-0"
                  title="Preview Document"
                />
              </div>
            ) : previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">Generating preview...</span>
              </div>
            ) : (
              <>
                {currentView === 'original' && workflowData?.base_file_public_url && (
                  <OriginalFileView 
                    url={workflowData.base_file_public_url} 
                    filename="Original File" 
                    workflowData={workflowData}
                    conversationId={conversationId}
                  />
                )}

                {currentView === 'template' && workflowData?.template_file_public_url && (
                  <TemplateView 
                    url={workflowData.template_file_public_url} 
                    filename="Template"
                    templateMappings={workflowData.origin_template_mappings}
                    fields={workflowData.fields}
                    showMappings={showMappings}
                    onFieldUpdate={handleFieldUpdate}
                    workflowData={workflowData}
                    conversationId={conversationId}
                  />
                )}

                {currentView === 'translated_template' && workflowData?.template_translated_file_public_url && (
                  <TranslatedTemplateView 
                    url={workflowData.template_translated_file_public_url} 
                    filename="Translated Template"
                    templateMappings={workflowData.translated_template_mappings}
                    fields={workflowData.fields}
                    showMappings={showMappings}
                    onFieldUpdate={handleFieldUpdate}
                    workflowData={workflowData}
                    conversationId={conversationId}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;