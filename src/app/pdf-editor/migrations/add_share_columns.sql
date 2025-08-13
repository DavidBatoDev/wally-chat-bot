-- Migration to add share functionality to projects table
-- Run this in your Supabase SQL editor

-- Add share-related columns to projects table if they don't exist
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS share_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS share_permissions VARCHAR(20) DEFAULT 'viewer' CHECK (share_permissions IN ('viewer', 'editor')),
ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT false;

-- Create index for share_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_id ON projects(share_id) WHERE share_id IS NOT NULL;

-- Update RLS policies to allow viewing shared projects
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view public projects" ON projects;

-- Create new policy for public projects with share_id
CREATE POLICY "Anyone can view shared public projects" ON projects
    FOR SELECT USING (
        is_public = true 
        AND share_id IS NOT NULL
    );

-- Create policy for authenticated users to view shared projects that require auth
CREATE POLICY "Authenticated users can view shared projects requiring auth" ON projects
    FOR SELECT USING (
        auth.uid() IS NOT NULL 
        AND is_public = true 
        AND share_id IS NOT NULL 
        AND requires_auth = true
    );

-- Function to generate unique share_id
CREATE OR REPLACE FUNCTION generate_share_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..20 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update share settings
CREATE OR REPLACE FUNCTION update_project_share_settings(
    p_project_id UUID,
    p_is_public BOOLEAN,
    p_share_permissions VARCHAR(20) DEFAULT 'viewer',
    p_requires_auth BOOLEAN DEFAULT false
)
RETURNS projects AS $$
DECLARE
    v_project projects;
    v_share_id VARCHAR(255);
BEGIN
    -- Check if user owns the project
    SELECT * INTO v_project 
    FROM projects 
    WHERE id = p_project_id AND created_by = auth.uid();
    
    IF v_project IS NULL THEN
        RAISE EXCEPTION 'Project not found or access denied';
    END IF;
    
    -- Generate share_id if making public and doesn't have one
    IF p_is_public AND v_project.share_id IS NULL THEN
        v_share_id := generate_share_id();
        
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM projects WHERE share_id = v_share_id) LOOP
            v_share_id := generate_share_id();
        END LOOP;
    ELSE
        v_share_id := v_project.share_id;
    END IF;
    
    -- Update project
    UPDATE projects 
    SET 
        is_public = p_is_public,
        share_id = CASE 
            WHEN p_is_public THEN v_share_id 
            ELSE NULL 
        END,
        share_permissions = p_share_permissions,
        requires_auth = p_requires_auth,
        updated_at = NOW()
    WHERE id = p_project_id
    RETURNING * INTO v_project;
    
    RETURN v_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get shared project by share_id
CREATE OR REPLACE FUNCTION get_shared_project(p_share_id VARCHAR(255))
RETURNS projects AS $$
DECLARE
    v_project projects;
BEGIN
    SELECT * INTO v_project
    FROM projects
    WHERE share_id = p_share_id AND is_public = true;
    
    IF v_project IS NULL THEN
        RAISE EXCEPTION 'Shared project not found';
    END IF;
    
    -- Check if authentication is required
    IF v_project.requires_auth AND auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to view this project';
    END IF;
    
    RETURN v_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_project_share_settings TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_project TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_share_id TO authenticated;