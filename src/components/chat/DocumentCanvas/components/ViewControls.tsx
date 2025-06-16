import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { WorkflowData, ViewType } from '../types/workflow';

interface ViewControlsProps {
  currentView: ViewType;
  showMappings: boolean;
  workflowData: WorkflowData | null;
  loading: boolean;
  error: string | null;
  hasWorkflow: boolean;
  onViewChange: (view: ViewType) => void;
  onToggleMappings: () => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({
  currentView,
  showMappings,
  workflowData,
  loading,
  error,
  hasWorkflow,
  onViewChange,
  onToggleMappings
}) => {
  const getMappingsCount = () => {
    if (currentView === 'translated_template') {
      return workflowData?.translated_template_mappings 
        ? Object.keys(workflowData.translated_template_mappings).length 
        : 0;
    }
    return workflowData?.origin_template_mappings 
      ? Object.keys(workflowData.origin_template_mappings).length 
      : 0;
  };

  if (loading || error || !hasWorkflow) return null;

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex space-x-3">
        <Button
          onClick={() => onViewChange('original')}
          variant={currentView === 'original' ? 'default' : 'outline'}
          disabled={!workflowData?.base_file_public_url}
          className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
            currentView === 'original'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Original File
        </Button>
        
        <Button
          onClick={() => onViewChange('template')}
          variant={currentView === 'template' ? 'default' : 'outline'}
          disabled={!workflowData?.template_file_public_url}
          className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
            currentView === 'template'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Template
        </Button>

        <Button
          onClick={() => onViewChange('translated_template')}
          variant={currentView === 'translated_template' ? 'default' : 'outline'}
          disabled={!workflowData?.template_translated_file_public_url}
          className={`px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200 ${
            currentView === 'translated_template'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Translated Template
        </Button>
      </div>
      
      {(currentView === 'template' || currentView === 'translated_template') && 
      ((currentView === 'template' && workflowData?.origin_template_mappings) || 
        (currentView === 'translated_template' && workflowData?.translated_template_mappings)) && (
        <div className="flex items-center space-x-2">
          <Button
            onClick={onToggleMappings}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            {showMappings ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>
              {showMappings ? 'Hide' : 'Show'} Mappings ({getMappingsCount()})
            </span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ViewControls;