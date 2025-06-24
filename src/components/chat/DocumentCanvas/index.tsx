// client/src/components/chat/DocumentCanvas/index.tsx
import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {useWorkflowData} from './hooks/useWorkflowData';
import OriginalFileView from './views/OriginalFileView';
import TemplateView from './views/TemplateView';
import TranslatedTemplateView from './views/TranslatedTemplateView';
import ViewControls from './components/ViewControls';
import { WorkflowData, ViewType, TemplateMapping, WorkflowField } from './types/workflow';
import api from '@/lib/api';
// @ts-ignore
import { cloneDeep, isEqual } from 'lodash';

interface DocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

function safeParseMappings(mappings: any) {
  if (typeof mappings === 'string') {
    try {
      return JSON.parse(mappings);
    } catch {
      return {};
    }
  }
  return mappings || {};
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

  const [localMappings, setLocalMappings] = useState<Record<string, TemplateMapping | null> | null>(null);
  const [localFields, setLocalFields] = useState<Record<string, WorkflowField> | null>(null);
  const [localRequiredFields, setLocalRequiredFields] = useState<Record<string, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [translatingFields, setTranslatingFields] = useState<Record<string, boolean>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  // Sync local state with workflowData when loaded or view changes
  useEffect(() => {
    if (!workflowData) return;
    if (currentView === 'template') {
      setLocalMappings(cloneDeep(safeParseMappings(workflowData.origin_template_mappings)));
    } else if (currentView === 'translated_template') {
      setLocalMappings(cloneDeep(safeParseMappings(workflowData.translated_template_mappings)));
    } else {
      setLocalMappings(null);
    }
    setLocalFields(cloneDeep(workflowData.fields || {}));
    setLocalRequiredFields(cloneDeep((workflowData.required_fields || workflowData.template_required_fields) || {}));
    setUnsavedChanges(false);
  }, [workflowData, currentView]);

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

  // Auto-translate only pending fields when switching to translated view
  useEffect(() => {
    if (
      currentView === 'translated_template' &&
      localFields &&
      workflowData &&
      workflowData.translate_to
    ) {
      const fieldsToTranslate = Object.entries(localFields)
        .filter(([key, field]) =>
          field.value &&
          (!field.translated_value || field.translated_value.trim() === '') &&
          (field.translated_status === 'pending' || !field.translated_status)
        );
      if (fieldsToTranslate.length > 0) {
        fieldsToTranslate.forEach(async ([key, field]) => {
          setTranslatingFields(prev => ({ ...prev, [key]: true }));
          try {
            const response = await api.post(`/api/workflow/${conversationId}/translate-field`, {
              field_key: key,
              target_language: workflowData.translate_to,
              source_language: workflowData.translate_from || undefined,
              use_gemini: true
            });
            const translatedValue = response.data.translated_value;
            setLocalFields(prev => {
              const next = { ...(prev || {}) };
              next[key] = {
                value: (prev && prev[key] && typeof prev[key].value === 'string') ? prev[key].value : '',
                value_status: (prev && prev[key] && prev[key].value_status) ? prev[key].value_status : 'pending',
                translated_value: translatedValue,
                translated_status: 'translated'
              };
              return next;
            });
          } catch (err) {
            console.error(`Failed to translate field ${key}:`, err);
          } finally {
            setTranslatingFields(prev => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, localFields, workflowData, conversationId]);

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
    if (!conversationId) {
      throw new Error("Missing data for preview");
    }
    try {
      const isTranslated = currentView === 'translated_template';
      const templateId = isTranslated 
        ? workflowData?.template_translated_id || workflowData?.template_id
        : workflowData?.template_id;
      // Use localMappings and localFields for preview
      const mappings = localMappings;
      const fields = localFields;
      const response = await api.post(
        '/api/workflow/generate/insert-text-enhanced',
        {
          template_id: workflowData?.template_id,
          template_translated_id: templateId,
          isTranslated,
          fields: fields || {},
          template_mappings: mappings || {},
        },
        {
          responseType: 'blob'
        }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (err: any) {
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
      setIsEditingMode(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [isOpen]);

  // Handlers for mapping/field changes
  const handleMappingUpdate = (fieldKey: string, newMapping: TemplateMapping) => {
    setLocalMappings(prev => {
      const updated = { ...(prev || {}) };
      updated[fieldKey] = newMapping;
      setUnsavedChanges(true);
      return updated;
    });
  };
  const handleMappingAdd = (fieldKey: string, mapping: TemplateMapping) => {
    setLocalMappings(prev => {
      const updated = { ...(prev || {}) };
      updated[fieldKey] = mapping;
      setUnsavedChanges(true);
      return updated;
    });
    setLocalFields(prev => {
      // Always add the field if missing
      if (!prev || !prev[fieldKey]) {
        return { ...(prev || {}), [fieldKey]: { value: '', value_status: 'pending', translated_value: null, translated_status: 'pending' } };
      }
      return prev;
    });
    setEditingField(fieldKey);
  };
  const handleMappingDelete = (fieldKey: string) => {
    setLocalMappings(prev => {
      const updated = { ...(prev || {}) };
      updated[fieldKey] = null;
      setUnsavedChanges(true);
      return updated;
    });
    // Only delete field if not present in the other template
    if (workflowData) {
      const otherMappings = currentView === 'template' ? (workflowData.translated_template_mappings || {}) : (workflowData.origin_template_mappings || {});
      if (!otherMappings[fieldKey]) {
        setLocalFields(prev => {
          const updated = { ...(prev || {}) };
          delete updated[fieldKey];
          return updated;
        });
      }
    }
    // Remove from required fields as well
    setLocalRequiredFields(prev => {
      const updated = { ...prev };
      delete updated[fieldKey];
      return updated;
    });
  };
  const handleFieldUpdateLocal = (fieldKey: string, newValue: string, isTranslatedView = false) => {
    setLocalFields(prev => {
      const updated = { ...(prev || {}) };
      // Always create the field if missing!
      if (!updated[fieldKey]) {
        updated[fieldKey] = {
          value: '',
          value_status: 'pending',
          translated_value: null,
          translated_status: 'pending'
        };
      }
      if (isTranslatedView) {
        updated[fieldKey] = {
          ...updated[fieldKey],
          translated_value: newValue,
          translated_status: 'edited',
        };
      } else {
        updated[fieldKey] = {
          ...updated[fieldKey],
          value: newValue,
          value_status: newValue.trim() === '' ? 'pending' : 'edited',
        };
      }
      setUnsavedChanges(true);
      return updated;
    });
  };

  // Save/Cancel logic
  const handleSaveChanges = async () => {
    if (!workflowData) return;
    setIsSaving(true);
    try {
      // Filter out mappings with value null (deleted)
      const filteredMappings: Record<string, any> = {};
      Object.entries(localMappings || {}).forEach(([key, value]) => {
        if (value !== null) filteredMappings[key] = value;
      });
      // Only keep required fields for existing boxes
      const validRequiredFields: Record<string, string> = {};
      Object.keys(filteredMappings).forEach(key => {
        if (localRequiredFields[key]) validRequiredFields[key] = localRequiredFields[key];
      });
      // Ensure every mapping has a field
      const allFields = { ...(localFields || {}) };
      Object.keys(filteredMappings).forEach(key => {
        if (!allFields[key]) {
          allFields[key] = { value: '', value_status: 'pending', translated_value: null, translated_status: 'pending' };
        }
      });
      // Only keep fields for existing mappings
      const cleanFields: Record<string, any> = {};
      Object.keys(allFields).forEach(key => {
        if (filteredMappings[key]) {
          cleanFields[key] = allFields[key];
        }
      });
      // Build info_json_custom for PATCH
      const info_json_custom = {
        ...(workflowData.info_json_custom || workflowData.info_json || {}),
        required_fields: validRequiredFields,
        fillable_text_info: Object.values(filteredMappings),
      };
      // --- DEBUG LOGS ---
      console.log('localMappings:', localMappings);
      console.log('localFields:', localFields);
      console.log('filteredMappings:', filteredMappings);
      console.log('cleanFields:', cleanFields);
      const mappingsKey = currentView === 'template' ? 'origin_template_mappings' : 'translated_template_mappings';
      const patchPayload = {
        [mappingsKey]: filteredMappings,
        fields: cleanFields,
        info_json_custom,
      };
      console.log('PATCH payload:', patchPayload);
      // --- END DEBUG LOGS ---
      await api.patch(`/api/workflow/${conversationId}/template-mappings`, patchPayload);
      await fetchWorkflowData();
      toast({ title: 'Changes saved', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
    setUnsavedChanges(false);
  };
  const handleCancelChanges = () => {
    if (!workflowData) return;
    if (currentView === 'template') {
      setLocalMappings(cloneDeep(workflowData.origin_template_mappings || {}));
    } else if (currentView === 'translated_template') {
      setLocalMappings(cloneDeep(workflowData.translated_template_mappings || {}));
    }
    setLocalFields(cloneDeep(workflowData.fields || {}));
    setLocalRequiredFields(cloneDeep((workflowData.required_fields || workflowData.template_required_fields) || {}));
    setUnsavedChanges(false);
  };

  // After fetchWorkflowData (after saving or loading)
  useEffect(() => {
    if (workflowData) {
      console.log('origin_template_mappings after load:', workflowData.origin_template_mappings, typeof workflowData.origin_template_mappings);
      console.log('translated_template_mappings after load:', workflowData.translated_template_mappings, typeof workflowData.translated_template_mappings);
    }
  }, [workflowData]);

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

  const handleRequiredFieldAdd = (fieldKey: string, description: string) => {
    setLocalRequiredFields(prev => ({ ...prev, [fieldKey]: description }));
    setUnsavedChanges(true);
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
        isEditingMode={isEditingMode}
        setIsEditingMode={setIsEditingMode}
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

                {currentView === 'template' && localMappings && localFields && (
                  <TemplateView
                    url={workflowData?.template_file_public_url || ''}
                    filename="Template"
                    templateMappings={localMappings}
                    fields={localFields}
                    showMappings={showMappings}
                    onFieldUpdate={async (fieldKey, newValue) => { handleFieldUpdateLocal(fieldKey, newValue); return Promise.resolve(); }}
                    conversationId={conversationId}
                    workflowData={workflowData}
                    onMappingUpdate={handleMappingUpdate}
                    onMappingAdd={handleMappingAdd}
                    onMappingDelete={handleMappingDelete}
                    onSaveChanges={handleSaveChanges}
                    onCancelChanges={handleCancelChanges}
                    unsavedChanges={unsavedChanges}
                    isEditingMode={isEditingMode}
                    setIsEditingMode={setIsEditingMode}
                    requiredFields={localRequiredFields}
                    editingField={editingField}
                    setEditingField={setEditingField}
                  />
                )}

                {currentView === 'translated_template' && localMappings && localFields && (
                  <TranslatedTemplateView
                    url={workflowData?.template_translated_file_public_url || ''}
                    filename="Translated Template"
                    templateMappings={localMappings}
                    fields={localFields}
                    showMappings={showMappings}
                    onFieldUpdate={async (fieldKey, newValue) => { handleFieldUpdateLocal(fieldKey, newValue, true); return Promise.resolve(); }}
                    conversationId={conversationId}
                    workflowData={workflowData}
                    onMappingUpdate={handleMappingUpdate}
                    onMappingAdd={handleMappingAdd}
                    onMappingDelete={handleMappingDelete}
                    onSaveChanges={handleSaveChanges}
                    onCancelChanges={handleCancelChanges}
                    unsavedChanges={unsavedChanges}
                    isEditingMode={isEditingMode}
                    setIsEditingMode={setIsEditingMode}
                    requiredFields={localRequiredFields}
                    editingField={editingField}
                    setEditingField={setEditingField}
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