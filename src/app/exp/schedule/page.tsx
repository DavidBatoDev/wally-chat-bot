'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/translation/Sidebar';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle, Clock, AlertTriangle, Grid3X3, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ProjectDetailsModal } from '@/components/translation/ProjectDetailsModal';
import { CalendarSkeleton } from '@/components/translation/LoadingSkeletons';
import { StaggeredList } from '@/components/ui/animations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProjectCard } from '@/components/translation/ProjectCard';
import type { Project } from '@/types/translation';

export default function SchedulePage() {
  const router = useRouter();
  const { currentUser, projects, userRoles } = useTranslationStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');

  // Filter projects based on user role
  const filteredProjects = React.useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'translator') {
      // For translators, only show projects they are assigned to and have deadlines
      return projects.filter(project => 
        project.assignedTranslator === currentUser.id && 
        project.deadline && 
        ['assigned', 'in-progress', 'sent-back', 'pm-review', 'completed'].includes(project.status)
      );
    } else {
      // For project managers, show all projects with deadlines
      return projects.filter(project => project.deadline);
    }
  }, [currentUser, projects]);



  // Calculate project statistics based on filtered projects
  const totalProjects = filteredProjects.length;
  const completedProjects = filteredProjects.filter(p => p.status === 'completed').length;
  const pendingProjects = filteredProjects.filter(p => p.status !== 'completed').length;

  // Get calendar days based on view mode
  const getCalendarDays = () => {
    if (viewMode === 'weekly') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      // For monthly view, we need to show a full calendar grid
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      // Get the start of the week that contains the first day of the month
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start for display
      
      // Get the end of the week that contains the last day of the month
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Sunday start for display
      
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  };

  const calendarDays = getCalendarDays();

  // Get projects for each day
  const getProjectsForDay = (date: Date) => {
    return filteredProjects.filter(project => {
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
        return 'bg-orange-500 hover:bg-orange-600';
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

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setShowProjectModal(true);
  };

  const handleDayClick = (date: Date, projects: Project[]) => {
    if (projects.length > 0) {
      setSelectedDay(date);
      setShowDayModal(true);
    }
  };

  // Add loading and access control
  React.useEffect(() => {
    // Wait for store to be fully loaded (userRoles indicates store is ready)
    if (userRoles.length > 0) {
      if (!currentUser) {
        router.push('/exp/login');
      } else {
        setIsLoading(false);
      }
    }
  }, [currentUser, userRoles, router]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (viewMode === 'weekly') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-80 bg-gradient-to-b from-blue-50 to-white border-r border-blue-200">
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <CalendarSkeleton />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        onNewProject={() => {/* Navigate to project manager */}}
        onBulkUpload={() => {/* Implement bulk upload */}}
        onAssignTeam={() => {/* Implement team assignment */}}
        onGenerateReport={() => {/* Implement report generation */}}
      />
      
      <main className="flex-1 overflow-auto">
        <div className="min-h-full p-6 bg-gray-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">
                {currentUser.role === 'translator' ? 'My Project Schedule' : 'Project Schedule'}
              </h1>
              <p className="text-muted-foreground">
                {currentUser.role === 'translator' 
                  ? 'Monthly view of your assigned project deadlines' 
                  : 'Monthly view of all project deadlines'
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 mr-4">
                <Button
                  variant={viewMode === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('weekly')}
                  className={`flex items-center gap-1 ${
                    viewMode === 'weekly' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Week
                </Button>
                <Button
                  variant={viewMode === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('monthly')}
                  className={`flex items-center gap-1 ${
                    viewMode === 'monthly' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  Month
                </Button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigatePeriod('prev')}
                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold text-blue-900">
                {viewMode === 'weekly' 
                  ? `${format(calendarDays[0], 'MMM d')} - ${format(calendarDays[6], 'MMM d, yyyy')}`
                  : format(currentDate, 'MMMM yyyy')
                }
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigatePeriod('next')}
                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 hover:border-blue-300 transition-colors shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              {currentUser.role === 'translator' ? 'My Projects' : 'Total Projects'}
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalProjects}</div>
            <p className="text-xs text-blue-600">
              {currentUser.role === 'translator' 
                ? 'Projects assigned to you' 
                : 'All projects in the system'
              }
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 hover:border-blue-300 transition-colors shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              {currentUser.role === 'translator' ? 'My Pending' : 'Pending Projects'}
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingProjects}</div>
            <p className="text-xs text-blue-600">
              {currentUser.role === 'translator' 
                ? 'Your projects not yet completed' 
                : 'Projects not yet completed'
              }
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 hover:border-blue-300 transition-colors shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              {currentUser.role === 'translator' ? 'My Completed' : 'Completed Projects'}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedProjects}</div>
            <p className="text-xs text-blue-600">
              {currentUser.role === 'translator' 
                ? 'Your successfully completed projects' 
                : 'Successfully completed projects'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Calendar className="h-5 w-5 text-blue-600" />
            {currentUser.role === 'translator' ? 'My Project Calendar' : 'Project Calendar'} - {viewMode === 'weekly' ? 'Weekly View' : 'Monthly View'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Calendar Grid */}
          <div className={`grid grid-cols-7 gap-2 ${viewMode === 'weekly' ? 'min-h-[400px]' : ''}`}>
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
              const isCurrentPeriod = viewMode === 'weekly' 
                ? dayProjects.length > 0 || isSameDay(day, new Date())
                : isCurrentMonth;
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`${viewMode === 'weekly' ? 'min-h-[350px]' : 'min-h-[120px]'} p-3 border border-blue-100 rounded-lg ${
                    isCurrentPeriod ? 'bg-white' : 'bg-gray-50'
                  } ${isToday ? 'ring-2 ring-blue-500 shadow-md' : ''} hover:shadow-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300 hover:scale-[1.01] ${
                    dayProjects.length > 0 ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => handleDayClick(day, dayProjects)}
                >
                  {/* Day Number */}
                  <div className={`text-sm font-medium mb-3 ${
                    isCurrentMonth ? 'text-blue-900' : 'text-gray-400'
                  } ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                    {viewMode === 'weekly' ? format(day, 'EEE d') : format(day, 'd')}
                  </div>

                  {/* Projects */}
                  <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-hide">
                    {dayProjects.slice(0, viewMode === 'weekly' ? 10 : 3).map((project) => (
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
                    {dayProjects.length > (viewMode === 'weekly' ? 10 : 3) && (
                      <div className="text-xs text-muted-foreground text-center py-2 bg-gray-100 rounded-lg">
                        +{dayProjects.length - (viewMode === 'weekly' ? 10 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
          <CardTitle className="text-sm text-blue-900">Status Legend</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-sm">OCR Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm">Pending Confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">Assigning Translator</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm">PM Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm">Sent Back</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">Completed</span>
            </div>
          </div>
        </CardContent>
      </Card>

          {/* Day Projects Modal */}
          <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-900">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Projects for {selectedDay && format(selectedDay, 'EEEE, MMMM d, yyyy')}
                </DialogTitle>
              </DialogHeader>
              
              {selectedDay && (() => {
                const dayProjects = getProjectsForDay(selectedDay);
                const projectsByStatus = dayProjects.reduce((acc, project) => {
                  const status = project.status;
                  if (!acc[status]) {
                    acc[status] = [];
                  }
                  acc[status].push(project);
                  return acc;
                }, {} as Record<string, Project[]>);

                const statusOrder = [
                  'ocr-processing',
                  'pending-confirmation', 
                  'assigning-translator',
                  'assigned',
                  'in-progress',
                  'pm-review',
                  'sent-back',
                  'completed'
                ];

                return (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {dayProjects.length} project{dayProjects.length !== 1 ? 's' : ''} scheduled
                      </div>
                      <Badge variant="outline" className="border-blue-200 text-blue-700">
                        {Object.keys(projectsByStatus).length} status{Object.keys(projectsByStatus).length !== 1 ? 'es' : ''}
                      </Badge>
                    </div>

                    {statusOrder.map(status => {
                      const projects = projectsByStatus[status];
                      if (!projects || projects.length === 0) return null;

                      return (
                        <div key={status} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(status).replace('hover:bg-', 'bg-')}`}></div>
                            <h3 className="font-semibold text-blue-900 capitalize">
                              {getStatusLabel(status)} ({projects.length})
                            </h3>
                          </div>
                          <div className="grid gap-3">
                            {projects.map(project => (
                              <div 
                                key={project.id}
                                onClick={() => {
                                  setSelectedProject(project);
                                  setShowProjectModal(true);
                                  setShowDayModal(false);
                                }}
                                className="cursor-pointer"
                              >
                                <ProjectCard project={project} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Project Details Modal */}
          {selectedProject && (
            <ProjectDetailsModal
              project={selectedProject}
              open={showProjectModal}
              onOpenChange={setShowProjectModal}
            />
          )}
        </div>
      </main>
    </div>
  );
} 