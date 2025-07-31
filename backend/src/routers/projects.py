from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response, Form
from fastapi.responses import JSONResponse
from typing import List, Union
from db.supabase_client import supabase
from models.project import Project, ProjectCreate
from models.template_ocr import TemplateOCRResponse, TemplateOCRError
from dependencies.auth import get_current_user
from gotrue.types import User
import uuid
from datetime import datetime
from google.cloud import documentai_v1 as documentai
from services.ocr_service import process_document_for_layout, create_styled_json_from_layout, convert_image_to_pdf
from services.template_ocr_service import process_document_with_template, process_document_with_pdf_template
import base64
import io
import traceback
from core.config import settings

date_now = datetime.now().isoformat()
router = APIRouter()

@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(title: str, current_user: User = Depends(get_current_user)):

    try:
        project_data = {
            'title': title,
            'user_id': str(current_user.id),
            'collaborator': None,
            'created_at': date_now,
            'updated_at': date_now
        }
        print("project_data")
        print(project_data)
        response = supabase.table('projects').insert(project_data).execute()
        
        if response.data is None and response.error is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response.error.message)
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    try:
        response = supabase.table('projects').select('*').eq('user_id', str(current_user.id)).execute()
        
        if response.data is None and response.error is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response.error.message)

        return response.data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    try:
        response = supabase.table('projects').select('*').eq('id', str(project_id)).eq('user_id', str(current_user.id)).single().execute()
        
        if response.data is None and response.error is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        return response.data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{project_id}/files", response_model=Project)
async def upload_project_file(project_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        # First verify project ownership
        project_response = supabase.table('projects').select('*').eq('id', str(project_id)).eq('user_id', str(current_user.id)).single().execute()
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
        storage_path = f"{str(current_user.id)}/{str(project_id)}/{unique_filename}"
        
        try:
            # Upload to storage bucket
            storage_response = supabase.storage \
                .from_('pdfs') \
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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
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
    template_pdf: UploadFile = File(..., description="PDF template to apply extracted text to"),
    current_user: User = Depends(get_current_user)
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