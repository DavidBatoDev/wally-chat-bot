'use client';

import React from 'react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Search, CheckCircle } from 'lucide-react';

interface TranslatorAssignmentIndicatorProps {
  projectId: string;
}

export function TranslatorAssignmentIndicator({ projectId }: TranslatorAssignmentIndicatorProps) {
  const { processingState } = useTranslationStore();
  
  const isProcessing = processingState.activeProcessing.has(projectId);
  const progress = processingState.processingProgress.get(projectId) || 0;
  
  if (!isProcessing) return null;

  const getProcessingMessage = () => {
    if (progress < 30) {
      return "Analyzing project requirements...";
    } else if (progress < 60) {
      return "Searching for available translators...";
    } else if (progress < 90) {
      return "Evaluating translator skills and availability...";
    } else {
      return "Finalizing assignment...";
    }
  };

  const getIcon = () => {
    if (progress < 30) {
      return <Search className="h-4 w-4 animate-pulse" />;
    } else if (progress < 60) {
      return <Users className="h-4 w-4 animate-pulse" />;
    } else if (progress < 90) {
      return <Users className="h-4 w-4 animate-bounce" />;
    } else {
      return <CheckCircle className="h-4 w-4 animate-pulse" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 border-blue-200 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              {getIcon()}
              <span className="font-semibold text-blue-700">Agent Processing</span>
            </div>
            <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700">
              {Math.round(progress)}%
            </Badge>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {getProcessingMessage()}
            </p>
            
            <Progress 
              value={progress} 
              className="h-2"
            />
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>AI Agent</span>
              <span>Finding best translator match...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 