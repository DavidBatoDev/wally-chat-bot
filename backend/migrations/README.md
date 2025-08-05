# PDF Editor Project State Migration

This directory contains database migrations to support storing PDF editor project state in Supabase instead of localStorage.

## Migration Overview

The `001_create_projects_table.sql` migration creates a comprehensive database schema for storing complete PDF editor project state with the following features:

- **Single Table Design**: Uses JSONB to store complete project state in one table
- **Offline Support**: Built-in version control and sync status management
- **Performance**: Optimized indexes for common queries
- **Security**: Row Level Security (RLS) policies for user data protection
- **Flexibility**: JSONB schema allows for easy evolution

## Running the Migration

### Option 1: Direct SQL Execution (Recommended)

1. Connect to your Supabase database using the SQL editor or psql
2. Execute the migration file:

```sql
-- Copy and paste the contents of 001_create_projects_table.sql
-- into the Supabase SQL editor and run it
```

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to your project root
cd client/backend

# Run the migration
supabase db reset --linked
# Then manually run the migration SQL in the Supabase dashboard
```

### Option 3: Programmatic Execution

You can also run the migration programmatically using Python:

```python
from src.services.db_service import SupabaseService

def run_migration():
    db = SupabaseService()

    # Read and execute the migration file
    with open('migrations/001_create_projects_table.sql', 'r') as f:
        migration_sql = f.read()

    # Execute the migration (you may need to split by statements)
    # Note: This is a simplified example - proper migration tools handle this better
    db.client.rpc('exec_sql', {'sql': migration_sql})

run_migration()
```

## Database Schema

### Projects Table

The main `projects` table stores complete project state:

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Complete project state as JSONB
    project_data JSONB NOT NULL,

    -- Extracted fields for indexing
    current_page INTEGER DEFAULT 1,
    num_pages INTEGER DEFAULT 0,
    current_workflow_step VARCHAR(20) DEFAULT 'translate',
    source_language VARCHAR(10) DEFAULT '',
    desired_language VARCHAR(10) DEFAULT '',

    -- Offline sync support
    sync_status VARCHAR(20) DEFAULT 'synced',
    local_version INTEGER DEFAULT 1,
    server_version INTEGER DEFAULT 1,

    -- Additional metadata
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    file_size BIGINT
);
```

### JSONB Project Data Structure

The `project_data` column stores the complete project state matching the `ProjectState` interface:

```typescript
interface ProjectDataStructure {
  documentState: {
    url: string;
    currentPage: number;
    numPages: number;
    scale: number;
    pageWidth: number;
    pageHeight: number;
    // ... all other document state fields
  };
  viewState: {
    currentView: "original" | "translated" | "split";
    currentWorkflowStep: string;
    // ... all other view state fields
  };
  elementCollections: {
    originalTextBoxes: TextBox[];
    translatedTextBoxes: TextBox[];
    // ... all other element collections
  };
  layerState: {
    originalLayerOrder: string[];
    translatedLayerOrder: string[];
  };
  editorState: {
    selectedFieldId: string | null;
    isEditMode: boolean;
    // ... all other editor state fields
  };
  sourceLanguage: string;
  desiredLanguage: string;
  originalDocumentFile?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 or URL
  };
}
```

## API Endpoints

After running the migration, you can use these new API endpoints:

### Create Project

```http
POST /api/v1/project-state/projects
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "name": "My Project",
  "description": "Project description",
  "project_data": {
    "documentState": { ... },
    "viewState": { ... },
    "elementCollections": { ... },
    "layerState": { ... },
    "editorState": { ... },
    "sourceLanguage": "en",
    "desiredLanguage": "es"
  }
}
```

### List Projects

```http
GET /api/v1/project-state/projects?limit=50&offset=0
Authorization: Bearer <jwt-token>
```

### Get Project

```http
GET /api/v1/project-state/projects/{project_id}
Authorization: Bearer <jwt-token>
```

### Update Project

```http
PUT /api/v1/project-state/projects/{project_id}
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "project_data": {
    // Updated project state
  }
}
```

### Delete Project

```http
DELETE /api/v1/project-state/projects/{project_id}
Authorization: Bearer <jwt-token>
```

### Sync Project (for offline support)

```http
POST /api/v1/project-state/projects/{project_id}/sync
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "project_data": { ... },
  "local_version": 5
}
```

## Integration with useProjectState Hook

To integrate with your existing `useProjectState.ts` hook, you'll need to:

1. **Replace localStorage calls** with API calls
2. **Add authentication** to API requests
3. **Handle offline sync** for better UX

### Example Integration

```typescript
// In useProjectState.ts
const saveProject = useCallback(
  async (projectName?: string) => {
    try {
      const projectState: ProjectState = {
        // ... build project state
      };

      // Replace localStorage with API call
      const response = await fetch("/api/v1/project-state/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: projectName || projectState.name,
          project_data: projectState,
        }),
      });

      if (!response.ok) throw new Error("Failed to save project");

      const savedProject = await response.json();
      toast.success(`Project "${savedProject.name}" saved successfully!`);

      return savedProject;
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save project");
      return null;
    }
  },
  [
    /* dependencies */
  ]
);
```

## Features

### 1. Offline Support

- **Sync Status**: Track whether projects are synced, pending, or in conflict
- **Version Control**: Local and server version numbers for conflict resolution
- **Conflict Resolution**: Handle cases where local and server versions diverge

### 2. Performance Optimizations

- **JSONB Indexes**: Fast queries on project data
- **Extracted Fields**: Common fields duplicated for efficient filtering
- **View**: `project_summary` view for efficient project listing

### 3. Security

- **Row Level Security**: Users can only access their own projects
- **Public Projects**: Optional support for public project sharing
- **Storage Integration**: Secure file storage with RLS policies

### 4. Extensibility

- **JSONB Schema**: Easy to add new fields without migrations
- **Validation**: Optional project data validation functions
- **Triggers**: Automatic timestamp and version management

## Rollback

To rollback this migration:

```sql
-- Drop the projects table and related objects
DROP VIEW IF EXISTS project_summary;
DROP TABLE IF EXISTS projects CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_server_version() CASCADE;
DROP FUNCTION IF EXISTS validate_project_data(JSONB) CASCADE;

-- Remove storage bucket (optional)
DELETE FROM storage.buckets WHERE id = 'project-files';
```

## Next Steps

1. **Run the Migration**: Execute `001_create_projects_table.sql` in your Supabase database
2. **Add Router**: Include the project state router in your FastAPI app
3. **Update Frontend**: Modify `useProjectState.ts` to use the new API endpoints
4. **Test Integration**: Verify that project saving/loading works correctly
5. **Handle Offline Mode**: Implement sync logic for offline usage

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure RLS policies are correctly configured
2. **JSONB Validation**: Check that project data matches expected structure
3. **Storage Issues**: Verify storage bucket permissions if using file uploads
4. **Sync Conflicts**: Implement proper conflict resolution in your frontend

### Debugging

```sql
-- Check project data structure
SELECT id, name, jsonb_pretty(project_data)
FROM projects
WHERE created_by = 'user-id';

-- Check sync status
SELECT id, name, sync_status, local_version, server_version
FROM projects
WHERE created_by = 'user-id';

-- Validate project data
SELECT id, name, validate_project_data(project_data) as is_valid
FROM projects;
```
