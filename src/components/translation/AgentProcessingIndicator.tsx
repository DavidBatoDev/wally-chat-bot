'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentProcessingIndicatorProps {
  message: string;
  className?: string;
}

export function AgentProcessingIndicator({ message, className }: AgentProcessingIndicatorProps) {
  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 p-4 shadow-lg border-2 border-blue-200 bg-blue-50/95 backdrop-blur",
      "animate-in slide-in-from-bottom-2 fade-in duration-300",
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Bot className="h-8 w-8 text-blue-600" />
          <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Agent Processing</p>
          <p className="text-xs text-blue-700">{message}</p>
        </div>
        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
      </div>
    </Card>
  );
} 