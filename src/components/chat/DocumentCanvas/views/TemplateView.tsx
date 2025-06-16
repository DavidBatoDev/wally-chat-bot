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
}

const TemplateView: React.FC<TemplateViewProps> = ({ 
  url, 
  filename,
  templateMappings,
  fields,
  showMappings,
  onFieldUpdate,
  conversationId,
  workflowData
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
      />
    </div>
  );
};

export default TemplateView;