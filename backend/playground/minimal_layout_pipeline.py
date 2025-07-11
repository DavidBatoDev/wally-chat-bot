import os
import json
from pathlib import Path
import fitz  # PyMuPDF for merging
from file_converter import convert_to_pdf
from layout_analyzer import analyze_layout_with_llm, apply_fallback_styling
from generate_styled_pdf import generate_styled_pdf
from google.cloud import documentai_v1 as documentai
from dotenv import load_dotenv

load_dotenv()

def minimal_layout_pipeline(input_file_path, output_dir="output", use_llm=True):
    """
    Complete pipeline to transform any document to minimal layout, with multi-page support.
    
    Steps:
    1. Convert input file to PDF if needed
    2. Process with Google Document AI
    3. For each page:
        a. Extract layout
        b. Analyze layout with LLM for styling
        c. Generate a styled PDF page
    4. Merge all styled pages into a single PDF
    5. Save combined layout information
    """
    
    print(f"\n🚀 Starting minimal layout pipeline for: {input_file_path}")
    
    # Create output directory and a temp subdir for page-specific files
    temp_dir = os.path.join(output_dir, "temp_pages")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Initialize array to store all page layouts
    all_page_layouts = []

    # Step 1: Convert to PDF if needed
    print("\n📄 Step 1: Converting to PDF...")
    pdf_path = convert_to_pdf(input_file_path, os.path.join(output_dir, "temp"))
    
    # Step 2: Process with Document AI
    print("\n🤖 Step 2: Processing with Google Document AI...")
    
    project_id = os.getenv("GOOGLE_PROJECT_ID")
    location = "us"
    processor_id = os.getenv("GOOGLE_DOCUMENT_AI_PROCESSOR_ID")
    
    client = documentai.DocumentProcessorServiceClient()
    processor_name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
    
    with open(pdf_path, "rb") as f:
        raw_document = documentai.RawDocument(content=f.read(), mime_type="application/pdf")
    
    request = documentai.ProcessRequest(name=processor_name, raw_document=raw_document)
    result = client.process_document(request=request)
    document = result.document
    
    print(f"✅ Document AI processing complete. Found {len(document.pages)} pages.")

    # Group entities by page
    page_entities = [[] for _ in document.pages]
    for entity in document.entities:
        if entity.page_anchor and entity.page_anchor.page_refs:
            page_ref = entity.page_anchor.page_refs[0]
            if hasattr(page_ref, 'page'):
                page_index = int(page_ref.page)
                if 0 <= page_index < len(page_entities):
                    page_entities[page_index].append(entity)

    temp_pdf_paths = []
    
    # Step 3: Process each page
    for i, p_entities in enumerate(page_entities):
        page_num = i + 1
        print(f"\n📄 Processing page {page_num}/{len(document.pages)}...")
        
        # Step 3a: Extract page-specific layout
        # Reconstruct the page's text from the main document text using page-level text anchors.
        # The `Page` object does not have a direct `text` attribute.
        page_text = ""
        if (i < len(document.pages) and
                document.pages[i].layout and
                document.pages[i].layout.text_anchor and
                document.pages[i].layout.text_anchor.text_segments):
            for segment in document.pages[i].layout.text_anchor.text_segments:
                start = int(segment.start_index)
                end = int(segment.end_index)
                page_text += document.text[start:end]

        page_layout_json = {
            "entities": [],
            "text": page_text
        }
        
        for entity in p_entities:
            text_segments = entity.text_anchor.text_segments
            entity_text = ""
            for segment in text_segments:
                start = int(segment.start_index)
                end = int(segment.end_index)
                entity_text += document.text[start:end]
            
            bounding_poly = None
            if entity.page_anchor and entity.page_anchor.page_refs:
                page_ref = entity.page_anchor.page_refs[0]
                if hasattr(page_ref, 'bounding_poly') and page_ref.bounding_poly:
                    vertices = page_ref.bounding_poly.normalized_vertices
                    if len(vertices) >= 4:
                        bounding_poly = {
                            "vertices": [
                                {"x": float(v.x), "y": float(v.y)} for v in vertices
                            ]
                        }
            
            entity_data = {
                "type": entity.type_,
                "text": entity_text.strip(),
                "confidence": float(entity.confidence),
                "bounding_poly": bounding_poly,
                "id": entity.id if hasattr(entity, 'id') else None
            }
            page_layout_json["entities"].append(entity_data)
        
        basic_layout_path = os.path.join(temp_dir, f"page_{i}_basic_layout.json")
        with open(basic_layout_path, "w", encoding='utf-8') as f:
            json.dump(page_layout_json, f, indent=2, ensure_ascii=False)
        
        # Step 3b: Analyze layout with LLM or use fallback
        if use_llm:
            print(f"   🎨 Analyzing layout for page {page_num} with LLM...")
            enhanced_layout = analyze_layout_with_llm(basic_layout_path, pdf_path)
        else:
            print("   Skipping LLM analysis, using fallback styling.")
            with open(basic_layout_path, 'r', encoding='utf-8') as f:
                layout_data = json.load(f)
            enhanced_layout = apply_fallback_styling(layout_data)
            
        enhanced_layout_path = os.path.join(temp_dir, f"page_{i}_enhanced_layout.json")
        with open(enhanced_layout_path, "w", encoding='utf-8') as f:
            json.dump(enhanced_layout, f, indent=2, ensure_ascii=False)
            
        # Step 3c: Generate styled PDF for the page
        print(f"   📑 Generating styled PDF for page {page_num}...")
        temp_pdf_path = os.path.join(temp_dir, f"page_{i}_styled.pdf")
        page_layout = generate_styled_pdf(enhanced_layout_path, temp_pdf_path, pdf_path, page_num=i, save_enhanced_layout=False)
        all_page_layouts.append(page_layout)
        temp_pdf_paths.append(temp_pdf_path)

    # Step 4: Merge all styled PDF pages
    print("\n🔗 Step 4: Merging all pages into a single PDF...")
    final_pdf_path = os.path.join(output_dir, "minimal_layout.pdf")
    
    if temp_pdf_paths:
        merged_pdf = fitz.open()
        for temp_pdf in temp_pdf_paths:
            if os.path.exists(temp_pdf):
                merged_pdf.insert_pdf(fitz.open(temp_pdf))
        merged_pdf.save(final_pdf_path)
        merged_pdf.close()
        print(f"✅ Merged {len(temp_pdf_paths)} pages into {final_pdf_path}")
    else:
        print("⚠️ No pages were generated, final PDF is empty.")
        # Create an empty PDF to avoid errors
        fitz.open().save(final_pdf_path)

    # Step 5: Save combined layout information
    print("\n💾 Saving combined layout information...")
    combined_layout = {
        "document_info": {
            "total_pages": len(document.pages),
            "source_file": input_file_path
        },
        "pages": all_page_layouts
    }
    
    layout_json_path = os.path.join(output_dir, "minimal_json_layout.json")
    with open(layout_json_path, 'w', encoding='utf-8') as f:
        json.dump(combined_layout, f, indent=2, ensure_ascii=False)
    print(f"✅ Combined layout information saved to {layout_json_path}")

    # Clean up temporary files
    print("\n🗑️ Cleaning up temporary files...")
    for path in Path(temp_dir).glob("*"):
        try:
            os.remove(path)
        except OSError as e:
            print(f"Error removing file {path}: {e}")
    os.rmdir(temp_dir)
    
    print(f"\n✨ Pipeline complete! Output saved to: {final_pdf_path}")
    
    # Summary
    print("\n📊 Summary:")
    print(f"  - Original file: {input_file_path}")
    print(f"  - Pages processed: {len(document.pages)}")
    print(f"  - Output directory: {output_dir}")
    print(f"  - Final PDF: {final_pdf_path}")
    print(f"  - Layout JSON: {layout_json_path}")
    
    return {
        "success": True,
        "output_pdf": final_pdf_path,
        "output_json": layout_json_path,
        "pages_processed": len(document.pages)
    }

if __name__ == "__main__":
    # Test the pipeline
    import sys
    
    input_file = "test_images/test2.pdf" # Default
    use_llm_flag = True # Default

    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2 and sys.argv[2].lower() in ['false', 'no', '0', 'nollm']:
        use_llm_flag = False
        print("🤖 LLM analysis is DISABLED.")
    
    if os.path.exists(input_file):
        result = minimal_layout_pipeline(input_file, use_llm=use_llm_flag)
    else:
        print(f"❌ Input file not found: {input_file}")
        print("Usage: python minimal_layout_pipeline.py <input_file> [use_llm: false]")
        print("Supported formats: PDF, JPG, PNG, DOCX") 