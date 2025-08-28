from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response, Form, Query
from fastapi.responses import JSONResponse
from typing import List, Union, Dict, Any, Optional
from db.supabase_client import supabase, db_service
from models.project import Project, ProjectCreate
from models.template_ocr import TemplateOCRResponse, TemplateOCRError
from dependencies.auth import get_current_user
from gotrue.types import User
import uuid
from datetime import datetime
from google.cloud import documentai_v1 as documentai
from services.ocr_service import process_document_for_layout, create_styled_json_from_layout, convert_image_to_pdf
from services.template_ocr_service import process_document_with_template, process_document_with_pdf_template
from services.project_service import get_project_service
import base64
import io
import traceback
import logging
from core.config import settings
from pydantic import BaseModel, Field

date_now = datetime.now().isoformat()
logger = logging.getLogger(__name__)
router = APIRouter()
project_service = get_project_service()

# Pydantic models for project CRUD (aligned with project_state router)
class ProjectStateCreate(BaseModel):
    """Model for creating a new project state."""
    client_name: str
    desired_language: str
    source_language: str
    deadline: datetime
    delivery_date: datetime
    description: Optional[str] = Field(None, description="Project description")
    project_data: Dict[str, Any] = Field(..., description="Complete project state data")
    tags: Optional[List[str]] = Field(default_factory=list, description="Project tags")
    is_public: Optional[bool] = Field(False, description="Whether project is public")

class ProjectStateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    project_data: Dict[str, Any] = Field(..., description="Updated project state data")
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    local_version: Optional[int] = Field(None, description="Local version for sync")

class ProjectStateResponse(BaseModel):
    """Model for project state response."""
    id: str
    name: str
    project_code: Optional[str] = None
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str
    project_data: Dict[str, Any]
    current_page: int
    num_pages: int
    current_workflow_step: str
    source_language: str
    desired_language: str
    tags: List[str]
    is_public: bool
    sync_status: str
    local_version: int
    server_version: int

class ProjectSummaryResponse(BaseModel):
    """Model for project summary (list view)."""
    id: str
    name: str
    project_code: Optional[str] = None
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    current_page: int
    num_pages: int
    current_workflow_step: str
    current_project_step: Optional[str] = None
    source_language: str
    desired_language: str
    tags: List[str]
    is_public: bool
    sync_status: str
    server_version: int
    # Metadata from JSONB
    document_url: Optional[str]
    file_type: Optional[str]
    text_boxes_count: int
    images_count: int

