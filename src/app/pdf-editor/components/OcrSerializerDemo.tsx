import React, { useState } from 'react';
import { serializeOcrResponse, getTextBoxesForPage, getAllTextBoxes } from '../utils/ocrResponseSerializer';
import { TextField } from '../types/pdf-editor.types';

// Sample OCR response data (from the user's example)
const sampleOcrResponse = {
  "success": true,
  "data": {
    "projectId": "c9f7b6ce-396f-4cf9-b37b-a3eaf67c6d56",
    "totalPages": 1,
    "totalViews": 1,
    "processedPages": 1,
    "results": [
      {
        "pageNumber": 1,
        "viewType": "original",
        "ocrResult": {
          "styled_layout": {
            "document_info": {
              "total_pages": 1,
              "mime_type": "application/pdf",
              "page_width": 288,
              "page_height": 432
            },
            "pages": [
              {
                "page_number": 1,
                "text": "Sample text content",
                "entities": [
                  {
                    "type": "MessengerTextBox",
                    "text": "iyo hahanapan",
                    "confidence": 0.9853746294975281,
                    "id": "8",
                    "bounding_poly": {
                      "vertices": [
                        { "x": 0.22184300422668457, "y": 0.26505494117736816 },
                        { "x": 0.4266211688518524, "y": 0.26505494117736816 },
                        { "x": 0.4266211688518524, "y": 0.2887912094593048 },
                        { "x": 0.22184300422668457, "y": 0.2887912094593048 }
                      ]
                    },
                    "styling": {
                      "font_size": 5.4,
                      "font_family": "Helvetica",
                      "colors": {
                        "fill_color": { "r": 0, "g": 0, "b": 0 },
                        "stroke_color": { "r": 0, "g": 0, "b": 0 },
                        "background_color": { "r": 0.95, "g": 0.95, "b": 0.95, "a": 0.5 },
                        "border_color": { "r": 0.7, "g": 0.7, "b": 0.7 }
                      },
                      "text_alignment": "left",
                      "line_spacing": 1.2,
                      "line_height": 3.7740678977966304,
                      "text_padding": 3.24,
                      "text_lines": ["iyo hahanapan"],
                      "line_count": 1,
                      "background": {
                        "border_radius": 2.7,
                        "expanded_x": 60.650785217285154,
                        "expanded_y": 111.26373458862305,
                        "expanded_width": 65.45611141204834,
                        "expanded_height": 16.73406789779663
                      }
                    },
                    "dimensions": {
                      "box_width": 58.97611141204834,
                      "box_height": 10.25406789779663,
                      "box_x": 63.890785217285156,
                      "box_y": 114.50373458862305,
                      "text_y": 118.27780248641967,
                      "coordinates": {
                        "x1": 63.890785217285156,
                        "y1": 114.50373458862305,
                        "x2": 122.8668966293335,
                        "y2": 114.50373458862305,
                        "x3": 122.8668966293335,
                        "y3": 124.75780248641968,
                        "x4": 63.890785217285156,
                        "y4": 124.75780248641968
                      }
                    }
                  },
                  {
                    "type": "chat_time",
                    "text": "12 JAN 2023 AT 13:09",
                    "confidence": 0.999929666519165,
                    "id": "2",
                    "bounding_poly": {
                      "vertices": [
                        { "x": 0.3731513023376465, "y": 0.33714285492897034 },
                        { "x": 0.6331058144569397, "y": 0.33714285492897034 },
                        { "x": 0.6331058144569397, "y": 0.35164836049079895 },
                        { "x": 0.3731513023376465, "y": 0.35164836049079895 }
                      ]
                    },
                    "styling": {
                      "font_size": 5.4,
                      "font_family": "Helvetica",
                      "colors": {
                        "fill_color": { "r": 0.5, "g": 0.5, "b": 0.5 },
                        "stroke_color": { "r": 0, "g": 0, "b": 0 },
                        "background_color": null,
                        "border_color": null
                      },
                      "text_alignment": "center",
                      "line_spacing": 1.2,
                      "line_height": 0.8663784027099606,
                      "text_padding": 2.7,
                      "text_lines": ["12 JAN 2023 AT 13:09"],
                      "line_count": 1
                    },
                    "dimensions": {
                      "box_width": 74.86689949035645,
                      "box_height": 6.266378402709961,
                      "box_x": 107.46757507324219,
                      "box_y": 145.64571332931519,
                      "text_y": 146.51209173202514,
                      "coordinates": {
                        "x1": 107.46757507324219,
                        "y1": 145.64571332931519,
                        "x2": 182.33447456359863,
                        "y2": 145.64571332931519,
                        "x3": 182.33447456359863,
                        "y3": 151.91209173202515,
                        "x4": 107.46757507324219,
                        "y4": 151.91209173202515
                      }
                    }
                  }
                ]
              }
            ]
          }
        },
        "captureInfo": {
          "width": 288,
          "height": 432,
          "imageSize": 36978
        }
      }
    ],
    "errors": [],
    "startTime": "2025-08-21T13:39:14.182Z",
    "endTime": "2025-08-21T13:39:41.331Z",
    "duration": 27149,
    "successRate": 100
  }
};

