import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { WorkflowData } from '../types/workflow';

export const useWorkflowData = (conversationId: string) => {
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [hasWorkflow, setHasWorkflow] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflowData = useCallback(async () => {
    if (!conversationId) {
      setHasWorkflow(false);
      setWorkflowData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/workflow/${conversationId}`);
      setHasWorkflow(response.data.has_workflow);
      setWorkflowData(response.data.workflow_data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setHasWorkflow(false);
        setWorkflowData(null);
        setError(null);
        return;
      }
      
      setError(err.response?.data?.message || 'Failed to load workflow');
      setHasWorkflow(false);
      setWorkflowData(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const handleFieldUpdate = useCallback(async (fieldKey: string, newValue: string, isTranslatedView: boolean) => {
    if (!workflowData?.fields) return;

    const existingField = workflowData.fields[fieldKey] || {
      value: '',
      value_status: 'pending',
      translated_value: null,
      translated_status: 'pending'
    };

    const updatedFields = {
      ...workflowData.fields,
      [fieldKey]: {
        ...existingField,
        ...(isTranslatedView 
          ? {
              translated_value: newValue,
              translated_status: 'edited' as const
            }
          : {
              value: newValue,
              value_status: 'edited' as const
            }
        )
      }
    };

    setWorkflowData(prev => prev ? ({ ...prev, fields: updatedFields }) : null);

    try {
      const updateData = {
        field_key: fieldKey,
        value: isTranslatedView ? existingField.value : newValue,
        value_status: isTranslatedView ? existingField.value_status : 'edited',
        translated_value: isTranslatedView ? newValue : existingField.translated_value,
        translated_status: isTranslatedView ? 'edited' : existingField.translated_status
      };

      await api.patch(`/api/workflow/${conversationId}/field`, updateData);
    } catch (err: any) {
      setWorkflowData(prev => prev ? ({ ...prev, fields: workflowData.fields }) : null);
    }
  }, [conversationId, workflowData]);

  return {
    workflowData,
    loading,
    error,
    hasWorkflow,
    fetchWorkflowData,
    handleFieldUpdate
  };
};