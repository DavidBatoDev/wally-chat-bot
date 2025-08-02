"""
API router for PDF editor project state management.
Provides endpoints for saving, loading, and managing project state instead of localStorage.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, List, Dict, Any
import logging
from pydantic import BaseModel, Field
from datetime import datetime

from services.project_service import get_project_service
from gotrue.types import User
from dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/project-state", tags=["Project State"])

# Pydantic models for request/response validation
class ProjectStateCreate(BaseModel):
    """Model for creating a new project state."""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    project_data: Dict[str, Any] = Field(..., description="Complete project state data")
    tags: Optional[List[str]] = Field(default_factory=list, description="Project tags")
    is_public: Optional[bool] = Field(False, description="Whether project is public")

class ProjectStateUpdate(BaseModel):
    """Model for updating project state."""
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
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    current_page: int
    num_pages: int
    current_workflow_step: str
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

class SyncRequest(BaseModel):
    """Model for sync request."""
    project_data: Dict[str, Any]
    local_version: int

class SyncResponse(BaseModel):
    """Model for sync response."""
    status: str  # 'synced', 'conflict'
    project: Optional[Dict[str, Any]] = None
    local_data: Optional[Dict[str, Any]] = None
    server_data: Optional[Dict[str, Any]] = None
    server_version: Optional[int] = None

@router.post("/projects", response_model=ProjectStateResponse, status_code=status.HTTP_201_CREATED)
async def create_project_state(
    project: ProjectStateCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project state.
    This replaces saving to localStorage with database persistence.
    """
    try:
        project_service = get_project_service()
        
        # Add user metadata to project data
        project_data = project.project_data.copy()
        project_data.update({
            'name': project.name,
            'description': project.description,
            'tags': project.tags,
            'isPublic': project.is_public,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        })
        
        result = project_service.create_project(current_user.id, project_data)
        
        return ProjectStateResponse(**result)
        
    except Exception as e:
        logger.error(f"Error creating project state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@router.get("/projects", response_model=List[ProjectSummaryResponse])
async def list_project_states(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of projects to return"),
    offset: int = Query(0, ge=0, description="Number of projects to skip"),
    current_user: User = Depends(get_current_user)
):
    """
    List user's project states.
    This replaces getting saved projects from localStorage.
    """
    try:
        project_service = get_project_service()
        projects = project_service.list_user_projects(current_user.id, limit, offset)
        
        return [ProjectSummaryResponse(**project) for project in projects]
        
    except Exception as e:
        logger.error(f"Error listing project states: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list projects: {str(e)}"
        )

@router.get("/projects/{project_id}", response_model=ProjectStateResponse)
async def get_project_state(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project state by ID.
    This replaces loading from localStorage.
    """
    try:
        project_service = get_project_service()
        project = project_service.get_project(project_id, current_user.id)
        
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

@router.put("/projects/{project_id}", response_model=ProjectStateResponse)
async def update_project_state(
    project_id: str,
    project_update: ProjectStateUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update a project state.
    This replaces saving to localStorage with database updates.
    """
    try:
        project_service = get_project_service()
        
        # Prepare update data
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
        
        result = project_service.update_project(project_id, current_user.id, project_data)
        
        return ProjectStateResponse(**result)
        
    except Exception as e:
        logger.error(f"Error updating project state {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project: {str(e)}"
        )

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_state(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project state.
    """
    try:
        project_service = get_project_service()
        success = project_service.delete_project(project_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project state {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        )

@router.post("/projects/{project_id}/sync", response_model=SyncResponse)
async def sync_project_state(
    project_id: str,
    sync_request: SyncRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Sync local project changes with server.
    Handles conflict resolution for offline mode support.
    """
    try:
        project_service = get_project_service()
        
        result = project_service.sync_project(
            project_id, 
            current_user.id, 
            sync_request.project_data
        )
        
        return SyncResponse(**result)
        
    except Exception as e:
        logger.error(f"Error syncing project state {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync project: {str(e)}"
        )

@router.get("/projects/search", response_model=List[ProjectSummaryResponse])
async def search_project_states(
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results"),
    current_user: User = Depends(get_current_user)
):
    """
    Search project states by name or content.
    """
    try:
        project_service = get_project_service()
        projects = project_service.search_projects(current_user.id, q, limit)
        
        return [ProjectSummaryResponse(**project) for project in projects]
        
    except Exception as e:
        logger.error(f"Error searching project states: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search projects: {str(e)}"
        )

@router.get("/stats", response_model=Dict[str, Any])
async def get_project_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get user's project statistics.
    """
    try:
        project_service = get_project_service()
        stats = project_service.get_project_stats(current_user.id)
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting project stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get project stats: {str(e)}"
        )

# Health check endpoint for the project state service
@router.get("/health")
async def project_state_health():
    """
    Health check for project state service.
    """
    try:
        project_service = get_project_service()
        # Simple health check - verify database connection
        is_healthy = project_service.db.health_check()
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "project_state",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Project state health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "project_state",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }