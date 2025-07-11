from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import json
import os

def convert_coordinates(y_coord, page_height):
    """Convert normalized y-coordinate to PDF coordinate system."""
    return page_height * (1 - y_coord)

def generate_pdf_from_layout(layout_json_path, output_path):
    """Generate a PDF file from Document AI layout."""
    # Load the layout data
    with open(layout_json_path, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)

    # Set up the PDF canvas with letter size
    page_width, page_height = letter  # (612, 792) points
    c = canvas.Canvas(output_path, pagesize=letter)

    # Sort entities by y-coordinate for proper layering
    entities = [e for e in layout_data['entities'] if e['bounding_poly'] is not None]
    entities.sort(key=lambda e: e['bounding_poly']['vertices'][0]['y'])

    # Process each entity
    for entity in entities:
        if not entity['bounding_poly']:
            continue

        # Get the bounding polygon vertices
        vertices = entity['bounding_poly']['vertices']
        
        # Calculate actual coordinates
        x1 = vertices[0]['x'] * page_width
        y1 = convert_coordinates(vertices[0]['y'], page_height)
        x2 = vertices[1]['x'] * page_width
        y2 = convert_coordinates(vertices[1]['y'], page_height)
        x3 = vertices[2]['x'] * page_width
        y3 = convert_coordinates(vertices[2]['y'], page_height)
        x4 = vertices[3]['x'] * page_width
        y4 = convert_coordinates(vertices[3]['y'], page_height)

        # Calculate box dimensions
        box_width = x2 - x1
        box_height = abs(y1 - y4)  # Use absolute value since y is inverted
        box_y = min(y1, y2, y3, y4)

        # Draw text box background
        c.setFillColorRGB(0.95, 0.95, 0.95, 0.5)  # Light gray, semi-transparent
        c.setStrokeColorRGB(0.8, 0.8, 0.8, 0.5)   # Darker gray for border
        
        # Draw rectangle for text box
        c.rect(x1, box_y, box_width, box_height, fill=1, stroke=1)

        # Set font and size based on entity type
        if entity['type'] == 'chat_time':
            font_size = 8
            c.setFillColorRGB(0.5, 0.5, 0.5)  # Gray color for timestamps
        elif entity['type'] == 'chat_label':
            font_size = 8
            c.setFillColorRGB(0.6, 0.6, 0.6)  # Light gray for labels
        elif entity['type'] == 'audience_name':
            font_size = 12
            c.setFillColorRGB(0, 0, 0)  # Black for names
        else:
            font_size = 10
            c.setFillColorRGB(0, 0, 0)  # Default black

        c.setFont('Helvetica', font_size)

        # Calculate padding and text position
        padding = 4  # Padding from box edges
        
        # Handle multi-line text
        lines = entity['text'].split('\n')
        line_height = min(font_size * 1.2, (box_height - 2 * padding) / len(lines))
        total_text_height = line_height * len(lines)
        
        # Calculate vertical position to center text in box
        vertical_space = box_height - total_text_height
        text_y = box_y + vertical_space/2 + total_text_height - padding  # Center text vertically
        
        # Draw text lines
        for i, line in enumerate(lines):
            c.drawString(x1 + padding, text_y - (i * line_height), line)

    # Save the PDF
    c.save()
    print(f"✅ PDF layout exported to {output_path}")

def main():
    # File paths
    layout_json_path = "layout.json"
    output_dir = "layout_output"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate PDF
    output_path = os.path.join(output_dir, "docai_layout.pdf")
    generate_pdf_from_layout(layout_json_path, output_path)

if __name__ == "__main__":
    main() 