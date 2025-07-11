from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import json
import os
import fitz  # PyMuPDF

def convert_coordinates(y_coord, page_height):
    """Convert normalized y-coordinate to PDF coordinate system."""
    return page_height * (1 - y_coord)

def draw_rounded_rect(c, x, y, width, height, radius):
    """Draw a rounded rectangle that doesn't interfere with text positioning."""
    if radius <= 0:
        c.rect(x, y, width, height, fill=1, stroke=0)
        return
    
    # For small radii or boxes, just draw regular rectangle
    if radius > min(width, height) / 2:
        radius = min(width, height) / 2
    
    # Draw main rectangle (center part)
    c.rect(x + radius, y, width - 2*radius, height, fill=1, stroke=0)
    c.rect(x, y + radius, width, height - 2*radius, fill=1, stroke=0)
    
    # Draw corner circles to create rounded effect
    c.circle(x + radius, y + radius, radius, fill=1, stroke=0)
    c.circle(x + width - radius, y + radius, radius, fill=1, stroke=0)
    c.circle(x + radius, y + height - radius, radius, fill=1, stroke=0)
    c.circle(x + width - radius, y + height - radius, radius, fill=1, stroke=0)

def draw_rounded_border(c, x, y, width, height, radius):
    """Draw a rounded border that matches the rounded rectangle."""
    if radius <= 0:
        c.rect(x, y, width, height, fill=0, stroke=1)
        return
    
    # For small radii or boxes, just draw regular rectangle border
    if radius > min(width, height) / 2:
        radius = min(width, height) / 2
    
    # Draw main rectangle borders (center part)
    c.line(x + radius, y, x + width - radius, y)  # Top
    c.line(x + radius, y + height, x + width - radius, y + height)  # Bottom
    c.line(x, y + radius, x, y + height - radius)  # Left
    c.line(x + width, y + radius, x + width, y + height - radius)  # Right
    
    # Draw corner arcs to create rounded effect
    c.arc(x, y + height - 2*radius, x + 2*radius, y + height, 90, 180)  # Bottom-left
    c.arc(x + width - 2*radius, y + height - 2*radius, x + width, y + height, 0, 90)  # Bottom-right
    c.arc(x + width - 2*radius, y, x + width, y + 2*radius, 270, 360)  # Top-right
    c.arc(x, y, x + 2*radius, y + 2*radius, 180, 270)  # Top-left

def detect_image_regions(pdf_path, page_num=None):
    """Detect image regions in the PDF."""
    doc = fitz.open(pdf_path)
    image_regions = []
    
    page_range = range(doc.page_count)
    if page_num is not None and 0 <= page_num < doc.page_count:
        page_range = [page_num]
        
    for p_num in page_range:
        page = doc[p_num]
        image_list = page.get_images()
        
        for img_index, img in enumerate(image_list):
            # Get image rectangle
            img_rect = page.get_image_rects(img[0])
            if img_rect:
                for rect in img_rect:
                    # Convert to normalized coordinates
                    page_rect = page.rect
                    normalized_rect = {
                        "x": rect.x0 / page_rect.width,
                        "y": rect.y0 / page_rect.height,
                        "width": (rect.x1 - rect.x0) / page_rect.width,
                        "height": (rect.y1 - rect.y0) / page_rect.height,
                        "page": p_num
                    }
                    image_regions.append(normalized_rect)
    
    doc.close()
    return image_regions

def draw_image_outline(c, x, y, width, height):
    """Draw an outline around image regions."""
    # Draw a dashed border around image
    c.setStrokeColorRGB(0.7, 0.7, 0.7)  # Light gray
    c.setLineWidth(2)
    c.setDash(5, 3)  # Dashed line pattern
    c.rect(x - 2, y - 2, width + 4, height + 4, fill=0, stroke=1)
    c.setDash()  # Reset to solid line

