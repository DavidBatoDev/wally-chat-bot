# Share Project Feature Documentation

## Overview

The Share Project feature allows users to share their PDF editor projects with others via shareable links, similar to Google Docs. Users can control access permissions, require authentication, and manage who can view or edit their projects.

## Features

### 1. Share Modal
- **Google Docs-like Interface**: Clean, intuitive sharing modal with tabs for general access and people management
- **Share Link Generation**: Automatic generation of unique, shareable links
- **Copy to Clipboard**: One-click copy functionality for share links
- **Access Control**: Toggle between public and private access

### 2. Permission Levels
- **Viewer**: Read-only access to the project
- **Editor**: Full editing capabilities (future enhancement)

### 3. Security Options
- **Public Access**: Anyone with the link can access
- **Require Authentication**: Users must sign in to view the project
- **Private**: Only the owner can access (share link disabled)

### 4. Share Settings
- Default permissions for new viewers
- Authentication requirements
- Individual user invitations (UI ready, backend integration pending)

## Technical Implementation

### Frontend Components

#### ShareProjectModal (`src/app/pdf-editor/components/ShareProjectModal.tsx`)
- Main modal component with tabbed interface
- Manages share settings and link generation
- Handles permission updates

#### Share Button (PDFEditorHeader)
- Added share button with Share2 icon
- Triggers share modal opening
- Only visible when a project is saved

#### Shared Project Page (`src/app/pdf-editor/shared/[shareId]/page.tsx`)
- Dynamic route for accessing shared projects
- Handles authentication checks
- Shows appropriate UI based on permissions

### Backend Integration

#### API Endpoints (via projectApiService.ts)
- `getSharedProject(shareId)`: Fetch project by share ID
- `updateProjectShareSettings(projectId, settings)`: Update share settings
- `getProjectShareSettings(projectId)`: Get current share settings

#### Database Schema Updates
New columns added to `projects` table:
- `share_id`: Unique identifier for share links
- `share_permissions`: Default permission level (viewer/editor)
- `requires_auth`: Boolean flag for authentication requirement

#### SQL Functions
- `generate_share_id()`: Creates unique share identifiers
- `update_project_share_settings()`: Updates project sharing configuration
- `get_shared_project()`: Retrieves shared project with access control

#### Row Level Security (RLS)
- Policy for viewing public shared projects
- Policy for authenticated users accessing protected shares

## Usage Flow

### For Project Owners

1. **Save Project**: First save your project to enable sharing
2. **Click Share Button**: Opens the share modal
3. **Configure Settings**:
   - Toggle public/private access
   - Set default permissions (viewer/editor)
   - Choose authentication requirements
4. **Copy Share Link**: Click copy button to get the shareable URL
5. **Share**: Send the link to collaborators

### For Viewers

1. **Receive Link**: Get share link from project owner
2. **Open Link**: Navigate to the shared project URL
3. **Authentication** (if required):
   - Sign in if the project requires authentication
   - Continue as guest for public projects
4. **View/Edit**: Access the project based on granted permissions

## Share Link Format

```
https://[domain]/pdf-editor/shared/[shareId]
```

Example: `https://example.com/pdf-editor/shared/abc123xyz789`

## Security Considerations

1. **Unique Share IDs**: 20-character random strings ensure uniqueness
2. **Access Control**: RLS policies enforce permissions at database level
3. **Authentication Check**: Server-side validation for protected projects
4. **Owner Verification**: Only project owners can modify share settings

## Database Migration

Run the migration script in Supabase SQL editor:
```sql
-- Location: src/app/pdf-editor/migrations/add_share_columns.sql
```

This adds necessary columns, indexes, functions, and policies.

## Future Enhancements

1. **Email Invitations**: Send direct invites to specific users
2. **Expiring Links**: Set expiration dates for share links
3. **Access Logs**: Track who accessed shared projects
4. **Collaborative Editing**: Real-time collaboration for editor permissions
5. **Custom Permissions**: Granular control over specific features
6. **Share Analytics**: View statistics on shared project usage

## Environment Variables

No additional environment variables required. Uses existing Supabase configuration:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Testing the Feature

1. Create or load a project in the PDF editor
2. Save the project (required for sharing)
3. Click the share button in the header
4. Toggle "General Access" to enable sharing
5. Copy the generated link
6. Open the link in an incognito window to test access

## Troubleshooting

### Share button not visible
- Ensure project is saved first
- Check that `currentProjectId` is set

### Share link not working
- Verify the project is set to public
- Check database migration was run successfully
- Ensure share_id was generated correctly

### Authentication issues
- Verify Supabase auth is configured
- Check RLS policies are applied
- Ensure user session is valid

## Code Structure

```
src/app/pdf-editor/
├── components/
│   └── ShareProjectModal.tsx      # Share modal component
├── shared/
│   └── [shareId]/
│       └── page.tsx               # Shared project route
├── services/
│   └── projectApiService.ts      # API functions (updated)
├── migrations/
│   └── add_share_columns.sql     # Database migration
└── PDFEditorContent.tsx          # Main editor (updated)
```