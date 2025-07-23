'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
  BarChart3,
  Calendar,
  Target,
  Languages,
  FileText,
  Activity,
  Trophy,
  CheckSquare,
  Shield,
  BookOpen,
  History,
  TrendingUp,
  Plus,
  Upload,
  UserPlus,
  FileBarChart,
  Check,
  X,
  HelpCircle,
  Edit,
  AlertCircle,
  ClipboardCheck,
  Star,
  LogOut,
  Bell,
} from 'lucide-react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SidebarNavItem, QuickAction, UserRoleType } from '@/types/translation';

interface SidebarProps {
  onNewProject?: () => void;
  onBulkUpload?: () => void;
  onAssignTeam?: () => void;
  onGenerateReport?: () => void;
  onAcceptAssignment?: () => void;
  onDeclineAssignment?: () => void;
  onMarkComplete?: () => void;
  onRequestHelp?: () => void;
  onNotificationClick?: () => void;
}

export function Sidebar({
  onNewProject,
  onBulkUpload,
  onAssignTeam,
  onGenerateReport,
  onAcceptAssignment,
  onDeclineAssignment,
  onMarkComplete,
  onRequestHelp,
  onNotificationClick,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { currentUser, notifications, teamMembers, projects, setCurrentUser } = useTranslationStore();
  
  const unreadNotifications = notifications.filter(n => !n.read && n.userId === currentUser?.id).length;
  
  // Calculate project stats
  const projectStats = {
    total: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    inProgress: projects.filter(p => ['in-progress', 'pm-review'].includes(p.status)).length,
    pending: projects.filter(p => ['ocr-processing', 'pending-confirmation', 'assigning-translator', 'assigned'].includes(p.status)).length,
  };
  
  // Get role-specific navigation items
  const getNavItems = (role: UserRoleType): SidebarNavItem[] => {
    switch (role) {
      case 'project-manager':
        return [
          { title: 'Dashboard', href: '/exp/project-manager', icon: LayoutDashboard },
          { title: 'Team Management', href: '/exp/project-manager/team', icon: Users },
          { title: 'Analytics', href: '/exp/project-manager/analytics', icon: BarChart3 },
          { title: 'Schedule', href: '/exp/project-manager/schedule', icon: Calendar },
          { title: 'Goals', href: '/exp/project-manager/goals', icon: Target },
        ];
      case 'translator':
        return [
          { title: 'My Projects', href: '/exp/translator', icon: FileText },
          { title: 'Translation Tools', href: '/exp/translator/tools', icon: Languages },
          { title: 'Language Pairs', href: '/exp/translator/languages', icon: Languages },
          { title: 'Activity Log', href: '/exp/translator/activity', icon: Activity },
          { title: 'Performance', href: '/exp/translator/performance', icon: Trophy },
        ];
      default:
        return [];
    }
  };
  
  // Get role-specific quick actions
  const getQuickActions = (role: UserRoleType): QuickAction[] => {
    switch (role) {
      case 'project-manager':
        return [
          { title: 'New Project', icon: Plus, action: onNewProject || (() => {}) },
          { title: 'Bulk Upload', icon: Upload, action: onBulkUpload || (() => {}) },
          { title: 'Assign Team', icon: UserPlus, action: onAssignTeam || (() => {}) },
          { title: 'Generate Report', icon: FileBarChart, action: onGenerateReport || (() => {}) },
        ];
      case 'translator':
        return [
          { title: 'Accept Assignment', icon: Check, action: onAcceptAssignment || (() => {}) },
          { title: 'Decline Assignment', icon: X, action: onDeclineAssignment || (() => {}) },
          { title: 'Mark Complete', icon: CheckSquare, action: onMarkComplete || (() => {}) },
          { title: 'Request Help', icon: HelpCircle, action: onRequestHelp || (() => {}) },
        ];
      default:
        return [];
    }
  };
  
  // Get role-specific stats
  const getRoleStats = (role: UserRoleType) => {
    switch (role) {
      case 'project-manager':
        return projectStats;
      case 'translator':
        const myProjects = projects.filter(p => p.assignedTranslator === currentUser?.name);
        return {
          assigned: myProjects.filter(p => p.status === 'assigned').length,
          inProgress: myProjects.filter(p => p.status === 'in-progress').length,
          completed: myProjects.filter(p => ['pm-review', 'completed'].includes(p.status)).length,
          overdue: myProjects.filter(p => new Date(p.deadline) < new Date()).length,
        };
      default:
        return {};
    }
  };
  
  if (!currentUser) return null;
  
  const navItems = getNavItems(currentUser.role);
  const quickActions = getQuickActions(currentUser.role);
  const stats = getRoleStats(currentUser.role);
  
  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r bg-background transition-all duration-300",
        isCollapsed ? "w-16" : "w-80"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-4 top-4 z-10 h-8 w-8 rounded-full border bg-background"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
      
      {/* User Profile */}
      <div className="flex items-center gap-3 border-b p-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={currentUser.avatar} />
          <AvatarFallback>{currentUser.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="flex-1">
            <p className="text-sm font-medium">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{currentUser.role.replace('-', ' ')}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={onNotificationClick}
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
              {unreadNotifications}
            </Badge>
          )}
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {/* Navigation */}
        <div className="space-y-1 p-2">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                isCollapsed && "justify-center"
              )}
            >
              <item.icon className="h-4 w-4" />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </a>
          ))}
        </div>
        
        {!isCollapsed && (
          <>
            <Separator className="my-4" />
            
            {/* Quick Actions */}
            <div className="px-4">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Quick Actions
              </h3>
              <div className="space-y-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={action.action}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.title}
                  </Button>
                ))}
              </div>
            </div>
            
            <Separator className="my-4" />
            
            {/* Stats Overview */}
            <div className="px-4">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {currentUser.role === 'project-manager' ? 'Project Overview' : 
                 currentUser.role === 'translator' ? 'Work Stats' : 'Review Stats'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    <p className="text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Team Management (PM only) */}
            {currentUser.role === 'project-manager' && (
              <>
                <Separator className="my-4" />
                <div className="px-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Team Management
                  </h3>
                  <div className="space-y-2">
                    {teamMembers.slice(0, 4).map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-xs font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "h-2 w-2 rounded-full p-0",
                            member.availability === 'available' && 'bg-green-500',
                            member.availability === 'busy' && 'bg-yellow-500',
                            member.availability === 'offline' && 'bg-gray-500'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </ScrollArea>
      
      {/* Logout */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")}
          onClick={() => setCurrentUser(null)}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );
} 