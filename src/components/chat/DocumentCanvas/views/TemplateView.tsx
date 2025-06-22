import React from 'react';
import FileViewer from '../components/DocumentViewer/FileViewer';

interface TemplateViewProps {
  url: string;
  filename?: string;
  templateMappings?: Record<string, any>;
  fields?: Record<string, any>;
  showMappings: boolean;
  onFieldUpdate: (fieldKey: string, newValue: string, isTranslatedView: boolean) => Promise<void>;
  conversationId: string;
  workflowData: any;
  onMappingUpdate: (fieldKey: string, newMapping: any) => void;
  onMappingAdd: (fieldKey: string, mapping: any) => void;
  onMappingDelete: (fieldKey: string) => void;
  onSaveChanges: () => void;
  onCancelChanges: () => void;
  unsavedChanges: boolean;
  isEditingMode: boolean;
  setIsEditingMode: (v: boolean) => void;
  requiredFields?: Record<string, string>;
  editingField: string | null;
  setEditingField: (fieldKey: string | null) => void;
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
  setEditingField
}) => {
  return (
    <div className="h-full">
      <FileViewer 
        url={url} 
        filename={filename || "Template"}
        templateMappings={templateMappings}
        fields={fields}
        showMappings={showMappings}
        onFieldUpdate={(fieldKey, newValue) => onFieldUpdate(fieldKey, newValue, false)}
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
      />
    </div>
  );
};

export default TemplateView;