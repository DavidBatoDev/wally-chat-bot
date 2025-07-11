from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List
from db.supabase_client import supabase
from models.project import Project, ProjectCreate
from dependencies.auth import get_current_user
from gotrue.types import User
import uuid
from datetime import datetime
from google.cloud import documentai_v1 as documentai
from services.ocr_service import process_document
import base64
import io

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
):
    """
    Process a file through OCR and return both the layout JSON and styled PDF.
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

        # Process with Document AI and get layout and PDF
        pdf_bytes, ocr_layout = process_document(file_content, mime_type)
        
        # Encode PDF as base64 for JSON response
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Return both the layout and PDF
        return JSONResponse({
            "layout": ocr_layout,
        })

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )
    finally:
        await file.seek(0)  # Reset file pointer 