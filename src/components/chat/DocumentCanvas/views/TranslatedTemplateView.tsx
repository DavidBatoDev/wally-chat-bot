// client/src/components/chat/DocumentCanvas/views/TranslatedTemplateView.tsx
import React from 'react';
import FileViewer from '../components/DocumentViewer/FileViewer';

interface TranslatedTemplateViewProps {
  url: string;
  filename?: string;
  templateMappings?: Record<string, any>;
  fields?: Record<string, any>;
  showMappings: boolean;
  onFieldUpdate: (fieldKey: string, newValue: string, isTranslatedView: boolean) => Promise<void>;
  workflowData: any;
  conversationId: string;
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

const TranslatedTemplateView: React.FC<TranslatedTemplateViewProps> = ({ 
  url, 
  filename,
  templateMappings,
  fields,
  showMappings,
  workflowData,
  conversationId,
  onFieldUpdate,
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
  const handleFieldUpdate = (fieldKey: string, newValue: string) => {
    return onFieldUpdate(fieldKey, newValue, true);
  };

  return (
    <FileViewer 
      url={url} 
      filename={filename || "Translated Template"}
      templateMappings={templateMappings}
      fields={fields}
      showMappings={showMappings}
      onFieldUpdate={handleFieldUpdate}
      isTranslatedView={true}
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
  );
};

export default TranslatedTemplateView;