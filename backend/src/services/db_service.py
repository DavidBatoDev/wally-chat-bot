"""
Working Supabase database service for the backend.
"""

from supabase import create_client, Client
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class SupabaseService:
    """Comprehensive Supabase database service."""
    
    def __init__(self):
        self._client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize the Supabase client."""
        try:
            # Use your provided credentials directly
            supabase_url = "https://ylvmwrvyiamecvnydwvj.supabase.co"
            supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsdm13cnZ5aWFtZWN2bnlkd3ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA5MjkzMSwiZXhwIjoyMDYyNjY4OTMxfQ.6PehkE7I_Q9j8EzzSUC6RGi7Z9QykHcY6Qa20eiLKtM"
            
            self._client = create_client(supabase_url, supabase_key)
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Supabase client: {e}")
            self._client = None
    
    @property
    def client(self) -> Client:
        """Get the Supabase client."""
        if self._client is None:
            self._initialize_client()
        if self._client is None:
            raise ConnectionError("Failed to initialize Supabase client")
        return self._client
    
    def health_check(self) -> bool:
        """Check if the database connection is healthy."""
        try:
            result = self.client.table('templates').select('id').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def test_profiles_connection(self) -> Dict[str, Any]:
        """Test connection by fetching profiles table."""
        try:
            result = self.client.table('profiles').select('*').limit(5).execute()
            return {
                "success": True,
                "count": len(result.data) if result.data else 0,
                "data": result.data,
                "message": "Successfully connected to profiles table"
            }
        except Exception as e:
            logger.error(f"Profiles connection test failed: {e}")
            return {
                "success": False,
                "count": 0,
                "data": [],
                "error": str(e),
                "message": f"Failed to connect to profiles table: {str(e)}"
            }
    
    # Generic CRUD operations
    def create_record(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new record in the specified table."""
        try:
            result = self.client.table(table).insert(data).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                raise Exception("No data returned from insert operation")
        except Exception as e:
            logger.error(f"Error creating record in {table}: {e}")
            raise
    
    def update_record(self, table: str, record_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a record in the specified table."""
        try:
            result = self.client.table(table).update(data).eq('id', record_id).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                raise Exception("No data returned from update operation")
        except Exception as e:
            logger.error(f"Error updating record {record_id} in {table}: {e}")
            raise
    
    def delete_record(self, table: str, record_id: str) -> bool:
        """Delete a record from the specified table."""
        try:
            result = self.client.table(table).delete().eq('id', record_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting record {record_id} from {table}: {e}")
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
    
    def get_record(self, table: str, record_id: str) -> Optional[Dict[str, Any]]:
        """Get a single record by ID."""
        try:
            result = self.client.table(table).select('*').eq('id', record_id).execute()
            if result.data:
                return result.data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting record from {table}: {e}")
            raise
    
    # Template operations
    def get_templates_by_type(self, doc_type: str) -> List[Dict[str, Any]]:
        """Get templates by document type."""
        return self.get_records('templates', {'doc_type': doc_type})
    
    def get_template_with_mappings(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get template with its field mappings (if mappings table exists)."""
        try:
            template = self.get_record('templates', template_id)
            if not template:
                return None
            
            # Note: Since template_mappings table doesn't exist, just return the template
            template['mappings'] = []
            return template
        except Exception as e:
            logger.error(f"Error getting template with mappings: {e}")
            raise
    
    # Profile operations
    def get_profile_files(self, profile_id: str) -> List[Dict[str, Any]]:
        """Get all file objects for a profile."""
        return self.get_records('file_objects', {'profile_id': profile_id}, order_by='created_at')

# Global instance
db_service = SupabaseService()