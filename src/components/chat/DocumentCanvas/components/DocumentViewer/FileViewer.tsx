import React from 'react';
import PDFViewer from './PDFViewer';
import ImageViewer from './ImageViewer';
import { File } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileViewerProps {
  url: string; 
  filename?: string; 
  templateMappings?: Record<string, any>;
  fields?: Record<string, any>;
  showMappings?: boolean;
  onFieldUpdate?: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
  conversationId: string;
  workflowData: any;
  onMappingUpdate?: (fieldKey: string, newMapping: any) => void;
  onMappingAdd?: (fieldKey: string, mapping: any) => void;
  onMappingDelete?: (fieldKey: string) => void;
  onSaveChanges?: () => void;
  onCancelChanges?: () => void;
  unsavedChanges?: boolean;
  isEditingMode?: boolean;
  setIsEditingMode?: (v: boolean) => void;
  requiredFields?: Record<string, string>;
  editingField?: string | null;
  setEditingField?: (fieldKey: string | null) => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ 
  url, 
  filename, 
  templateMappings, 
  fields = {}, 
  showMappings = false, 
  onFieldUpdate, 
  isTranslatedView = false,
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
  const getFileType = (url: string): 'pdf' | 'image' | 'other' => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = pathname.split('.').pop()?.toLowerCase();
      
      if (extension === 'pdf') return 'pdf';
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(extension || '')) {
        return 'image';
      }
      return 'other';
    } catch (error) {
      const extension = url.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') return 'pdf';
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(extension || '')) {
        return 'image';
      }
      return 'other';
    }
  };

  const fileType = getFileType(url);

  if (fileType === 'pdf') {
    return (
      <PDFViewer 
        url={url} 
        templateMappings={templateMappings}
        fields={fields}
        showMappings={showMappings}
        onFieldUpdate={onFieldUpdate}
        isTranslatedView={isTranslatedView}
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
  }

  if (fileType === 'image') {
    return <ImageViewer url={url} />;
  }

  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center">
        <File size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="font-medium text-gray-600 mb-2">
          {filename || 'Document'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          This file type cannot be previewed in the browser
        </p>
        <Button
          onClick={() => window.open(url, '_blank')}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Open File
        </Button>
      </div>
    </div>
  );
};

export default FileViewer;