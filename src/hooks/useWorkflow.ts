// client/src/hooks/useWorkflow.ts
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface TemplateMappingFont {
  name: string;
  size: number;
  color: string;
}

export interface TemplateMappingPosition {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TemplateMappingBboxCenter {
  x: number;
  y: number;
}

export interface TemplateMapping {
  label: string;
  font: TemplateMappingFont;
  position: TemplateMappingPosition;
  bbox_center: TemplateMappingBboxCenter;
  alignment: string;
  page_number: number;
}


export type WorkflowFieldStatus = "ocr" | "pending" | "edited" | "confirmed";
export type TranslatedFieldStatus =
  | "pending"
  | "translated"
  | "completed"
  | "edited"

export interface WorkflowField {
  value: string;
  value_status: WorkflowFieldStatus;
  translated_value: string | null;
  translated_status: TranslatedFieldStatus;
  isCustomField?: boolean;
}


interface WorkflowData {
  file_id: string;
  base_file_public_url?: string;
  template_id: string;
  template_file_public_url?: string;
  origin_template_mappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  template_translated_id: string;
  template_translated_file_public_url?: string;
  translated_template_mappings?: Record<string, TemplateMapping>;
  translate_to: string;
  translate_from: string;
  shapes?: any[];
  deletion_rectangles?: any[];
}

interface UseWorkflowReturn {
  hasWorkflow: boolean;
  workflowData: WorkflowData | null;
  loading: boolean;
  error: string | null;
  refreshWorkflow: () => Promise<void>;
  checkWorkflow: () => Promise<void>; // New method for manual checks
}

export default function useWorkflow(conversationId?: string): UseWorkflowReturn {
  const [hasWorkflow, setHasWorkflow] = useState<boolean>(false);
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch workflow data from API
  const fetchWorkflow = useCallback(async (showLoading = true) => {
    if (!conversationId) {
      setHasWorkflow(false);
      setWorkflowData(null);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await api.get(`/api/workflow/${conversationId}`);
      
      console.log('Workflow check result:', {
        conversationId,
        hasWorkflow: response.data.has_workflow,
        hasData: !!response.data.workflow_data
      });
      
      setHasWorkflow(response.data.has_workflow);
      setWorkflowData(response.data.workflow_data);
    } catch (err: any) {
      console.error('Error fetching workflow:', err);
      
      // Handle 404 specifically - no workflow exists (this is normal)
      if (err.response?.status === 404) {
        setHasWorkflow(false);
        setWorkflowData(null);
        setError(null); // Clear error for 404
        return;
      }
      
      // For other errors, set error state
      setError(err.response?.data?.message || 'Failed to load workflow');
      setHasWorkflow(false);
      setWorkflowData(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [conversationId]);

  // Initial load when conversationId changes
  useEffect(() => {
    if (conversationId) {
      fetchWorkflow(true);
    } else {
      setHasWorkflow(false);
      setWorkflowData(null);
      setLoading(false);
      setError(null);
    }
  }, [conversationId, fetchWorkflow]);

  // Method for manual workflow checks (after messages)
  const checkWorkflow = useCallback(async () => {
    await fetchWorkflow(false); // Don't show loading spinner for background checks
  }, [fetchWorkflow]);

  const refreshWorkflow = useCallback(async () => {
    await fetchWorkflow(true);
  }, [fetchWorkflow]);

  return {
    hasWorkflow,
    workflowData,
    loading,
    error,
    refreshWorkflow,
    checkWorkflow
  };
}