'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Filter,
  Search,
  Settings,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Archive,
  Star,
  StarOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/translation';
import { useTranslationStore } from '@/lib/store/TranslationStore';

// Extended notification type with additional metadata
interface ExtendedNotification extends Notification {
  priority?: 'high' | 'medium' | 'low';
  category?: 'project' | 'team' | 'system' | 'deadline';
  starred?: boolean;
  archived?: boolean;
  relatedProjectId?: string;
  actionUrl?: string;
}

// Notification grouping logic
const groupNotifications = (notifications: ExtendedNotification[]) => {
  const groups: Record<string, ExtendedNotification[]> = {};
  
  notifications.forEach(notification => {
    const date = parseISO(notification.createdAt);
    let groupKey: string;
    
    if (isToday(date)) {
      groupKey = 'Today';
    } else if (isYesterday(date)) {
      groupKey = 'Yesterday';
    } else {
      groupKey = format(date, 'EEEE, MMMM d');
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
  });
  
  return groups;
};

interface SmartNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmartNotificationCenter: React.FC<SmartNotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { notifications, currentUser, markNotificationAsRead, clearNotifications } = useTranslationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  
  // Filter user notifications and extend with metadata
  const userNotifications = useMemo(() => {
    return notifications
      .filter(n => n.userId === currentUser?.id)
      .map(n => ({
        ...n,
        priority: determinePriority(n),
        category: determineCategory(n),
        starred: false,
        archived: false,
      } as ExtendedNotification));
  }, [notifications, currentUser]);

  // Apply filters
  const filteredNotifications = useMemo(() => {
    let filtered = userNotifications;

    // Tab filter
    if (selectedTab === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (selectedTab === 'starred') {
      filtered = filtered.filter(n => n.starred);
    } else if (selectedTab === 'high-priority') {
      filtered = filtered.filter(n => n.priority === 'high');
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(n => n.category === filterCategory);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(n => n.priority === filterPriority);
    }

    // Archive filter
    if (!showArchived) {
      filtered = filtered.filter(n => !n.archived);
    }

    return filtered;
  }, [userNotifications, selectedTab, searchQuery, filterCategory, filterPriority, showArchived]);

  // Group notifications
  const groupedNotifications = useMemo(() => 
    groupNotifications(filteredNotifications),
    [filteredNotifications]
  );

  // Stats
  const stats = useMemo(() => ({
    total: userNotifications.length,
    unread: userNotifications.filter(n => !n.read).length,
    highPriority: userNotifications.filter(n => n.priority === 'high' && !n.read).length,
  }), [userNotifications]);

  // Determine priority based on notification content
  function determinePriority(notification: Notification): 'high' | 'medium' | 'low' {
    if (notification.type === 'error' || notification.title.toLowerCase().includes('urgent')) {
      return 'high';
    }
    if (notification.type === 'warning' || notification.title.toLowerCase().includes('deadline')) {
      return 'medium';
    }
    return 'low';
  }

  // Determine category based on notification content
  function determineCategory(notification: Notification): string {
    if (notification.title.toLowerCase().includes('project') || 
        notification.message.toLowerCase().includes('project')) {
      return 'project';
    }
    if (notification.title.toLowerCase().includes('assigned') || 
        notification.message.toLowerCase().includes('team')) {
      return 'team';
    }
    if (notification.title.toLowerCase().includes('deadline')) {
      return 'deadline';
    }
    return 'system';
  }

  // Mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    userNotifications.forEach(notification => {
      if (!notification.read) {
        markNotificationAsRead(notification.id);
      }
    });
  }, [userNotifications, markNotificationAsRead]);

  // Get icon for notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: ExtendedNotification['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="text-xs">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="text-xs">Medium</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">Notifications</SheetTitle>
              <SheetDescription>
                {stats.unread} unread, {stats.highPriority} high priority
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={stats.unread === 0}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Search and Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="deadline">Deadlines</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1">
          <TabsList className="w-full justify-start px-4 h-12 bg-transparent border-b rounded-none">
            <TabsTrigger value="all" className="relative">
              All
              {stats.total > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {stats.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="relative">
              Unread
              {stats.unread > 0 && (
                <Badge variant="default" className="ml-2 h-5 px-1.5 text-xs">
                  {stats.unread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="high-priority">
              Priority
              {stats.highPriority > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {stats.highPriority}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="m-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {Object.keys(groupedNotifications).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <BellOff className="h-12 w-12 mb-3" />
                  <p className="text-sm">No notifications found</p>
                </div>
              ) : (
                <div className="p-4 space-y-6">
                  <AnimatePresence>
                    {Object.entries(groupedNotifications).map(([date, notifications]) => (
                      <motion.div
                        key={date}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-2"
                      >
                        <h3 className="text-sm font-medium text-gray-500 sticky top-0 bg-white py-2">
                          {date}
                        </h3>
                        {notifications.map((notification, index) => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              "p-4 rounded-lg border transition-all cursor-pointer",
                              !notification.read && "bg-blue-50/50 border-blue-200",
                              notification.read && "hover:bg-gray-50"
                            )}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">
                                      {notification.title}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                      {notification.message}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getPriorityBadge(notification.priority)}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Toggle star functionality
                                      }}
                                    >
                                      {notification.starred ? (
                                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                      ) : (
                                        <StarOff className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
                                  </span>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {notification.category}
                                  </Badge>
                                  {!notification.read && (
                                    <span className="flex items-center gap-1 text-blue-600">
                                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                                      New
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}; 