def capture_final_styling(entity, base_font_size, page_height, page_width):
    """Capture the final styling information for an entity."""
    style_info = entity.get('style', {}).copy()
    
    # Calculate font size based on entity type
    entity_type = entity.get('type', 'unknown')
    if entity_type == 'MessengerTextBox':
        font_size = base_font_size * 1.2
    elif entity_type == 'audience_name':
        font_size = base_font_size * 1.4
    elif entity_type in ['chat_time', 'chat_label', 'chat_reply', 'replied to']:
        font_size = base_font_size * 0.90
    else:
        font_size = base_font_size

    # Get font weight and name
    font_weight = style_info.get('font_weight', 'normal')
    font_name = 'Helvetica-Bold' if font_weight == 'bold' else 'Helvetica'

    # Get alignment
    alignment = style_info.get('alignment', 'left')

    # Calculate actual dimensions and positions
    vertices = entity['bounding_poly']['vertices']
    x1 = vertices[0]['x'] * page_width
    y1 = convert_coordinates(vertices[0]['y'], page_height)
    x2 = vertices[1]['x'] * page_width
    y2 = convert_coordinates(vertices[1]['y'], page_height)
    x3 = vertices[2]['x'] * page_width
    y3 = convert_coordinates(vertices[2]['y'], page_height)
    x4 = vertices[3]['x'] * page_width
    y4 = convert_coordinates(vertices[3]['y'], page_height)

    box_width = x2 - x1
    box_height = abs(y1 - y4)

    # Update style information
    style_info.update({
        'font_size': font_size,
        'font_name': font_name,
        'font_weight': font_weight,
        'alignment': alignment,
        'actual_width': box_width,
        'actual_height': box_height,
        'leading': font_size * 1.2,  # Line height
    })

    # For MessengerTextBox, include additional styling
    if entity_type == 'MessengerTextBox':
        padding = style_info.get('padding', 8)
        style_info.update({
            'border_radius': 6,
            'has_border': True,
            'border_color': [0.7, 0.7, 0.7],
            'padding': padding,
            'expanded_width': box_width + (2 * padding),
            'expanded_height': box_height + (2 * padding)
        })

    return style_info

