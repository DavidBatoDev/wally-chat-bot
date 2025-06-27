// client/src/components/chat/DocumentCanvas/index.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Page } from 'react-pdf';
import { saveAs } from 'file-saver';
import { transformCoordinatesForPdf, drawTextWithFallback, validateTextPosition } from './utils/pdfTextPositioning';
import { loadFontsWithFallbacks } from './utils/fontLoader';
import { validateFieldData, createDebugInfo, logDebugInfo, createGenerationReport, DebugInfo } from './utils/debugHelper';
import { createPositionDebugInfo, validateMultipleFields } from './utils/positionValidator';

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
  // 1. All useState hooks
  const [currentView, setCurrentView] = useState<ViewType>('original');
  const [showMappings, setShowMappings] = useState<boolean>(true);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [lastOverlayScale, setLastOverlayScale] = useState(1);

  // 2. All useMemo/useCallback hooks
  const memoizedMappings = useMemo(() => localMappings, [localMappings]);
  const memoizedFields = useMemo(() => localFields, [localFields]);
  const memoizedRequiredFields = useMemo(() => localRequiredFields, [localRequiredFields]);
  const filteredMappings = useMemo(() => {
    if (!memoizedMappings) return null;
    const result: Record<string, TemplateMapping> = {};
    Object.entries(memoizedMappings).forEach(([key, value]) => {
      if (value) result[key] = value;
    });
    return result;
  }, [memoizedMappings]);
  const handleFieldUpdateLocalMemo = useCallback(
    (fieldKey: string, newValue: string, isTranslatedView = false) => {
      setLocalFields(prev => {
        const updated = { ...(prev || {}) };
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
    },
    []
  );
  const handleSaveChanges = useCallback(async () => {
    if (!workflowData) return;
    setIsSaving(true);
    try {
      const filteredMappings: Record<string, any> = {};
      Object.entries(localMappings || {}).forEach(([key, value]) => {
        if (value !== null) filteredMappings[key] = value;
      });
      const validRequiredFields: Record<string, string> = {};
      Object.keys(filteredMappings).forEach(key => {
        if (localRequiredFields[key]) validRequiredFields[key] = localRequiredFields[key];
      });
      const allFields = { ...(localFields || {}) };
      Object.keys(filteredMappings).forEach(key => {
        if (!allFields[key]) {
          allFields[key] = { value: '', value_status: 'pending', translated_value: null, translated_status: 'pending' };
        }
      });
      const cleanFields: Record<string, any> = {};
      Object.keys(allFields).forEach(key => {
        if (filteredMappings[key]) {
          cleanFields[key] = allFields[key];
        }
      });
      const info_json_custom = {
        ...(workflowData.info_json_custom || workflowData.info_json || {}),
        required_fields: validRequiredFields,
        fillable_text_info: Object.values(filteredMappings),
      };
      const mappingsKey = currentView === 'template' ? 'origin_template_mappings' : 'translated_template_mappings';
      const patchPayload = {
        [mappingsKey]: filteredMappings,
        fields: cleanFields,
        info_json_custom,
      };
      await api.patch(`/api/workflow/${conversationId}/template-mappings`, patchPayload);
      await fetchWorkflowData();
      toast({ title: 'Changes saved', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setIsSaving(false);
    setUnsavedChanges(false);
  }, [workflowData, localMappings, localFields, localRequiredFields, currentView, conversationId, fetchWorkflowData, toast]);
  const handleCancelChanges = useCallback(() => {
    if (!workflowData) return;
    if (currentView === 'template') {
      setLocalMappings(cloneDeep(workflowData.origin_template_mappings || {}));
    } else if (currentView === 'translated_template') {
      setLocalMappings(cloneDeep(workflowData.translated_template_mappings || {}));
    }
    setLocalFields(cloneDeep(workflowData.fields || {}));
    setLocalRequiredFields(cloneDeep((workflowData.required_fields || workflowData.template_required_fields) || {}));
    setUnsavedChanges(false);
  }, [workflowData, currentView]);

  const handleFieldUpdateTemplate = useCallback(
    (fieldKey: string, newValue: string) => {
      handleFieldUpdateLocalMemo(fieldKey, newValue);
      return Promise.resolve();
    },
    [handleFieldUpdateLocalMemo]
  );
  const handleFieldUpdateTranslated = useCallback(
    (fieldKey: string, newValue: string) => {
      handleFieldUpdateLocalMemo(fieldKey, newValue, true);
      return Promise.resolve();
    },
    [handleFieldUpdateLocalMemo]
  );

  const handleMappingUpdate = useCallback(() => {
    // TODO: Implement mapping update logic
  }, []);
  const handleMappingAdd = useCallback(() => {
    // TODO: Implement mapping add logic
  }, []);
  const handleMappingDelete = useCallback(() => {
    // TODO: Implement mapping delete logic
  }, []);

  // Add this handler to update mappings and persist
  const handleUpdateLayout = useCallback((newMappings: Record<string, TemplateMapping>) => {
    setLocalMappings(newMappings);
    // Persist to backend - use the correct mappings key based on current view
    const mappingsKey = currentView === 'template' ? 'origin_template_mappings' : 'translated_template_mappings';
    api.patch(`/api/workflow/${conversationId}/template-mappings`, {
      [mappingsKey]: newMappings,
      fields: localFields,
    });
    setUnsavedChanges(true);
  }, [conversationId, localFields, currentView]);

  // 3. All useEffect hooks
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

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!showPreview && previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  }, [showPreview, previewBlobUrl]);

  useEffect(() => {
    if (showPreview) {
      setShowPreview(false);
    }
  }, [currentView]);

  const handleTogglePreview = async () => {
    const newPreviewState = !showPreview;
    setShowPreview(newPreviewState);
    if (newPreviewState) {
      try {
        const url = await generatePreview();
        setPreviewBlobUrl(url);
      } catch (err) {
        toast({
          title: 'Preview Error',
          description: 'Failed to generate preview',
          variant: 'destructive'
        });
        setShowPreview(false);
      }
    } else {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
    }
  };

  const generatePreview = async (): Promise<string> => {
    if (!workflowData?.template_file_public_url) throw new Error('No template PDF');
    // Fetch the template PDF
    const existingPdfBytes = await fetch(workflowData.template_file_public_url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Load fonts with fallback handling
    const fontResult = await loadFontsWithFallbacks(pdfDoc);
    const { primaryFont, fallbackFont } = fontResult;
    
    // For each mapping, draw the field value at the mapped position
    Object.entries(localMappings || {}).forEach(([key, mapping]) => {
      if (!mapping) return;
      
      const page = pdfDoc.getPage(mapping.page_number - 1);
      const value = localFields?.[key]?.value || '';
      
      if (!value.trim()) return; // Skip empty values
      
      // Use the new positioning logic
      const position = transformCoordinatesForPdf({
        mapping,
        textValue: value,
        font: primaryFont,
        pdfPageHeight: page.getHeight(),
        scale: lastOverlayScale,
        debugMode: false // Set to true for debugging
      });
      
      // Validate position
      if (!validateTextPosition(position, page.getWidth(), page.getHeight(), value)) {
        console.warn(`Preview: Text position out of bounds for field ${key}`);
        return;
      }
      
      // Draw text with fallback handling
      drawTextWithFallback(
        page,
        value,
        position,
        primaryFont,
        fallbackFont,
        rgb(0, 0, 0)
      );
    });
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  };

  const handleDownloadFilledPdf = async () => {
    try {
      console.log('🚀 Starting PDF Generation Process...');
      
      // Validate field data before processing
      if (localMappings && localFields) {
        // Filter out null mappings for validation
        const validMappings: Record<string, TemplateMapping> = {};
        Object.entries(localMappings).forEach(([key, mapping]) => {
          if (mapping) validMappings[key] = mapping;
        });
        
        const validation = validateFieldData(validMappings, localFields, currentView === 'translated_template');
        console.log('📋 Field Validation:', validation.summary);
        if (validation.issues.length > 0) {
          console.warn('⚠️ Validation Issues:', validation.issues);
        }
      }
      
      // Debug: log all fields and which value will be used
      console.log('📊 Download PDF - Field Analysis:');
      if (localFields) {
        Object.entries(localFields).forEach(([key, field]) => {
          let chosen;
          let usedType;
          if (currentView === 'translated_template') {
            chosen = field.translated_value;
            usedType = 'translated_value';
          } else {
            chosen = field.value;
            usedType = 'value';
          }
          console.log(`  📝 Field: ${key} | View: ${currentView} | Used: ${usedType}`, {
            value: field.value,
            translated_value: field.translated_value,
            used: chosen
          });
        });
      }
      const templateUrl = currentView === 'translated_template'
        ? workflowData?.template_translated_file_public_url
        : workflowData?.template_file_public_url;
      if (!templateUrl) throw new Error('No template PDF');
      // Fetch the correct template PDF
      const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      // Load fonts with enhanced fallback handling
      const fontResult = await loadFontsWithFallbacks(pdfDoc);
      const { primaryFont: customFont, fallbackFont, fontName } = fontResult;
      console.log(`🔤 PDF Generation using font: ${fontName}`);
      
      // Initialize debug tracking
      const debugInfos: DebugInfo[] = [];
      const actualPositions: Record<string, { x: number; y: number; fontSize: number }> = {};
      const processedFieldValues: Record<string, string> = {};
      let canvasWidth = null;
      let pdfWidth = null;
      const firstMapping = Object.values(localMappings || {}).find(Boolean);
      if (firstMapping) {
        const page = pdfDoc.getPage(firstMapping.page_number - 1);
        pdfWidth = page.getWidth();
        canvasWidth = pdfWidth * lastOverlayScale;
      }
      
      console.log('📐 Processing text fields...');
      Object.entries(localMappings || {}).forEach(([key, mapping]) => {
        try {
          if (!mapping) return;
          
          const pageNum = mapping.page_number - 1;
          const page = pdfDoc.getPage(pageNum);
          
          // Get the appropriate field value based on current view
          let value = '';
          if (currentView === 'translated_template') {
            value = localFields?.[key]?.translated_value || '';
          } else {
            value = localFields?.[key]?.value || '';
          }
          
          if (!value.trim()) {
            console.log(`Skipping empty field: ${key}`);
            return; // Skip empty values
          }
          
          // Use the new positioning logic with proper text centering
          const position = transformCoordinatesForPdf({
            mapping,
            textValue: value,
            font: customFont,
            pdfPageHeight: page.getHeight(),
            scale: 1, // No scaling for final PDF
            debugMode: true // Enable debug for download
          });
          
          // Create debug info for this field
          let textWidth: number | undefined;
          try {
            textWidth = customFont.widthOfTextAtSize(value, position.fontSize);
          } catch {
            // Fallback approximation if measurement fails
            textWidth = value.length * position.fontSize * 0.6;
          }
          
          // Store position and value for validation
          actualPositions[key] = position;
          processedFieldValues[key] = value;
          
          const debugInfo = createDebugInfo(key, value, mapping, position, fontName, textWidth);
          debugInfos.push(debugInfo);
          logDebugInfo(debugInfo);
          
          // Create detailed position debug info
          const positionDebug = createPositionDebugInfo(key, mapping, position, page.getHeight(), value);
          console.log(positionDebug);
          
          // Validate position bounds
          if (!validateTextPosition(position, page.getWidth(), page.getHeight(), value, true)) {
            console.warn(`📍 Download: Text position out of bounds for field ${key}, skipping`);
            return;
          }
          
          // Draw text with enhanced fallback handling
          const success = drawTextWithFallback(
            page,
            value,
            position,
            customFont,
            fallbackFont,
            rgb(0, 0, 0),
            true // Enable debug mode
          );
          
          if (!success) {
            console.error(`❌ Failed to draw text for field ${key} after all attempts`);
          } else {
            console.log(`✅ Successfully drew text for field ${key}`);
          }
          
        } catch (fieldErr) {
          console.error('❌ Error processing field for PDF:', { key, mapping, err: fieldErr });
        }
      });
      
      // Generate comprehensive validation report
      if (Object.keys(actualPositions).length > 0) {
        // Filter out null mappings for validation
        const validMappings: Record<string, TemplateMapping> = {};
        Object.entries(localMappings || {}).forEach(([key, mapping]) => {
          if (mapping && actualPositions[key]) validMappings[key] = mapping;
        });
        
        const firstPage = pdfDoc.getPage(0);
        const validationResult = validateMultipleFields(
          validMappings,
          actualPositions,
          processedFieldValues,
          firstPage.getHeight()
        );
        
        console.log(validationResult.summary);
      }
      
      // Generate and log comprehensive report
      const report = createGenerationReport(debugInfos, fontName, currentView === 'translated_template');
      console.log(report);
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const filename = currentView === 'translated_template' ? 'translated-template.pdf' : 'filled-template.pdf';
      saveAs(blob, filename);
      
      console.log(`🎉 PDF Generation Complete! Downloaded as: ${filename}`);
    } catch (err) {
      console.error('Download PDF error:', err);
      toast({
        title: 'Download Error',
        description: 'Failed to generate filled PDF',
        variant: 'destructive'
      });
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
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
    }
  }, [isOpen]);

  // 4. All logic and returns
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
        onDownloadFilledPdf={handleDownloadFilledPdf}
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
                    workflowData={workflowData}
                    conversationId={conversationId}
                  />
                )}

            {currentView === 'template' && filteredMappings && memoizedFields && (
                  <TemplateView
                    url={workflowData?.template_file_public_url || ''}
                    filename="Template"
                    templateMappings={filteredMappings}
                    fields={memoizedFields}
                    showMappings={showMappings}
                    onFieldUpdate={handleFieldUpdateTemplate}
                    conversationId={conversationId}
                    workflowData={workflowData}
                    onMappingUpdate={handleMappingUpdate}
                    onMappingAdd={handleMappingAdd}
                    onMappingDelete={handleMappingDelete}
                    onUpdateLayout={handleUpdateLayout}
                    onSaveChanges={handleSaveChanges}
                    onCancelChanges={handleCancelChanges}
                    unsavedChanges={unsavedChanges}
                    isEditingMode={isEditingMode}
                    setIsEditingMode={setIsEditingMode}
                    requiredFields={memoizedRequiredFields}
                    editingField={editingField}
                    setEditingField={setEditingField}
                    onScaleChange={setLastOverlayScale}
                  />
                )}

            {currentView === 'translated_template' && filteredMappings && memoizedFields && (
                  <TranslatedTemplateView
                    url={workflowData?.template_translated_file_public_url || ''}
                    filename="Translated Template"
                    templateMappings={filteredMappings}
                    fields={memoizedFields}
                    showMappings={showMappings}
                    onFieldUpdate={handleFieldUpdateTranslated}
                    conversationId={conversationId}
                    workflowData={workflowData}
                    onMappingUpdate={handleMappingUpdate}
                    onMappingAdd={handleMappingAdd}
                    onMappingDelete={handleMappingDelete}
                    onUpdateLayout={handleUpdateLayout}
                    onSaveChanges={handleSaveChanges}
                    onCancelChanges={handleCancelChanges}
                    unsavedChanges={unsavedChanges}
                    isEditingMode={isEditingMode}
                    setIsEditingMode={setIsEditingMode}
                    requiredFields={memoizedRequiredFields}
                    editingField={editingField}
                    setEditingField={setEditingField}
                    onScaleChange={setLastOverlayScale}
                  />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;