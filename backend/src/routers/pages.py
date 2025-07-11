from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Any
import uuid
from db.supabase_client import supabase
from models.page import Page, PageCreate
from dependencies.auth import get_current_user
from gotrue.types import User
from services.ocr_service import process_document
import mimetypes
from fastapi.responses import StreamingResponse
from datetime import datetime
import uuid
router = APIRouter()


@router.post("/", response_model=Page, status_code=status.HTTP_201_CREATED)
async def create_page(project_id: uuid.UUID, page_no: int, current_user: User = Depends(get_current_user)):
    # Verify that the project exists and belongs to the user
    project_id = str(project_id)
    user_id = str(current_user.id)
    
    project_res = supabase.table('projects').select('id').eq('id', project_id).eq('user_id', user_id).single().execute()
    if not project_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or access denied")

    try:
        page_data = {
            'project_id': project_id,
            'user_id': user_id,
            'page_no': page_no,
            'layout': None,
            'ocr_layout': None,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('pages').insert(page_data).execute()

        if response.data is None or not response.data:
            error_msg = response.error.message if response.error else "Could not create page"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/project/{project_id}", response_model=List[Page])
async def get_pages_for_project(project_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    # Verify project access
    project_res = supabase.table('projects').select('id').eq('id', str(project_id)).eq('user_id', user_id).single().execute()
    if not project_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or access denied")

    try:
        response = supabase.table('pages').select('*').eq('project_id', str(project_id)).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{page_id}/layout", response_model=Page)
async def update_page_layout(page_id: uuid.UUID, layout: dict[str, Any], current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    # Verify page ownership
    page_res = supabase.table('pages').select('id').eq('id', str(page_id)).eq('user_id', user_id).single().execute()
    if not page_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found or access denied")
        
    try:
        response = supabase.table('pages').update({'layout': layout}).eq('id', str(page_id)).execute()
        
        if response.data is None or not response.data:
             error_msg = response.error.message if response.error else "Could not update page layout"
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{page_id}/ocr", response_model=Page)
async def generate_ocr_layout(page_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    
    # 1. Verify page ownership
    page_res = supabase.table('pages').select('id').eq('id', str(page_id)).eq('user_id', user_id).single().execute()
    if not page_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found or access denied")

    try:
        # 2. Read file content
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
        
        # 3. Determine MIME type
        mime_type = file.content_type
        if not mime_type:
            if file.filename.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            else:
                mime_type = 'application/octet-stream'

        # 4. Process with OCR service
        _, ocr_layout = process_document(file_content, mime_type)
        
        # 5. Update only the OCR layout in the database
        response = supabase.table('pages').update({
            'ocr_layout': ocr_layout
        }).eq('id', str(page_id)).execute()
        
        if response.data is None or not response.data:
            error_msg = response.error.message if response.error else "Could not update page with OCR data"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
            
        return response.data[0]

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate OCR layout: {str(e)}")
    finally:
        await file.seek(0)  # Reset file pointer

@router.get("/{page_id}/layout", response_model=dict)
async def get_page_styled_layout(page_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    """
    Retrieves the stored OCR layout with all styling information for a page.
    """
    user_id = str(current_user.id)
    
    # Fetch the page data, specifically the ocr_layout
    page_res = supabase.table('pages').select('ocr_layout').eq('id', str(page_id)).eq('user_id', user_id).single().execute()
    if not page_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found or access denied")
    
    ocr_layout = page_res.data.get('ocr_layout')

    if not ocr_layout or not ocr_layout.get('entities'):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page does not have a styled OCR layout.")

    return ocr_layout


@router.get("/{page_id}/export", response_class=StreamingResponse)
async def export_page_as_pdf(page_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    
    # 1. Fetch the page data, specifically the ocr_layout and styled_pdf if available
    page_res = supabase.table('pages').select('ocr_layout, styled_pdf').eq('id', str(page_id)).eq('user_id', user_id).single().execute()
    if not page_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found or access denied")
    
    page_data = page_res.data
    ocr_layout = page_data.get('ocr_layout')
    styled_pdf = page_data.get('styled_pdf')

    # 2. Check if ocr_layout exists
    if not ocr_layout or not ocr_layout.get('pages'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Page does not have an OCR layout to export.")

    try:
        # 3. If we have a stored styled PDF, use it; otherwise generate it
        if styled_pdf:
            pdf_bytes = styled_pdf
        else:
            # Generate PDF from layout
            _, pdf_bytes = process_document(None, None, layout_data=ocr_layout)
        
        # 4. Return the PDF as a streaming response
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=exported_page_{page_id}.pdf"}
        )

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to export PDF: {str(e)}") 