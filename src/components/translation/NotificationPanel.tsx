'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Bell, X, Info, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const { notifications, markNotificationAsRead, clearNotifications, currentUser } = useTranslationStore();
  
  // Auto mark all as read when panel opens
  React.useEffect(() => {
    if (open && currentUser) {
      const userNotifications = notifications.filter(n => n.userId === currentUser.id && !n.read);
      userNotifications.forEach(n => markNotificationAsRead(n.id));
    }
  }, [open, currentUser]);
  
  if (!open || !currentUser) return null;
  
  const userNotifications = notifications.filter(n => n.userId === currentUser.id);
  const unreadCount = userNotifications.filter(n => !n.read).length;
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Info;
    }
  };
  
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <Card className="w-96 max-h-[600px] pointer-events-auto shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="text-xs"
              >
                Clear all
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {userNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {userNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 hover:bg-gray-50 cursor-pointer transition-colors",
                        !notification.read && "bg-blue-50/50"
                      )}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                          getNotificationColor(notification.type)
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notification.createdAt), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
} 