import React from 'react';
import FileViewer from '../components/DocumentViewer/FileViewer';

interface OriginalFileViewProps {
  url: string;
  filename?: string;
}

const OriginalFileView: React.FC<OriginalFileViewProps> = ({ 
  url, 
  filename 
}) => {
  return (
    <div className="h-full">
      <FileViewer 
        url={url} 
        filename={filename || "Original File"} 
      />
    </div>
  );
};

export default OriginalFileView;