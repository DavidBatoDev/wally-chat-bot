'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkline } from '@/components/charts/ChartComponents';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Users,
  FileText,
  Activity,
  AlertCircle,
  CheckCircle,
  Calendar,
  Target,
  Zap,
  Star,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Remove react-intersection-observer dependency
// import { useInView } from 'react-intersection-observer';

// Simple useInView replacement
const useInView = (options: { triggerOnce: boolean }) => {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (options.triggerOnce && inView) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [options.triggerOnce, inView]);

  return { ref, inView };
};

// Animated Counter Component
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
}) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });

  useEffect(() => {
    if (inView) {
      let startTime: number;
      let animationFrame: number;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        setCount(Math.floor(progress * value * Math.pow(10, decimals)) / Math.pow(10, decimals));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);

      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
      };
    }
  }, [value, duration, decimals, inView]);

  return (
    <span ref={ref}>
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
};

// Metric Card Widget
interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
  sparklineData?: Array<{ value: number }>;
  loading?: boolean;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  prefix = '',
  suffix = '',
  sparklineData,
  loading = false,
  onClick,
}) => {
  if (loading) {
    return (
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const changeIcon = change && change > 0 ? ArrowUpRight : ArrowDownRight;
  const ChangeIcon = change ? changeIcon : null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={cn(
          "cursor-pointer hover:shadow-lg transition-all duration-300",
          onClick && "hover:border-blue-300"
        )}
        onClick={onClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-700">{title}</CardTitle>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">
              {typeof value === 'number' ? (
                <>
                  {prefix}
                  <AnimatedCounter value={value} suffix={suffix} />
                </>
              ) : (
                value
              )}
            </div>
            {sparklineData && (
              <div className="w-20 h-8">
                <Sparkline data={sparklineData} color={trend === 'up' ? '#10b981' : '#ef4444'} />
              </div>
            )}
          </div>
          {(change !== undefined || trend) && (
            <div className="flex items-center gap-1 mt-2">
              {trend && <TrendIcon className={cn("h-4 w-4", trendColor)} />}
              {change !== undefined && (
                <span className={cn("text-sm font-medium", change > 0 ? 'text-green-600' : 'text-red-600')}>
                  {ChangeIcon && <ChangeIcon className="inline h-3 w-3" />}
                  {Math.abs(change)}%
                </span>
              )}
              <span className="text-sm text-gray-600">vs last period</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Progress Ring Widget
interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  children,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const [offset, setOffset] = useState(circumference);
  const { ref, inView } = useInView({ triggerOnce: true });

  useEffect(() => {
    if (inView) {
      const progressOffset = circumference - (value / 100) * circumference;
      setOffset(progressOffset);
    }
  }, [value, circumference, inView]);

  return (
    <div ref={ref} className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (
          <span className="text-2xl font-bold">
            <AnimatedCounter value={value} suffix="%" />
          </span>
        )}
      </div>
    </div>
  );
};

// Activity Feed Widget
interface ActivityItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
  onViewAll?: () => void;
  loading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  maxItems = 5,
  onViewAll,
  loading = false,
}) => {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    // For older than a week, show the actual date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <AnimatePresence>
            <div className="space-y-4">
              {activities.slice(0, maxItems).map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activity.user.avatar} />
                    <AvatarFallback className="text-xs">
                      {activity.user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user.name}</span>{' '}
                      <span className="text-gray-600">{activity.action}</span>{' '}
                      <span className="font-medium">{activity.target}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity.type)}
                      <span className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Team Status Widget
interface TeamMemberStatus {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'available' | 'busy' | 'offline';
  currentProjects: number;
  completedToday: number;
}

interface TeamStatusProps {
  members: TeamMemberStatus[];
  onMemberClick?: (member: TeamMemberStatus) => void;
  loading?: boolean;
}

export const TeamStatusWidget: React.FC<TeamStatusProps> = ({
  members,
  onMemberClick,
  loading = false,
}) => {
  const getStatusColor = (status: TeamMemberStatus['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableCount = members.filter(m => m.status === 'available').length;
  const busyCount = members.filter(m => m.status === 'busy').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Status</CardTitle>
        <CardDescription>
          {availableCount} available, {busyCount} busy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {members.map((member) => (
            <motion.div
              key={member.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all",
                member.status === 'offline' && "opacity-60"
              )}
              onClick={() => onMemberClick?.(member)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                    getStatusColor(member.status)
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Active: {member.currentProjects}</span>
                <Badge variant="secondary" className="text-xs">
                  {member.completedToday} today
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Deadline Tracker Widget
interface DeadlineItem {
  id: string;
  projectName: string;
  clientName: string;
  deadline: string;
  status: 'on-track' | 'at-risk' | 'overdue';
  progress: number;
}

interface DeadlineTrackerProps {
  deadlines: DeadlineItem[];
  onDeadlineClick?: (deadline: DeadlineItem) => void;
  loading?: boolean;
}

export const DeadlineTracker: React.FC<DeadlineTrackerProps> = ({
  deadlines,
  onDeadlineClick,
  loading = false,
}) => {
  const getStatusColor = (status: DeadlineItem['status']) => {
    switch (status) {
      case 'on-track':
        return 'text-green-600 bg-green-50';
      case 'at-risk':
        return 'text-yellow-600 bg-yellow-50';
      case 'overdue':
        return 'text-red-600 bg-red-50';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Upcoming Deadlines
        </CardTitle>
        <Badge variant="outline">
          {deadlines.filter(d => d.status === 'at-risk').length} at risk
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deadlines.map((deadline, index) => (
            <motion.div
              key={deadline.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 rounded-lg border hover:shadow-md transition-all cursor-pointer"
              onClick={() => onDeadlineClick?.(deadline)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{deadline.projectName}</p>
                  <p className="text-xs text-gray-500">{deadline.clientName}</p>
                </div>
                <Badge className={cn("text-xs", getStatusColor(deadline.status))}>
                  {deadline.deadline}
                </Badge>
              </div>
              <Progress value={deadline.progress} className="h-2" />
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}; 