def generate_styled_pdf(layout_json_path, output_path, original_pdf_path=None, page_num=None, save_enhanced_layout=True):
    """Generate a PDF file from enhanced layout with styling and optionally save enhanced layout with style information."""
    # Load the layout data
    with open(layout_json_path, 'r', encoding='utf-8') as f:
        layout_data = json.load(f)

    # Add page number to layout data
    layout_data['page_number'] = page_num + 1 if page_num is not None else 1

    # Detect image regions if original PDF is provided
    image_regions = []
    if original_pdf_path and os.path.exists(original_pdf_path):
        image_regions = detect_image_regions(original_pdf_path, page_num=page_num)

    # Set up the PDF canvas
    page_width, page_height = letter
    c = canvas.Canvas(output_path, pagesize=letter)
    
    # Get a sample style sheet
    styles = getSampleStyleSheet()

    # Calculate base font size (existing code)
    total_messenger_box_height = 0
    total_messenger_box_lines = 0
    
    messenger_entities = [e for e in layout_data['entities'] if e.get('type') == 'MessengerTextBox' and e.get('bounding_poly')]
    
    for entity in messenger_entities:
        vertices = entity['bounding_poly']['vertices']
        y_coords = [v['y'] for v in vertices]
        box_height_normalized = max(y_coords) - min(y_coords)
        box_height = box_height_normalized * page_height
        
        total_messenger_box_height += box_height
        total_messenger_box_lines += len(entity['text'].split('\n'))

    base_font_size = 16
    if total_messenger_box_lines > 0:
        average_line_height = total_messenger_box_height / total_messenger_box_lines
        base_font_size = average_line_height * 0.8
    
    base_font_size = max(10, min(base_font_size, 16))

    # Draw image outlines
    for img_region in image_regions:
        img_x = img_region['x'] * page_width
        img_y = convert_coordinates(img_region['y'] + img_region['height'], page_height)
        img_width = img_region['width'] * page_width
        img_height = img_region['height'] * page_height
        
        draw_image_outline(c, img_x, img_y, img_width, img_height)

    # Sort entities by y-coordinate
    entities = [e for e in layout_data['entities'] if e['bounding_poly'] is not None]
    entities.sort(key=lambda e: e['bounding_poly']['vertices'][0]['y'])

    # Process each entity and capture final styling
    for entity in entities:
        if not entity['bounding_poly']:
            continue

        # Capture and update style information
        entity['style'] = capture_final_styling(entity, base_font_size, page_height, page_width)

        # Rest of the existing drawing code...
        # [Previous drawing code remains unchanged]
        vertices = entity['bounding_poly']['vertices']
        
        x1 = vertices[0]['x'] * page_width
        y1 = convert_coordinates(vertices[0]['y'], page_height)
        x2 = vertices[1]['x'] * page_width
        y2 = convert_coordinates(vertices[1]['y'], page_height)
        x3 = vertices[2]['x'] * page_width
        y3 = convert_coordinates(vertices[2]['y'], page_height)
        x4 = vertices[3]['x'] * page_width
        y4 = convert_coordinates(vertices[3]['y'], page_height)

        box_width = x2 - x1
        box_height = abs(y1 - y4)
        box_y = min(y1, y2, y3, y4)

        style = entity['style']
        bg_color = style.get('background_color', [0.95, 0.95, 0.95])
        text_color = style.get('text_color', [0, 0, 0])
        border_radius = style.get('border_radius', 0)
        has_border = style.get('has_border', False)
        border_color = style.get('border_color', [0.8, 0.8, 0.8])
        padding = style.get('padding', 8)
        font_weight = style.get('font_weight', 'normal')
        alignment_str = style.get('alignment', 'left')
        font_size = style.get('font_size', base_font_size)

        if entity['type'] != 'MessengerTextBox':
            bg_color = None
            border_radius = 0
            has_border = False
        else:
            has_border = True
            border_color = [0.7, 0.7, 0.7]
            border_radius = 6
            style['border_radius'] = border_radius

        font_name = 'Helvetica-Bold' if font_weight == 'bold' else 'Helvetica'

        if alignment_str == 'center':
            alignment = TA_CENTER
        elif alignment_str == 'right':
            alignment = TA_RIGHT
        else:
            alignment = TA_LEFT

        p_style = ParagraphStyle(
            name='CustomStyle',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=font_size,
            leading=font_size * 1.2,
            textColor=f'rgb({text_color[0]},{text_color[1]},{text_color[2]})',
            alignment=alignment,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=0,
            spaceAfter=0,
        )

        p_text = entity['text'].replace('\n', '<br/>')
        p = Paragraph(p_text, p_style)
        text_render_width = box_width
        w_text, h_text = p.wrapOn(c, text_render_width, 10000)

        if entity['type'] == 'MessengerTextBox':
            expanded_padding = padding
            expanded_width = box_width + (2 * expanded_padding)
            expanded_height = h_text + (2 * expanded_padding)
            
            expanded_x = x1 - expanded_padding
            expanded_y = box_y + (box_height - expanded_height) / 2
            
            if bg_color:
                c.setFillColorRGB(*bg_color)
                if border_radius > 0:
                    c.roundRect(expanded_x, expanded_y, expanded_width, expanded_height, border_radius, fill=1, stroke=0)
                else:
                    c.rect(expanded_x, expanded_y, expanded_width, expanded_height, fill=1, stroke=0)
            
            if has_border:
                c.setStrokeColorRGB(*border_color)
                c.setLineWidth(1)
                if border_radius > 0:
                    c.roundRect(expanded_x, expanded_y, expanded_width, expanded_height, border_radius, fill=0, stroke=1)
                else:
                    c.rect(expanded_x, expanded_y, expanded_width, expanded_height, fill=0, stroke=1)

            text_draw_x = x1
            text_draw_y = expanded_y + expanded_padding
            
            p.drawOn(c, text_draw_x, text_draw_y)
        else:
            text_draw_x = x1
            text_draw_y = box_y + (box_height - h_text) / 2
            p.drawOn(c, text_draw_x, text_draw_y)

    # Save the PDF
    c.save()
    print(f"✅ Styled PDF exported to {output_path}")

    # Save enhanced layout with style information if requested
    if save_enhanced_layout:
        # Use the same base filename as the PDF but with .json extension
        enhanced_output_path = os.path.splitext(output_path)[0] + '.json'
        with open(enhanced_output_path, 'w', encoding='utf-8') as f:
            json.dump(layout_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Enhanced layout with style information saved to {enhanced_output_path}")

    return layout_data

def main():
    # File paths
    layout_json_path = "enhanced_layout.json"
    original_pdf_path = "temp/test2.pdf"
    output_dir = "layout_output"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate PDF and get enhanced layout
    base_filename = "document_minimal_layout"  # Base name for both files
    output_path = os.path.join(output_dir, f"{base_filename}.pdf")
    enhanced_layout = generate_styled_pdf(layout_json_path, output_path, original_pdf_path, save_enhanced_layout=False)  # Don't save individual JSON
    
    # Save the enhanced layout
    json_output_path = os.path.join(output_dir, f"{base_filename}.json")
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(enhanced_layout, f, indent=2, ensure_ascii=False)
    print(f"✅ Enhanced layout saved to {json_output_path}")

if __name__ == "__main__":
    main() 