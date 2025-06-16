// client/src/components/chat/DocumentCanvas/index.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {useWorkflowData} from './hooks/useWorkflowData';
import OriginalFileView from './views/OriginalFileView';
import TemplateView from './views/TemplateView';
import TranslatedTemplateView from './views/TranslatedTemplateView';
import ViewControls from './components/ViewControls';
import { WorkflowData, ViewType } from './types/workflow';

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
  
  const {
    workflowData,
    loading,
    error,
    hasWorkflow,
    handleFieldUpdate,
    fetchWorkflowData
  } = useWorkflowData(conversationId);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchWorkflowData();
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentView('original');
      setShowMappings(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getViewTitle = () => {
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
            {currentView === 'original' && workflowData?.base_file_public_url && (
              <OriginalFileView 
                url={workflowData.base_file_public_url} 
                filename="Original File" 
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
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;