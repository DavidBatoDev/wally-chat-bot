import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { X, Check, Eye, EyeOff, Trash2, Move, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditableInput from './EditableInput';
import { TemplateMapping, WorkflowField } from '../types/workflow';
import api from '@/lib/api';
import { Rnd, DraggableData, RndResizeCallback } from 'react-rnd';

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
  const [isInteracting, setIsInteracting] = useState(false);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);

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
    if (onFieldUpdate) {
      onFieldUpdate(key, ""); // This should update localFields in the parent!
    }
    setShowAddBox(false);
    setNewBoxKey('');
  };
  const handleDeleteBox = (key: string) => {
    if (!onUpdateLayout) return;
    const newMappings = { ...mappings, [key]: null };
    onUpdateLayout(newMappings);
  };

  const handleEditIconClick = (key: string, boxRect: DOMRect) => {
    if (setEditingField) setEditingField(key);
    setSelectedBox(key);
    // Position the input below the box, centered
    setEditInputPosition({
      x: boxRect.width / 2,
      y: boxRect.height + 12
    });
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
            <Rnd
              key={key}
              size={{ width: Math.max(width, 4), height: Math.max(height, 4) }}
              position={{ x, y }}
              enableResizing={isEditingLayout}
              disableDragging={!isEditingLayout}
              bounds="parent"
              onDragStart={() => { setIsInteracting(true); setSelectedBox(key); }}
              onDragStop={(e: any, d: DraggableData) => {
                setIsInteracting(false);
                if (!isEditingLayout || !onUpdateLayout) return;
                const newX0 = d.x / scale;
                const newY0 = d.y / scale;
                const boxWidth = mapping.position.x1 - mapping.position.x0;
                const boxHeight = mapping.position.y1 - mapping.position.y0;
                const newMapping = {
                  ...mapping,
                  position: {
                    ...mapping.position,
                    x0: newX0,
                    y0: newY0,
                    x1: newX0 + boxWidth,
                    y1: newY0 + boxHeight
                  },
                  bbox_center: {
                    x: newX0 + boxWidth / 2,
                    y: newY0 + boxHeight / 2
                  }
                };
                onUpdateLayout({ ...mappings, [key]: newMapping });
              }}
              onResizeStart={() => { setIsInteracting(true); setSelectedBox(key); }}
              onResizeStop={(
                e: any,
                direction: string,
                ref: HTMLElement,
                delta: { width: number; height: number },
                position: { x: number; y: number }
              ) => {
                setIsInteracting(false);
                if (!isEditingLayout || !onUpdateLayout) return;
                const newWidth = ref.offsetWidth / scale;
                const newHeight = ref.offsetHeight / scale;
                const newX0 = position.x / scale;
                const newY0 = position.y / scale;
                const newMapping = {
                  ...mapping,
                  position: {
                    ...mapping.position,
                    x0: newX0,
                    y0: newY0,
                    x1: newX0 + newWidth,
                    y1: newY0 + newHeight
                  },
                  bbox_center: {
                    x: newX0 + newWidth / 2,
                    y: newY0 + newHeight / 2
                  }
                };
                onUpdateLayout({ ...mappings, [key]: newMapping });
              }}
              style={{
                boxShadow: selectedBox === key ? '0 2px 12px 0 rgba(0,0,0,0.14)' : '0 2px 8px 0 rgba(0,0,0,0.10)',
                border: selectedBox === key ? `2.5px solid ${borderColor}` : `1.5px solid ${borderColor}`,
                backgroundColor: backgroundColor,
                borderRadius: '8px',
                zIndex: isEditing ? 30 : statusColors.priority + 10,
                userSelect: 'none',
                position: 'absolute',
                transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
                cursor: isEditingLayout ? 'move' : 'pointer',
                overflow: 'visible',
              }}
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                setSelectedBox(key);
              }}
            >
              {/* Only show icons if selected */}
              {selectedBox === key && isEditingLayout && (
                <div
                  className="absolute flex gap-2 z-50"
                  style={{
                    left: '50%',
                    top: '-32px',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                  }}
                >
                  <button
                    type="button"
                    className="p-1 bg-white rounded-full shadow hover:bg-red-100 border border-gray-200"
                    style={{ zIndex: 100 }}
                    onClick={e => { e.stopPropagation(); handleDeleteBox(key); }}
                    title="Delete box"
                  >
                    <Trash2 size={18} className="text-red-500" />
                  </button>
                  <button
                    type="button"
                    className="p-1 bg-white rounded-full shadow hover:bg-blue-100 border border-gray-200"
                    style={{ zIndex: 100 }}
                    onClick={e => {
                      e.stopPropagation();
                      const box = (e.currentTarget as HTMLElement).parentElement?.parentElement as HTMLElement;
                      if (box) {
                        const rect = box.getBoundingClientRect();
                        handleEditIconClick(key, rect);
                      } else {
                        if (setEditingField) setEditingField(key);
                        setSelectedBox(key);
                        setEditInputPosition({ x: 0, y: 40 });
                      }
                    }}
                    title="Edit value"
                  >
                    <Pencil size={18} className="text-blue-500" />
                  </button>
                </div>
              )}
              {fieldValue && fieldValue.trim().length > 0 && !isEditing && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-900 bg-white bg-opacity-95 rounded-md px-2"
                  style={{
                    fontSize: Math.max(10, Math.min(14, height * 0.6)),
                    padding: '2px 4px',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)',
                    border: '1px solid #e5e7eb',
                    margin: 2,
                  }}
                >
                  <span className="truncate max-w-full">
                    {fieldValue}
                  </span>
                </div>
              )}
            </Rnd>
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
            onClick={e => {
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