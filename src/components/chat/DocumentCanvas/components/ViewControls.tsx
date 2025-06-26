// client/components/chat/DocumentCanvas/components/ViewControls.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { File, FileText, Languages, RefreshCw, Eye, EyeOff, Download, Edit2, Save, X } from 'lucide-react';
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
  onDownloadFilledPdf: () => void;
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
  setIsEditingMode,
  onDownloadFilledPdf
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
      const targetLanguage = workflowData.translate_to || 'en';
      
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

  const viewButtons = [
    {
      view: 'original' as ViewType,
      icon: File,
      label: 'Original',
      disabled: !workflowData?.base_file_public_url
    },
    {
      view: 'template' as ViewType,
      icon: FileText,
      label: 'Template',
      disabled: !workflowData?.template_file_public_url
    },
    {
      view: 'translated_template' as ViewType,
      icon: Languages,
      label: 'Translated',
      disabled: !workflowData?.template_translated_file_public_url
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* Compact Controls */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          {/* View Switcher - Compact */}
          <div className="flex items-center space-x-0.5 bg-gray-50 rounded-md p-0.5">
            <TooltipProvider delayDuration={300}>
              {viewButtons.map(({ view, icon: Icon, label, disabled }) => (
                <Tooltip key={view}>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={currentView === view ? 'default' : 'ghost'}
                      disabled={disabled}
                      className={`
                        px-2 py-1 h-7 text-xs font-medium transition-all min-w-0
                        ${currentView === view 
                          ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                          : 'hover:bg-gray-100 text-gray-600 border border-transparent'
                        }
                      `}
                      onClick={() => onViewChange(view)}
                    >
                      <Icon size={14} className="mr-1.5" />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{label} Document</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {/* Action Buttons - Compact */}
          {(currentView === 'template' || currentView === 'translated_template') && 
          workflowData?.fields && Object.keys(workflowData.fields).length > 0 && (
            <div className="flex items-center space-x-1">
              {/* Show/Hide Fields */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onToggleMappings}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      {showMappings ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                      <span className="hidden sm:inline">
                        Fields ({getMappingsCount()})
                      </span>
                      <span className="sm:hidden">
                        {getMappingsCount()}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>{showMappings ? 'Hide' : 'Show'} field mappings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Edit Mode Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsEditingMode(!isEditingMode)}
                      variant={isEditingMode ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-7 px-2 text-xs ${isEditingMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                    >
                      {isEditingMode ? (
                        <>
                          <Save size={14} className="mr-1" />
                          <span className="hidden sm:inline">Done</span>
                        </>
                      ) : (
                        <>
                          <Edit2 size={14} className="mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>{isEditingMode ? 'Save changes' : 'Edit field positions'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Translate All - Only in translated view */}
              {currentView === 'translated_template' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleTranslateAll}
                        variant="ghost"
                        size="sm"
                        disabled={translateLoading}
                        className="h-7 px-2 text-xs"
                      >
                        <RefreshCw size={14} className={`mr-1 ${translateLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Translate</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <p>Translate all fields to {workflowData?.translate_to || 'target language'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Download Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onDownloadFilledPdf}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                    >
                      <Download size={14} className="mr-1" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>Download filled PDF document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewControls;