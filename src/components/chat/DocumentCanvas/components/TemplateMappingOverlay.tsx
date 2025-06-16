import React, { useState } from 'react';
import { X, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditableInput from './EditableInput';
import { TemplateMapping, WorkflowField } from '../types/workflow';

interface TemplateMappingOverlayProps {
  mappings: Record<string, TemplateMapping>;
  fields: Record<string, WorkflowField>;
  pageNum: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  visible: boolean;
  onFieldUpdate: (fieldKey: string, newValue: string) => void;
  isTranslatedView?: boolean;
}

const TemplateMappingOverlay: React.FC<TemplateMappingOverlayProps> = ({ 
  mappings, 
  fields, 
  pageNum, 
  scale, 
  canvasWidth, 
  canvasHeight, 
  visible, 
  onFieldUpdate, 
  isTranslatedView = false 
}) => {
  const [hoveredMapping, setHoveredMapping] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editInputPosition, setEditInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState<boolean>(false);

  if (!visible || !mappings) return null;

  const getStatusColors = (field: WorkflowField | undefined, isTranslatedView: boolean) => {
    if (!field) {
      return {
        border: '#9ca3af',
        background: 'rgba(156, 163, 175, 0.1)',
        label: 'No Data',
        priority: 0
      };
    }

    const status = isTranslatedView ? field.translated_status : field.value_status;
    const value = isTranslatedView ? field.translated_value : field.value;
    const hasValue = value && value.trim().length > 0;

    switch (status) {
      case 'confirmed':
        return {
          border: '#10b981',
          background: 'rgba(16, 185, 129, 0.15)',
          label: 'Confirmed',
          priority: 4
        };
      case 'edited':
        return {
          border: '#3b82f6',
          background: 'rgba(59, 130, 246, 0.15)',
          label: 'Edited',
          priority: 3
        };
      case 'ocr':
      case 'translated':
        return {
          border: '#f59e0b',
          background: 'rgba(245, 158, 11, 0.15)',
          label: isTranslatedView ? 'Translated' : 'OCR',
          priority: 2
        };
      case 'pending':
      default:
        return {
          border: '#6b7280',
          background: 'rgba(107, 114, 128, 0.15)',
          label: 'Pending',
          priority: 1
        };
    }
  };

  const currentPageMappings = Object.entries(mappings).filter(
    ([_, mapping]) => mapping.page_number === pageNum
  );

  if (currentPageMappings.length === 0) return null;

  const handleFieldClick = (fieldKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (editingField === fieldKey) return;
    if (editingField) {
      setEditingField(null);
      setEditInputPosition(null);
      return;
    }
    
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const overlayContainer = target.parentElement;
    
    if (overlayContainer) {
      const containerRect = overlayContainer.getBoundingClientRect();
      setEditInputPosition({
        x: rect.left - containerRect.left,
        y: rect.bottom - containerRect.top + 4
      });
    } else {
      setEditInputPosition({
        x: target.offsetLeft,
        y: target.offsetTop + target.offsetHeight + 4
      });
    }
    
    setEditingField(fieldKey);
  };

  const handleFieldSave = (fieldKey: string, newValue: string) => {
    onFieldUpdate(fieldKey, newValue);
    setEditingField(null);
    setEditInputPosition(null);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditInputPosition(null);
  };

  return (
    <>
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {currentPageMappings.map(([key, mapping]) => {
          const x = mapping.position.x0 * scale;
          const y = mapping.position.y0 * scale;
          const width = (mapping.position.x1 - mapping.position.x0) * scale;
          const height = (mapping.position.y1 - mapping.position.y0) * scale;

          const isHovered = hoveredMapping === key;
          const isEditing = editingField === key;
          const field = fields[key];
          const fieldValue = isTranslatedView 
            ? (field?.translated_value || '') 
            : (field?.value || '');
          
          const statusColors = getStatusColors(field, isTranslatedView);
          
          let borderColor = statusColors.border;
          let backgroundColor = statusColors.background;
          
          if (isEditing) {
            borderColor = '#10b981';
            backgroundColor = 'rgba(16, 185, 129, 0.2)';
          } else if (isHovered) {
            borderColor = '#8b5cf6';
            backgroundColor = 'rgba(139, 92, 246, 0.2)';
          }

          return (
            <div
              key={key}
              className="absolute pointer-events-auto cursor-pointer transition-all duration-200"
              style={{
                left: x,
                top: y,
                width: Math.max(width, 4),
                height: Math.max(height, 4),
                border: `2px solid ${borderColor}`,
                backgroundColor: backgroundColor,
                borderRadius: '2px',
                zIndex: isEditing ? 30 : isHovered ? 20 : statusColors.priority + 10,
              }}
              onMouseEnter={() => !editingField && setHoveredMapping(key)}
              onMouseLeave={() => !editingField && setHoveredMapping(null)}
              onClick={(e) => handleFieldClick(key, e)}
              title={`${key}: ${mapping.label}${fieldValue ? ` - "${fieldValue}"` : ''} (${statusColors.label})`}
            >
              {fieldValue && fieldValue.trim().length > 0 && !isEditing && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-800 bg-white bg-opacity-90 rounded"
                  style={{
                    fontSize: Math.max(8, Math.min(12, height * 0.6)),
                    padding: '1px 2px',
                  }}
                >
                  <span className="truncate max-w-full">
                    {fieldValue}
                  </span>
                </div>
              )}

              {isHovered && !isEditing && (
                <div
                  className="absolute bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-40"
                  style={{
                    top: height + 8,
                    left: 0,
                    maxWidth: '300px',
                  }}
                >
                  <div className="font-semibold text-yellow-300">{key}</div>
                  <div className="text-gray-300">{mapping.label}</div>
                  
                  <div className="flex items-center mt-1 space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusColors.border }}
                    />
                    <span className="text-sm font-medium">{statusColors.label}</span>
                  </div>
                  
                  {field && (
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      {field.value && (
                        <div className="text-blue-300">
                          <span className="text-gray-400">Original:</span> "{field.value}"
                          <span className="text-xs text-gray-500 ml-2">({field.value_status})</span>
                        </div>
                      )}
                      {field.translated_value && (
                        <div className="text-green-300 mt-1">
                          <span className="text-gray-400">Translated:</span> "{field.translated_value}"
                          <span className="text-xs text-gray-500 ml-2">({field.translated_status})</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-gray-400 text-xs mt-2">
                    Font: {mapping.font.name}, Size: {mapping.font.size}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Click to edit
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute top-4 left-4 z-40">
        <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
          <div 
            className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setLegendCollapsed(!legendCollapsed)}
          >
            <div className="text-xs font-semibold text-gray-700">Field Status</div>
            <div 
              className="w-4 h-4 flex items-center justify-center text-gray-500 transform transition-transform"
              style={{ transform: legendCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            >
              ▼
            </div>
          </div>
          
          {!legendCollapsed && (
            <div className="px-3 pb-3 border-t border-gray-200">
              <div className="space-y-1 mt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                  <span className="text-xs text-gray-600">Confirmed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                  <span className="text-xs text-gray-600">Edited</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                  <span className="text-xs text-gray-600">{isTranslatedView ? 'Translated' : 'OCR'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6b7280' }}></div>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingField && editInputPosition && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              handleEditCancel();
            }}
          />
          
          <EditableInput
            value={isTranslatedView 
              ? (fields[editingField]?.translated_value || '') 
              : (fields[editingField]?.value || '')}
            onSave={(newValue: string) => handleFieldSave(editingField, newValue)}
            onCancel={handleEditCancel}
            placeholder={`Enter ${isTranslatedView ? 'translated ' : ''}${mappings[editingField]?.label || 'value'}`}
            position={editInputPosition}
          />
        </>
      )}
    </>
  );
};

export default TemplateMappingOverlay;