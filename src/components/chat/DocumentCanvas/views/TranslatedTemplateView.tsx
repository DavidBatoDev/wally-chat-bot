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
}

const TranslatedTemplateView: React.FC<TranslatedTemplateViewProps> = ({ 
  url, 
  filename,
  templateMappings,
  fields,
  showMappings,
    workflowData,
    conversationId,
  onFieldUpdate
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
      
    />
  );
};

export default TranslatedTemplateView;