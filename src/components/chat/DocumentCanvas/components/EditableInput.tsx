import React, { useRef, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableInputProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  placeholder?: string;
  position: { x: number; y: number };
}

const EditableInput: React.FC<EditableInputProps> = ({ 
  value, 
  onSave, 
  onCancel, 
  placeholder, 
  position 
}) => {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-300 p-2"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '200px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2">
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
    </div>
  );
};

export default EditableInput;