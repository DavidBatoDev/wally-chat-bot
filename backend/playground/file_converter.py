import os
from pathlib import Path
from PIL import Image
from docx2pdf import convert
import fitz  # PyMuPDF

def convert_to_pdf(input_file_path, output_dir="temp"):
    """
    Convert various file formats to PDF.
    
    Args:
        input_file_path: Path to input file
        output_dir: Directory to save converted PDF
        
    Returns:
        Path to converted PDF file
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get file extension
    file_path = Path(input_file_path)
    file_ext = file_path.suffix.lower()
    file_name = file_path.stem
    
    # Output PDF path
    output_pdf_path = os.path.join(output_dir, f"{file_name}.pdf")
    
    if file_ext == '.pdf':
        # Already PDF, just return the path
        return input_file_path
    
    elif file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
        # Convert image to PDF
        print(f"Converting image {input_file_path} to PDF...")
        image = Image.open(input_file_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Save as PDF
        image.save(output_pdf_path, 'PDF', resolution=100.0)
        print(f"✅ Image converted to PDF: {output_pdf_path}")
        return output_pdf_path
    
    elif file_ext in ['.docx', '.doc']:
        # Convert Word document to PDF
        print(f"Converting Word document {input_file_path} to PDF...")
        try:
            convert(input_file_path, output_pdf_path)
            print(f"✅ Word document converted to PDF: {output_pdf_path}")
            return output_pdf_path
        except Exception as e:
            print(f"Error converting Word document: {e}")
            # Alternative method using python-docx and reportlab
            return convert_docx_alternative(input_file_path, output_pdf_path)
    
    else:
        raise ValueError(f"Unsupported file format: {file_ext}")

def convert_docx_alternative(docx_path, output_pdf_path):
    """Alternative method to convert DOCX to PDF using python-docx."""
    try:
        from docx import Document
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import simpleSplit
        
        doc = Document(docx_path)
        c = canvas.Canvas(output_pdf_path, pagesize=letter)
        
        width, height = letter
        y_position = height - 50
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                # Simple text wrapping
                lines = simpleSplit(paragraph.text, 'Helvetica', 12, width - 100)
                for line in lines:
                    if y_position < 50:  # New page if needed
                        c.showPage()
                        y_position = height - 50
                    c.drawString(50, y_position, line)
                    y_position -= 15
                y_position -= 10  # Extra space between paragraphs
        
        c.save()
        print(f"✅ Word document converted to PDF (alternative method): {output_pdf_path}")
        return output_pdf_path
    except Exception as e:
        print(f"Alternative conversion also failed: {e}")
        raise

if __name__ == "__main__":
    # Test conversion
    test_file = "test_image.png"  # Change this to test different formats
    if os.path.exists(test_file):
        pdf_path = convert_to_pdf(test_file)
        print(f"Converted PDF saved at: {pdf_path}")
    else:
        print(f"Test file {test_file} not found") 