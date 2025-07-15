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
import traceback

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

def process_document_for_layout(
    document: documentai.Document,
    frontend_page_width: float = None,
    frontend_page_height: float = None,
    frontend_scale: float = None
) -> Dict[str, Any]:
    """
    Process a Document AI document and extract layout information.
    
    Args:
        document: Document AI document object
        frontend_page_width: Frontend's page width (optional)
        frontend_page_height: Frontend's page height (optional) 
        frontend_scale: Frontend's scale factor (optional)
    """
    try:
        # Use frontend dimensions if provided, otherwise fall back to Document AI dimensions
        if frontend_page_width and frontend_page_height:
            actual_page_width = frontend_page_width
            actual_page_height = frontend_page_height
            print(f"=== USING FRONTEND DIMENSIONS ===")
            print(f"Frontend provided: width={frontend_page_width}, height={frontend_page_height}, scale={frontend_scale}")
        else:
            # Fallback to Document AI dimensions
            actual_page_width = 612  # Default fallback
            actual_page_height = 792  # Default fallback
            
            if document.pages and len(document.pages) > 0:
                # Get dimensions from the first page
                first_page = document.pages[0]
                print(f"=== DOCUMENT AI PAGE DEBUG ===")
                print(f"First page object type: {type(first_page)}")
                print(f"First page dir(): {dir(first_page)}")
                print(f"First page attributes: {[attr for attr in dir(first_page) if not attr.startswith('_')]}")
                
                # Try different ways to access page dimensions
                if hasattr(first_page, 'width') and hasattr(first_page, 'height'):
                    actual_page_width = float(first_page.width)
                    actual_page_height = float(first_page.height)
                    print(f"Using first_page.width/height: {actual_page_width} x {actual_page_height}")
                elif hasattr(first_page, 'dimension'):
                    actual_page_width = float(first_page.dimension.width)
                    actual_page_height = float(first_page.dimension.height)
                    print(f"Using first_page.dimension: {actual_page_width} x {actual_page_height}")
                elif hasattr(first_page, 'page_width') and hasattr(first_page, 'page_height'):
                    actual_page_width = float(first_page.page_width)
                    actual_page_height = float(first_page.page_height)
                    print(f"Using first_page.page_width/height: {actual_page_width} x {actual_page_height}")
                else:
                    print(f"Could not find page dimensions, using defaults: {actual_page_width} x {actual_page_height}")
        
        print(f"=== FINAL PAGE DIMENSIONS ===")
        print(f"Using page dimensions: width={actual_page_width}, height={actual_page_height}")
        print(f"Page dimensions in points: {actual_page_width} x {actual_page_height}")
        print(f"Page dimensions in inches: {actual_page_width/72:.2f} x {actual_page_height/72:.2f}")
        print(f"=== END PAGE DIMENSIONS DEBUG ===")

        # Group entities by page
        print("Processing Document AI results...")
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

        result = {
            "document_info": {
                "total_pages": len(document.pages),
                "mime_type": "application/pdf", # Document AI always returns PDF
                "page_width": actual_page_width,
                "page_height": actual_page_height
            },
            "pages": all_page_layouts
        }
        
        print(f"=== FINAL RESULT DEBUG ===")
        print(f"Returning document_info: {result['document_info']}")
        print(f"Page dimensions in result: width={result['document_info']['page_width']}, height={result['document_info']['page_height']}")
        print(f"Total pages: {result['document_info']['total_pages']}")
        print(f"=== END FINAL RESULT DEBUG ===")
        
        print("=== DOCUMENT AI SUCCESS ===")
        return result
        
    except Exception as e:
        print("=== DOCUMENT AI ERROR ===")
        error_traceback = traceback.format_exc()
        print(f"ERROR in process_document_for_layout: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {error_traceback}")
        raise

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
    
    # Use actual page dimensions from input data instead of hardcoded letter size
    page_width = layout_data.get("document_info", {}).get("page_width", 612)
    page_height = layout_data.get("document_info", {}).get("page_height", 792)
    
    print(f"=== STYLED JSON PAGE DIMENSIONS DEBUG ===")
    print(f"create_styled_json_from_layout using: width={page_width}, height={page_height}")
    print(f"Input layout_data document_info: {layout_data.get('document_info', 'Not found')}")
    if 'document_info' in layout_data:
        print(f"Input page dimensions: width={layout_data['document_info'].get('page_width', 'Not found')}, height={layout_data['document_info'].get('page_height', 'Not found')}")
    print(f"=== END STYLED JSON PAGE DIMENSIONS DEBUG ===")
    
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
            
            # Get the bounding polygon vertices (these are normalized 0-1 coordinates)
            vertices = entity["bounding_poly"]["vertices"]
            
            # Convert normalized coordinates to actual page coordinates
            # Note: Document AI returns normalized coordinates (0-1) relative to the page
            x1 = vertices[0]["x"] * page_width
            y1 = vertices[0]["y"] * page_height
            x2 = vertices[1]["x"] * page_width
            y2 = vertices[1]["y"] * page_height
            x3 = vertices[2]["x"] * page_width
            y3 = vertices[2]["y"] * page_height
            x4 = vertices[3]["x"] * page_width
            y4 = vertices[3]["y"] * page_height
            
            # Calculate box dimensions
            box_width = x2 - x1
            box_height = abs(y1 - y4)
            box_x = x1
            box_y = min(y1, y2, y3, y4)  # Top of the box in normalized coordinates
            
            # Use the same coordinate system as frontend (top-left origin)
            # No Y-flip needed - keep coordinates consistent
            frontend_y = box_y
            
            print(f"=== ENTITY COORDINATE DEBUG ===")
            print(f"Entity: {entity['type']} - '{entity['text'][:50]}...'")
            print(f"Normalized vertices: {vertices}")
            print(f"Page coordinates: x1={x1}, y1={y1}, x2={x2}, y2={y2}, x3={x3}, y3={y3}, x4={x4}, y4={y4}")
            print(f"Box dimensions: width={box_width}, height={box_height}")
            print(f"Box position: x={box_x}, y={frontend_y}")
            print(f"=== END ENTITY COORDINATE DEBUG ===")
            
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
            text_y = frontend_y + vertical_space/2 + total_text_height - text_padding
            
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
                    "box_x": box_x,
                    "box_y": frontend_y,  # Use frontend Y coordinate
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
                expanded_x = box_x - text_padding
                expanded_y = frontend_y - text_padding  # Use same coordinate system
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
    print("=== OCR SERVICE DEBUG ===")
    print(f"process_document: Starting with mime_type={mime_type}, content_size={len(file_content)}")
    
    try:
        # Process document and get layout
        print("process_document: Calling process_document_for_layout...")
        try:
            layout_data = process_document_for_layout(file_content, mime_type)
            print(f"process_document: layout_data keys: {list(layout_data.keys()) if layout_data else 'None'}")
        except Exception as layout_error:
            print(f"ERROR in process_document_for_layout: {str(layout_error)}")
            print(f"Layout error traceback: {traceback.format_exc()}")
            raise layout_error
        
        # Generate styled PDF
        print("process_document: Calling create_styled_pdf_from_layout...")
        try:
            pdf_content = create_styled_pdf_from_layout(layout_data)
            print(f"process_document: PDF content size: {len(pdf_content)} bytes")
        except Exception as pdf_error:
            print(f"ERROR in create_styled_pdf_from_layout: {str(pdf_error)}")
            print(f"PDF error traceback: {traceback.format_exc()}")
            raise pdf_error
        
        # Generate styled JSON for frontend
        print("process_document: Calling create_styled_json_from_layout...")
        try:
            styled_json = create_styled_json_from_layout(layout_data)
            print(f"process_document: styled_json keys: {list(styled_json.keys()) if styled_json else 'None'}")
        except Exception as json_error:
            print(f"ERROR in create_styled_json_from_layout: {str(json_error)}")
            print(f"JSON error traceback: {traceback.format_exc()}")
            raise json_error
        
        print("process_document: All processing completed successfully")
        print("=== OCR SERVICE SUCCESS ===")
        return pdf_content, layout_data, styled_json
        
    except Exception as e:
        print("=== OCR SERVICE ERROR ===")
        error_traceback = traceback.format_exc()
        print(f"ERROR in process_document: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {error_traceback}")
        raise 