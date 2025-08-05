from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List
from services.db_service import db_service
from models.template import Template
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[Template])
async def get_templates():
    """
    Fetch all templates from the templates table in Supabase.
    """
    try:
        logger.info("Fetching all templates")
        
        templates = db_service.get_records('templates')
        logger.info(f"Successfully fetched {len(templates)} templates")
        
        return templates
        
    except Exception as e:
        logger.error(f"Error fetching templates: {str(e)}")
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
        logger.info(f"Fetching template {template_id}")
        
        template = db_service.get_record('templates', template_id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Template not found"
            )

        logger.info(f"Successfully fetched template: {template.get('doc_type', 'Unknown')} - {template.get('variation', 'Unknown')}")
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching template {template_id}: {str(e)}")
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
        logger.info(f"Fetching templates by type: {doc_type}")
        
        templates = db_service.get_templates_by_type(doc_type)
        logger.info(f"Successfully fetched {len(templates)} templates for doc_type: {doc_type}")
        
        return templates
        
    except Exception as e:
        logger.error(f"Error fetching templates by type {doc_type}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates by type: {str(e)}"
        ) 