import os
import json
import fitz  # PyMuPDF
from pathlib import Path
from google.cloud import documentai
from dotenv import load_dotenv
from models.page import OCREntity, BoundingPoly, Style
from core.config import settings
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.utils import ImageReader
from io import BytesIO
from typing import List, Dict, Any, Optional
from PIL import Image

load_dotenv()

def convert_coordinates(y_coord: float, page_height: float) -> float:
    """Convert normalized y-coordinate to PDF coordinate system."""
    return page_height * (1 - y_coord)

def draw_rounded_rect(c, x, y, width, height, radius):
    """Draw a rounded rectangle that doesn't interfere with text positioning."""
    if radius <= 0:
        c.rect(x, y, width, height, fill=1, stroke=0)
        return
    
    if radius > min(width, height) / 2:
        radius = min(width, height) / 2
    
    c.rect(x + radius, y, width - 2*radius, height, fill=1, stroke=0)
    c.rect(x, y + radius, width, height - 2*radius, fill=1, stroke=0)
    
    c.circle(x + radius, y + radius, radius, fill=1, stroke=0)
    c.circle(x + width - radius, y + radius, radius, fill=1, stroke=0)
    c.circle(x + radius, y + height - radius, radius, fill=1, stroke=0)
    c.circle(x + width - radius, y + height - radius, radius, fill=1, stroke=0)

def apply_styling(entity_type: str, box_width: float, box_height: float, base_font_size: float = 12.0) -> Style:
    """Apply styling based on entity type and calculate detailed measurements."""
    # Base style dictionary with detailed measurements
    style_dict = {
        'background_color': None,
        'text_color': [0.2, 0.2, 0.2],
        'border_color': [0.9, 0.9, 0.9],
        'has_border': False,
        'border_radius': 0,
        'padding': 8,
        'font_weight': 'normal',
        'alignment': 'left',
        'font_size': base_font_size,
        'font_name': 'Helvetica',
        'actual_width': box_width,
        'actual_height': box_height,
        'leading': base_font_size * 1.2,  # Line height
    }

    # Entity-specific styling
    if entity_type == 'MessengerTextBox':
        style_dict.update({
            'background_color': [0.97, 0.97, 0.97],
            'border_radius': 6,
            'has_border': True,
            'border_color': [0.7, 0.7, 0.7],
            'font_size': base_font_size * 1.2,
            'expanded_width': box_width + (2 * style_dict['padding']),
            'expanded_height': box_height + (2 * style_dict['padding'])
        })
        style_dict['leading'] = style_dict['font_size'] * 1.2
    elif entity_type in ['audience_name', 'speaker']:
        style_dict.update({
            'text_color': [0.25, 0.25, 0.25],
            'font_weight': 'bold',
            'font_size': base_font_size * 1.4,
            'leading': base_font_size * 1.4 * 1.2
        })
    elif entity_type in ['header', 'title', 'heading']:
        style_dict.update({
            'text_color': [0.1, 0.1, 0.1],
            'font_weight': 'bold',
            'font_size': base_font_size * 1.8,
            'leading': base_font_size * 1.8 * 1.2
        })
    elif entity_type in ['chat_label', 'chat_time']:
        style_dict.update({
            'text_color': [0.4, 0.4, 0.4],
            'font_size': base_font_size * 0.9,
            'leading': base_font_size * 0.9 * 1.2
        })
    
    return Style(**style_dict)

def calculate_base_font_size(entities: List[Dict[str, Any]], page_height: float) -> float:
    """Calculate base font size from messenger text boxes."""
    total_messenger_box_height = 0
    total_messenger_box_lines = 0
    
    for entity in entities:
        if entity.get('type') == 'MessengerTextBox' and entity.get('bounding_poly'):
            vertices = entity['bounding_poly']['vertices']
            y_coords = [v['y'] for v in vertices]
            box_height_normalized = max(y_coords) - min(y_coords)
            box_height = box_height_normalized * page_height
            
            total_messenger_box_height += box_height
            total_messenger_box_lines += len(entity['text'].split('\n'))

    if total_messenger_box_lines > 0:
        average_line_height = total_messenger_box_height / total_messenger_box_lines
        base_font_size = average_line_height * 0.8
        return max(10, min(base_font_size, 16))
    
    return 12.0  # Default font size

def process_document_for_layout(file_content: bytes, mime_type: str) -> Dict[str, Any]:
    """Process document using Google Document AI and extract layout with styling."""
    project_id = settings.GOOGLE_PROJECT_ID
    location = settings.GOOGLE_DOCUMENT_AI_LOCATION
    processor_id = settings.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
    
    if not all([project_id, processor_id]):
        raise ValueError("Google Cloud project ID and processor ID must be set in environment variables.")

    client = documentai.DocumentProcessorServiceClient()
    processor_name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
    raw_document = documentai.RawDocument(content=file_content, mime_type=mime_type)
    request = documentai.ProcessRequest(name=processor_name, raw_document=raw_document)
    
    try:
        result = client.process_document(request=request)
        document = result.document
    except Exception as e:
        print(f"Error calling Document AI: {e}")
        raise

    # Group entities by page
    page_entities = [[] for _ in document.pages]
    for entity in document.entities:
        if entity.page_anchor and entity.page_anchor.page_refs:
            page_ref = entity.page_anchor.page_refs[0]
            if hasattr(page_ref, 'page'):
                page_index = int(page_ref.page)
                if 0 <= page_index < len(page_entities):
                    page_entities[page_index].append(entity)

    # Process each page
    all_page_layouts = []
    page_width, page_height = letter  # Use letter size as default

    for i, p_entities in enumerate(page_entities):
        # Calculate base font size for this page
        base_font_size = calculate_base_font_size([{
            'type': entity.type_,
            'text': "".join(
                document.text[int(seg.start_index):int(seg.end_index)]
                for seg in entity.text_anchor.text_segments
            ),
            'bounding_poly': {
                'vertices': [{
                    'x': float(v.x), 'y': float(v.y)
                } for v in entity.page_anchor.page_refs[0].bounding_poly.normalized_vertices]
            } if entity.page_anchor and entity.page_anchor.page_refs else None
        } for entity in p_entities], page_height)

        page_layout = {
            "page_number": i + 1,
            "entities": [],
            "text": ""
        }

        # Get page text
        if (i < len(document.pages) and
                document.pages[i].layout and
                document.pages[i].layout.text_anchor and
                document.pages[i].layout.text_anchor.text_segments):
            for segment in document.pages[i].layout.text_anchor.text_segments:
                start = int(segment.start_index)
                end = int(segment.end_index)
                page_layout["text"] += document.text[start:end]

        # Process entities
        for entity in p_entities:
            text_segments = entity.text_anchor.text_segments
            entity_text = "".join(
                document.text[int(segment.start_index):int(segment.end_index)]
                for segment in text_segments
            )

            bounding_poly_dict = None
            if entity.page_anchor and entity.page_anchor.page_refs:
                page_ref = entity.page_anchor.page_refs[0]
                if hasattr(page_ref, 'bounding_poly') and page_ref.bounding_poly:
                    vertices = page_ref.bounding_poly.normalized_vertices
                    if len(vertices) >= 4:
                        bounding_poly_dict = {
                            "vertices": [{"x": float(v.x), "y": float(v.y)} for v in vertices]
                        }
                        # Calculate actual dimensions for styling
                        x_coords = [v.x * page_width for v in vertices]
                        y_coords = [v.y * page_height for v in vertices]
                        box_width = max(x_coords) - min(x_coords)
                        box_height = max(y_coords) - min(y_coords)
                        
                        style = apply_styling(entity.type_, box_width, box_height, base_font_size)
            
            entity_data = OCREntity(
                type=entity.type_,
                text=entity_text.strip(),
                confidence=float(entity.confidence),
                bounding_poly=BoundingPoly(**bounding_poly_dict) if bounding_poly_dict else None,
                id=entity.id if hasattr(entity, 'id') and entity.id else None,
                style=style
            )
            
            page_layout["entities"].append(entity_data.dict())

        all_page_layouts.append(page_layout)

    return {
        "document_info": {
            "total_pages": len(document.pages),
            "mime_type": mime_type,
            "page_width": page_width,
            "page_height": page_height
        },
        "pages": all_page_layouts
    }

def create_styled_pdf_from_layout(layout_data: Dict[str, Any]) -> bytes:
    """Generate a styled PDF from layout data, supporting multiple pages."""
    buffer = BytesIO()
    merged_pdf = fitz.open()

    for page_layout in layout_data["pages"]:
        # Create a new PDF page
        page_buffer = BytesIO()
        c = canvas.Canvas(page_buffer, pagesize=letter)
        page_width, page_height = letter
        styles = getSampleStyleSheet()

        entities = [e for e in page_layout["entities"] if e.get("bounding_poly")]
        entities.sort(key=lambda e: e["bounding_poly"]["vertices"][0]["y"])

        for entity in entities:
            vertices = entity["bounding_poly"]["vertices"]
            x1 = vertices[0]["x"] * page_width
            y1 = convert_coordinates(vertices[0]["y"], page_height)
            x2 = vertices[1]["x"] * page_width
            y2 = convert_coordinates(vertices[1]["y"], page_height)
            
            box_width = x2 - x1
            box_height = abs(y1 - y2)
            box_y = min(y1, y2)

            style = entity["style"]
            bg_color = style.get("background_color")
            text_color = style.get("text_color", [0, 0, 0])
            border_radius = style.get("border_radius", 0)
            has_border = style.get("has_border", False)
            border_color = style.get("border_color", [0.8, 0.8, 0.8])
            padding = style.get("padding", 8)
            font_weight = style.get("font_weight", "normal")
            font_size = style.get("font_size", 12)
            alignment_str = style.get("alignment", "left")

            font_name = "Helvetica-Bold" if font_weight == "bold" else "Helvetica"
            alignment = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}.get(alignment_str, TA_LEFT)

            # Create paragraph style
            p_style = ParagraphStyle(
                name="CustomStyle",
                fontName=font_name,
                fontSize=font_size,
                leading=font_size * 1.2,
                textColor=f"rgb({text_color[0]},{text_color[1]},{text_color[2]})",
                alignment=alignment,
            )

            # Create and measure paragraph
            p_text = entity["text"].replace("\n", "<br/>")
            p = Paragraph(p_text, p_style)
            w_text, h_text = p.wrapOn(c, box_width - 2 * padding, box_height)

            # Draw background and border for MessengerTextBox
            if entity["type"] == "MessengerTextBox" and bg_color:
                expanded_x = x1 - padding
                expanded_y = box_y + (box_height - h_text) / 2 - padding
                expanded_width = box_width + 2 * padding
                expanded_height = h_text + 2 * padding

                c.setFillColorRGB(*bg_color)
                if border_radius > 0:
                    draw_rounded_rect(c, expanded_x, expanded_y, expanded_width, expanded_height, border_radius)
                else:
                    c.rect(expanded_x, expanded_y, expanded_width, expanded_height, fill=1, stroke=0)

                if has_border:
                    c.setStrokeColorRGB(*border_color)
                    c.setLineWidth(1)
                    if border_radius > 0:
                        c.roundRect(expanded_x, expanded_y, expanded_width, expanded_height, border_radius, fill=0, stroke=1)
                    else:
                        c.rect(expanded_x, expanded_y, expanded_width, expanded_height, fill=0, stroke=1)

            # Draw text
            text_x = x1
            text_y = box_y + (box_height - h_text) / 2
            if entity["type"] == "MessengerTextBox":
                text_y = box_y + (box_height - h_text) / 2
            p.drawOn(c, text_x, text_y)

        c.save()
        page_buffer.seek(0)
        
        # Add page to merged PDF
        temp_pdf = fitz.open("pdf", page_buffer.getvalue())
        merged_pdf.insert_pdf(temp_pdf)

    # Save merged PDF to main buffer
    merged_pdf.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()

def convert_image_to_pdf(image_bytes: bytes) -> bytes:
    """Convert image bytes to PDF bytes."""
    try:
        # Open the image using PIL
        image = Image.open(BytesIO(image_bytes))
        
        # Create a new PDF with the same size as the image
        pdf_buffer = BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        
        # Calculate scaling to fit the image on the page while maintaining aspect ratio
        page_width, page_height = letter
        img_width, img_height = image.size
        
        # Calculate scaling factors
        width_ratio = page_width / img_width
        height_ratio = page_height / img_height
        scale = min(width_ratio, height_ratio) * 0.95  # 95% of the page
        
        # Calculate centered position
        x = (page_width - (img_width * scale)) / 2
        y = (page_height - (img_height * scale)) / 2
        
        # Draw the image
        c.drawImage(ImageReader(image), x, y, width=img_width*scale, height=img_height*scale)
        c.save()
        
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()
    except Exception as e:
        raise ValueError(f"Failed to convert image to PDF: {str(e)}")

def process_document(file_content: bytes | None, mime_type: str | None, layout_data: Dict[str, Any] | None = None) -> tuple[bytes, Dict[str, Any]]:
    """
    Process a document and return both the styled PDF and layout data.
    
    Args:
        file_content: Raw bytes of the document, or None if layout_data is provided
        mime_type: MIME type of the document, or None if layout_data is provided
        layout_data: Optional pre-existing layout data. If provided, file_content and mime_type are ignored
        
    Returns:
        tuple: (PDF bytes, Layout dictionary)
            - PDF bytes: The generated styled PDF content
            - Layout dictionary: The OCR layout data with styling information
    """
    if layout_data is None:
        if file_content is None or mime_type is None:
            raise ValueError("Either layout_data or both file_content and mime_type must be provided")
            
        # Convert image to PDF if needed
        if mime_type.startswith('image/'):
            file_content = convert_image_to_pdf(file_content)
            mime_type = 'application/pdf'
            
        # Process document and get layout
        layout_data = process_document_for_layout(file_content, mime_type)
    
    # Generate styled PDF
    pdf_content = create_styled_pdf_from_layout(layout_data)
    
    return pdf_content, layout_data 