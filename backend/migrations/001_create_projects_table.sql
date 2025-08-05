-- Migration: Create projects table for PDF Editor project state management
-- This migration creates a comprehensive single-table solution with JSONB support
-- for storing complete project state instead of using localStorage

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    -- Primary identifiers
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- User association
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Version control
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Complete project state as JSONB
    -- This stores the entire ProjectState interface from useProjectState.ts
    project_data JSONB NOT NULL,
    
    -- Extracted fields for indexing and querying
    -- These duplicate data from project_data for performance
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
    
    -- Constraints
    CONSTRAINT projects_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_workflow_step ON projects(current_workflow_step);
CREATE INDEX IF NOT EXISTS idx_projects_sync_status ON projects(sync_status);
CREATE INDEX IF NOT EXISTS idx_projects_languages ON projects(source_language, desired_language);

-- JSONB indexes for searching within project data
CREATE INDEX IF NOT EXISTS idx_projects_data_gin ON projects USING GIN (project_data);
CREATE INDEX IF NOT EXISTS idx_projects_elements ON projects USING GIN ((project_data->'elementCollections'));
CREATE INDEX IF NOT EXISTS idx_projects_document_state ON projects USING GIN ((project_data->'documentState'));

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to manage server version for sync support
CREATE OR REPLACE FUNCTION increment_server_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if project_data actually changed
    IF OLD.project_data IS DISTINCT FROM NEW.project_data THEN
        NEW.server_version = OLD.server_version + 1;
        NEW.last_synced_at = NOW();
        NEW.sync_status = 'synced';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to increment version on project data updates
CREATE TRIGGER increment_version_on_update 
    BEFORE UPDATE ON projects
    FOR EACH ROW 
    EXECUTE FUNCTION increment_server_version();

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own projects
CREATE POLICY "Users can manage their projects" ON projects
    FOR ALL USING (created_by = auth.uid());

-- RLS Policy: Anyone can view public projects (optional)
CREATE POLICY "Anyone can view public projects" ON projects
    FOR SELECT USING (is_public = true);

-- Create storage bucket for project files (if needed)
-- This is optional - you can store files as base64 in JSONB or use Supabase storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy for storage bucket
CREATE POLICY "Users can manage their project files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'project-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Function to validate project data structure (optional but recommended)
CREATE OR REPLACE FUNCTION validate_project_data(data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic validation of required fields in project_data
    RETURN (
        data ? 'documentState' AND
        data ? 'viewState' AND
        data ? 'elementCollections' AND
        data ? 'layerState' AND
        data ? 'editorState' AND
        data ? 'sourceLanguage' AND
        data ? 'desiredLanguage'
    );
END;
$$ language 'plpgsql';

-- Add check constraint to validate project data structure
ALTER TABLE projects 
ADD CONSTRAINT valid_project_data 
CHECK (validate_project_data(project_data));

-- Create a view for easy project listing with metadata
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    id,
    name,
    description,
    created_at,
    updated_at,
    created_by,
    current_page,
    num_pages,
    current_workflow_step,
    source_language,
    desired_language,
    is_public,
    tags,
    thumbnail_url,
    file_size,
    sync_status,
    server_version,
    -- Extract some useful metadata from JSONB
    (project_data->'documentState'->>'url') as document_url,
    (project_data->'documentState'->>'fileType') as file_type,
    jsonb_array_length(COALESCE(project_data->'elementCollections'->'originalTextBoxes', '[]'::jsonb)) as text_boxes_count,
    jsonb_array_length(COALESCE(project_data->'elementCollections'->'originalImages', '[]'::jsonb)) as images_count
FROM projects;

-- Grant necessary permissions (adjust as needed for your auth setup)
-- GRANT ALL ON projects TO authenticated;
-- GRANT ALL ON project_summary TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE projects IS 'Stores complete PDF editor project state with JSONB for flexible schema';
COMMENT ON COLUMN projects.project_data IS 'Complete project state matching ProjectState interface from useProjectState.ts';
COMMENT ON COLUMN projects.sync_status IS 'Offline sync status: synced, pending, or conflict';
COMMENT ON COLUMN projects.local_version IS 'Version number for local changes (client-side)';
COMMENT ON COLUMN projects.server_version IS 'Version number from server (auto-incremented)';