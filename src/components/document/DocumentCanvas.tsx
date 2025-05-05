
import React, { useState } from 'react';
import DocumentPlaceholder from './DocumentPlaceholder';

const DocumentCanvas = () => {
  const [hasDocument, setHasDocument] = useState(true); // Set to true for demo purposes
  
  // Example document elements with editable text fields
  const documentElements = [
    { id: 1, type: 'heading', x: 50, y: 50, width: 500, height: 40, text: "Sample Contract Agreement" },
    { id: 2, type: 'text', x: 50, y: 120, width: 500, height: 60, text: "This agreement is made between Party A and Party B on the date of signing." },
    { id: 3, type: 'form-field', x: 50, y: 200, width: 200, height: 30, label: "Full Name:", text: "John Doe" },
    { id: 4, type: 'form-field', x: 300, y: 200, width: 200, height: 30, label: "Date:", text: "May 5, 2025" },
    { id: 5, type: 'paragraph', x: 50, y: 250, width: 500, height: 100, text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam in dui mauris. Vivamus hendrerit arcu sed erat molestie vehicula. Sed auctor neque eu tellus rhoncus ut eleifend nibh porttitor." },
    { id: 6, type: 'signature', x: 50, y: 380, width: 200, height: 60, label: "Signature:", text: "" }
  ];

  const handleTextChange = (id: number, newText: string) => {
    console.log(`Text for element ${id} changed to: ${newText}`);
    // In a real app, you would update the state here
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="font-medium">Document View</h2>
          <p className="text-sm text-gray-500">Preview and interact with your document</p>
        </div>
        
        <div className="flex space-x-2">
          <button className="border border-gray-200 px-3 py-1.5 text-sm rounded-md hover:bg-gray-50 transition-colors flex items-center">
            <span>Analyze Layout</span>
          </button>
          <button className="bg-wally text-white px-3 py-1.5 text-sm rounded-md hover:bg-wally-dark transition-colors flex items-center">
            <span>Translate</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-50 overflow-hidden relative">
        {!hasDocument ? (
          <DocumentPlaceholder />
        ) : (
          <div className="p-8 h-full overflow-auto">
            <div className="bg-white w-full min-h-[1000px] shadow-md relative p-10">
              {/* Example document with editable elements */}
              {documentElements.map(el => (
                <div
                  key={el.id}
                  className="absolute border border-blue-400 bg-white/80 hover:bg-blue-50/80 transition-colors"
                  style={{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    height: `${el.height}px`
                  }}
                >
                  {el.type === 'form-field' && (
                    <div className="p-2">
                      <label className="block text-xs text-gray-500">{el.label}</label>
                      <input 
                        type="text" 
                        className="w-full border-none bg-transparent outline-none focus:ring-1 focus:ring-wally p-1" 
                        defaultValue={el.text}
                        onChange={(e) => handleTextChange(el.id, e.target.value)}
                      />
                    </div>
                  )}
                  
                  {el.type === 'heading' && (
                    <div className="p-2">
                      <input 
                        type="text" 
                        className="w-full border-none bg-transparent outline-none text-2xl font-bold focus:ring-1 focus:ring-wally p-1" 
                        defaultValue={el.text}
                        onChange={(e) => handleTextChange(el.id, e.target.value)}
                      />
                    </div>
                  )}
                  
                  {el.type === 'text' && (
                    <div className="p-2">
                      <textarea 
                        className="w-full h-full border-none bg-transparent outline-none resize-none focus:ring-1 focus:ring-wally p-1" 
                        defaultValue={el.text}
                        onChange={(e) => handleTextChange(el.id, e.target.value)}
                      />
                    </div>
                  )}
                  
                  {el.type === 'paragraph' && (
                    <div className="p-2">
                      <textarea 
                        className="w-full h-full border-none bg-transparent outline-none resize-none focus:ring-1 focus:ring-wally p-1" 
                        defaultValue={el.text}
                        onChange={(e) => handleTextChange(el.id, e.target.value)}
                      />
                    </div>
                  )}
                  
                  {el.type === 'signature' && (
                    <div className="p-2">
                      <label className="block text-xs text-gray-500">{el.label}</label>
                      <input 
                        type="text" 
                        className="w-full border-none bg-transparent outline-none italic focus:ring-1 focus:ring-wally p-1" 
                        placeholder="Sign here..."
                        onChange={(e) => handleTextChange(el.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;