@router.post("/", response_model=ProjectStateResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectStateCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project state.
    This replaces saving to localStorage with database persistence.
    """

    if current_user["role"] != "project_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to create a project"
        )

    try:
        # Generating project code
        project_code = db_service.generate_project_code()
        if not project_code:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate project code")
        
        # Build persisted project_data from request
        project_data = project.project_data.copy()
        project_data.update({
            'name': project_code,
            'project_code': project_code,
            'description': project.description,
            'tags': project.tags,
            'isPublic': project.is_public,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat(),
        })

        # Ensure initial backend step is text_ocr for tracking across sessions
        project_data['currentProjectStep'] = 'text_ocr'
        result = project_service.create_project(current_user["id"], project_data)
        return ProjectStateResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create project: {str(e)}")

# Get projects endpoint from project_state
@router.get("/", response_model=List[ProjectSummaryResponse])
async def get_projects(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of projects to return"),
    offset: int = Query(0, ge=0, description="Number of projects to skip"),
    current_user: User = Depends(get_current_user)
):
    """
    List user's project states.
    This replaces getting saved projects from localStorage.
    """
    try:
        projects = project_service.list_user_projects(current_user["id"], limit, offset)
        return projects
        
    except Exception as e:
        logger.error(f"Error listing project states: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list projects: {str(e)}"
        )

@router.get("/{project_id}", response_model=ProjectStateResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project state by ID.
    This replaces loading from localStorage.
    """
    try:
        project = project_service.get_project(project_id, current_user["id"]) 
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        return ProjectStateResponse(**project)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project state {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get project: {str(e)}"
        )

@router.put("/{project_id}", response_model=ProjectStateResponse)
async def update_project(
    project_id: str,
    project_update: ProjectStateUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing project's JSONB state and metadata."""
    try:
        project_data = project_update.project_data.copy()
        if project_update.name:
            project_data['name'] = project_update.name
        if project_update.description is not None:
            project_data['description'] = project_update.description
        if project_update.tags is not None:
            project_data['tags'] = project_update.tags
        if project_update.is_public is not None:
            project_data['isPublic'] = project_update.is_public
        if project_update.local_version is not None:
            project_data['localVersion'] = project_update.local_version
        project_data['updatedAt'] = datetime.utcnow().isoformat()

        result = project_service.update_project(project_id, current_user["id"], project_data)
        return ProjectStateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update project: {str(e)}")

# Delete project endpoint
@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project.
    """
    try:
        result = project_service.delete_project(project_id, current_user["id"])
        
        return {"success": result, "message": "Project deleted successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )



@router.post("/{project_id}/files", response_model=Project)
async def upload_project_file(project_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        user_id = current_user["id"]
        # First verify project ownership
        project_response = supabase.table('projects').select('*').eq('id', str(project_id)).eq('created_by', str(current_user["id"])).single().execute()
        if project_response.data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or access denied")

        project = project_response.data
        
        # Read file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
        
        # Create a unique file name
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        # Create the full path in the storage bucket
        storage_path = f"{str(user_id)}/{str(project_id)}/{unique_filename}"
        
        try:
            # Upload to storage bucket
            storage_response = supabase.storage \
                .from_('project-uploads') \
                .upload(
                    path=storage_path,
                    file=file_content,
                    file_options={"content-type": file.content_type}
                )
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Storage upload failed: {storage_response.error.message}"
                )
            
            # Get the public URL for the uploaded file
            file_url = supabase.storage.from_('pdfs').get_public_url(storage_path)
            
            # Update project's files array
            current_files = project.get('files', []) or []
            current_files.append(file_url)
            
            # Update the project record
            update_response = supabase.table('projects') \
                .update({'files': current_files}) \
                .eq('id', str(project_id)) \
                .execute()
            
            if not update_response.data:
                # If update fails, try to clean up the uploaded file
                try:
                    supabase.storage.from_('pdfs').remove([storage_path])
                except:
                    pass  # Best effort cleanup
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update project with new file"
                )
            
            return update_response.data[0]
            
        except Exception as storage_error:
            print(f"Storage error details: {str(storage_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage operation failed: {str(storage_error)}"
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Unexpected error details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        # Reset file pointer if needed
        await file.seek(0) 

@router.post("/process-file")
async def process_file_ocr(
    file: UploadFile = File(...),
    frontend_page_width: str = Form(None),
    frontend_page_height: str = Form(None),
    frontend_scale: str = Form(None),
):
    """
    Process a file through OCR and return both the layout JSON and styled PDF.
    Returns the raw layout data, styled JSON layout for frontend, and PDF content as base64.
    """
    print("=== BACKEND PROCESS-FILE DEBUG ===")
    print(f"Request received for file: {file.filename}")
    print(f"File content type: {file.content_type}")
    print(f"File size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    # Parse frontend dimensions if provided
    parsed_frontend_width = None
    parsed_frontend_height = None
    parsed_frontend_scale = None
    
    if frontend_page_width:
        try:
            parsed_frontend_width = float(frontend_page_width)
            print(f"Frontend page width: {parsed_frontend_width}")
        except ValueError:
            print(f"Warning: Invalid frontend_page_width: {frontend_page_width}")
    
    if frontend_page_height:
        try:
            parsed_frontend_height = float(frontend_page_height)
            print(f"Frontend page height: {parsed_frontend_height}")
        except ValueError:
            print(f"Warning: Invalid frontend_page_height: {frontend_page_height}")
    
    if frontend_scale:
        try:
            parsed_frontend_scale = float(frontend_scale)
            print(f"Frontend scale: {parsed_frontend_scale}")
        except ValueError:
            print(f"Warning: Invalid frontend_scale: {frontend_scale}")
    
    print(f"Parsed frontend dimensions: width={parsed_frontend_width}, height={parsed_frontend_height}, scale={parsed_frontend_scale}")
    
    try:
        # Read the file content
        print("Reading file content...")
        file_content = await file.read()
        print(f"Read file content size: {len(file_content)} bytes")

        # --- DEBUG: Save uploaded image to disk ---
        import os
        debug_dir = "debug_uploaded_images"
        os.makedirs(debug_dir, exist_ok=True)
        debug_path = os.path.join(debug_dir, file.filename)
        with open(debug_path, "wb") as f:
            f.write(file_content)
        print(f"Saved uploaded image for debugging: {debug_path}")
        # --- END DEBUG ---
        
        if not file_content:
            print("ERROR: Empty file content")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

        # Determine MIME type
        mime_type = file.content_type
        if not mime_type:
            if file.filename.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            else:
                mime_type = 'application/octet-stream'
        
        print(f"Determined MIME type: {mime_type}")

        # Process with Document AI and get layout only (skip PDF generation)
        print("Calling process_document_for_layout...")
        try:
            # First convert to PDF if needed and get Document AI document
            if mime_type.startswith('image/'):
                print("Converting image to PDF...")
                try:
                    file_content = convert_image_to_pdf(file_content)
                    mime_type = 'application/pdf'
                    print(f"Image converted to PDF, new content size: {len(file_content)} bytes")
                except Exception as convert_error:
                    print(f"ERROR converting image to PDF: {str(convert_error)}")
                    print(f"Convert error traceback: {traceback.format_exc()}")
                    raise convert_error
            
            # Process with Document AI
            print("Setting up Document AI client...")
            project_id = settings.GOOGLE_PROJECT_ID
            location = settings.GOOGLE_DOCUMENT_AI_LOCATION
            processor_id = settings.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
            
            print(f"Project ID: {project_id}")
            print(f"Location: {location}")
            print(f"Processor ID: {processor_id}")
            
            if not all([project_id, processor_id]):
                error_msg = "Google Cloud project ID and processor ID must be set in environment variables."
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)

            print("Creating Document AI client...")
            try:
                client = documentai.DocumentProcessorServiceClient()
                print("Document AI client created successfully")
            except Exception as client_error:
                print(f"ERROR creating Document AI client: {str(client_error)}")
                print(f"Client error traceback: {traceback.format_exc()}")
                raise client_error
            
            processor_name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
            print(f"Processor name: {processor_name}")
        
            raw_document = documentai.RawDocument(content=file_content, mime_type=mime_type)
            request = documentai.ProcessRequest(name=processor_name, raw_document=raw_document)
        
            print("Calling Document AI...")
            try:
                result = client.process_document(request=request)
                document = result.document
                print("Document AI call successful")
            except Exception as e:
                print(f"ERROR calling Document AI: {str(e)}")
                print(f"Document AI error traceback: {traceback.format_exc()}")
                raise e
            
            # Now call process_document_for_layout with the document and frontend dimensions
            layout_data = process_document_for_layout(
                document=document,
                frontend_page_width=parsed_frontend_width,
                frontend_page_height=parsed_frontend_height,
                frontend_scale=parsed_frontend_scale
            )
            print(f"process_document_for_layout completed successfully")
            print(f"Layout data keys: {list(layout_data.keys()) if layout_data else 'None'}")
        except Exception as layout_error:
            print(f"ERROR in process_document_for_layout call: {str(layout_error)}")
            print(f"Layout error traceback: {traceback.format_exc()}")
            raise layout_error
        
        # Generate styled JSON for frontend (skip PDF generation)
        print("Calling create_styled_json_from_layout...")
        try:
            styled_json = create_styled_json_from_layout(layout_data)
            print(f"create_styled_json_from_layout completed successfully")
            print(f"Styled JSON keys: {list(styled_json.keys()) if styled_json else 'None'}")
        except Exception as json_error:
            print(f"ERROR in create_styled_json_from_layout call: {str(json_error)}")
            print(f"JSON error traceback: {traceback.format_exc()}")
            raise json_error
        
        # Return only the styled JSON layout (no PDF needed for frontend)
        response_data = {
            "styled_layout": styled_json,
        }
        print(f"Returning response with styled_layout keys: {list(styled_json.keys()) if styled_json else 'None'}")
        print("=== BACKEND PROCESS-FILE SUCCESS ===")
        
        return JSONResponse(response_data)
        
    except Exception as e:
        print("=== BACKEND PROCESS-FILE ERROR ===")
        print(f"ERROR in process_file_ocr: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )
    finally:
        await file.seek(0)  # Reset file pointer

@router.post("/process-file/download")
async def process_file_ocr_download(file: UploadFile = File(...)):
    """
    Process a file through OCR and return the styled PDF as a downloadable file.
    """
    try:
        # Read the file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

        # Determine MIME type
        mime_type = file.content_type
        if not mime_type:
            if file.filename.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            else:
                mime_type = 'application/octet-stream'

        # # Process with Document AI and get layout and PDF
        # pdf_bytes, _, _ = process_document(file_content, mime_type)
        
        # Generate output filename
        output_filename = f"processed_{file.filename.rsplit('.', 1)[0]}.pdf"
        
        # Return PDF as downloadable file
        return Response(
            # content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"'
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )
    finally:
        await file.seek(0)  # Reset file pointer 


@router.post("/template-ocr/{template_id}")
async def process_file_with_template_ocr(
    template_id: str,
    file: UploadFile = File(...)
):
    """
    Process a file through template-based OCR using Gemini AI.
    Returns JSON with extracted data and styled layout information.
    """
    try:
        # Read the file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

        # Determine MIME type
        mime_type = file.content_type
        if not mime_type:
            if file.filename and file.filename.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            elif file.filename and file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            else:
                mime_type = 'application/octet-stream'

        print(f"Processing file with template {template_id}, MIME type: {mime_type}")

        # Process with template-based OCR service
        result = await process_document_with_template(
            template_id=template_id,
            file_content=file_content,
            mime_type=mime_type
        )

        print("OCR finished")

        # Check if processing was successful
        if not result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Template OCR processing failed")
            )

        # Return the complete result including styled JSON
        return {
            "template_id": result["template_id"],
            "doc_type": result["doc_type"],
            "variation": result["variation"],
            "extracted_data": result["extracted_ocr"],
            "missing_fields": result["missing_value_keys"],
            "styled_layout": result["styled_json"],
            "success": True
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Template OCR processing error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file with template: {str(e)}"
        )
    finally:
        await file.seek(0)  # Reset file pointer



@router.post("/template-ocr/{template_id}/pdf-template")
async def process_file_with_pdf_template_ocr(
    template_id: str,
    document_file: UploadFile = File(..., description="Document to extract data from"),
    template_pdf: UploadFile = File(..., description="PDF template to apply extracted text to")
):
    """
    Process a document through template-based OCR and apply extracted text to a PDF template.
    
    This endpoint takes two files:
    1. document_file: The source document to extract data from (PDF, PNG, JPG, JPEG)
    2. template_pdf: The PDF template to overlay the extracted text onto
    
    Returns a PDF with extracted text placed on the template.
    """
    try:
        # Read both files
        document_content = await document_file.read()
        template_pdf_content = await template_pdf.read()
        
        if not document_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty document file")
        
        if not template_pdf_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty template PDF file")
        
        # Validate template PDF
        if not template_pdf.content_type or template_pdf.content_type != 'application/pdf':
            if not (template_pdf.filename and template_pdf.filename.lower().endswith('.pdf')):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Template file must be a PDF"
                )

        # Determine document MIME type
        document_mime_type = document_file.content_type
        if not document_mime_type:
            if document_file.filename and document_file.filename.lower().endswith('.pdf'):
                document_mime_type = 'application/pdf'
            elif document_file.filename and document_file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                document_mime_type = 'image/jpeg'
            else:
                document_mime_type = 'application/octet-stream'

        print(f"Processing document with template {template_id} using PDF template")
        print(f"Document MIME type: {document_mime_type}")

        # Process with template-based OCR service using PDF template
        result = await process_document_with_pdf_template(
            template_id=template_id,
            file_content=document_content,
            mime_type=document_mime_type,
            template_pdf_bytes=template_pdf_content
        )

        # Check if processing was successful
        if not result.get("success", False):
            error_msg = result.get("error", "Template OCR processing failed")
            if "pdf_template_error" in result:
                error_msg += f" PDF Template Error: {result['pdf_template_error']}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )

        # Get the styled PDF with template
        styled_pdf = result.get("styled_pdf")
        if not styled_pdf:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate styled PDF with template"
            )

        # Generate output filename
        doc_base_name = document_file.filename.rsplit('.', 1)[0] if document_file.filename else "processed_document"
        template_base_name = template_pdf.filename.rsplit('.', 1)[0] if template_pdf.filename else "template"
        output_filename = f"ocr_{doc_base_name}_on_{template_base_name}.pdf"
        
        # Return PDF as downloadable file
        return Response(
            content=styled_pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"PDF Template OCR processing error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process files with PDF template: {str(e)}"
        )
    finally:
        await document_file.seek(0)
        await template_pdf.seek(0)

# New Workflow Step 1 Endpoints

@router.post("/template-detection")
async def detect_document_template(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Detect document template from uploaded file.
    Performs initial OCR to identify template type and language.
    """
    try:
        # Read the file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

        # Store the file temporarily for processing
        temp_file_path = f"/tmp/{file.filename}"
        with open(temp_file_path, "wb") as temp_file:
            temp_file.write(file_content)

        # Use the existing process_file OCR service for template detection
        from services.ocr_service import process_file, OCRError
        
        try:
            # Call the existing OCR service
            ocr_result = await process_file(
                file_content=file_content,
                filename=file.filename,
                page_number=1,
                frontend_page_width=595,  # A4 default
                frontend_page_height=842,  # A4 default
                frontend_scale=1.0
            )
            
            # Extract template information from OCR result
            detected_template = None
            detected_language = "English"  # Default
            confidence = 0.0
            doc_type = "general"
            
            # Try to match with existing templates based on OCR results
            if ocr_result and 'layout' in ocr_result:
                try:
                    templates = db_service.get_records('templates', limit=20)
                    
                    # Analyze OCR structure to match templates
                    if templates:
                        # Simple template matching based on number of entities and layout
                        layout = ocr_result.get('layout', {})
                        pages = layout.get('pages', [])
                        
                        if pages:
                            entities = pages[0].get('entities', [])
                            entity_count = len(entities)
                            
                            # Match based on entity count and document structure
                            best_match = None
                            best_score = 0.0
                            
                            for template in templates:
                                template_info = template.get('info_json', {})
                                expected_fields = len(template_info.get('fields', []))
                                
                                # Score based on similarity of field count
                                if expected_fields > 0:
                                    score = min(entity_count, expected_fields) / max(entity_count, expected_fields)
                                    if score > best_score:
                                        best_score = score
                                        best_match = template
                            
                            if best_match and best_score > 0.3:
                                detected_template = best_match
                                confidence = best_score
                                doc_type = detected_template.get('doc_type', 'general')
                    
                    # Language detection from OCR text
                    if pages and pages[0].get('entities'):
                        # Extract sample text for language detection
                        sample_texts = []
                        for entity in pages[0]['entities'][:5]:  # First 5 entities
                            if entity.get('text'):
                                sample_texts.append(entity['text'])
                        
                        if sample_texts:
                            combined_text = ' '.join(sample_texts).lower()
                            # Simple language detection based on common words
                            if any(word in combined_text for word in ['el', 'la', 'de', 'y', 'es', 'en', 'un', 'una']):
                                detected_language = "Spanish"
                            elif any(word in combined_text for word in ['le', 'la', 'de', 'et', 'est', 'un', 'une', 'les']):
                                detected_language = "French"
                            elif any(word in combined_text for word in ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine']):
                                detected_language = "German"
                            elif any(word in combined_text for word in ['the', 'and', 'or', 'is', 'are', 'was', 'were']):
                                detected_language = "English"
                
                except Exception as template_error:
                    logger.warning(f"Template matching error: {template_error}")
                    # Use fallback values
                    pass
            
            result = {
                "success": True,
                "template_id": detected_template['id'] if detected_template else 'unknown',
                "doc_type": doc_type,
                "variation": detected_template.get('variation', 'standard') if detected_template else 'standard',
                "confidence": confidence,
                "detected_language": detected_language,
                "message": "Template detection completed successfully",
                "ocr_preview": {
                    "entities_found": len(ocr_result.get('layout', {}).get('pages', [{}])[0].get('entities', [])) if ocr_result else 0,
                    "has_text": bool(ocr_result)
                }
            }
            
            return result
            
        except OCRError as ocr_error:
            logger.error(f"OCR processing error: {ocr_error}")
            # Return fallback result when OCR fails
            return {
                "success": True,
                "template_id": 'fallback_template',
                "doc_type": 'general',
                "variation": 'standard',
                "confidence": 0.3,
                "detected_language": "English",
                "message": "Template detection completed with limited analysis"
            }
        
        finally:
            # Clean up temp file
            import os
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect template: {str(e)}"
        )
    finally:
        await file.seek(0)

@router.post("/{project_id}/confirm-and-ocr")
async def confirm_project_and_perform_ocr(
    project_id: str,
    confirmation_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Confirm project details and perform full OCR.
    Updates project with confirmed details and triggers full text extraction.
    """
    try:
        # Verify project exists and user has permission
        project = project_service.get_project(project_id, current_user["id"])
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )

        # Only creator or PM can confirm
        if project['created_by'] != current_user["id"]:
            # Check if user is a PM
            user_profile = db_service.get_record('profiles', current_user["id"])
            if not user_profile or user_profile.get('role') != 'project_manager':
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only project creator or PM can confirm project details"
                )

        # Get the current project_data structure
        current_project_data = project.get('project_data', {})

        # Update the project_data structure to match PDF editor format
        updated_project_data = current_project_data.copy()

        # Update languages in the project_data structure (both top-level and nested)
        if confirmation_data.get('source_language'):
            updated_project_data['sourceLanguage'] = confirmation_data.get('source_language')
        if confirmation_data.get('desired_language'):
            updated_project_data['desiredLanguage'] = confirmation_data.get('desired_language')

        # Ensure documentState exists
        document_state = updated_project_data.get('documentState') or {}
        updated_project_data['documentState'] = document_state

        # Use provided num_pages and page dimensions if available
        styled_layout = confirmation_data.get('styled_layout') or {}
        doc_info = (styled_layout.get('document_info') or {}) if isinstance(styled_layout, dict) else {}
        page_width = doc_info.get('page_width') or document_state.get('pageWidth') or 595
        page_height = doc_info.get('page_height') or document_state.get('pageHeight') or 842
        num_pages = (
            confirmation_data.get('num_pages')
            or doc_info.get('total_pages')
            or document_state.get('numPages')
            or 1
        )
        document_state['pageWidth'] = page_width
        document_state['pageHeight'] = page_height
        document_state['numPages'] = num_pages
        document_state['currentPage'] = 1
        document_state.setdefault('scale', 1)
        document_state.setdefault('isLoading', False)
        document_state.setdefault('error', "")
        document_state.setdefault('fileType', document_state.get('fileType') or 'pdf')
        document_state.setdefault('imageDimensions', None)
        document_state['isDocumentLoaded'] = True
        document_state.setdefault('isPageLoading', False)
        document_state.setdefault('isScaleChanging', False)
        document_state.setdefault('pdfBackgroundColor', 'rgb(255, 255, 255)')
        document_state.setdefault('detectedPageBackgrounds', {})
        document_state.setdefault('deletedPages', [])
        document_state.setdefault('finalLayoutNumPages', 0)
        document_state.setdefault('finalLayoutCurrentPage', 1)
        document_state.setdefault('finalLayoutDeletedPages', [])
        document_state.setdefault('isTransforming', False)

        # Ensure pages array exists and is sized appropriately
        pages = document_state.get('pages') or []
        if not isinstance(pages, list):
            pages = []
        # Resize/initialize pages
        while len(pages) < num_pages:
            pages.append({
                'pageNumber': len(pages) + 1,
                'isTranslated': False,
                'elements': [],
            })
        document_state['pages'] = pages

        # Ensure elementCollections exists
        element_collections = updated_project_data.get('elementCollections') or {}
        element_collections.setdefault('originalTextBoxes', [])
        element_collections.setdefault('translatedTextBoxes', [])
        element_collections.setdefault('originalImages', [])
        element_collections.setdefault('translatedImages', [])
        element_collections.setdefault('originalShapes', [])
        element_collections.setdefault('translatedShapes', [])
        element_collections.setdefault('originalDeletionRectangles', [])
        element_collections.setdefault('translatedDeletionRectangles', [])
        element_collections.setdefault('untranslatedTexts', [])
        element_collections.setdefault('finalLayoutTextboxes', [])
        element_collections.setdefault('finalLayoutShapes', [])
        element_collections.setdefault('finalLayoutDeletionRectangles', [])
        element_collections.setdefault('finalLayoutImages', [])
        updated_project_data['elementCollections'] = element_collections

        # If styled layout is provided, map it into PDF editor structures
        if styled_layout and isinstance(styled_layout, dict):
            try:
                def to_px(val: float, dim: float) -> float:
                    try:
                        return float(val) * float(dim)
                    except Exception:
                        return 0.0

                def color_to_hex(rgb_arr: Any) -> str:
                    try:
                        r = int((rgb_arr[0] if len(rgb_arr) > 0 else 0) * 255)
                        g = int((rgb_arr[1] if len(rgb_arr) > 1 else 0) * 255)
                        b = int((rgb_arr[2] if len(rgb_arr) > 2 else 0) * 255)
                        return f"#{r:02x}{g:02x}{b:02x}"
                    except Exception:
                        return "#000000"

                translated_textboxes: list = []
                untranslated_list: list = []
                # Iterate through pages from styled_layout
                styled_pages = styled_layout.get('pages') or []
                if not styled_pages and styled_layout.get('entities'):
                    # Backward compat: single-page structure
                    styled_pages = [{
                        'page_number': 1,
                        'entities': styled_layout.get('entities')
                    }]

                for sp in styled_pages:
                    page_num = int(sp.get('page_number') or 1)
                    ents = sp.get('entities') or []
                    page_elements: list = []
                    for ent in ents:
                        verts = (((ent or {}).get('bounding_poly') or {}).get('vertices') or [])
                        if len(verts) >= 2:
                            min_x = min(v.get('x', 0) for v in verts)
                            min_y = min(v.get('y', 0) for v in verts)
                            max_x = max(v.get('x', 0) for v in verts)
                            max_y = max(v.get('y', 0) for v in verts)
                        else:
                            min_x = min_y = 0
                            max_x = max_y = 0

                        x = to_px(min_x, page_width)
                        y = to_px(min_y, page_height)
                        width = to_px(max_x - min_x, page_width)
                        height = to_px(max_y - min_y, page_height)

                        style = (ent.get('styling') or ent.get('style') or {})
                        colors = (style.get('colors') or {})
                        text_color = colors.get('fill_color') or colors.get('text_color')
                        if isinstance(text_color, dict):
                            rgb = [text_color.get('r', 0), text_color.get('g', 0), text_color.get('b', 0)]
                        else:
                            rgb = []
                        color = color_to_hex(rgb)
                        pad = style.get('text_padding') or 0
                        border_radius = (
                            (style.get('background') or {}).get('border_radius')
                            or style.get('border_radius')
                            or 0
                        )
                        bg = colors.get('background_color')
                        bg_hex = color_to_hex(bg) if isinstance(bg, list) or isinstance(bg, dict) else '#00000000'
                        border_col = colors.get('border_color')
                        border_hex = color_to_hex(border_col) if border_col else '#000000'
                        has_border = 1 if border_col else 0

                        textbox = {
                            'id': str(uuid.uuid4()),
                            'x': x,
                            'y': y,
                            'width': width,
                            'height': height,
                            'value': ent.get('text', ''),
                            'placeholder': (ent.get('placeholder') or 'Enter Text...'),
                            'fontSize': style.get('font_size') or 12,
                            'fontFamily': style.get('font_family') or 'Helvetica',
                            'page': page_num,
                            'type': ent.get('type') or 'text',
                            'color': color,
                            'bold': True if (style.get('font_family') == 'Helvetica-Bold' or style.get('font_weight') == 'bold') else False,
                            'italic': bool(style.get('italic', False)),
                            'underline': bool(style.get('underline', False)),
                            'textAlign': (style.get('text_alignment') or style.get('alignment') or 'left'),
                            'letterSpacing': style.get('letter_spacing') or 0,
                            'lineHeight': style.get('line_height') or 1.2,
                            'rotation': style.get('rotation') or 0,
                            'backgroundColor': bg_hex if bg else 'transparent',
                            'backgroundOpacity': (bg.get('a', 1) if isinstance(bg, dict) else (bg[3] if isinstance(bg, list) and len(bg) > 3 else 1)),
                            'borderColor': border_hex,
                            'borderWidth': has_border,
                            'borderRadius': border_radius,
                            'borderTopLeftRadius': border_radius,
                            'borderTopRightRadius': border_radius,
                            'borderBottomLeftRadius': border_radius,
                            'borderBottomRightRadius': border_radius,
                            'paddingTop': pad,
                            'paddingRight': pad,
                            'paddingBottom': pad,
                            'paddingLeft': pad,
                            'isEditing': False,
                        }
                        translated_textboxes.append(textbox)
                        page_elements.append({ **{k:v for k,v in textbox.items() if k not in ['placeholder','isEditing']}, 'type': 'textbox' })

                        # Record untranslated text linkage similar to editor
                        if textbox['value'] and textbox['value'].strip():
                            untranslated_list.append({
                                'id': str(uuid.uuid4()),
                                'translatedTextboxId': textbox['id'],
                                'originalText': textbox['value'],
                                'page': page_num,
                                'x': x,
                                'y': y,
                                'width': width,
                                'height': height,
                                'isCustomTextbox': False,
                                'status': 'needsChecking'
                            })

                    # Ensure page exists and attach elements
                    page_index = page_num - 1
                    while len(pages) <= page_index:
                        pages.append({
                            'pageNumber': len(pages) + 1,
                            'isTranslated': False,
                            'elements': []
                        })
                    pages[page_index]['elements'] = page_elements

                # Persist element collections
                element_collections['translatedTextBoxes'] = translated_textboxes
                if untranslated_list:
                    element_collections['untranslatedTexts'] = untranslated_list
                updated_project_data['elementCollections'] = element_collections
            except Exception as map_err:
                logger.warning(f"Failed to map styled_layout to project_data: {map_err}")
        
        # Update metadata fields for indexing
        update_metadata = {
            'source_language': confirmation_data.get('source_language'),
            'desired_language': confirmation_data.get('desired_language'),
            'current_project_step': 'text_ocr',
            'template_id': confirmation_data.get('template_id'),
            'pm_notes': confirmation_data.get('pm_notes', ''),
            'confirmed_at': datetime.utcnow().isoformat(),
            'confirmed_by': current_user["id"]
        }

        # First update - confirm the details
        updated_project = project_service.update_project(
            project_id, 
            current_user["id"], 
            updated_project_data
        )

        # Perform full OCR processing using the orchestrator service
        try:
            from services.ocr_orchestrator import get_ocr_orchestrator
            
            # Initialize OCR orchestrator
            ocr_orchestrator = get_ocr_orchestrator(project_service, db_service)
            
            # Process documents with appropriate OCR services
            ocr_result = await ocr_orchestrator.process_project_documents(
                project_id=project_id,
                user_id=current_user["id"],
                confirmation_data=confirmation_data
            )
            
            logger.info(f"OCR orchestration completed: {ocr_result}")
            
            # The orchestrator has already updated the project data and state
            # Return success response with OCR results
            return {
                "success": True,
                "project_id": project_id,
                "status": "ocr_completed",
                "message": ocr_result.get('message', 'OCR completed successfully'),
                "next_step": "assigning_translator",
                "pages_processed": ocr_result.get('pages_processed', 1),
                "entities_extracted": ocr_result.get('entities_extracted', 0),
                "project_data": {
                    "source_language": confirmation_data.get('source_language'),
                    "desired_language": confirmation_data.get('desired_language'),
                    "template_id": confirmation_data.get('template_id'),
                    "current_step": "assigning_translator",
                    "ocr_completed": True
                }
            }
            
        except Exception as ocr_error:
            logger.error(f"OCR processing error: {ocr_error}")
            # Even if OCR fails, we can still proceed with the confirmed details
            return {
                "success": True,
                "project_id": project_id,
                "status": "ocr_partial",
                "message": "Project confirmed but OCR encountered issues",
                "next_step": "manual_processing",
                "project_data": {
                    "source_language": confirmation_data.get('source_language'),
                    "desired_language": confirmation_data.get('desired_language'),
                    "template_id": confirmation_data.get('template_id'),
                    "current_step": "manual_processing",
                    "ocr_completed": False
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming project and performing OCR: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm project and perform OCR: {str(e)}"
        ) 