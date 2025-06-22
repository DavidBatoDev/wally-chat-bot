import React, { useRef, useEffect, useState } from 'react';
import { Check, X, Languages, Loader2 } from 'lucide-react'; // Added Loader2
import { Button } from '@/components/ui/button';
import api from '@/lib/api'; // Added API import
import { getLanguageCode } from '@/lib/languageUtils'; // Fixed import path

interface EditableInputProps {
  value: string;
  field: any;
  fieldKey: string;
  conversationId: string;
  workflowData: any;
  isTranslatedView: boolean;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  placeholder?: string;
  position: { x: number; y: number };
}

const EditableInput: React.FC<EditableInputProps> = ({ 
  value, 
  field,
  fieldKey,
  conversationId,
  workflowData,
  isTranslatedView,
  onSave, 
  onCancel, 
  placeholder, 
  position 
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [translating, setTranslating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Always sync inputValue with value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleTranslate = async () => {
    if (!field?.value || !workflowData) return;
    
    setTranslating(true);
    
    try {
      const targetLanguage = getLanguageCode(workflowData.translate_to);
      const sourceLanguage = workflowData.translate_from 
        ? getLanguageCode(workflowData.translate_from)
        : undefined;

      const response = await api.post(
        `/api/workflow/${conversationId}/translate-field`,
        {
          field_key: fieldKey,
          target_language: targetLanguage,
          source_language: sourceLanguage,
          use_gemini: true
        }
      );

      if (response.data.success) {
        setInputValue(response.data.translated_value);
      } else {
        throw new Error(response.data.message || "Translation failed");
      }
    } catch (err: any) {
      console.error("Field translation error:", err);
      const errorMessage = err.response?.data?.detail || 
                           err.response?.data?.message || 
                           err.message || 
                           "Translation failed";
      
      // Show error in console for now
      console.error(errorMessage);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-300 p-2"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '250px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2 mb-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleSave}
          className="h-7 w-7 p-0 bg-green-500 hover:bg-green-600 text-white"
        >
          <Check size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-7 w-7 p-0"
        >
          <X size={14} />
        </Button>
      </div>
      
      {isTranslatedView && field?.value && (
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-500 truncate mr-2">
            Original: {field.value}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTranslate}
            disabled={translating}
            className="h-7 text-xs"
          >
            {translating ? (
              <span className="flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Translating...
              </span>
            ) : (
              <span className="flex items-center">
                <Languages size={12} className="mr-1" />
                Auto-translate
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EditableInput;