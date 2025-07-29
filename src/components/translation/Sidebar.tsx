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
  Search,
  RotateCcw, // Add this for the reset icon
} from 'lucide-react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GlobalSearch } from '@/components/translation/GlobalSearch';
import { useGlobalNotifications } from '@/components/translation/GlobalNotificationProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SidebarNavItem, QuickAction, UserRoleType } from '@/types/translation';
import { StatusToggle } from '@/components/translation/StatusToggle';

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
  const { 
    currentUser, 
    projects, 
    teamMembers, 
    userRoles, 
    notifications,
    setCurrentUser,
    clearAllData,
    initializeSampleData,
  } = useTranslationStore();
  const { toggleNotifications } = useGlobalNotifications();
  const router = useRouter();
  
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
          { title: 'Team Management', href: '/exp/team', icon: Users },
          { title: 'Analytics', href: '/exp/analytics', icon: BarChart3 },
          { title: 'Schedule', href: '/exp/schedule', icon: Calendar },
        ];
      case 'translator':
        return [
          { title: 'My Projects', href: '/exp/translator', icon: FileText },
          { title: 'Translation Tools', href: '/exp/translator/tools', icon: Languages },
          { title: 'Language Pairs', href: '/exp/translator/languages', icon: Languages },
          { title: 'Schedule', href: '/exp/schedule', icon: Calendar },
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
        const myProjects = projects.filter(p => p.assignedTranslator === currentUser?.id);
        return {
          assigned: myProjects.filter(p => p.status === 'assigned').length,
          inProgress: myProjects.filter(p => ['in-progress', 'sent-back'].includes(p.status)).length,
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
        "flex flex-col h-full bg-white border-r border-blue-100 shadow-sm transition-all duration-300",
        isCollapsed ? "w-16" : "w-72"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Languages className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-blue-900 truncate">Translation Hub</h2>
              <p className="text-xs text-blue-600 truncate">Project Management</p>
            </div>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 p-0 hover:bg-blue-100 flex-shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-blue-600" />
          )}
        </Button>
      </div>

      {/* User Profile */}
      <div className="p-3 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={currentUser?.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
              {currentUser?.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentUser?.name}
                </p>
                <p className="text-xs text-blue-600 capitalize truncate">
                  {currentUser?.role?.replace('-', ' ')}
                </p>
              </div>
              <StatusToggle />
            </div>
          )}
        </div>
      </div>

      {/* Global Search */}
      {!isCollapsed && (
        <div className="p-3 border-b border-blue-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Project Stats */}
      {!isCollapsed && (
        <div className="p-3 border-b border-blue-100">
          <div className="grid grid-cols-2 gap-2">
            {currentUser.role === 'project-manager' ? (
              <>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{projectStats.total}</div>
                  <div className="text-xs text-blue-600">Total</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{projectStats.completed}</div>
                  <div className="text-xs text-green-600">Done</div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{(stats as any).assigned + (stats as any).inProgress + (stats as any).completed}</div>
                  <div className="text-xs text-blue-600">Total</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{(stats as any).completed}</div>
                  <div className="text-xs text-green-600">Done</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = false; // TODO: Implement proper active state detection
            
            return (
              <Button
                key={index}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-9 px-3",
                  isActive 
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "hover:bg-blue-50 text-gray-700 hover:text-blue-700",
                  isCollapsed && "justify-center px-0"
                )}
                onClick={() => router.push(item.href)}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
              </Button>
            );
          })}
        </div>

        {/* Role-specific Actions */}
        {!isCollapsed && quickActions.length > 0 && (
          <div className="py-2">
            <Separator className="my-2" />
            <div className="px-2 py-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Actions
              </p>
            </div>
            <div className="space-y-1">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-8 px-3 text-sm hover:bg-blue-50 text-gray-600 hover:text-blue-700"
                    onClick={action.action}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{action.title}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-blue-100 space-y-2">
        {/* Dev Reset Button - Only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-9 px-3 text-orange-600 hover:bg-orange-50 hover:text-orange-700 border border-orange-200",
              isCollapsed && "justify-center px-0"
            )}
            onClick={() => {
              clearAllData();
              initializeSampleData();
              toast.success('Storage state reset to initial state! 🔄', {
                description: 'All data has been cleared and sample data has been reloaded.',
              });
            }}
            title="Reset storage to initial state (Dev only)"
          >
            <RotateCcw className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm truncate">Reset Dev Data</span>}
          </Button>
        )}

        {/* Notifications */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-9 px-3 hover:bg-blue-50 text-gray-700 hover:text-blue-700",
            isCollapsed && "justify-center px-0"
          )}
          onClick={toggleNotifications}
        >
          <div className="relative flex-shrink-0">
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </Badge>
            )}
          </div>
          {!isCollapsed && <span className="text-sm truncate">Notifications</span>}
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-9 px-3 text-red-600 hover:bg-red-50 hover:text-red-700",
            isCollapsed && "justify-center px-0"
          )}
          onClick={() => {
            setCurrentUser(null);
            router.push('/exp/login');
          }}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm truncate">Logout</span>}
        </Button>
      </div>
    </div>
  );
} 