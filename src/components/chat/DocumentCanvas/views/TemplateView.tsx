import React from 'react';
import FileViewer from '../components/DocumentViewer/FileViewer';
import { TemplateMapping, WorkflowField } from '../types/workflow';

interface TemplateViewProps {
  url: string;
  filename?: string;
  templateMappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  showMappings: boolean;
  onFieldUpdate: (fieldKey: string, newValue: string, isTranslatedView: boolean) => Promise<void>;
  conversationId: string;
  workflowData: any;
  onMappingUpdate: (fieldKey: string, newMapping: TemplateMapping) => void;
  onMappingAdd: (fieldKey: string, mapping: TemplateMapping) => void;
  onMappingDelete: (fieldKey: string) => void;
  onSaveChanges: () => void;
  onCancelChanges: () => void;
  unsavedChanges: boolean;
  isEditingMode: boolean;
  setIsEditingMode: (v: boolean) => void;
  requiredFields?: Record<string, string>;
  editingField: string | null;
  setEditingField: (fieldKey: string | null) => void;
  onUpdateLayout?: (newMappings: Record<string, TemplateMapping>) => void;
  onScaleChange?: (scale: number) => void;
}

const TemplateView: React.FC<TemplateViewProps> = ({
  url,
  filename,
  templateMappings,
  fields,
  showMappings,
  onFieldUpdate,
  conversationId,
  workflowData,
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
  // Wrap onFieldUpdate to always use isTranslatedView = false
  const handleFieldUpdate = (fieldKey: string, newValue: string) => onFieldUpdate(fieldKey, newValue, false);
  return (
    <div className="h-full">
      <FileViewer
        url={url}
        filename={filename || 'Template'}
        templateMappings={templateMappings}
        fields={fields}
        showMappings={showMappings}
        onFieldUpdate={handleFieldUpdate}
        conversationId={conversationId}
        workflowData={workflowData}
        onMappingUpdate={onMappingUpdate}
        onMappingAdd={onMappingAdd}
        onMappingDelete={onMappingDelete}
        onSaveChanges={onSaveChanges}
        onCancelChanges={onCancelChanges}
        unsavedChanges={unsavedChanges}
        isEditingMode={isEditingMode}
        setIsEditingMode={setIsEditingMode}
        requiredFields={requiredFields}
        editingField={editingField}
        setEditingField={setEditingField}
        onUpdateLayout={onUpdateLayout}
        onScaleChange={onScaleChange}
      />
    </div>
  );
};

export default TemplateView;