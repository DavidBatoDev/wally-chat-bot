'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingMessageButtonProps {
  unreadCount?: number;
  onClick: () => void;
  className?: string;
}

export const FloatingMessageButton: React.FC<FloatingMessageButtonProps> = ({
  unreadCount = 0,
  onClick,
  className
}) => {
  return (
    <div className={cn("fixed bottom-6 right-6 z-40", className)}>
      <Button
        onClick={onClick}
        size="lg"
        className="relative h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 p-0"
      >
        <MessageCircle className="h-6 w-6 text-white" />
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </Button>
    </div>
  );
}; 