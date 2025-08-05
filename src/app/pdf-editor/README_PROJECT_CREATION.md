# Automatic Project Creation on Document Upload

This document describes the new automatic project creation feature that creates a database project entry whenever a user uploads a document to the PDF Editor.

## Overview

When a user uploads a document (PDF or image), the system now automatically:

1. **Processes the file upload** (existing functionality)
2. **Creates a project in the database** (new functionality)
3. **Provides visual feedback** about project creation status
4. **Handles authentication gracefully** (works for both authenticated and non-authenticated users)

## Implementation Details

### Files Created/Modified

#### New Files

1. **`services/projectApiService.ts`** - API client for project state management

   - Complete CRUD operations for projects
   - Automatic project creation from file uploads
   - Authentication handling
   - Error management

2. **`hooks/useProjectCreation.ts`** - React hook for project creation

   - Integrates with file upload process
   - Manages project creation state
   - Provides UI feedback helpers

3. **`config/api.ts`** - API configuration
   - Centralized API endpoint configuration
   - Environment variable management

#### Modified Files

1. **`PDFEditorContent.tsx`** - Main editor component

   - Enhanced `handleFileUpload` function
   - Added project creation integration
   - Added UI status indicators
   - Authentication-aware behavior

2. **`migrations/001_create_projects_table.sql`** - Database schema
   - Complete project state storage with JSONB
   - Offline sync support
   - Row Level Security (RLS)

### Database Schema

The project is stored in the `projects` table with the following key fields:

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    project_data JSONB NOT NULL,  -- Complete project state
    current_page INTEGER,
    num_pages INTEGER,
    source_language VARCHAR(10),
    desired_language VARCHAR(10),
    sync_status VARCHAR(20) DEFAULT 'synced',
    -- ... other fields
);
```

### API Endpoints

The following endpoints are available for project management:

- `POST /api/v1/project-state/projects` - Create project
- `GET /api/v1/project-state/projects` - List projects
- `GET /api/v1/project-state/projects/{id}` - Get project
- `PUT /api/v1/project-state/projects/{id}` - Update project
- `DELETE /api/v1/project-state/projects/{id}` - Delete project
- `POST /api/v1/project-state/projects/{id}/sync` - Sync project

## User Experience

### For Authenticated Users

1. **Upload Document**: User clicks "Upload Document" and selects a file
2. **File Processing**: Document is processed and displayed (existing behavior)
3. **Project Creation**: System automatically creates a project in the background
4. **Visual Feedback**:
   - Upload button shows "Creating Project..." during creation
   - Success message appears when project is created
   - Error message if project creation fails (but upload still works)

### For Non-Authenticated Users

1. **Upload Document**: Works normally without project creation
2. **Notification**: Friendly message suggesting sign-in for project management
3. **No Blocking**: Document upload and editing works normally

### Visual States

#### Upload Button States

- **Normal**: "Upload Document" (blue button)
- **Creating Project**: "Creating Project..." (disabled, gray button with spinner)
- **Error**: Returns to normal state, shows error toast

#### Status Indicators

- **Creating**: Blue spinner with "Creating your project..."
- **Success**: Green checkmark with "Project created successfully!"
- **Error**: Red warning icon with "Project creation failed"
- **Not Authenticated**: Amber info box suggesting sign-in

## Configuration

### Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### API Configuration

The API configuration is centralized in `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  PROJECT_STATE: {
    BASE: "/api/v1/project-state",
    PROJECTS: "/api/v1/project-state/projects",
    // ... other endpoints
  },
};
```

## Authentication Integration

The system checks for authentication using a simple token-based approach:

```typescript
function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}
```

**Note**: This is a placeholder implementation. In production, integrate with your actual authentication system (NextAuth.js, Supabase Auth, etc.).

## Error Handling

The system gracefully handles various error scenarios:

1. **Network Errors**: Shows user-friendly error messages
2. **Authentication Errors**: Falls back to non-authenticated mode
3. **Server Errors**: Logs errors but doesn't block document upload
4. **Validation Errors**: Shows specific error messages from the API

## Project Data Structure

The `project_data` JSONB field stores the complete project state:

```typescript
interface ProjectData {
  documentState: {
    url: string;
    currentPage: number;
    numPages: number;
    // ... all document state
  };
  viewState: {
    currentView: "original" | "translated" | "split";
    // ... all view state
  };
  elementCollections: {
    originalTextBoxes: TextBox[];
    translatedTextBoxes: TextBox[];
    // ... all elements
  };
  // ... other state
  originalDocumentFile: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded file
  };
}
```

## Performance Considerations

1. **Async Project Creation**: Project creation happens asynchronously after file upload
2. **Base64 Encoding**: Files are stored as base64 for complete project state
3. **Timeout Handling**: API calls have appropriate timeouts
4. **Error Recovery**: System continues working even if project creation fails

## Future Enhancements

1. **Automatic Sync**: Sync project state changes automatically
2. **Conflict Resolution**: Handle conflicts when multiple users edit the same project
3. **Project Templates**: Create projects from predefined templates
4. **Bulk Operations**: Upload multiple files and create projects in batch
5. **Cloud Storage**: Store files in cloud storage instead of base64

## Testing

To test the automatic project creation:

1. **Setup**: Ensure backend is running with the migration applied
2. **Authentication**: Set an auth token in localStorage (or implement proper auth)
3. **Upload**: Upload a document and observe the project creation process
4. **Verification**: Check the database to confirm project was created
5. **Error Testing**: Test with invalid tokens, network issues, etc.

## Troubleshooting

### Common Issues

1. **Project Not Created**: Check authentication token and API connectivity
2. **UI Not Updating**: Verify React hooks are properly implemented
3. **Database Errors**: Check migration was applied correctly
4. **CORS Issues**: Ensure backend CORS settings allow frontend requests

### Debug Mode

Enable debug logging by setting:

```javascript
localStorage.setItem("debug", "project-creation");
```

This will log detailed information about the project creation process.

## Migration Path

For existing users:

1. **Existing Projects**: Will continue to work with localStorage
2. **New Projects**: Will be created in database automatically
3. **Migration Tool**: Consider creating a tool to migrate localStorage projects to database
4. **Backward Compatibility**: System maintains compatibility with existing project structure
