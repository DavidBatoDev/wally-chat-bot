# PDF Editor Supabase Database Schema

This document outlines the simplified single-table database schema with JSONB support and offline capabilities for the PDF Editor project.

## Architecture Overview

This design uses a **single table approach** with JSONB columns to store complex project data. This enables:

- Simple save/load operations
- Offline mode support with easy synchronization
- Fast project loading (single query)
- Flexible schema evolution

## Database Table

### `projects` Table

Single table storing all project data with JSONB columns for complex structures.

```sql
CREATE TABLE projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    version VARCHAR(20) DEFAULT '1.0.0',

    -- Complete project state as JSONB
    project_data JSONB NOT NULL,

    -- Extracted fields for indexing and querying
    current_page INTEGER DEFAULT 1,
    num_pages INTEGER DEFAULT 0,
    current_workflow_step VARCHAR(20) DEFAULT 'translate',
    source_language VARCHAR(10) DEFAULT '',
    desired_language VARCHAR(10) DEFAULT '',

    -- Metadata
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    file_size BIGINT,

    -- Offline sync support
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
    local_version INTEGER DEFAULT 1,
    server_version INTEGER DEFAULT 1,

    CONSTRAINT projects_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255)
);
```

## JSONB Project Data Structure

The `project_data` JSONB column contains the complete project state:

```typescript
interface ProjectDataStructure {
  // Document state
  documentState: {
    url: string;
    currentPage: number;
    numPages: number;
    scale: number;
    pageWidth: number;
    pageHeight: number;
    fileType: string | null;
    imageDimensions: { width: number; height: number } | null;
    pdfBackgroundColor: string;
    detectedPageBackgrounds: Record<number, string>;
    pages: Array<{
      pageNumber: number;
      isTranslated: boolean;
      backgroundColor?: string;
      pageType?: string;
      birthCertTemplate?: any;
      birthCertType?: string;
      translatedTemplateURL?: string;
      translatedTemplateWidth?: number;
      translatedTemplateHeight?: number;
    }>;
    deletedPages: number[];
    isTransforming: boolean;
  };

  // View state
  viewState: {
    currentView: "original" | "translated" | "split";
    currentWorkflowStep: string;
    activeSidebarTab: string;
    isSidebarCollapsed: boolean;
    isCtrlPressed: boolean;
    zoomMode?: "page" | "width";
    containerWidth?: number;
    transformOrigin?: string;
  };

  // All UI elements
  elementCollections: {
    originalTextBoxes: TextBox[];
    originalShapes: Shape[];
    originalImages: Image[];
    originalDeletionRectangles: DeletionRectangle[];
    translatedTextBoxes: TextBox[];
    translatedShapes: Shape[];
    translatedImages: Image[];
    translatedDeletionRectangles: DeletionRectangle[];
    untranslatedTexts: UntranslatedText[];
  };

  // Layer state
  layerState: {
    originalLayerOrder: string[];
    translatedLayerOrder: string[];
  };

  // Editor state
  editorState: {
    selectedFieldId: string | null;
    selectedShapeId: string | null;
    isEditMode: boolean;
    isAddTextBoxMode: boolean;
    isTextSelectionMode: boolean;
    showDeletionRectangles: boolean;
    isImageUploadMode: boolean;
    isSelectionMode: boolean;
  };

  // Language settings
  sourceLanguage: string;
  desiredLanguage: string;

  // File references
  originalDocumentFile?: {
    name: string;
    size: number;
    type: string;
    url?: string; // Supabase storage URL
  };
}
```

## Indexes for Performance

```sql
-- Indexes for common queries
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_projects_workflow_step ON projects(current_workflow_step);
CREATE INDEX idx_projects_sync_status ON projects(sync_status);
CREATE INDEX idx_projects_languages ON projects(source_language, desired_language);

-- JSONB indexes for searching within project data
CREATE INDEX idx_projects_data_gin ON projects USING GIN (project_data);
CREATE INDEX idx_projects_elements ON projects USING GIN ((project_data->'elementCollections'));
```

## Storage Buckets (Optional)

### `project-files` Bucket

For storing original documents and images (if not using base64 embedding).

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- RLS Policies
CREATE POLICY "Users can manage their project files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'project-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
```

## Offline Mode Support

### Sync Status Management

The table includes fields to support offline mode:

- `last_synced_at`: When the project was last synchronized with the server
- `sync_status`: Current sync state (`synced`, `pending`, `conflict`)
- `local_version`: Version number for local changes
- `server_version`: Version number from server

### Conflict Resolution Strategy

```typescript
interface SyncConflict {
  projectId: string;
  localVersion: number;
  serverVersion: number;
  localData: ProjectDataStructure;
  serverData: ProjectDataStructure;
  conflictFields: string[];
}

// Resolution strategies:
// 1. "server-wins" - Use server data
// 2. "local-wins" - Use local data
// 3. "merge" - Attempt to merge changes
// 4. "manual" - Require user intervention
```

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can manage their own projects
CREATE POLICY "Users can manage their projects" ON projects
    FOR ALL USING (created_by = auth.uid());

-- Optional: Public projects (if is_public = true)
CREATE POLICY "Anyone can view public projects" ON projects
    FOR SELECT USING (is_public = true);
```

## Database Functions

### Update Timestamp Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to projects table
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Sync Version Management Function

```sql
CREATE OR REPLACE FUNCTION increment_server_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.server_version = OLD.server_version + 1;
    NEW.last_synced_at = NOW();
    NEW.sync_status = 'synced';
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to projects table
CREATE TRIGGER increment_version_on_update BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION increment_server_version();
```

## API Integration Examples

### Save Project (Single Table Approach)

```typescript
// Save complete project to Supabase (simplified)
const saveProjectToSupabase = async (projectData: ProjectState) => {
  const { data: project, error } = await supabase
    .from("projects")
    .upsert({
      id: projectData.id,
      name: projectData.name,
      description: projectData.description,
      project_data: projectData, // Complete project state as JSONB
      current_page: projectData.documentState.currentPage,
      num_pages: projectData.documentState.numPages,
      current_workflow_step: projectData.viewState.currentWorkflowStep,
      source_language: projectData.sourceLanguage,
      desired_language: projectData.desiredLanguage,
      local_version: projectData.localVersion || 1,
    })
    .select()
    .single();

  if (error) throw error;
  return project;
};
```

### Load Project (Single Query)

```typescript
// Load complete project from Supabase
const loadProjectFromSupabase = async (
  projectId: string
): Promise<ProjectState> => {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) throw error;

  // Return the complete project state from JSONB
  return {
    ...project.project_data,
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    serverVersion: project.server_version,
    syncStatus: project.sync_status,
  };
};
```

### Offline Sync Support

```typescript
// Sync local changes with server
const syncProject = async (localProject: ProjectState) => {
  const { data: serverProject, error } = await supabase
    .from("projects")
    .select("server_version, project_data")
    .eq("id", localProject.id)
    .single();

  if (error) throw error;

  // Check for conflicts
  if (serverProject.server_version > localProject.serverVersion) {
    // Handle conflict
    return {
      status: "conflict",
      localData: localProject,
      serverData: serverProject.project_data,
    };
  }

  // No conflict, save local changes
  const { data: updatedProject, error: updateError } = await supabase
    .from("projects")
    .update({
      project_data: localProject,
      local_version: localProject.localVersion + 1,
    })
    .eq("id", localProject.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    status: "synced",
    project: updatedProject,
  };
};
```

This simplified single-table approach with JSONB provides easy save/load operations and built-in offline sync support.
