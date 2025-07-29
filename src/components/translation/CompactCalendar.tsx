'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import type { Project } from '@/types/translation';

interface CompactCalendarProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
  onDayClick?: (date: Date, projects: Project[]) => void;
  title?: string;
}

export function CompactCalendar({ 
  projects, 
  onProjectClick, 
  onDayClick,
  title = "Project Calendar"
}: CompactCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar days for monthly view
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Get the start of the week that contains the first day of the month
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start for display
    
    // Get the end of the week that contains the last day of the month
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Sunday start for display
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const calendarDays = getCalendarDays();

  // Get projects for each day
  const getProjectsForDay = (date: Date) => {
    return projects.filter(project => {
      if (!project.deadline) return false;
      const projectDate = new Date(project.deadline);
      return isSameDay(projectDate, date);
    });
  };

  // Get status color for project
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ocr-processing':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'pending-confirmation':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'assigning-translator':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'assigned':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'in-progress':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'pm-review':
        return 'bg-pink-500 hover:bg-pink-600';
      case 'sent-back':
        return 'bg-red-500 hover:bg-red-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ocr-processing':
        return 'OCR';
      case 'pending-confirmation':
        return 'Confirm';
      case 'assigning-translator':
        return 'Assigning';
      case 'assigned':
        return 'Assigned';
      case 'in-progress':
        return 'In Progress';
      case 'pm-review':
        return 'PM Review';
      case 'sent-back':
        return 'Sent Back';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
  };

  const handleDayClick = (date: Date, dayProjects: Project[]) => {
    if (dayProjects.length > 0 && onDayClick) {
      onDayClick(date, dayProjects);
    }
  };

  return (
    <Card className="border-blue-200 shadow-sm h-full flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Calendar className="h-5 w-5 text-blue-600" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-10 w-10 p-0 text-blue-600 hover:bg-blue-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold text-blue-900 min-w-[140px] text-center">
              {format(currentDate, 'MMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-10 w-10 p-0 text-blue-600 hover:bg-blue-100"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-1 flex flex-col">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 h-full">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            const dayProjects = getProjectsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`min-h-[120px] p-3 border border-blue-100 rounded-lg ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'ring-2 ring-blue-500 shadow-md' : ''} hover:shadow-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300 hover:scale-[1.01] ${
                  dayProjects.length > 0 ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleDayClick(day, dayProjects)}
              >
                {/* Day Number */}
                <div className={`text-sm font-medium mb-3 ${
                  isCurrentMonth ? 'text-blue-900' : 'text-gray-400'
                } ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                  {format(day, 'd')}
                </div>

                {/* Projects */}
                <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-hide">
                  {dayProjects.slice(0, 3).map((project) => (
                    <div
                      key={project.id}
                      className={`${getStatusColor(project.status)} text-white text-xs px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-md`}
                      title={`${project.qCode} - ${project.clientName} (${getStatusLabel(project.status)})`}
                    >
                      <div className="font-semibold">{project.qCode}</div>
                      <div className="text-xs opacity-90 truncate mt-1">
                        {project.clientName}
                      </div>
                    </div>
                  ))}
                  
                  {/* Show more indicator */}
                  {dayProjects.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center py-2 bg-gray-100 rounded-lg">
                      +{dayProjects.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
} 