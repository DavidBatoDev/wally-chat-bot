"""
Project service for managing PDF editor project state in Supabase.
This service provides CRUD operations for the projects table created by the migration.
"""

from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
import json
from db.supabase_client import SupabaseService

logger = logging.getLogger(__name__)

class ProjectService:
    """Service for managing PDF editor projects with JSONB project state."""
    
    def __init__(self, db_service: SupabaseService):
        self.db = db_service
    
    def create_project(self, user_id: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new project with complete project state.
        
        Args:
            user_id: The ID of the user creating the project
            project_data: Complete project state matching ProjectState interface
            
        Returns:
            Created project record
        """
        try:
            # Extract metadata from project_data for indexing
            document_state = project_data.get('documentState', {})
            view_state = project_data.get('viewState', {})
            
            project_record = {
                'name': project_data.get('name', 'Untitled Project'),
                'description': project_data.get('description', ''),
                'created_by': user_id,
                'project_data': project_data,
                # New: persist project_code if provided
                'project_code': project_data.get('project_code', ""),
                 # New: initialize backend-controlled project step
                 'current_project_step': 'text_ocr',
                
                # Extracted fields for indexing
                'current_page': document_state.get('currentPage', 1),
                'num_pages': document_state.get('numPages', 0),
                'current_workflow_step': view_state.get('currentWorkflowStep', 'translate'),
                'source_language': project_data.get('sourceLanguage', ''),
                'desired_language': project_data.get('desiredLanguage', ''),
                
                # Optional metadata
                'file_size': project_data.get('originalDocumentFile', {}).get('size'),
                'tags': project_data.get('tags', []),
                'is_public': project_data.get('isPublic', False),
                
                # Sync fields
                'local_version': 1,
                'server_version': 1,
                'sync_status': 'synced'
            }
            
            result = self.db.create_record('projects', project_record)
            logger.info(f"Created project: {result.get('id')}")
            return result
            
        except Exception as e:
            logger.error(f"Error creating project: {e}")
            raise
    
    def get_project(self, project_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get a project by ID.
        
        Args:
            project_id: The project ID
            user_id: Optional user ID for permission checking. If None, allows public access.
            
        Returns:
            Project record or None if not found
        """
        try:
            # Build filters
            filters = {'id': project_id}
            if user_id:
                # Add user filter for RLS (Row Level Security will also enforce this)
                filters['created_by'] = user_id
            
            projects = self.db.get_records('projects', filters, limit=1)
            return projects[0] if projects else None
            
        except Exception as e:
            logger.error(f"Error getting project {project_id}: {e}")
            raise
    
    def update_project(self, project_id: str, user_id: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a project's state.
        
        Args:
            project_id: The project ID
            user_id: The user ID (for permission checking)
            project_data: Updated project state
            
        Returns:
            Updated project record
        """
        try:
            # Extract metadata from updated project_data
            document_state = project_data.get('documentState', {})
            view_state = project_data.get('viewState', {})
            
            update_data = {
                'project_data': project_data,
                'name': project_data.get('name'),
                'description': project_data.get('description'),
                
                # Update extracted fields
                'current_page': document_state.get('currentPage'),
                'num_pages': document_state.get('numPages'),
                'current_workflow_step': view_state.get('currentWorkflowStep'),
                'source_language': project_data.get('sourceLanguage'),
                'desired_language': project_data.get('desiredLanguage'),
                
                # Update metadata if provided
                'tags': project_data.get('tags'),
                'is_public': project_data.get('isPublic'),
                
                # Increment local version for sync tracking
                'local_version': project_data.get('localVersion', 1) + 1,
                'sync_status': 'pending'  # Mark as pending sync
            }
            # Never allow changing project_code via update
            if 'project_code' in update_data:
                update_data.pop('project_code')
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            result = self.db.update_record('projects', project_id, update_data)
            logger.info(f"Updated project: {project_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error updating project {project_id}: {e}")
            raise
    
    def delete_project(self, project_id: str, user_id: str) -> bool:
        """
        Delete a project.
        
        Args:
            project_id: The project ID
            user_id: The user ID (for permission checking)
            
        Returns:
            True if deleted successfully
        """
        try:
            # Verify ownership before deletion (RLS will also enforce this)
            project = self.get_project(project_id, user_id)
            if not project:
                raise ValueError(f"Project {project_id} not found or access denied")
            
            result = self.db.delete_record('projects', project_id)
            logger.info(f"Deleted project: {project_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            raise
    
    def list_user_projects(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        List projects for a user.
        
        Args:
            user_id: The user ID
            limit: Maximum number of projects to return
            offset: Number of projects to skip
            
        Returns:
            List of project records
        """
        try:
            # Read directly from projects table to include complete columns
            query = self.db.client.table('projects').select('*')
            query = query.eq('created_by', user_id)
            query = query.order('updated_at', desc=True)
            query = query.range(offset, offset + limit - 1)

            result = query.execute()
            rows = result.data or []

            # Enrich with summary fields expected by API consumers
            enriched: List[Dict[str, Any]] = []
            for row in rows:
                proj_data = (row.get('project_data') or {})
                doc_state = proj_data.get('documentState') or {}
                elem = proj_data.get('elementCollections') or {}

                document_url = doc_state.get('url')
                file_type = doc_state.get('fileType')
                text_boxes_count = len(elem.get('originalTextBoxes') or [])
                images_count = len(elem.get('originalImages') or [])

                enriched.append({
                    **row,
                    'document_url': document_url,
                    'file_type': file_type,
                    'text_boxes_count': text_boxes_count,
                    'images_count': images_count,
                    # Normalize enum/current_project_step to plain string
                    'current_project_step': (row.get('current_project_step') or ''),
                })

            return enriched
            
        except Exception as e:
            logger.error(f"Error listing projects for user {user_id}: {e}")
            raise
    
    def search_projects(self, user_id: str, search_term: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search projects by name or content.
        
        Args:
            user_id: The user ID
            search_term: Search term
            limit: Maximum number of results
            
        Returns:
            List of matching project records
        """
        try:
            # Search in project names and JSONB content
            query = self.db.client.table('projects').select('*')
            query = query.eq('created_by', user_id)
            
            # Use PostgreSQL full-text search or JSONB search
            # This is a simple implementation - you can enhance with proper full-text search
            query = query.or_(f"name.ilike.%{search_term}%,project_data->>name.ilike.%{search_term}%")
            query = query.limit(limit)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error searching projects for user {user_id}: {e}")
            raise
    
    def sync_project(self, project_id: str, user_id: str, local_project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync a local project with the server version.
        
        Args:
            project_id: The project ID
            user_id: The user ID
            local_project_data: Local project state
            
        Returns:
            Sync result with status and data
        """
        try:
            # Get current server version
            server_project = self.get_project(project_id, user_id)
            if not server_project:
                raise ValueError(f"Project {project_id} not found")
            
            local_version = local_project_data.get('localVersion', 1)
            server_version = server_project.get('server_version', 1)
            
            # Check for conflicts
            if server_version > local_version:
                return {
                    'status': 'conflict',
                    'local_data': local_project_data,
                    'server_data': server_project['project_data'],
                    'local_version': local_version,
                    'server_version': server_version
                }
            
            # No conflict, update with local changes
            updated_project = self.update_project(project_id, user_id, local_project_data)
            
            return {
                'status': 'synced',
                'project': updated_project,
                'server_version': updated_project.get('server_version')
            }
            
        except Exception as e:
            logger.error(f"Error syncing project {project_id}: {e}")
            raise
    
    def get_project_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get statistics about user's projects.
        
        Args:
            user_id: The user ID
            
        Returns:
            Project statistics
        """
        try:
            # Get basic counts
            total_projects = len(self.db.get_records('projects', {'created_by': user_id}, limit=1000))
            
            # Get projects by workflow step
            query = self.db.client.table('projects').select('current_workflow_step')
            query = query.eq('created_by', user_id)
            result = query.execute()
            
            workflow_counts = {}
            for project in result.data or []:
                step = project.get('current_workflow_step', 'unknown')
                workflow_counts[step] = workflow_counts.get(step, 0) + 1
            
            return {
                'total_projects': total_projects,
                'workflow_step_counts': workflow_counts,
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting project stats for user {user_id}: {e}")
            raise

# Create a singleton instance
_project_service = None

def get_project_service() -> ProjectService:
    """Get the project service singleton."""
    global _project_service
    if _project_service is None:
        from .db_service import SupabaseService
        db_service = SupabaseService()
        _project_service = ProjectService(db_service)
    return _project_service