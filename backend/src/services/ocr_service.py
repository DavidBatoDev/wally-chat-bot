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

def calculate_font_size(page_height: float, box_height: float, entity_type: str, text_lines_count: int = 1) -> float:
    """Calculate dynamic font size based on page height and entity type."""
    # Base size is proportional to page height
    base_size = page_height / 40  # Base size for better readability
    
    # Scale based on box height and line count
    box_scale = min(1.0, box_height / (page_height * 0.1))
    # Adjust line scale to be more consistent between single and multi-line
    line_scale = 1.0 if text_lines_count == 1 else 0.9  # Less aggressive reduction for multi-line
    font_size = base_size * box_scale * line_scale
    
    # Apply type-specific scaling - make more consistent
    if entity_type == 'chat_time' or entity_type == 'chat_label':
        font_size *= 0.5  # Smaller for timestamps and labels
    elif entity_type == 'audience_name':
        font_size *= 0.7  # Slightly larger for names
    elif entity_type == 'MessengerTextBox':
        font_size *= 0.6  # Standard size for messages
    
    # Enforce minimum and maximum sizes
    min_size = page_height / 80  # Dynamic minimum
    max_size = page_height / 30   # Dynamic maximum
    
    return max(min_size, min(font_size, max_size))

def create_styled_pdf_from_layout(layout_data: Dict[str, Any]) -> bytes:
    """Generate a styled PDF from layout data."""
    buffer = BytesIO()
    merged_pdf = fitz.open()

    for page_layout in layout_data["pages"]:
        page_buffer = BytesIO()
        c = canvas.Canvas(page_buffer, pagesize=letter)
        page_width, page_height = letter

        # Sort entities by y-coordinate for proper layering
        entities = [e for e in page_layout["entities"] if e.get("bounding_poly")]
        entities.sort(key=lambda e: e["bounding_poly"]["vertices"][0]["y"])

        for entity in entities:
            if not entity["bounding_poly"]:
                continue

            # Get the bounding polygon vertices
            vertices = entity["bounding_poly"]["vertices"]
            
            # Calculate actual coordinates
            x1 = vertices[0]["x"] * page_width
            y1 = convert_coordinates(vertices[0]["y"], page_height)
            x2 = vertices[1]["x"] * page_width
            y2 = convert_coordinates(vertices[1]["y"], page_height)
            x3 = vertices[2]["x"] * page_width
            y3 = convert_coordinates(vertices[2]["y"], page_height)
            x4 = vertices[3]["x"] * page_width
            y4 = convert_coordinates(vertices[3]["y"], page_height)

            # Calculate box dimensions
            box_width = x2 - x1
            box_height = abs(y1 - y4)  # Use absolute value since y is inverted
            box_y = min(y1, y2, y3, y4)

            # Count lines for this entity
            text_lines = entity["text"].split("\n")
            line_count = len(text_lines)

            # Calculate dynamic font size
            font_size = calculate_font_size(page_height, box_height, entity["type"], line_count)
            
            # Calculate dynamic padding based on font size - more consistent padding
            base_padding = font_size * 0.5  # Reduced padding multiplier
            text_padding = base_padding if entity["type"] != "MessengerTextBox" else base_padding * 1.2

            # Draw text box background for MessengerTextBox
            if entity["type"] == "MessengerTextBox":
                c.setFillColorRGB(0.95, 0.95, 0.95, 0.5)  # Light gray background
                c.setStrokeColorRGB(0.8, 0.8, 0.8, 0.5)   # Darker gray border
                
                # Calculate dynamic border radius based on font size
                radius = min(font_size * 0.5, 8)  # Reduced radius multiplier and cap
                
                # Add padding to the box
                expanded_x = x1 - text_padding
                expanded_y = box_y - text_padding
                expanded_width = box_width + (2 * text_padding)
                expanded_height = box_height + (2 * text_padding)
                
                # Draw rounded rectangle for chat bubble
                draw_rounded_rect(c, expanded_x, expanded_y, expanded_width, expanded_height, radius)
                
                # Draw border
                c.setStrokeColorRGB(0.7, 0.7, 0.7)  # Border color
                c.roundRect(expanded_x, expanded_y, expanded_width, expanded_height, radius, fill=0, stroke=1)

            # Set colors based on entity type
            if entity["type"] == "chat_time":
                c.setFillColorRGB(0.5, 0.5, 0.5)  # Gray for timestamps
            elif entity["type"] == "chat_label":
                c.setFillColorRGB(0.6, 0.6, 0.6)  # Light gray for labels
            elif entity["type"] == "audience_name":
                c.setFillColorRGB(0, 0, 0)  # Black for names
                c.setFont('Helvetica-Bold', font_size)  # Bold for names
            else:
                c.setFillColorRGB(0, 0, 0)  # Default black
                c.setFont('Helvetica', font_size)
            
            # Calculate dynamic line height based on font size and line count
            line_spacing = 1.2  # Consistent line spacing
            line_height = min(font_size * line_spacing, (box_height - 2 * text_padding) / line_count)
            total_text_height = line_height * line_count
            
            # Calculate vertical position to center text in box
            vertical_space = box_height - total_text_height
            text_y = box_y + vertical_space/2 + total_text_height - text_padding
            
            # Draw text lines
            for i, line in enumerate(text_lines):
                # Handle text alignment
                if entity["type"] in ["chat_time", "chat_label"]:
                    # Center align timestamps and labels
                    text_width = c.stringWidth(line, 'Helvetica', font_size)
                    text_x = x1 + (box_width - text_width) / 2
                else:
                    text_x = x1 + text_padding
                
                c.drawString(text_x, text_y - (i * line_height), line)

        c.save()
        page_buffer.seek(0)
        
        # Add page to merged PDF
        temp_pdf = fitz.open("pdf", page_buffer.getvalue())
        merged_pdf.insert_pdf(temp_pdf)

    # Save merged PDF to main buffer
    merged_pdf.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()

def process_document_for_layout(file_content: bytes, mime_type: str) -> Dict[str, Any]:
    """Process document using Google Document AI and extract layout."""
    # First convert to PDF if needed
    if mime_type.startswith('image/'):
        file_content = convert_image_to_pdf(file_content)
        mime_type = 'application/pdf'
    
    # Process with Document AI
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
    page_width, page_height = letter

    for i, p_entities in enumerate(page_entities):
        # Extract page text
        page_text = ""
        if (i < len(document.pages) and
                document.pages[i].layout and
                document.pages[i].layout.text_anchor and
                document.pages[i].layout.text_anchor.text_segments):
            for segment in document.pages[i].layout.text_anchor.text_segments:
                start = int(segment.start_index)
                end = int(segment.end_index)
                page_text += document.text[start:end]

        # Process entities
        page_layout = {
            "page_number": i + 1,
            "entities": [],
            "text": page_text
        }

        for entity in p_entities:
            text_segments = entity.text_anchor.text_segments
            entity_text = "".join(
                document.text[int(segment.start_index):int(segment.end_index)]
                for segment in text_segments
            )

            bounding_poly = None
            if entity.page_anchor and entity.page_anchor.page_refs:
                page_ref = entity.page_anchor.page_refs[0]
                if hasattr(page_ref, 'bounding_poly') and page_ref.bounding_poly:
                    vertices = page_ref.bounding_poly.normalized_vertices
                    if len(vertices) >= 4:
                        bounding_poly = {
                            "vertices": [{"x": float(v.x), "y": float(v.y)} for v in vertices]
                        }

            entity_data = {
                "type": entity.type_,
                "text": entity_text.strip(),
                "confidence": float(entity.confidence),
                "bounding_poly": bounding_poly,
                "id": entity.id if hasattr(entity, 'id') else None
            }
            
            page_layout["entities"].append(entity_data)

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

def convert_image_to_pdf(image_bytes: bytes) -> bytes:
    """Convert image bytes to PDF bytes."""
    try:
        # Open the image using PIL
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode not in ['RGB', 'L']:
            image = image.convert('RGB')
        
        # Create PDF with the image
        pdf_buffer = BytesIO()
        
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
        
        # Create PDF
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        c.drawImage(ImageReader(image), x, y, width=img_width*scale, height=img_height*scale)
        c.save()
        
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()
    except Exception as e:
        raise ValueError(f"Failed to convert image to PDF: {str(e)}")

