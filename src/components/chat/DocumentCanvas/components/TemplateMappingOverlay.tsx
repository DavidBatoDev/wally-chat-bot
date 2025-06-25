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

  // PATCH mappings/fields when adding a box
  const patchAddMapping = async (newMappings: any, newFields: any) => {
    try {
      await api.patch(`/api/workflow/${conversationId}/template-mappings`, {
        origin_template_mappings: newMappings,
        fields: newFields,
      });
    } catch (err) {
      console.error('Failed to add mapping', err);
    }
  };

  const handleFieldSave = (fieldKey: string, newValue: string) => {
    onFieldUpdate(fieldKey, newValue);
    if (setEditingField) setEditingField(null);
    setEditInputPosition(null);
    // Always persist value to backend
    patchFieldValue(fieldKey, newValue);
  };

  const handleEditCancel = () => {
    if (setEditingField) setEditingField(null);
    setEditInputPosition(null);
  };

  const handleAddTextBox = () => setShowAddBox(true);

  // 1. Helper to generate a unique field key
  function generateFieldKey(base: string, mappings: Record<string, TemplateMapping>) {
    let key = base.replace(/\s+/g, '_').toLowerCase();
    let i = 1;
    while (mappings[key]) {
      key = `${base.replace(/\s+/g, '_').toLowerCase()}_${i++}`;
    }
    return key;
  }

  const handleAddBoxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateLayout) return;
    let key = newBoxKey.trim();
    if (!key) key = generateFieldKey('field', mappings);
    if (mappings[key]) return;
    const newMapping = {
      label: key,
      font: { name: 'Arial', size: 12, color: '#222222' },
      position: { x0: 100, y0: 100, x1: 220, y1: 130 },
      bbox_center: { x: 160, y: 115 },
      alignment: 'left',
      page_number: pageNum
    };
    const newMappings = { ...mappings, [key]: newMapping };
    onUpdateLayout(newMappings);
    if (onFieldUpdate) {
      onFieldUpdate(key, "");
    }
    // Persist add to backend
    patchAddMapping(newMappings, fields);
    setShowAddBox(false);
    setNewBoxKey('');
  };

  const handleDeleteBox = (key: string) => {
    if (!onUpdateLayout) return;
    const newMappings = { ...mappings };
    delete newMappings[key];
    onUpdateLayout(newMappings);
    // Optionally, also remove the field value from backend
    patchDeleteMapping(newMappings, fields);
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

  const handleBoxDragStop = (key: string, d: any) => {
    const mapping = mappings[key];
    if (!mapping) return;
    const newX0 = d.x / scale;
    const newY0 = d.y / scale;
    const width = mapping.position.x1 - mapping.position.x0;
    const height = mapping.position.y1 - mapping.position.y0;
    const newMapping = {
      ...mapping,
      position: {
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
    if (onUpdateLayout) onUpdateLayout({ ...mappings, [key]: newMapping });
  };

  const handleBoxResizeStop = (key: string, dir: any, ref: any, delta: any, pos: any) => {
    const mapping = mappings[key];
    if (!mapping) return;
    const newX0 = pos.x / scale;
    const newY0 = pos.y / scale;
    const newWidth = ref.offsetWidth / scale;
    const newHeight = ref.offsetHeight / scale;
    const newMapping = {
      ...mapping,
      position: {
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
    if (onUpdateLayout) onUpdateLayout({ ...mappings, [key]: newMapping });
  };

  return (
    <>
      {isEditingLayout && !showAddBox && (
        <Button onClick={handleAddTextBox} className="absolute top-2 right-2 z-50 rounded shadow bg-white border border-gray-200 hover:bg-gray-100" size="sm" variant="outline">+ Add Text Box</Button>
      )}
      {isEditingLayout && showAddBox && (
        <form onSubmit={handleAddBoxSubmit} className="absolute top-2 right-2 z-50 bg-white p-2 rounded shadow flex items-center space-x-2 border border-gray-200">
          <input
            type="text"
            value={newBoxKey}
            onChange={e => setNewBoxKey(e.target.value)}
            placeholder="Field label (optional)"
            className="border px-2 py-1 rounded text-xs"
            autoFocus
          />
          <Button type="submit" size="sm" variant="default">Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddBox(false); setNewBoxKey(''); }}>Cancel</Button>
        </form>
      )}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        {currentPageMappings.map(([key, mapping]) => {
          const x = mapping.position.x0 * scale;
          const y = mapping.position.y0 * scale;
          const width = (mapping.position.x1 - mapping.position.x0) * scale;
          const height = (mapping.position.y1 - mapping.position.y0) * scale;
          const fontSize = (mapping.font && mapping.font.size) || 14;
          const isSelected = selectedBox === key;
          const isEditing = editingField === key;
          const field = fields[key];
          const fieldValue = isTranslatedView ? (field?.translated_value || '') : (field?.value || '');
          return (
            <Rnd
              key={key}
              size={{ width: Math.max(width, 40), height: Math.max(height, 28) }}
              position={{ x, y }}
              enableResizing={isEditingLayout}
              disableDragging={!isEditingLayout}
              bounds="parent"
              onDragStart={() => { setIsInteracting(true); setSelectedBox(key); }}
              onDragStop={(e: any, d: DraggableData) => handleBoxDragStop(key, d)}
              onResizeStart={() => { setIsInteracting(true); setSelectedBox(key); }}
              onResizeStop={(e: any, direction: string, ref: HTMLElement, delta: { width: number; height: number }, position: { x: number; y: number }) => handleBoxResizeStop(key, direction, ref, delta, position)}
              style={{
                border: isSelected ? '2px solid #6366f1' : '1.5px solid #d1d5db',
                background: 'rgba(99,102,241,0.03)',
                borderRadius: '6px',
                boxShadow: isSelected ? '0 2px 8px 0 rgba(99,102,241,0.10)' : 'none',
                zIndex: isSelected ? 30 : 10,
                userSelect: 'none',
                position: 'absolute',
                transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                pointerEvents: 'auto',
                cursor: isEditingLayout ? 'move' : 'pointer',
                overflow: 'visible',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                minHeight: 20,
                minWidth: 40,
                fontSize: (fontSize * scale) + 'px',
              }}
              onClick={() => setSelectedBox(key)}
            >
              {/* Show value or label, editable inline */}
              {isEditing ? (
                <EditableInput
                  value={fieldValue}
                  field={field}
                  fieldKey={key}
                  conversationId={conversationId || ""}
                  workflowData={workflowData}
                  isTranslatedView={isTranslatedView}
                  onSave={val => handleFieldSave(key, val)}
                  onCancel={handleEditCancel}
                  autoFocus
                  position={{ x: 0, y: 0 }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs px-1 py-0 rounded cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: '#222',
                    textShadow: '0 1px 2px rgba(255,255,255,0.7)',
                    fontSize: (fontSize * scale) + 'px',
                    fontWeight: 500,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    minHeight: 18,
                    minWidth: 30,
                  }}
                  onDoubleClick={() => { if (setEditingField) setEditingField(key); }}
                  title="Double-click to edit"
                >
                  {fieldValue || <span style={{ color: '#bbb' }}>Click to enter text</span>}
                </div>
              )}
              {/* Controls: show only if selected and in edit mode */}
              {selectedBox === key && isEditingLayout && (
                <div
                  className="absolute flex gap-1 z-50"
                  style={{
                    pointerEvents: 'auto',
                    background: 'rgba(255,255,255,0.92)',
                    borderRadius: 6,
                    padding: '1px 2px',
                    top: '-32px',
                    right: 0,
                    boxShadow: '0 2px 8px 0 rgba(99,102,241,0.10)',
                    border: '1px solid #e0e7ef',
                  }}
                >
                  <button
                    type="button"
                    className="p-0.5 bg-white rounded-full shadow hover:bg-red-100 border border-gray-200"
                    style={{ zIndex: 100, width: 20, height: 20 }}
                    onClick={e => { e.stopPropagation(); handleDeleteBox(key); }}
                    title="Delete box"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                  <button
                    type="button"
                    className="p-0.5 bg-white rounded-full shadow hover:bg-blue-100 border border-gray-200"
                    style={{ zIndex: 100, width: 20, height: 20 }}
                    onClick={e => { e.stopPropagation(); if (setEditingField) setEditingField(key); }}
                    title="Edit value"
                  >
                    <Pencil size={14} className="text-blue-500" />
                  </button>
                  {/* Font size dropdown */}
                  <select
                    value={fontSize}
                    onChange={e => {
                      const newFontSize = parseInt(e.target.value, 10);
                      const updated = {
                        ...mapping,
                        font: {
                          ...mapping.font,
                          size: newFontSize,
                        },
                      };
                      const newMappings = { ...mappings, [key]: updated };
                      if (onUpdateLayout) onUpdateLayout(newMappings);
                    }}
                    style={{ fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db', marginRight: 4, height: 22 }}
                  >
                    {[10,12,14,16,18,20,22,24,26,28].map(size => (
                      <option key={size} value={size}>{size}px</option>
                    ))}
                  </select>
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