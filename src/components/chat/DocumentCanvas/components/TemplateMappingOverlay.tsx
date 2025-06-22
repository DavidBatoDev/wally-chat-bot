import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { X, Check, Eye, EyeOff, Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditableInput from './EditableInput';
import { TemplateMapping, WorkflowField } from '../types/workflow';
import api from '@/lib/api';

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
  workflowData: any; // Add this prop
  conversationId: string; // Add this prop
  isEditingLayout?: boolean;
  onUpdateLayout?: (newMappings: any) => void;
  editingField?: string | null;
  setEditingField?: (fieldKey: string | null) => void;
}

const TemplateMappingOverlay = forwardRef<any, TemplateMappingOverlayProps>(({ 
  mappings, 
  fields, 
  pageNum, 
  scale, 
  canvasWidth, 
  canvasHeight, 
  visible, 
  onFieldUpdate, 
  workflowData, // Add this prop
  conversationId, // Add this prop
  isTranslatedView = false,
  isEditingLayout = false,
  onUpdateLayout,
  editingField,
  setEditingField
}, ref) => {
  // All hooks must be called unconditionally
  const [hoveredMapping, setHoveredMapping] = useState<string | null>(null);
  const [editInputPosition, setEditInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState<boolean>(true);
  const [showAddBox, setShowAddBox] = useState(false);
  const [newBoxKey, setNewBoxKey] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; x1: number; y1: number } | null>(null);

  // Mouse event listeners for drag/resize
  React.useEffect(() => {
    if (draggingKey) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
    if (resizingKey) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [draggingKey, resizingKey, dragOffset, resizeStart]);

  useImperativeHandle(ref, () => ({
    showAddBox: () => setShowAddBox(true)
  }));

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
    //   case 'confirmed':
    //     return {
    //       border: '#10b981',
    //       background: 'rgba(16, 185, 129, 0.15)',
    //       label: 'Confirmed',
    //       priority: 4
    //     };
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
    ([_, mapping]) => mapping && mapping.page_number === pageNum
  );

  if (currentPageMappings.length === 0) return null;

  const handleFieldClick = (fieldKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (editingField === fieldKey) return;
    if (editingField && setEditingField) {
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
    
    if (setEditingField) setEditingField(fieldKey);
  };

  // PATCH single field value if not in edit mode
  const patchFieldValue = async (fieldKey: string, newValue: string) => {
    try {
      await api.patch(`/api/workflow/${conversationId}/field`, {
        field_key: fieldKey,
        value: newValue,
        value_status: 'edited',
      });
    } catch (err) {
      console.error('Failed to update field value', err);
    }
  };

  // PATCH mappings/fields when deleting a box
  const patchDeleteMapping = async (newMappings: any, newFields: any) => {
    console.log(newMappings)
    console.log(fields)
    try {
      await api.patch(`/api/workflow/${conversationId}/template-mappings`, {
        origin_template_mappings: newMappings,
        fields: newFields,
      });
    } catch (err) {
      console.error('Failed to delete mapping', err);
    }
  };

  const handleFieldSave = (fieldKey: string, newValue: string) => {
    onFieldUpdate(fieldKey, newValue);
    if (setEditingField) setEditingField(null);
    setEditInputPosition(null);
    if (!isEditingLayout) {
      patchFieldValue(fieldKey, newValue);
    }
  };

  const handleEditCancel = () => {
    if (setEditingField) setEditingField(null);
    setEditInputPosition(null);
  };

  const handleAddTextBox = () => setShowAddBox(true);
  const handleAddBoxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateLayout) return;
    const key = newBoxKey.trim();
    if (!key || mappings[key]) return;
    const newMapping = {
      label: key,
      font: { name: 'Arial', size: 10, color: '#000000' },
      position: { x0: 100, y0: 100, x1: 200, y1: 120 },
      bbox_center: { x: 150, y: 110 },
      alignment: 'left',
      page_number: pageNum
    };
    onUpdateLayout({ ...mappings, [key]: newMapping });
    setShowAddBox(false);
    setNewBoxKey('');
  };
  const handleDeleteBox = (key: string) => {
    if (!onUpdateLayout) return;
    const newMappings = { ...mappings, [key]: null };
    onUpdateLayout(newMappings);
  };

  const handleDragStart = (key: string, e: React.MouseEvent) => {
    if (!isEditingLayout) return;
    setDraggingKey(key);
    const mapping = mappings[key];
    const startX = e.clientX;
    const startY = e.clientY;
    setDragOffset({
      x: startX - mapping.position.x0 * scale,
      y: startY - mapping.position.y0 * scale
    });
  };
  const handleDrag = (e: MouseEvent) => {
    if (!draggingKey || !onUpdateLayout || !dragOffset) return;
    const mapping = mappings[draggingKey];
    const newX0 = (e.clientX - dragOffset.x) / scale;
    const newY0 = (e.clientY - dragOffset.y) / scale;
    const width = mapping.position.x1 - mapping.position.x0;
    const height = mapping.position.y1 - mapping.position.y0;
    const newMapping = {
      ...mapping,
      position: {
        ...mapping.position,
        x0: newX0,
        y0: newY0,
        x1: newX0 + width,
        y1: newY0 + height
      },
      bbox_center: {
        x: newX0 + width / 2,
        y: newY0 + height / 2
      }
    };
    onUpdateLayout({ ...mappings, [draggingKey]: newMapping });
  };
  const handleDragEnd = () => {
    setDraggingKey(null);
    setDragOffset(null);
  };

  const handleResizeStart = (key: string, e: React.MouseEvent) => {
    if (!isEditingLayout) return;
    e.stopPropagation();
    setResizingKey(key);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      x1: mappings[key].position.x1,
      y1: mappings[key].position.y1
    });
  };
  const handleResize = (e: MouseEvent) => {
    if (!resizingKey || !onUpdateLayout || !resizeStart) return;
    const mapping = mappings[resizingKey];
    const dx = (e.clientX - resizeStart.x) / scale;
    const dy = (e.clientY - resizeStart.y) / scale;
    const newX1 = resizeStart.x1 + dx;
    const newY1 = resizeStart.y1 + dy;
    const newMapping = {
      ...mapping,
      position: {
        ...mapping.position,
        x1: newX1,
        y1: newY1
      },
      bbox_center: {
        x: mapping.position.x0 + (newX1 - mapping.position.x0) / 2,
        y: mapping.position.y0 + (newY1 - mapping.position.y0) / 2
      }
    };
    onUpdateLayout({ ...mappings, [resizingKey]: newMapping });
  };
  const handleResizeEnd = () => {
    setResizingKey(null);
    setResizeStart(null);
  };

  return (
    <>
      {isEditingLayout && !showAddBox && (
        <Button onClick={handleAddTextBox} className="absolute top-2 right-2 z-50" size="sm" variant="outline">Add Text Box</Button>
      )}
      {isEditingLayout && showAddBox && (
        <form onSubmit={handleAddBoxSubmit} className="absolute top-2 right-2 z-50 bg-white p-2 rounded shadow flex items-center space-x-2">
          <input
            type="text"
            value={newBoxKey}
            onChange={e => setNewBoxKey(e.target.value)}
            placeholder="Field key (unique)"
            className="border px-2 py-1 rounded text-xs"
            autoFocus
          />
          <Button type="submit" size="sm" variant="default" disabled={!newBoxKey.trim() || !!mappings[newBoxKey.trim()]}>Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddBox(false); setNewBoxKey(''); }}>Cancel</Button>
        </form>
      )}
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
              className={`absolute pointer-events-auto transition-all duration-200 ${isEditingLayout ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                left: x,
                top: y,
                width: Math.max(width, 4),
                height: Math.max(height, 4),
                border: `2px solid ${borderColor}`,
                backgroundColor: backgroundColor,
                borderRadius: '2px',
                zIndex: isEditing ? 30 : isHovered ? 20 : statusColors.priority + 10,
                userSelect: 'none',
              }}
              onMouseEnter={() => !editingField && setHoveredMapping(key)}
              onMouseLeave={() => !editingField && setHoveredMapping(null)}
              onClick={isEditingLayout ? undefined : (e) => handleFieldClick(key, e)}
              onMouseDown={isEditingLayout ? (e) => handleDragStart(key, e) : undefined}
              title={`${key}: ${mapping.label}${fieldValue ? ` - "${fieldValue}"` : ''} (${statusColors.label})`}
            >
              {isEditingLayout && (
                <button
                  type="button"
                  className="absolute top-0 right-0 m-1 p-1 bg-white rounded-full shadow z-50 hover:bg-red-100"
                  style={{ zIndex: 100 }}
                  onClick={e => { e.stopPropagation(); handleDeleteBox(key); }}
                  title="Delete box"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              )}
              {isEditingLayout && (
                <div
                  className="absolute bottom-0 right-0 w-3 h-3 bg-gray-300 rounded cursor-se-resize z-50"
                  style={{ zIndex: 100 }}
                  onMouseDown={e => handleResizeStart(key, e)}
                  title="Resize"
                />
              )}
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
                {/* <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                  <span className="text-xs text-gray-600">Confirmed</span>
                </div> */}
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
            field={fields[editingField]}
            fieldKey={editingField}
            conversationId={conversationId || ""}
            workflowData={workflowData}
            isTranslatedView={isTranslatedView}
            onSave={(newValue) => handleFieldSave(editingField, newValue)}
            onCancel={handleEditCancel}
            placeholder={`Enter ${isTranslatedView ? 'translated ' : ''}${mappings[editingField]?.label || 'value'}`}
            position={editInputPosition}
          />
        </>
      )}
    </>
  );
});

export default TemplateMappingOverlay;