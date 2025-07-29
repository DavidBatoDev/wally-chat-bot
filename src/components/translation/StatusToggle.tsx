'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type AvailabilityStatus = 'available' | 'busy' | 'offline';

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

const statusConfig: Record<AvailabilityStatus, StatusConfig> = {
  available: {
    label: 'Available',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
  busy: {
    label: 'Busy',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
  },
  offline: {
    label: 'Offline',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
  },
};

export function StatusToggle() {
  const { currentUser, teamMembers, updateTeamMember } = useTranslationStore();
  const [isChanging, setIsChanging] = useState(false);

  // Get current user's availability from teamMembers
  const currentTeamMember = teamMembers.find(
    member => member.id === currentUser?.id || member.name === currentUser?.name
  );
  
  const currentStatus: AvailabilityStatus = currentTeamMember?.availability || 'available';
  const config = statusConfig[currentStatus];

  const handleStatusChange = async (newStatus: AvailabilityStatus) => {
    if (!currentUser || !currentTeamMember) return;
    
    setIsChanging(true);
    
    try {
      // Update the team member's availability
      updateTeamMember(currentTeamMember.id, { availability: newStatus });
      
      const newConfig = statusConfig[newStatus];
      toast.success(`Status updated to ${newConfig.label}`, {
        description: `You are now marked as ${newConfig.label.toLowerCase()}`,
      });
    } catch (error) {
      toast.error('Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setIsChanging(false);
    }
  };

  if (!currentUser || !currentTeamMember) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-5 px-1.5 text-xs font-medium border transition-colors min-w-0",
            config.bgColor,
            config.textColor,
            "hover:opacity-80",
            isChanging && "opacity-50 cursor-not-allowed"
          )}
          disabled={isChanging}
        >
          <div className={cn("h-1.5 w-1.5 rounded-full mr-1 flex-shrink-0", config.color)} />
          <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-28">
        {(Object.entries(statusConfig) as [AvailabilityStatus, StatusConfig][]).map(([status, statusConf]) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
            className={cn(
              "flex items-center gap-2 cursor-pointer text-xs py-1.5",
              currentStatus === status && "bg-blue-50"
            )}
          >
            <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", statusConf.color)} />
            <span className="text-xs">{statusConf.label}</span>
            {currentStatus === status && (
              <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">
                •
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 