def create_styled_json_from_layout(layout_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a JSON with all styling information for frontend PDF reconstruction."""
    styled_layout = {
        "document_info": layout_data["document_info"],
        "pages": []
    }
    
    page_width, page_height = letter
    
    for page_layout in layout_data["pages"]:
        styled_page = {
            "page_number": page_layout["page_number"],
            "text": page_layout["text"],
            "entities": []
        }
        
        # Sort entities by y-coordinate for proper layering
        entities = [e for e in page_layout["entities"] if e.get("bounding_poly")]
        entities.sort(key=lambda e: e["bounding_poly"]["vertices"][0]["y"])
        
        for entity in entities:
            if not entity["bounding_poly"]:
                continue
            
            # Get the bounding polygon vertices
            vertices = entity["bounding_poly"]["vertices"]
            
            # Calculate actual coordinates
            x1 = vertices[0]["x"] * page_width
            y1 = convert_coordinates(vertices[0]["y"], page_height)
            x2 = vertices[1]["x"] * page_width
            y2 = convert_coordinates(vertices[1]["y"], page_height)
            x3 = vertices[2]["x"] * page_width
            y3 = convert_coordinates(vertices[2]["y"], page_height)
            x4 = vertices[3]["x"] * page_width
            y4 = convert_coordinates(vertices[3]["y"], page_height)
            
            # Calculate box dimensions
            box_width = x2 - x1
            box_height = abs(y1 - y4)
            box_y = min(y1, y2, y3, y4)
            
            # Count lines for this entity
            text_lines = entity["text"].split("\n")
            line_count = len(text_lines)
            
            # Calculate dynamic font size
            font_size = calculate_font_size(page_height, box_height, entity["type"], line_count)
            
            # Calculate dynamic padding based on font size
            base_padding = font_size * 0.5
            text_padding = base_padding if entity["type"] != "MessengerTextBox" else base_padding * 1.2
            
            # Calculate colors based on entity type
            colors = {
                "fill_color": {"r": 0, "g": 0, "b": 0},  # Default black
                "stroke_color": {"r": 0, "g": 0, "b": 0},
                "background_color": None,
                "border_color": None
            }
            
            if entity["type"] == "chat_time":
                colors["fill_color"] = {"r": 0.5, "g": 0.5, "b": 0.5}
            elif entity["type"] == "chat_label":
                colors["fill_color"] = {"r": 0.6, "g": 0.6, "b": 0.6}
            elif entity["type"] == "audience_name":
                colors["fill_color"] = {"r": 0, "g": 0, "b": 0}
            elif entity["type"] == "MessengerTextBox":
                colors["background_color"] = {"r": 0.95, "g": 0.95, "b": 0.95, "a": 0.5}
                colors["border_color"] = {"r": 0.7, "g": 0.7, "b": 0.7}
            
            # Calculate text positioning
            line_spacing = 1.2
            line_height = min(font_size * line_spacing, (box_height - 2 * text_padding) / line_count)
            total_text_height = line_height * line_count
            vertical_space = box_height - total_text_height
            text_y = box_y + vertical_space/2 + total_text_height - text_padding
            
            # Calculate text alignment
            text_alignment = "left"  # Default
            if entity["type"] in ["chat_time", "chat_label"]:
                text_alignment = "center"
            
            # Create styled entity
            styled_entity = {
                "type": entity["type"],
                "text": entity["text"],
                "confidence": entity["confidence"],
                "id": entity.get("id"),
                "bounding_poly": entity["bounding_poly"],
                "styling": {
                    "font_size": font_size,
                    "font_family": "Helvetica-Bold" if entity["type"] == "audience_name" else "Helvetica",
                    "colors": colors,
                    "text_alignment": text_alignment,
                    "line_spacing": line_spacing,
                    "line_height": line_height,
                    "text_padding": text_padding,
                    "text_lines": text_lines,
                    "line_count": line_count
                },
                "dimensions": {
                    "box_width": box_width,
                    "box_height": box_height,
                    "box_x": x1,
                    "box_y": box_y,
                    "text_y": text_y,
                    "coordinates": {
                        "x1": x1, "y1": y1,
                        "x2": x2, "y2": y2,
                        "x3": x3, "y3": y3,
                        "x4": x4, "y4": y4
                    }
                }
            }
            
            # Add background styling for MessengerTextBox
            if entity["type"] == "MessengerTextBox":
                radius = min(font_size * 0.5, 8)
                expanded_x = x1 - text_padding
                expanded_y = box_y - text_padding
                expanded_width = box_width + (2 * text_padding)
                expanded_height = box_height + (2 * text_padding)
                
                styled_entity["styling"]["background"] = {
                    "border_radius": radius,
                    "expanded_x": expanded_x,
                    "expanded_y": expanded_y,
                    "expanded_width": expanded_width,
                    "expanded_height": expanded_height
                }
            
            styled_page["entities"].append(styled_entity)
        
        styled_layout["pages"].append(styled_page)
    
    return styled_layout

def process_document(file_content: bytes, mime_type: str) -> tuple[bytes, Dict[str, Any], Dict[str, Any]]:
    """Process a document and return the styled PDF, layout data, and styled JSON."""
    # Process document and get layout
    layout_data = process_document_for_layout(file_content, mime_type)
    
    # Generate styled PDF
    pdf_content = create_styled_pdf_from_layout(layout_data)
    
    # Generate styled JSON for frontend
    styled_json = create_styled_json_from_layout(layout_data)
    
    return pdf_content, layout_data, styled_json 