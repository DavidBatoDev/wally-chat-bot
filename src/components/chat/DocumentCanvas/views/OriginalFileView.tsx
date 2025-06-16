import React from 'react';
import FileViewer from '../components/DocumentViewer/FileViewer';

interface OriginalFileViewProps {
  url: string;
  filename?: string;
    conversationId: string;
    workflowData: any;
}

const OriginalFileView: React.FC<OriginalFileViewProps> = ({ 
  url, 
  filename,
  conversationId,
  workflowData
}) => {
  return (
    <div className="h-full">
      <FileViewer 
        url={url} 
        filename={filename || "Original File"} 
        conversationId={conversationId}
        workflowData={workflowData}
      />
    </div>
  );
};

export default OriginalFileView;