// client/components/chat/DocumentCanvas/components/ViewControls.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { File, FileText, Languages, RefreshCw, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkflowData, ViewType } from '../types/workflow';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ViewControlsProps {
  currentView: ViewType;
  showMappings: boolean;
  workflowData: WorkflowData | null;
  loading: boolean;
  error: string | null;
  hasWorkflow: boolean;
  onViewChange: (view: ViewType) => void;
  onToggleMappings: () => void;
  conversationId: string;
  fetchWorkflowData: () => Promise<void>;
  onTogglePreview: () => void;
  showPreview: boolean;
  isEditingMode: boolean;
  setIsEditingMode: (v: boolean) => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({
  currentView,
  showMappings,
  workflowData,
  loading,
  error,
  hasWorkflow,
  onViewChange,
  onToggleMappings,
  conversationId,
  fetchWorkflowData,
  onTogglePreview,
  showPreview,
  isEditingMode,
  setIsEditingMode
}) => {
  const { toast } = useToast();
  const [translateLoading, setTranslateLoading] = useState(false);

  const getMappingsCount = () => {
    if (currentView === 'translated_template') {
      return workflowData?.translated_template_mappings 
        ? Object.keys(workflowData.translated_template_mappings).length 
        : 0;
    }
    return workflowData?.origin_template_mappings 
      ? Object.keys(workflowData.origin_template_mappings).length 
      : 0;
  };

  const handleTranslateAll = async () => {
    if (!conversationId || !workflowData) return;
    
    setTranslateLoading(true);
    
    try {
      // Get target language from workflow data or default to English
      const targetLanguage = workflowData.translate_to || 'en';

      console.log("Translating all fields to:", targetLanguage);
      
      const response = await api.post(
        `/api/workflow/${conversationId}/translate-all-fields`,
        {
          target_language: targetLanguage,
          use_gemini: false,
          source_language: workflowData.translate_from || undefined,
          force_retranslate: false
        }
      );
      
      if (response.data.success) {
        toast({
          title: "Translation Successful",
          description: `Translated ${Object.keys(response.data.translated_fields).length} fields`,
          variant: "default"
        });
        
        await fetchWorkflowData();
      } else {
        throw new Error(response.data.message || "Translation failed");
      }
    } catch (err: any) {
      console.error("Translate all error:", err);
      const errorMessage = err.response?.data?.detail || 
                           err.response?.data?.message || 
                           err.message || 
                           "Translation failed";
      
      toast({
        title: "Translation Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTranslateLoading(false);
    }
  };

  if (loading || error || !hasWorkflow) return null;

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex space-x-3">
        <TooltipProvider delayDuration={200}>
          {/* Original File Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={currentView === 'original' ? 'default' : 'outline'}
                disabled={!workflowData?.base_file_public_url}
                className={`h-10 w-10 ${currentView === 'original' ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
                onClick={() => onViewChange('original')}
                aria-label="Original File"
              >
                <File size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Original File</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Template Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={currentView === 'template' ? 'default' : 'outline'}
                disabled={!workflowData?.template_file_public_url}
                className={`h-10 w-10 ${currentView === 'template' ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
                onClick={() => onViewChange('template')}
                aria-label="OCRed"
              >
                <FileText size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>OCRed</p>
            </TooltipContent>
          </Tooltip>

          {/* Translated Template Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={currentView === 'translated_template' ? 'default' : 'outline'}
                disabled={!workflowData?.template_translated_file_public_url}
                className={`h-10 w-10 ${currentView === 'translated_template' ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
                onClick={() => onViewChange('translated_template')}
                aria-label="Translation"
              >
                <Languages size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Translation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-center space-x-2">
        {(currentView === 'template' || currentView === 'translated_template') && 
        workflowData?.fields && Object.keys(workflowData.fields).length > 0 && (
          <>
            <Button
              onClick={onToggleMappings}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              {showMappings ? <Eye size={16} /> : <Eye size={16} />}
              <span>
                {showMappings ? 'Hide' : 'Show'} Mappings ({getMappingsCount()})
              </span>
            </Button>
            
            <Button
              onClick={onTogglePreview}
              variant={showPreview ? 'default' : 'outline'}
              size="sm"
              className="flex items-center space-x-2"
            >
              <Eye size={16} />
              <span>Preview</span>
            </Button>
            
            {/* Edit Layout Button */}
            <Button
              onClick={() => setIsEditingMode(!isEditingMode)}
              variant={isEditingMode ? 'default' : 'outline'}
              size="sm"
              className="flex items-center space-x-2"
            >
              {isEditingMode ? 'Done' : 'Edit Layout'}
            </Button>
            
            {currentView === 'translated_template' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleTranslateAll}
                      variant="outline"
                      size="sm"
                      disabled={translateLoading}
                      className="flex items-center space-x-2"
                    >
                      {translateLoading ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      <span>Translate All</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Translate all editable fields</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewControls;