'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  X,
  Check,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  User,
  FileText,
  Languages,
  Calendar,
  TrendingUp,
  Settings,
  Filter,
} from 'lucide-react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import type { Notification } from '@/types/translation';
import { format, formatDistanceToNow } from 'date-fns';

interface EnhancedNotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type NotificationFilter = 'all' | 'unread' | 'projects' | 'system' | 'team';

const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertCircle,
  error: AlertCircle,
};

const notificationColors = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-orange-500',
  error: 'bg-red-500',
};

export function EnhancedNotifications({ isOpen, onClose }: EnhancedNotificationsProps) {
  const { notifications, currentUser, markNotificationAsRead, clearNotifications } = useTranslationStore();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [showSettings, setShowSettings] = useState(false);

  const userNotifications = notifications.filter(n => n.userId === currentUser?.id);
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const filteredNotifications = userNotifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'projects':
        return notification.title.toLowerCase().includes('project') || 
               notification.message.toLowerCase().includes('project');
      case 'system':
        return notification.title.toLowerCase().includes('system') || 
               notification.type === 'info';
      case 'team':
        return notification.title.toLowerCase().includes('team') || 
               notification.message.toLowerCase().includes('assigned');
      default:
        return true;
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markNotificationAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    userNotifications.forEach(notification => {
      if (!notification.read) {
        markNotificationAsRead(notification.id);
      }
    });
  };

  const getNotificationIcon = (notification: Notification) => {
    const IconComponent = notificationIcons[notification.type];
    return <IconComponent className="h-4 w-4" />;
  };

  const getNotificationColor = (notification: Notification) => {
    return notificationColors[notification.type];
  };

  const getNotificationPreview = (message: string) => {
    return message.length > 100 ? `${message.substring(0, 100)}...` : message;
  };

  const getNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end pt-20">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Mark all as read</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Mark All
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Clear all notifications</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearNotifications}
                  disabled={userNotifications.length === 0}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { key: 'all', label: 'All', count: userNotifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'projects', label: 'Projects', count: userNotifications.filter(n => 
                n.title.toLowerCase().includes('project') || n.message.toLowerCase().includes('project')
              ).length },
              { key: 'system', label: 'System', count: userNotifications.filter(n => 
                n.title.toLowerCase().includes('system') || n.type === 'info'
              ).length },
              { key: 'team', label: 'Team', count: userNotifications.filter(n => 
                n.title.toLowerCase().includes('team') || n.message.toLowerCase().includes('assigned')
              ).length },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={filter === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(tab.key as NotificationFilter)}
                className="whitespace-nowrap"
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification, index) => (
                <div key={notification.id}>
                  <div
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50",
                      !notification.read && "bg-blue-50 border-l-4 border-blue-500",
                      notification.read && "opacity-75"
                    )}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        getNotificationColor(notification),
                        "text-white"
                      )}>
                        {getNotificationIcon(notification)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className={cn(
                            "text-sm font-medium line-clamp-1",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                            <span className="text-xs text-gray-500">
                              {getNotificationTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {getNotificationPreview(notification.message)}
                        </p>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-2">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Mark as read
                            </Button>
                          )}
                          
                          {/* Context-specific actions */}
                          {notification.title.toLowerCase().includes('project') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to project
                                console.log('Navigate to project');
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Project
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {index < filteredNotifications.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {filter === 'all' 
                    ? 'You\'re all caught up!' 
                    : 'Check other categories for notifications'
                  }
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}</span>
            <span>{unreadCount} unread</span>
          </div>
        </div>
      </div>
    </div>
  );
} 