import json
from google.cloud import documentai_v1 as documentai
import os
from dotenv import load_dotenv

load_dotenv()

def process_with_document_ai(file_path):
    # 🛠️ CONFIGURATION
    project_id = os.getenv("GOOGLE_PROJECT_ID")
    location = "us"  # Or your processor location
    processor_id = os.getenv("GOOGLE_DOCUMENT_AI_PROCESSOR_ID")
    file_path = "C:/Users/Andrei/Desktop/Greystack/SocMedOCR/wally-soc-med/backend/playground/test_images/test2.pdf"

    # 🧠 Setup Document AI Client
    client = documentai.DocumentProcessorServiceClient()
    processor_name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"

    # 📄 Read PDF content
    with open(file_path, "rb") as f:
        raw_document = documentai.RawDocument(content=f.read(), mime_type="application/pdf")

    # 🚀 Send to Document AI
    request = documentai.ProcessRequest(name=processor_name, raw_document=raw_document)
    result = client.process_document(request=request)
    document = result.document

    # 🧩 Extract entities and their layout
    layout_json = {
        "entities": [],
        "text": document.text  # Store full document text for reference
    }

    for entity in document.entities:
        # Get the text segments for this entity
        text_segments = entity.text_anchor.text_segments
        entity_text = ""
        for segment in text_segments:
            start = int(segment.start_index)
            end = int(segment.end_index)
            entity_text += document.text[start:end]
        
        # Get bounding box if available
        bounding_poly = None
        if entity.page_anchor and entity.page_anchor.page_refs:
            page_ref = entity.page_anchor.page_refs[0]
            if hasattr(page_ref, 'bounding_poly') and page_ref.bounding_poly:
                vertices = page_ref.bounding_poly.normalized_vertices
                if len(vertices) >= 4:  # Make sure we have all corners
                    bounding_poly = {
                        "vertices": [
                            {"x": float(vertices[0].x), "y": float(vertices[0].y)},  # top-left
                            {"x": float(vertices[1].x), "y": float(vertices[1].y)},  # top-right
                            {"x": float(vertices[2].x), "y": float(vertices[2].y)},  # bottom-right
                            {"x": float(vertices[3].x), "y": float(vertices[3].y)}   # bottom-left
                        ]
                    }

        # Add entity to our JSON
        entity_data = {
            "type": entity.type_,  # The entity type (e.g., "person", "address", etc.)
            "text": entity_text.strip(),
            "confidence": float(entity.confidence),
            "bounding_poly": bounding_poly,
            "id": entity.id if hasattr(entity, 'id') else None,
            "normalized_value": None
        }

        # Add normalized value if available
        if hasattr(entity, 'normalized_value') and entity.normalized_value:
            if hasattr(entity.normalized_value, 'datetime_value'):
                datetime_val = entity.normalized_value.datetime_value
                entity_data["normalized_value"] = {
                    "datetime": {
                        "month": datetime_val.month if hasattr(datetime_val, 'month') else None,
                        "day": datetime_val.day if hasattr(datetime_val, 'day') else None,
                        "hours": datetime_val.hours if hasattr(datetime_val, 'hours') else None,
                        "minutes": datetime_val.minutes if hasattr(datetime_val, 'minutes') else None
                    }
                }
            else:
                entity_data["normalized_value"] = entity.normalized_value.text

        # Add properties if available
        if hasattr(entity, 'properties') and entity.properties:
            entity_data["properties"] = [{
                "type": prop.type_,
                "text": document.text[prop.text_anchor.text_segments[0].start_index:prop.text_anchor.text_segments[0].end_index].strip(),
                "normalized_value": prop.normalized_value.text if prop.normalized_value else None
            } for prop in entity.properties]
        else:
            entity_data["properties"] = []

        layout_json["entities"].append(entity_data)

    # 📝 Save to layout.json
    with open("layout.json", "w", encoding='utf-8') as f:
        json.dump(layout_json, f, indent=2, ensure_ascii=False)

    print("✅ Entity layout exported to layout.json")

    # Print summary of found entities
    entity_types = {}
    for entity in layout_json["entities"]:
        entity_type = entity["type"]
        entity_types[entity_type] = entity_types.get(entity_type, 0) + 1

    print("\n📊 Entity Summary:")
    for entity_type, count in entity_types.items():
        print(f"- {entity_type}: {count} found")


process_with_document_ai("C:/Users/Andrei/Desktop/Greystack/SocMedOCR/wally-soc-med/backend/playground/test_images/test2.pdf")