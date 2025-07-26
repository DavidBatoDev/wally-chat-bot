from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List
from db.supabase_client import supabase
from models.template import Template
import traceback

router = APIRouter()

@router.get("/", response_model=List[Template])
async def get_templates():
    """
    Fetch all templates from the templates table in Supabase.
    """
    try:
        print("=== FETCHING TEMPLATES ===")
        
        # Query all templates from the templates table
        response = supabase.table('templates').select('*').execute()
        
        if response.data is None and response.error is not None:
            print(f"Supabase error: {response.error.message}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=response.error.message
            )

        templates = response.data
        print(f"Successfully fetched {len(templates)} templates")
        
        return templates
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR fetching templates: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates: {str(e)}"
        )

@router.get("/{template_id}", response_model=Template)
async def get_template(template_id: str):
    """
    Fetch a specific template by ID from the templates table.
    """
    try:
        print(f"=== FETCHING TEMPLATE {template_id} ===")
        
        # Query specific template from the templates table
        response = supabase.table('templates').select('*').eq('id', template_id).single().execute()
        
        if response.data is None and response.error is not None:
            print(f"Supabase error: {response.error.message}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Template not found"
            )

        template = response.data
        print(f"Successfully fetched template: {template.get('doc_type', 'Unknown')} - {template.get('variation', 'Unknown')}")
        
        return template
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR fetching template {template_id}: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch template: {str(e)}"
        )

@router.get("/by-type/{doc_type}", response_model=List[Template])
async def get_templates_by_type(doc_type: str):
    """
    Fetch all templates of a specific document type.
    """
    try:
        print(f"=== FETCHING TEMPLATES BY TYPE: {doc_type} ===")
        
        # Query templates by document type
        response = supabase.table('templates').select('*').eq('doc_type', doc_type).execute()
        
        if response.data is None and response.error is not None:
            print(f"Supabase error: {response.error.message}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=response.error.message
            )

        templates = response.data
        print(f"Successfully fetched {len(templates)} templates for doc_type: {doc_type}")
        
        return templates
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR fetching templates by type {doc_type}: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception args: {e.args}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates by type: {str(e)}"
        ) 