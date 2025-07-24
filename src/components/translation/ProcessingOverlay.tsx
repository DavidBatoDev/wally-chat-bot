"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProcessingOverlayProps {
  progress: number;
  message: string;
}

export function ProcessingOverlay({ progress, message }: ProcessingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Processing</h3>
              <p className="text-sm text-muted-foreground mb-4">{message}</p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 