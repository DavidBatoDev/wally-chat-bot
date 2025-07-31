import os
import io
import json
import tempfile
import re
import base64
from typing import Optional, Dict, Any, Union, List, Set, Tuple
import traceback
from pathlib import Path
from dotenv import load_dotenv
import httpx
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image

# Document processing
try:
    import fitz  # PyMuPDF for PDF handling
except ImportError:
    fitz = None

# Gemini AI
import google.generativeai as genai

# Supabase
from db.supabase_client import supabase

# Load environment variables
load_dotenv()

class TemplateOCRService:
    def __init__(self):
        """Initialize the template OCR service with API configurations."""
        # Configure Gemini API
        try:
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            self.gemini_model = "gemini-2.5-flash"
            self.gemini = genai.GenerativeModel(self.gemini_model)
            print(f"Gemini model {self.gemini_model} configured successfully")
        except Exception as e:
            print(f"Error configuring Gemini: {e}")
            self.gemini = None

        # Regular expression for matching placeholders
        self.placeholder_re = re.compile(r"\{(.*?)\}")

    def infer_radio_groups_from_fields(self, placeholder_json: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Infer radio button groups from field descriptions and labels using the standard info_json format.
        Groups fields that appear to be mutually exclusive choices.
        """
        radio_groups = {}
        
        # Look for common radio group patterns in descriptions and labels
        potential_groups = {}
        
        for field_key, field_info in placeholder_json.items():
            if isinstance(field_info, dict):
                label = field_info.get('label', '').lower()
                description = field_info.get('description', '').lower()
                
                # Look for checkbox patterns that suggest radio groups
                if 'checkbox' in description or 'check' in label.lower():
                    # Group by similar base concepts based on labels and descriptions
                    
                    # Gender/Sex group
                    if any(keyword in label for keyword in ['sex', 'male', 'female', 'gender']):
                        if 'gender' not in potential_groups:
                            potential_groups['gender'] = []
                        potential_groups['gender'].append(field_key)
                    
                    # Attendant group  
                    elif any(keyword in label for keyword in ['attendant', 'physician', 'nurse', 'midwife', 'doctor']):
                        if 'attendant' not in potential_groups:
                            potential_groups['attendant'] = []
                        potential_groups['attendant'].append(field_key)
                    
                    # Birth type/multiple birth group
                    elif any(keyword in label for keyword in ['birth', 'first', 'second', 'third', 'multiple']):
                        if 'birth_type' not in potential_groups:
                            potential_groups['birth_type'] = []
                        potential_groups['birth_type'].append(field_key)
                    
                    # Status/legitimate group
                    elif any(keyword in label for keyword in ['legitimate', 'status', 'married']):
                        if 'status' not in potential_groups:
                            potential_groups['status'] = []
                        potential_groups['status'].append(field_key)
                    
                    # Location/limits group (yes/no questions)
                    elif any(keyword in description for keyword in ['city limits', 'residence', 'place']) and any(keyword in label for keyword in ['yes', 'no', 'y', 'n']):
                        if 'location_limits' not in potential_groups:
                            potential_groups['location_limits'] = []
                        potential_groups['location_limits'].append(field_key)
                
                # Also check for field key patterns that suggest grouping
                clean_key = field_key.strip('{}').lower()
                
                # Look for numbered patterns like at1, at2, at3 (attendant types)
                if clean_key.startswith('at') and len(clean_key) <= 4:
                    if 'attendant_types' not in potential_groups:
                        potential_groups['attendant_types'] = []
                    potential_groups['attendant_types'].append(field_key)
                
                # Look for tb1, tb2, tb3 patterns (type of birth)
                elif clean_key.startswith('tb') and len(clean_key) <= 4:
                    if 'birth_types' not in potential_groups:
                        potential_groups['birth_types'] = []
                    potential_groups['birth_types'].append(field_key)
                
                # Look for imb1, imb2, imb3 patterns (multiple birth)
                elif clean_key.startswith('imb') and len(clean_key) <= 5:
                    if 'multiple_birth_order' not in potential_groups:
                        potential_groups['multiple_birth_order'] = []
                    potential_groups['multiple_birth_order'].append(field_key)
        
        # Only keep groups with multiple fields (actual radio groups)
        for group_name, fields in potential_groups.items():
            if len(fields) > 1:
                radio_groups[group_name] = fields
                print(f"Detected radio group '{group_name}': {fields}")
        
        return radio_groups

    def identify_active_radio_groups(self, placeholder_json: Dict[str, Any]) -> Dict[str, List[str]]:
        """Identify which radio groups are present in the current template."""
        return self.infer_radio_groups_from_fields(placeholder_json)

    def apply_radio_button_logic(self, extracted: Dict[str, Any], missing: Dict[str, Any], 
                                active_groups: Dict[str, List[str]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Apply radio button logic: if one field in a group is selected, remove others from missing."""
        updated_missing = missing.copy()
        
        for group_name, group_fields in active_groups.items():
            # Check if any field in this group was extracted
            selected_fields = [field for field in group_fields if field in extracted and extracted[field]["value"]]
            
            if selected_fields:
                # Remove all other fields in this group from missing
                for field in group_fields:
                    if field != selected_fields[0] and field in updated_missing:
                        del updated_missing[field]
                        print(f"Removed {field} from missing (radio group: {group_name}, selected: {selected_fields[0]})")
        
        return extracted, updated_missing

    async def download_file_from_url(self, file_url: str) -> bytes:
        """Download file content from a public URL."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            raise Exception(f"Failed to download file from URL {file_url}: {str(e)}")

    def convert_pdf_to_images(self, pdf_bytes: bytes) -> List[bytes]:
        """Convert PDF pages to a list of image bytes."""
        if not fitz:
            raise Exception("PyMuPDF not installed. Install with: pip install PyMuPDF")
        
        images = []
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                img_bytes = pix.tobytes("png")
                images.append(img_bytes)
        except Exception as e:
            raise Exception(f"Failed to convert PDF to images: {e}")
        return images

    def extract_json_from_text(self, text: str) -> Optional[Dict]:
        """Extract JSON from text using regex pattern matching."""
        # Try to find JSON pattern in the text
        json_match = re.search(r'(\{.*\})', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        return None

    def create_template_extraction_prompt(self, placeholder_json: Dict[str, Any], 
                                         active_groups: Dict[str, List[str]]) -> str:
        """Create a generic extraction prompt that adapts to any document template using the standard info_json format."""
        
        # Create group descriptions for radio buttons
        group_descriptions = []
        for group_name, group_fields in active_groups.items():
            group_desc = f"\n**{group_name.upper()} GROUP (select only ONE):**\n"
            for field in group_fields:
                field_info = placeholder_json.get(field, {})
                if isinstance(field_info, dict):
                    desc = field_info.get('description', '')
                    label = field_info.get('label', field)
                else:
                    desc = str(field_info)
                    label = field
                group_desc += f"  - {field}: {label} - {desc}\n"
            group_descriptions.append(group_desc)
        
        # Create complete field listing with descriptions using the standard format
        field_listing = "\n**ALL DOCUMENT FIELDS (EXTREMELY IMPORTANT):**\n"
        for field, field_info in placeholder_json.items():
            if isinstance(field_info, dict):
                label = field_info.get('label', field)
                description = field_info.get('description', '')
            else:
                label = field
                description = str(field_info)
            field_listing += f"  {field}: {label} - {description}\n"
        
        # Create generic extraction prompt that works with any template using the standard info_json format
        prompt = f"""You are an expert OCR engine. Extract ALL visible text from this document and match it to the specified fields.

{field_listing}

**RADIO BUTTON GROUPS (Only ONE per group):**
{"".join(group_descriptions)}

**🎯 CRITICAL EXTRACTION STRATEGY:**

**ALL FIELDS ARE EXTREMELY IMPORTANT - Extract every possible field!**

1. **SYSTEMATIC SCANNING**: Scan the entire document from top to bottom, left to right
2. **TEXT RECOGNITION**: Look for typed, handwritten, stamped, and printed text
3. **FIELD MATCHING**: Match visible text to field descriptions above using the location hints provided
4. **LOCATION AWARENESS**: Use field descriptions to find text in specific document areas and sections
5. **MULTI-LINE HANDLING**: Addresses and long text may span multiple lines
6. **CHECKBOX DETECTION**: Any mark (X, ✓, dot, filled) = "X", empty box = ""
7. **NUMBER EXTRACTION**: Extract all dates, ages, reference numbers, codes from boxes and fields

📋 **TEXT RECOGNITION PRIORITIES:**
- **TYPED/STAMPED TEXT**: Official information, names, addresses, numbers
- **HANDWRITTEN TEXT**: Signatures, names, personal information in designated areas
- **CHECKBOXES**: Any visible mark = "X", empty box = ""
- **FAINT/LIGHT TEXT**: Light pencil, faded ink, watermarks
- **SMALL TEXT**: Tiny numbers, codes, reference text in margins and boxes
- **MULTI-LINE TEXT**: Complete addresses, descriptions, notes that span multiple lines
- **SECTION-SPECIFIC TEXT**: Use section numbers and headers mentioned in field descriptions

⚡ **EXTRACTION RULES:**
1. **Names**: Extract exactly as written (preserve all capitalization and formatting)
2. **Dates**: Accept any format (MM/DD/YYYY, DD-MM-YYYY, written out, abbreviated)
3. **Numbers**: Include all numeric codes, references, ages, counts, box numbers
4. **Addresses**: Complete multi-line addresses and locations as described in field descriptions
5. **Titles/Positions**: Extract job titles, official positions, roles from signature areas
6. **Empty Fields**: Use "" (empty string) only for truly blank fields

🔍 **VISUAL SCANNING TECHNIQUE:**
- **Follow field descriptions**: Use the specific location hints provided for each field
- **Scan systematically**: Check all sections, margins, headers, footers mentioned in descriptions
- **Check signature areas**: Look for names, titles, and dates in certification/signature blocks
- **Examine small elements**: Tiny boxes, numbered fields, registry numbers in margins
- **Don't skip complex areas**: Crowded sections often contain important information

🎯 **TARGET: Extract 95%+ of all visible text. Every field matters equally - use the descriptions as your guide.**

Return ONLY a JSON object with field keys (no {{}}) and extracted values:

{{
    "field1": "extracted_value1",
    "field2": "extracted_value2", 
    "checkbox_field": "X",
    "empty_field": ""
}}

**FINAL SCAN**: Review the entire document one more time, using each field description as a guide to find any missed text.
"""
        return prompt

    def create_refinement_prompt(self, raw_extracted: Dict, placeholder_json: Dict[str, Any], 
                               active_groups: Dict[str, List[str]]) -> str:
        """Create a refinement prompt to clean up and organize extracted data using the standard info_json format."""
        
        # Create field type mapping for validation based on descriptions
        checkbox_fields = []
        text_fields = []
        
        for field, info in placeholder_json.items():
            field_info = info if isinstance(info, dict) else {'description': str(info)}
            description = field_info.get('description', '').lower()
            
            if 'checkbox' in description and ('mark' in description or 'x' in description or 'check' in description):
                checkbox_fields.append(field)
            else:
                text_fields.append(field)
        
        # Create validation rules
        validation_rules = f"""
**FIELD TYPE VALIDATION:**

Checkbox Fields (should contain only "X" or empty string):
{', '.join(checkbox_fields) if checkbox_fields else 'None detected'}

Text Fields (should contain actual text content):
{', '.join(text_fields) if text_fields else 'All fields'}

**RADIO BUTTON GROUPS (only ONE per group should have "X"):**
"""
        
        for group_name, group_fields in active_groups.items():
            validation_rules += f"\n{group_name.upper()}: {', '.join(group_fields)}"
        
        prompt = f"""You are a data validation expert for document extraction using the standard template format.

Review and correct the following extracted data to ensure it follows proper formatting rules:

{validation_rules}

**CURRENT EXTRACTED DATA:**
{json.dumps(raw_extracted, indent=2)}

**CORRECTION RULES:**
1. **Checkbox Fields**: Must contain only "X" (if checked) or "" (if unchecked)
2. **Radio Groups**: Only ONE field per group should contain "X"
3. **Name Fields**: Should contain proper names, not checkmarks or irrelevant text
4. **Date/Number Fields**: Should contain appropriate date or numeric values
5. **Address Fields**: Should contain complete address information
6. **Text Fields**: Should not contain "X" unless it's part of actual text content
7. **Field Consistency**: Ensure values match the field descriptions and expected content

**COMMON ERRORS TO FIX:**
- Names appearing in checkbox fields → Move to appropriate name fields or remove
- Multiple checkboxes selected in radio groups → Keep only the most appropriate one
- "X" appearing in text fields that should contain actual text
- Missing or misplaced information that was extracted to wrong fields
- Inconsistent formatting (preserve original capitalization and format)

Return a corrected JSON object with the same structure but properly formatted values that match the field descriptions.
"""
        return prompt

    def create_focused_missing_fields_prompt(self, missing_fields: Dict[str, Any], extracted_fields: Dict[str, Any], active_groups: Dict[str, List[str]]) -> str:
        """Create a focused prompt targeting specific missing fields, excluding radio groups with selections."""
        
        # Filter out radio group fields where we already have a selection
        filtered_missing = {}
        for field_key, field_info in missing_fields.items():
            should_include = True
            
            # Check if this field is part of a radio group that already has a selection
            for group_name, group_fields in active_groups.items():
                if field_key in group_fields:
                    # Check if any other field in this group was already extracted
                    group_has_selection = any(group_field in extracted_fields for group_field in group_fields)
                    if group_has_selection:
                        should_include = False
                        print(f"Skipping {field_key} - radio group '{group_name}' already has selection")
                        break
            
            if should_include:
                filtered_missing[field_key] = field_info
        
        if not filtered_missing:
            print("No fields to search in second pass - all radio groups have selections")
            # Return a minimal prompt that will return empty JSON
            return """Return empty JSON object: {}"""
        
        # Limit to most important missing fields to avoid overload
        priority_missing = list(filtered_missing.items())[:15]  # Focus on top 15 missing fields
        
        field_descriptions = []
        for field_key, field_info in priority_missing:
            if isinstance(field_info, dict):
                label = field_info.get('label', field_key)
                description = field_info.get('description', '')
            else:
                label = field_key
                description = str(field_info)
            
            # Clean field key for output
            clean_key = field_key.strip("{}")
            field_entry = f"  {clean_key}: {label} - {description}"
            field_descriptions.append(field_entry)
        
        prompt = f"""🎯 FOCUSED EXTRACTION - SECOND PASS

You are a specialist OCR scanner focused ONLY on finding {len(priority_missing)} specific missed fields.

**CRITICAL MISSION**: Find these exact fields that were not detected in the initial scan:

{chr(10).join(field_descriptions)}

**🔍 ULTRA-FOCUSED SCANNING TECHNIQUE:**

1. **IGNORE EVERYTHING ELSE** - only extract the fields listed above
2. **SCAN WITH FRESH EYES** - these fields ARE visible, look harder
3. **USE FIELD DESCRIPTIONS** - follow the location hints in each description
4. **CHECK ALL AREAS** - scan margins, headers, footers, signature blocks
5. **LOOK FOR PATTERNS** - numbers, names, addresses, checkboxes, dates

**⚡ TARGETED EXTRACTION RULES:**
- These fields EXIST and are VISIBLE in the document
- Use the field descriptions as location guides
- Look for ANY text that matches the field purpose
- Don't skip text just because it's handwritten, faint, or small
- Extract multi-line content completely
- If you see relevant text, extract it immediately

**EXTRACTION FORMAT:**
Return ONLY a JSON object with the exact field keys and values found:

{{
    "field1": "found_value1",
    "field2": "found_value2",
    "field3": "X"
}}

**FINAL COMMAND**: These {len(priority_missing)} fields EXIST and are VISIBLE in the document. Scan systematically until you find them.

DO NOT include explanations or notes outside the JSON object.
"""
        return prompt

    def create_styled_pdf_from_extracted_data(self, template_data: Dict[str, Any], 
                                            extracted_data: Dict[str, Any]) -> bytes:
        """Create a styled PDF with extracted text placed in their template positions."""
        
        # Get fillable text info from template
        fillable_text_info = template_data.get("fillable_text_info", [])
        if not fillable_text_info:
            raise Exception("No fillable text info found in template")
        
        # Create PDF buffer
        buffer = io.BytesIO()
        
        # Get page dimensions from the first field (assuming all fields are on same page for now)
        # In a real implementation, you'd handle multi-page documents
        page_width = 612  # Default letter size width
        page_height = 792  # Default letter size height
        
        # Try to get actual page dimensions from template if available
        if fillable_text_info:
            # Look for the maximum coordinates to estimate page size
            max_x = max(field.get("position", {}).get("x1", 0) for field in fillable_text_info)
            max_y = max(field.get("position", {}).get("y1", 0) for field in fillable_text_info)
            if max_x > 0 and max_y > 0:
                page_width = max_x + 50  # Add some margin
                page_height = max_y + 50  # Add some margin
        
        # Create canvas
        c = canvas.Canvas(buffer, pagesize=(page_width, page_height))
        
        # Process each fillable field
        for field_info in fillable_text_info:
            field_key = field_info.get("key", "")
            position = field_info.get("position", {})
            font_info = field_info.get("font", {})
            
            # Get extracted value for this field
            extracted_value = ""
            is_placeholder = False
            
            if field_key in extracted_data:
                field_data = extracted_data[field_key]
                if isinstance(field_data, dict):
                    extracted_value = field_data.get("value", "")
                else:
                    extracted_value = str(field_data)
            
            # If no value found, use placeholder text with the field key
            if not extracted_value:
                extracted_value = f"[{field_key}]"
                is_placeholder = True
            
            # Get position coordinates
            x0 = position.get("x0", 0)
            y0 = position.get("y0", 0)
            width = position.get("width", 100)
            height = position.get("height", 12)
            
            # Convert coordinates (PDF coordinate system has origin at bottom-left)
            pdf_x = x0
            pdf_y = page_height - y0 - height
            
            # Get font information
            font_name = font_info.get("name", "Helvetica")
            font_size = font_info.get("size", 10)
            font_color = font_info.get("color", "#cccccc" if is_placeholder else "#000000")  # Gray for placeholders
            
            # Map font names to ReportLab font names
            font_mapping = {
                "Arial": "Helvetica",
                "Times": "Times-Roman",
                "Courier": "Courier"
            }
            reportlab_font = font_mapping.get(font_name, "Helvetica")
            
            # Set font and color
            try:
                c.setFont(reportlab_font, font_size)
                if font_color.startswith("#"):
                    color = HexColor(font_color)
                    c.setFillColor(color)
                else:
                    c.setFillColor("black")  # Fallback to black
            except:
                # Fallback to default font and color
                c.setFont("Helvetica", 10)
                c.setFillColor("gray" if is_placeholder else "black")
            
            # Draw the text
            try:
                # Handle text that might be too long for the field
                if len(extracted_value) * font_size * 0.6 > width:  # Rough width estimation
                    # Truncate text if it's too long
                    max_chars = int(width / (font_size * 0.6))
                    extracted_value = extracted_value[:max_chars] + "..." if len(extracted_value) > max_chars else extracted_value
                
                c.drawString(pdf_x, pdf_y, extracted_value)
            except Exception as e:
                print(f"Error drawing text for field {field_key}: {e}")
                continue
        
        # Save PDF
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    def create_styled_json_from_extracted_data(self, template_data: Dict[str, Any], 
                                             extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a styled JSON response similar to the OCR service format."""
        
        fillable_text_info = template_data.get("fillable_text_info", [])
        
        # Create the response structure similar to OCR service
        styled_layout = {
            "document_info": {
                "total_pages": 1,  # Assuming single page for now
                "mime_type": "application/pdf",
                "page_width": 612,
                "page_height": 792
            },
            "pages": []
        }
        
        # Create page data
        page_data = {
            "page_number": 1,
            "text": "",  # We don't have full text extraction in this case
            "entities": []
        }
        
        # Convert extracted data to entities format - CREATE ENTITIES FOR ALL FIELDS
        for field_info in fillable_text_info:
            field_key = field_info.get("key", "")
            position = field_info.get("position", {})
            
            # Get extracted value
            extracted_value = ""
            confidence = 1.0
            is_placeholder = False
            
            if field_key in extracted_data:
                field_data = extracted_data[field_key]
                if isinstance(field_data, dict):
                    extracted_value = field_data.get("value", "")
                else:
                    extracted_value = str(field_data)
            
            # If no value found, use placeholder text with the field key
            if not extracted_value:
                extracted_value = f"[{field_key}]"  # Use field key as placeholder
                confidence = 0.0  # Set confidence to 0 for placeholder values
                is_placeholder = True
            
            # Create entity in OCR service format for ALL fields
            entity = {
                "type": field_info.get("label", field_key),
                "text": extracted_value,
                "confidence": confidence,
                "is_placeholder": is_placeholder,  # Flag to indicate this is a placeholder
                "bounding_poly": {
                    "vertices": [
                        {"x": position.get("x0", 0) / 612, "y": position.get("y0", 0) / 792},
                        {"x": position.get("x1", 0) / 612, "y": position.get("y0", 0) / 792},
                        {"x": position.get("x1", 0) / 612, "y": position.get("y1", 0) / 792},
                        {"x": position.get("x0", 0) / 612, "y": position.get("y1", 0) / 792}
                    ]
                },
                "id": field_key,
                "style": {
                    "x": position.get("x0", 0),
                    "y": position.get("y0", 0),
                    "width": position.get("width", 100),
                    "height": position.get("height", 12),
                    "font_family": field_info.get("font", {}).get("name", "Arial"),
                    "font_size": field_info.get("font", {}).get("size", 10),
                    "color": field_info.get("font", {}).get("color", "#cccccc" if is_placeholder else "#000000"),  # Gray for placeholders
                    "background_color": "transparent",
                    "border_color": "transparent",
                    "border_width": 0,
                    "rotation": field_info.get("rotation", 0),
                    "opacity": 0.7 if is_placeholder else 1,  # More transparent for placeholders
                    "z_index": 1
                }
            }
            
            page_data["entities"].append(entity)
        
        styled_layout["pages"].append(page_data)
        return styled_layout

    def create_styled_pdf_with_template(self, template_pdf_bytes: bytes, 
                                       extracted_data: Dict[str, Any],
                                       fillable_text_info: List[Dict[str, Any]]) -> bytes:
        """Create a styled PDF by overlaying extracted text on a template PDF."""
        
        if not fitz:
            raise Exception("PyMuPDF not installed. Install with: pip install PyMuPDF")
        
        try:
            # Open the template PDF
            template_doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
            
            # Process each page
            for page_num in range(len(template_doc)):
                page = template_doc.load_page(page_num)
                
                # Process each fillable field for this page
                for field_info in fillable_text_info:
                    field_key = field_info.get("key", "")
                    field_page = field_info.get("page_number", 1)
                    
                    # Skip if this field is not for the current page
                    if field_page != page_num + 1:
                        continue
                    
                    # Get extracted value for this field
                    extracted_value = ""
                    is_placeholder = False
                    
                    if field_key in extracted_data:
                        field_data = extracted_data[field_key]
                        if isinstance(field_data, dict):
                            extracted_value = field_data.get("value", "")
                        else:
                            extracted_value = str(field_data)
                    
                    # If no value found, use placeholder text with the field key
                    if not extracted_value:
                        extracted_value = f"[{field_key}]"
                        is_placeholder = True
                    
                    # Get position and font information
                    position = field_info.get("position", {})
                    font_info = field_info.get("font", {})
                    
                    x0 = position.get("x0", 0)
                    y0 = position.get("y0", 0)
                    width = position.get("width", 100)
                    height = position.get("height", 12)
                    
                    font_name = font_info.get("name", "helv")
                    font_size = font_info.get("size", 10)
                    font_color = font_info.get("color", "#cccccc" if is_placeholder else "#000000")  # Gray for placeholders
                    
                    # Convert color to RGB tuple
                    color_rgb = (0.8, 0.8, 0.8) if is_placeholder else (0, 0, 0)  # Light gray for placeholders, black for values
                    if font_color.startswith("#") and len(font_color) == 7:
                        try:
                            r = int(font_color[1:3], 16) / 255.0
                            g = int(font_color[3:5], 16) / 255.0
                            b = int(font_color[5:7], 16) / 255.0
                            color_rgb = (r, g, b)
                        except ValueError:
                            color_rgb = (0.8, 0.8, 0.8) if is_placeholder else (0, 0, 0)  # Fallback
                    
                    # Create a text rectangle
                    rect = fitz.Rect(x0, y0, x0 + width, y0 + height)
                    
                    # Insert text at the specified position
                    try:
                        page.insert_text(
                            (x0, y0 + height * 0.8),  # Adjust Y position for text baseline
                            extracted_value,
                            fontsize=font_size,
                            fontname=font_name,
                            color=color_rgb
                        )
                    except Exception as text_error:
                        print(f"Error inserting text for field {field_key}: {text_error}")
                        # Try with default font
                        try:
                            page.insert_text(
                                (x0, y0 + height * 0.8),
                                extracted_value,
                                fontsize=10,
                                color=(0.8, 0.8, 0.8) if is_placeholder else (0, 0, 0)  # Gray for placeholders
                            )
                        except:
                            print(f"Failed to insert text for field {field_key}")
                            continue
            
            # Save the modified PDF to bytes
            pdf_bytes = template_doc.tobytes()
            template_doc.close()
            
            return pdf_bytes
            
        except Exception as e:
            raise Exception(f"Failed to process PDF template: {str(e)}")

    async def extract_values_from_document_with_template(
        self, 
        template_id: str,
        file_content: bytes,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        Extract information from a document using OCR based on template requirements.
        
        Args:
            template_id: Template ID to get required fields from database
            file_content: Document file content as bytes
            mime_type: MIME type of the document
        
        Returns:
            Dictionary containing extracted values, missing fields, and styled data
        """
        if not self.gemini:
            raise Exception("Gemini API not configured")
        
        try:
            # 1. Get template from Supabase
            try:
                tpl_response = supabase.table("templates").select("*").eq("id", template_id).single().execute()
                
                if not tpl_response.data:
                    raise Exception(f"Template not found with ID: {template_id}")
                
                template_data = tpl_response.data
                placeholder_json: Dict[str, Any] = template_data["info_json"]["required_fields"]
                print(f"Found template {template_id} with {len(placeholder_json)} placeholders")
            except Exception as db_err:
                print(f"Database error: {db_err}")
                raise Exception(f"Error fetching template: {str(db_err)}")
            
            # 2. Identify active radio groups
            active_groups = self.identify_active_radio_groups(placeholder_json)
            print(f"Identified {len(active_groups)} active radio groups: {list(active_groups.keys())}")
            
            # 3. Process the file based on its type
            image_bytes = None
            
            if mime_type in ("image/jpg", "image/jpeg", "image/png"):
                image_bytes = file_content
                print(f"Detected image file: {len(image_bytes)} bytes")
            elif mime_type == "application/pdf" and fitz:
                # For documents, we'll process the first page
                try:
                    image_bytes = self.convert_pdf_to_images(file_content)[0]
                    print(f"Converted first PDF page to image: {len(image_bytes)} bytes")
                except Exception as pdf_err:
                    print(f"PDF conversion error: {pdf_err}")
                    raise Exception(f"Failed to process PDF: {str(pdf_err)}")
            else:
                raise Exception(f"Unsupported file type: {mime_type}")
            
            if not image_bytes:
                raise Exception("Could not process file")
            
            # 4. Initial extraction with specialized template prompt
            try:
                print("Sending template extraction request to Gemini API...")
                
                # Properly create and prepare the PIL image object
                img = Image.open(io.BytesIO(image_bytes))
                
                # Ensure the image is in a compatible format (RGB)
                if img.mode not in ['RGB', 'L']:
                    img = img.convert('RGB')
                
                # Create specialized template prompt
                initial_prompt = self.create_template_extraction_prompt(placeholder_json, active_groups)
                
                initial_response = self.gemini.generate_content(
                    contents=[initial_prompt, img],
                    generation_config={
                        "temperature": 0.1,  # Consistent with reference code
                        "max_output_tokens": 15000,  # Reduced from 8192 to match reference proven approach
                    }
                )
                
                # Get text response
                initial_response_text = initial_response.text
                print(f"Received initial response of length {len(initial_response_text)}")
                print(f"Initial response: {initial_response_text}")
                # Try to extract JSON from the response
                raw_extracted = self.extract_json_from_text(initial_response_text)
                if not raw_extracted:
                    print("Failed to extract JSON from initial response")
                    print(f"Response preview: {initial_response_text[:200]}...")
                    return {
                        "template_id": template_id,
                        "error": "Could not extract valid JSON from Gemini initial response",
                        "raw_response": initial_response_text[:500] + "..." if len(initial_response_text) > 500 else initial_response_text,
                        "extracted_ocr": {},
                        "missing_value_keys": placeholder_json
                    }
                
                # 5. Refinement pass to clean up the data
                try:
                    refine_prompt = self.create_refinement_prompt(raw_extracted, placeholder_json, active_groups)
                    
                    refine_response = self.gemini.generate_content(
                        contents=refine_prompt,
                        generation_config={
                            "temperature": 0.15,  # Consistent refinement temperature
                            "max_output_tokens": 15000,  # Reduced to match reference approach
                        }
                    )
                    
                    refine_response_text = refine_response.text
                    print(f"Received refinement response of length {len(refine_response_text)}")
                    
                    # Extract the refined JSON
                    refined_json = self.extract_json_from_text(refine_response_text)
                    if not refined_json:
                        print("Failed to extract JSON from refinement response, using raw extraction")
                        refined_json = raw_extracted
                
                except Exception as refine_err:
                    print(f"Refinement error: {refine_err}, using raw extraction")
                    refined_json = raw_extracted
                
                # Apply specialized field patterns to catch common issues
                print("Applying specialized field patterns...")
                # refined_json = self.apply_specialized_field_patterns(refined_json) # Removed specialized field patterns
                
                # 6. Format the response with placeholders and apply radio button logic
                extracted = {}
                for k in placeholder_json.keys():
                    clean_key = k.strip("{}")
                    field_info = placeholder_json[k]
                    
                    # Get label from field info
                    if isinstance(field_info, dict):
                        label = field_info.get('label', k)
                    else:
                        label = k
                    
                    # Check if value was extracted - try multiple variations
                    extracted_value = ""
                    if clean_key in refined_json and refined_json[clean_key]:
                        extracted_value = refined_json[clean_key]
                    else:
                        # Try alternative field name variations
                        alternatives = [
                            clean_key.lower(),
                            clean_key.upper(),
                            clean_key.replace("_", ""),
                            clean_key.replace("/", "_"),
                            clean_key.replace("-", "_"),
                        ]
                        for alt_key in alternatives:
                            if alt_key in refined_json and refined_json[alt_key]:
                                extracted_value = refined_json[alt_key]
                                break
                    
                    if extracted_value:
                        extracted[k] = {
                            "label": label,
                            "value": str(extracted_value).strip()
                        }
                
                # Format missing fields with label and empty value
                missing = {}
                for k in placeholder_json.keys():
                    if k not in extracted:
                        field_info = placeholder_json[k]
                        if isinstance(field_info, dict):
                            label = field_info.get('label', k)
                        else:
                            label = k
                        
                        missing[k] = {
                            "label": label,
                            "value": ""
                        }
                
                # Check if we need a second pass (50% or more fields missing)
                total_fields = len(placeholder_json)
                missing_count = len(missing)
                missing_percentage = (missing_count / total_fields) * 100 if total_fields > 0 else 0
                
                print(f"Initial extraction: {len(extracted)} extracted, {missing_count} missing ({missing_percentage:.1f}%)")
                
                # SECOND PASS: If 50% or more fields are missing, do focused extraction
                if missing_percentage >= 50.0 and missing_count > 0:
                    print(f"🔄 SECOND PASS TRIGGERED - {missing_percentage:.1f}% fields missing, focusing on missed fields...")
                    
                    # Check if we have many bottom section fields missing - use emergency prompt
                    # bottom_section_patterns = ['cob_', 'informant_', 'receive_by_', 'prepared_by_', 'date_place_marriage'] # Removed birth certificate specific patterns
                    # bottom_missing = {k: v for k, v in missing.items() 
                    #                 if any(pattern in k.strip("{}") for pattern in bottom_section_patterns)}
                    
                    # if len(bottom_missing) >= 3:  # If 3+ bottom section fields missing, use emergency prompt
                    #     print(f"🚨 EMERGENCY BOTTOM SECTION EXTRACTION - {len(bottom_missing)} bottom fields clearly visible but missed!")
                    #     focused_prompt = self.create_bottom_section_emergency_prompt(bottom_missing)
                    # else:
                    focused_prompt = self.create_focused_missing_fields_prompt(missing, extracted, active_groups)
                    
                    try:
                        # Second extraction pass with higher temperature for creativity
                        second_response = self.gemini.generate_content(
                            contents=[focused_prompt, img],
                            generation_config={
                                "temperature": 0.15,  # Higher temperature for more creativity
                                "max_output_tokens": 15000,  # Smaller output for focused extraction
                            }
                        )
                        
                        second_response_text = second_response.text
                        print(f"Second pass response length: {len(second_response_text)}")
                        print(f"Second pass response: {second_response_text}")
                        
                        # Extract JSON from second response
                        second_extracted = self.extract_json_from_text(second_response_text)
                        if second_extracted:
                            print(f"Second pass found {len(second_extracted)} additional fields")
                            
                            # Merge second pass results into main extraction
                            for field_key, value in second_extracted.items():
                                # Add curly braces back to match template format
                                template_key = f"{{{field_key}}}"
                                if template_key in missing and value and str(value).strip():
                                    # Move from missing to extracted
                                    field_info = missing[template_key]
                                    extracted[template_key] = {
                                        "label": field_info["label"],
                                        "value": str(value).strip()
                                    }
                                    # Remove from missing
                                    del missing[template_key]
                                    print(f"✅ Second pass found: {field_key} = {value}")
                        else:
                            print("⚠️ Second pass failed to extract valid JSON")
                    
                    except Exception as second_pass_err:
                        print(f"⚠️ Second pass error: {second_pass_err}, continuing with initial results")
                

                # Apply radio button logic to clean up missing fields
                extracted, missing = self.apply_radio_button_logic(extracted, missing, active_groups)
                
                print(f"Final extraction: {len(extracted)} extracted, {len(missing)} missing ({(len(missing)/total_fields)*100:.1f}%)")
                
                # Print missing fields for debugging - detailed analysis
                if missing:
                    print("=== MISSING FIELDS ANALYSIS ===")
                    missing_keys = list(missing.keys())
                    print(f"Missing field keys ({len(missing_keys)}): {missing_keys}")
                    
                    # Show detailed missing fields with their labels and categories
                    for i, (key, field_info) in enumerate(list(missing.items())[:15]):  # Show first 15
                        label = field_info.get('label', key)
                        # Find which category this field belongs to
                        category = "field"  # Generic category since we removed hardcoded categories
                        print(f"  {key}: {label} ({category})")
                    
                    if len(missing) > 15:
                        print(f"  ... and {len(missing) - 15} more missing fields")
                    
                    # Analyze missing fields by simple patterns instead of categories
                    missing_by_type = {"checkbox": 0, "text": 0, "number": 0, "address": 0, "name": 0, "other": 0}
                    for key, field_info in missing.items():
                        label = field_info.get('label', '').lower() if isinstance(field_info, dict) else ''
                        description = field_info.get('description', '').lower() if isinstance(field_info, dict) else ''
                        
                        if 'checkbox' in description:
                            missing_by_type["checkbox"] += 1
                        elif 'name' in label:
                            missing_by_type["name"] += 1
                        elif 'address' in label or 'residence' in label:
                            missing_by_type["address"] += 1
                        elif any(num_word in label for num_word in ['age', 'year', 'day', 'number', 'box']):
                            missing_by_type["number"] += 1
                        elif len(label) > 0:
                            missing_by_type["text"] += 1
                        else:
                            missing_by_type["other"] += 1
                    
                    print("Missing fields by type:")
                    for field_type, count in missing_by_type.items():
                        if count > 0:
                            print(f"  {field_type.title()}: {count} fields")
                else:
                    print("🎉 ALL FIELDS EXTRACTED SUCCESSFULLY!")
                
                # 7. Create styled outputs
                styled_pdf = self.create_styled_pdf_from_extracted_data(template_data["info_json"], extracted)
                styled_json = self.create_styled_json_from_extracted_data(template_data["info_json"], extracted)
                
                return {
                    "template_id": template_id,
                    "doc_type": template_data.get("doc_type", ""),
                    "variation": template_data.get("variation", ""),
                    "extracted_ocr": extracted,
                    "missing_value_keys": missing,
                    "styled_pdf": styled_pdf,
                    "styled_json": styled_json,
                    "success": True
                }
            
            except Exception as e:
                print(f"Gemini API error: {e}")
                traceback.print_exc()
                return {
                    "template_id": template_id,
                    "error": f"Error processing with Gemini: {str(e)}",
                    "extracted_ocr": {},
                    "missing_value_keys": placeholder_json,
                    "success": False
                }
        
        except Exception as e:
            print(f"Extraction error: {e}")
            traceback.print_exc()
            raise Exception(f"Error during extraction: {str(e)}")

    async def extract_values_and_apply_to_pdf_template(
        self,
        template_id: str,
        file_content: bytes,
        mime_type: str,
        template_pdf_bytes: bytes
    ) -> Dict[str, Any]:
        """
        Extract values from document and apply them to a PDF template.
        
        Args:
            template_id: Template ID for field definitions
            file_content: Source document to extract from
            mime_type: MIME type of source document
            template_pdf_bytes: PDF template to apply extracted text to
            
        Returns:
            Dictionary with extraction results and styled PDF
        """
        # First, extract the data using the existing method
        extraction_result = await self.extract_values_from_document_with_template(
            template_id=template_id,
            file_content=file_content,
            mime_type=mime_type
        )
        
        if not extraction_result.get("success", False):
            return extraction_result
        
        # Get template data for fillable text info
        try:
            tpl_response = supabase.table("templates").select("*").eq("id", template_id).single().execute()
            if not tpl_response.data:
                raise Exception(f"Template not found with ID: {template_id}")
            
            template_data = tpl_response.data
            fillable_text_info = template_data["info_json"].get("fillable_text_info", [])
            
        except Exception as e:
            return {
                "template_id": template_id,
                "error": f"Error fetching template data: {str(e)}",
                "success": False
            }
        
        # Apply extracted data to the PDF template
        try:
            styled_pdf = self.create_styled_pdf_with_template(
                template_pdf_bytes=template_pdf_bytes,
                extracted_data=extraction_result["extracted_ocr"],
                fillable_text_info=fillable_text_info
            )
            
            # Update the result with the new PDF
            extraction_result["styled_pdf"] = styled_pdf
            extraction_result["template_pdf_applied"] = True
            
            return extraction_result
            
        except Exception as e:
            extraction_result["pdf_template_error"] = str(e)
            return extraction_result


# Singleton instance
template_ocr_service = TemplateOCRService()


# Convenience functions for use in routers
async def process_document_with_template(
    template_id: str,
    file_content: bytes,
    mime_type: str
) -> Dict[str, Any]:
    """
    Process a document using template-based OCR extraction.
    
    Args:
        template_id: Template ID to get required fields from database
        file_content: Document file content as bytes
        mime_type: MIME type of the document
    
    Returns:
        Dictionary containing extracted values, missing fields, and styled data
    """
    return await template_ocr_service.extract_values_from_document_with_template(
        template_id=template_id,
        file_content=file_content,
        mime_type=mime_type
    )


def create_styled_pdf_from_template_data(template_data: Dict[str, Any], 
                                       extracted_data: Dict[str, Any]) -> bytes:
    """Create a styled PDF with extracted text placed in template positions."""
    return template_ocr_service.create_styled_pdf_from_extracted_data(template_data, extracted_data)


def create_styled_json_from_template_data(template_data: Dict[str, Any], 
                                        extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a styled JSON response from template and extracted data."""
    return template_ocr_service.create_styled_json_from_extracted_data(template_data, extracted_data) 


async def process_document_with_pdf_template(
    template_id: str,
    file_content: bytes,
    mime_type: str,
    template_pdf_bytes: bytes
) -> Dict[str, Any]:
    """
    Process a document using template-based OCR and apply results to a PDF template.
    
    Args:
        template_id: Template ID to get required fields from database
        file_content: Document file content as bytes
        mime_type: MIME type of the document
        template_pdf_bytes: PDF template to overlay extracted text on
    
    Returns:
        Dictionary containing extracted values and styled PDF with template
    """
    return await template_ocr_service.extract_values_and_apply_to_pdf_template(
        template_id=template_id,
        file_content=file_content,
        mime_type=mime_type,
        template_pdf_bytes=template_pdf_bytes
    ) 