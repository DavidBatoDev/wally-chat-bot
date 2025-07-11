import json
import base64
import google.generativeai as genai
import os
from dotenv import load_dotenv
import fitz  # PyMuPDF

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def pdf_to_base64_images(pdf_path):
    """Convert PDF pages to base64 encoded images."""
    doc = fitz.open(pdf_path)
    images = []
    
    for page_num in range(doc.page_count):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for better quality
        img_data = pix.tobytes("png")
        img_base64 = base64.b64encode(img_data).decode()
        images.append(img_base64)
    
    doc.close()
    return images

def analyze_layout_with_llm(layout_json_path, original_file_path=None):
    """Analyze layout with LLM to add styling information."""
    
    # Load the layout data
    with open(layout_json_path, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)
    
    # Create a detailed prompt for color and styling analysis
    prompt = f"""
You are an expert document designer and layout analyst. Analyze the following document layout and enhance it with sophisticated styling that preserves the visual hierarchy and color scheme of the original document.

ORIGINAL DOCUMENT: {original_file_path if original_file_path else "Not provided"}

DOCUMENT LAYOUT DATA:
{json.dumps(layout_data, indent=2)}

TASK: Enhance each text entity with sophisticated styling that:
1. **Preserves Visual Hierarchy**: Use font weights, sizes, and colors to maintain the document's structure
2. **Color Analysis**: Based on the entity type and position, determine appropriate:
   - Background colors (RGB values 0-1, e.g., [0.95, 0.95, 0.95] for light gray)
   - Text colors (RGB values 0-1, e.g., [0.2, 0.2, 0.2] for dark gray)
   - Border colors if needed
3. **Typography**: Choose appropriate font weights and alignments
4. **Spacing**: Add appropriate padding and border radius for modern design
5. **Visual Consistency**: Ensure colors work together harmoniously

STYLING GUIDELINES:
- **ONLY MessengerTextBox entities should have background boxes**
- All other entities (chat_time, chat_label, audience_name, etc.) should have NO background (transparent)
- Use subtle, professional color schemes
- Text colors should be dark (0.2 or lower RGB values) for contrast
- Headers/titles: Bold font, darker text, no background
- Body text: Normal font, standard size, dark text, no background
- Labels/tags: Smaller font, medium text color, no background
- Chat elements: Only MessengerTextBox gets background with rounded corners
- Use rounded corners (border_radius: 8-12) only for MessengerTextBox
- Add padding (8-12px) only for MessengerTextBox to accommodate larger fonts

COLOR SUGGESTIONS BY ENTITY TYPE:
- MessengerTextBox: bg=[0.97, 0.97, 0.97], text=[0.2, 0.2, 0.2], rounded corners, 2px border
- Audience Names: NO background, text=[0.25, 0.25, 0.25], BOLD, larger font
- Headers/Titles: NO background, text=[0.1, 0.1, 0.1], bold
- Body Text: NO background, text=[0.2, 0.2, 0.2], normal
- Labels: NO background, text=[0.4, 0.4, 0.4], normal
- Chat Elements: NO background, text=[0.25, 0.25, 0.25], normal
- Timestamps: NO background, text=[0.4, 0.4, 0.4], smaller font

For each entity, add a "style" object with these properties:
- background_color: [r, g, b] (0-1 values)
- text_color: [r, g, b] (0-1 values)
- border_color: [r, g, b] (0-1 values, optional)
- has_border: boolean
- border_radius: number (8-12 recommended)
- padding: number (6-12 recommended)
- font_weight: "normal" or "bold"
- alignment: "left", "center", or "right"

Return the enhanced JSON with styling information added to each entity.
"""

    try:
        # Generate response from LLM
        response = genai.GenerativeModel('gemini-1.5-flash').generate_content(prompt)
        
        # Parse the response
        enhanced_layout = json.loads(response.text)
        
        # Save the enhanced layout
        output_path = "enhanced_layout.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(enhanced_layout, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Layout enhanced with LLM styling and saved to {output_path}")
        return enhanced_layout
        
    except Exception as e:
        print(f"❌ Error enhancing layout with LLM: {e}")
        print("Using fallback styling...")
        
        # Fallback styling if LLM fails
        return apply_fallback_styling(layout_data)

def apply_fallback_styling(layout_data):
    """Apply fallback styling if LLM analysis fails."""
    
    for entity in layout_data['entities']:
        entity_type = entity.get('type', 'unknown')
        
        # Default styling - no background for most entities
        style = {
            'background_color': None,  # No background by default
            'text_color': [0.2, 0.2, 0.2],
            'border_color': [0.9, 0.9, 0.9],
            'has_border': False,
            'border_radius': 0,
            'padding': 8,  # Keep compact padding
            'font_weight': 'normal',
            'alignment': 'left'
        }
        
        # Only MessengerTextBox entities get background styling
        if entity_type == 'MessengerTextBox':
            style.update({
                'background_color': [0.97, 0.97, 0.97],
                'text_color': [0.2, 0.2, 0.2],
                'border_radius': 6,  # Keep slightly rounded corners
                'padding': 8,  # Keep compact padding
                'font_weight': 'normal',
                'alignment': 'left',
                'has_border': True,
                'border_color': [0.7, 0.7, 0.7]
            })
        elif entity_type in ['audience_name', 'speaker']:
            style.update({
                'text_color': [0.25, 0.25, 0.25],
                'font_weight': 'bold'
            })
        elif entity_type in ['header', 'title', 'heading']:
            style.update({
                'text_color': [0.1, 0.1, 0.1],
                'font_weight': 'bold'
            })
        elif entity_type in ['chat_label', 'chat_time']:
            style.update({
                'text_color': [0.4, 0.4, 0.4],
                'font_weight': 'normal'
            })
        
        entity['style'] = style
    
    # Save fallback styling
    output_path = "enhanced_layout.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(layout_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Fallback styling applied and saved to {output_path}")
    return layout_data

if __name__ == "__main__":
    # Test the layout analyzer
    layout_json_path = "layout.json"
    if os.path.exists(layout_json_path):
        analyze_layout_with_llm(layout_json_path)
    else:
        print(f"❌ Layout file {layout_json_path} not found") 