export const OcrSerializerDemo: React.FC = () => {
  const [serializedData, setSerializedData] = useState<any>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [selectedView, setSelectedView] = useState<string>("original");

  const handleSerializeOcr = () => {
    try {
      console.log("🧪 Testing OCR Response Serializer...");
      
      // Serialize the OCR response
      const { textBoxesByPage, pageDimensions, totalTextBoxes } = serializeOcrResponse(sampleOcrResponse);
      
      console.log(`✅ Successfully serialized ${totalTextBoxes} textboxes`);
      console.log(`📄 Pages processed: ${pageDimensions.size}`);
      
      setSerializedData({
        textBoxesByPage,
        pageDimensions,
        totalTextBoxes
      });
      
    } catch (error) {
      console.error("❌ Error testing OCR serializer:", error);
    }
  };

  const getPageTextBoxes = () => {
    if (!serializedData) return [];
    
    const pageTextBoxes = getTextBoxesForPage(
      serializedData.textBoxesByPage, 
      selectedPage, 
      selectedView
    );
    
    return pageTextBoxes;
  };

  const getAllTextBoxesData = () => {
    if (!serializedData) return [];
    return getAllTextBoxes(serializedData.textBoxesByPage);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OCR Response Serializer Demo</h1>
      
      <div className="mb-6">
        <button
          onClick={handleSerializeOcr}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Test OCR Serializer
        </button>
      </div>

      {serializedData && (
        <div className="space-y-6">
          <div className="bg-green-100 p-4 rounded">
            <h2 className="text-lg font-semibold text-green-800">✅ Serialization Results</h2>
            <p className="text-green-700">
              Successfully serialized {serializedData.totalTextBoxes} textboxes across {serializedData.pageDimensions.size} pages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-100 p-4 rounded">
              <h3 className="text-lg font-semibold mb-3">Page Selection</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium">Page:</label>
                  <select
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {Array.from(serializedData.pageDimensions.keys()).map(pageNum => (
                      <option key={pageNum} value={pageNum}>Page {pageNum}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">View:</label>
                  <select
                    value={selectedView}
                    onChange={(e) => setSelectedView(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="original">Original</option>
                    <option value="translated">Translated</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 p-4 rounded">
              <h3 className="text-lg font-semibold mb-3">Statistics</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Total TextBoxes:</strong> {serializedData.totalTextBoxes}</p>
                <p><strong>Pages:</strong> {serializedData.pageDimensions.size}</p>
                <p><strong>Current Page TextBoxes:</strong> {getPageTextBoxes().length}</p>
                <p><strong>Page Dimensions:</strong> {serializedData.pageDimensions.get(selectedPage)?.width || 0} × {serializedData.pageDimensions.get(selectedPage)?.height || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                TextBoxes for Page {selectedPage} ({selectedView})
              </h3>
            </div>
            <div className="p-4">
              {getPageTextBoxes().length > 0 ? (
                <div className="space-y-3">
                  {getPageTextBoxes().map((textBox: TextField, index: number) => (
                    <div key={textBox.id} className="border border-gray-200 rounded p-3 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <strong>Text:</strong> "{textBox.value}"
                        </div>
                        <div>
                          <strong>Type:</strong> {textBox.type}
                        </div>
                        <div>
                          <strong>Position:</strong> ({textBox.x.toFixed(1)}, {textBox.y.toFixed(1)})
                        </div>
                        <div>
                          <strong>Size:</strong> {textBox.width.toFixed(1)} × {textBox.height.toFixed(1)}
                        </div>
                        <div>
                          <strong>Font:</strong> {textBox.fontSize}px {textBox.fontFamily}
                        </div>
                        <div>
                          <strong>Color:</strong> <span className="inline-block w-4 h-4 rounded border" style={{backgroundColor: textBox.color}}></span> {textBox.color}
                        </div>
                        <div>
                          <strong>Background:</strong> <span className="inline-block w-4 h-4 rounded border" style={{backgroundColor: textBox.backgroundColor}}></span> {textBox.backgroundColor}
                        </div>
                        <div>
                          <strong>Alignment:</strong> {textBox.textAlign}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No textboxes found for this page and view.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold">All TextBoxes Summary</h3>
            </div>
            <div className="p-4">
              <div className="text-sm space-y-1">
                {getAllTextBoxesData().map((textBox: TextField, index: number) => (
                  <div key={textBox.id} className="flex items-center space-x-4 py-1">
                    <span className="w-8 text-gray-500">{index + 1}.</span>
                    <span className="w-32 truncate">"{textBox.value}"</span>
                    <span className="w-20 text-xs">{textBox.type}</span>
                    <span className="w-24 text-xs">Page {textBox.page}</span>
                    <span className="w-16 text-xs">({textBox.x.toFixed(0)}, {textBox.y.toFixed(0)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 p-4 rounded">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Use in Your Code</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>1. Import the serializer:</strong></p>
          <code className="block bg-blue-100 p-2 rounded font-mono">
            import { serializeOcrResponse, getTextBoxesForPage } from "./utils/ocrResponseSerializer";
          </code>
          
          <p><strong>2. Serialize OCR response:</strong></p>
          <code className="block bg-blue-100 p-2 rounded font-mono">
            const { textBoxesByPage, pageDimensions, totalTextBoxes } = serializeOcrResponse(ocrResponse);
          </code>
          
          <p><strong>3. Get textboxes for specific page:</strong></p>
          <code className="block bg-blue-100 p-2 rounded font-mono">
            const pageTextBoxes = getTextBoxesForPage(textBoxesByPage, 1, "original");
          </code>
          
          <p><strong>4. Create textboxes in frontend:</strong></p>
          <code className="block bg-blue-100 p-2 rounded font-mono">
            pageTextBoxes.forEach(textBox => {<br/>
            &nbsp;&nbsp;handleAddTextBoxWithUndo(textBox.x, textBox.y, textBox.page, "original", "original", textBox);<br/>
            });
          </code>
        </div>
      </div>
    </div>
  );
};

