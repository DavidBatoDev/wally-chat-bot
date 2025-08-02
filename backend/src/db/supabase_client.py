from supabase import create_client, Client
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
import os

# Handle imports for both direct execution and module import
try:
    from ..core.config import settings
except ImportError:
    # Fallback for direct execution
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from core.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Comprehensive Supabase database service for handling all database operations.
    """
    
    def __init__(self):
        self._client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize the Supabase client with proper error handling."""
        try:
            # Use credentials from config (which can be overridden by environment variables)
            supabase_url = getattr(settings, 'SUPABASE_URL', 'https://ylvmwrvyiamecvnydwvj.supabase.co')
            supabase_key = getattr(settings, 'SUPABASE_SERVICE_KEY', 
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsdm13cnZ5aWFtZWN2bnlkd3ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA5MjkzMSwiZXhwIjoyMDYyNjY4OTMxfQ.6PehkE7I_Q9j8EzzSUC6RGi7Z9QykHcY6Qa20eiLKtM')
            
            self._client = create_client(supabase_url, supabase_key)
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Supabase client: {e}")
            self._client = None
    
    @property
    def client(self) -> Client:
        """Get the Supabase client, reinitializing if necessary."""
        if self._client is None:
            self._initialize_client()
        
        if self._client is None:
            raise ConnectionError("Failed to initialize Supabase client")
        
        return self._client
    
    def health_check(self) -> bool:
        """Check if the database connection is healthy."""
        try:
            # Simple query to test connection using templates table (which exists)
            result = self.client.table('templates').select('id').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    # Generic CRUD operations
    def create_record(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new record in the specified table."""
        try:
            result = self.client.table(table).insert(data).execute()
            if result.data:
                logger.info(f"Created record in {table}: {result.data[0].get('id', 'unknown')}")
                return result.data[0]
            else:
                raise Exception("No data returned from insert operation")
        except Exception as e:
            logger.error(f"Error creating record in {table}: {e}")
            raise
    
    def get_record(self, table: str, record_id: str, id_column: str = 'id') -> Optional[Dict[str, Any]]:
        """Get a single record by ID."""
        try:
            result = self.client.table(table).select('*').eq(id_column, record_id).execute()
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting record from {table}: {e}")
            raise
    
    def get_records(self, table: str, filters: Optional[Dict[str, Any]] = None, 
                   limit: Optional[int] = None, order_by: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get multiple records with optional filtering."""
        try:
            query = self.client.table(table).select('*')
            
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            
            if order_by:
                query = query.order(order_by)
            
            if limit:
                query = query.limit(limit)
            
            result = query.execute()
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error getting records from {table}: {e}")
            raise
    
    def update_record(self, table: str, record_id: str, data: Dict[str, Any], 
                     id_column: str = 'id') -> Dict[str, Any]:
        """Update a record by ID."""
        try:
            # Add updated_at timestamp if not provided
            if 'updated_at' not in data:
                data['updated_at'] = datetime.utcnow().isoformat()
            
            result = self.client.table(table).update(data).eq(id_column, record_id).execute()
            if result.data:
                logger.info(f"Updated record in {table}: {record_id}")
                return result.data[0]
            else:
                raise Exception("No data returned from update operation")
        except Exception as e:
            logger.error(f"Error updating record in {table}: {e}")
            raise
    
    def delete_record(self, table: str, record_id: str, id_column: str = 'id') -> bool:
        """Delete a record by ID."""
        try:
            result = self.client.table(table).delete().eq(id_column, record_id).execute()
            logger.info(f"Deleted record from {table}: {record_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting record from {table}: {e}")
            raise
    
    # Profile-specific operations
    def get_profile_by_id(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Get profile by ID."""
        return self.get_record('profiles', profile_id)
    
    def create_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new profile."""
        profile_data['created_at'] = datetime.utcnow().isoformat()
        return self.create_record('profiles', profile_data)
    
    def update_profile(self, profile_id: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a profile."""
        return self.update_record('profiles', profile_id, profile_data)
    
    # File object operations
    def get_profile_files(self, profile_id: str) -> List[Dict[str, Any]]:
        """Get all file objects for a profile."""
        return self.get_records('file_objects', {'profile_id': profile_id}, order_by='created_at')
    
    def create_file_object(self, file_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new file object record."""
        file_data['created_at'] = datetime.utcnow().isoformat()
        return self.create_record('file_objects', file_data)
    
    def get_file_object(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get a file object by ID."""
        return self.get_record('file_objects', file_id)
    
    def delete_file_object(self, file_id: str) -> bool:
        """Delete a file object."""
        return self.delete_record('file_objects', file_id)
    
    # Template-specific operations
    def get_templates_by_type(self, doc_type: str) -> List[Dict[str, Any]]:
        """Get templates by document type."""
        return self.get_records('templates', {'doc_type': doc_type})
    
    def get_template_with_mappings(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get template with its field mappings."""
        try:
            # Get template
            template = self.get_record('templates', template_id)
            if not template:
                return None
            
            # Get associated template mappings
            mappings = self.get_records('template_mappings', {'template_id': template_id})
            template['mappings'] = mappings
            
            return template
        except Exception as e:
            logger.error(f"Error getting template with mappings: {e}")
            raise
    
    # Additional file operations
    def get_files_by_bucket(self, bucket: str) -> List[Dict[str, Any]]:
        """Get all files in a specific bucket."""
        return self.get_records('file_objects', {'bucket': bucket}, order_by='created_at')
    
    def get_files_by_mime_type(self, mime_type: str) -> List[Dict[str, Any]]:
        """Get all files of a specific MIME type."""
        return self.get_records('file_objects', {'mime_type': mime_type}, order_by='created_at')
    
    # Raw SQL execution for complex queries
    def execute_raw_sql(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Execute raw SQL query (use with caution)."""
        try:
            result = self.client.rpc('execute_sql', {'query': query, 'params': params or {}}).execute()
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error executing raw SQL: {e}")
            raise

# Global instance
db_service = SupabaseService()

# For backward compatibility
supabase = db_service.client 