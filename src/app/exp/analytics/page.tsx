'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Sidebar } from '@/components/translation/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Award,
  Clock3,
  Languages,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  DollarSign,
  Zap,
  Star,
  Timer,
  TrendingUp as TrendUp
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import type { Project, TeamMember, UserRole } from '@/types/translation';

// Import new components
import { 
  ProductivityChart, 
  StatusDistributionChart, 
  RevenueChart, 
  TeamPerformanceChart,
  LanguageDistributionChart 
} from '@/components/charts/ChartComponents';
import { 
  MetricCard, 
  ProgressRing, 
  ActivityFeed, 
  TeamStatusWidget, 
  DeadlineTracker 
} from '@/components/dashboard/DashboardWidgets';
import { LoadingSpinner } from '@/components/ui/animations';

interface AnalyticsData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  averageProjectDuration: number;
  statusDistribution: Record<string, number>;
  teamPerformance: Array<{
    name: string;
    role: string;
    projectsCompleted: number;
    averageTime: number;
    qualityScore: number;
    avatar?: string;
    productivity: number;
    workload: number;
  }>;
  processingTimes: Array<{
    stage: string;
    averageTime: number;
    projectCount: number;
  }>;
  languageDistribution: Array<{
    language: string;
    count: number;
  }>;
  clientAnalytics: Array<{
    clientName: string;
    projectCount: number;
    totalRevenue: number;
    satisfaction: number;
    revenue: number;
  }>;
  qualityMetrics: {
    averageQuality: number;
    revisionRate: number;
    clientSatisfaction: number;
    qualityScore: number;
  };
  timeTrends: Array<{
    date: string;
    projects: number;
    revenue: number;
  }>;
  bottlenecks: Array<{
    stage: string;
    projectsStuck: number;
    impact: 'high' | 'medium' | 'low';
  }>;
  productivity: {
    projectsPerDay: number;
    efficiency: number;
    completionRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  revenueMetrics: {
    totalRevenue: number;
    averageProjectValue: number;
    monthlyGrowth: number;
    profitMargin: number;
  };
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { projects, teamMembers, userRoles, currentUser } = useTranslationStore();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30');
  const [selectedView, setSelectedView] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for store to be loaded
    if (userRoles.length === 0) {
      return;
    }

    if (!currentUser) {
      router.push('/exp/login');
      return;
    }

    // Simulate loading
    setTimeout(() => {
      calculateAnalytics();
      setIsLoading(false);
    }, 1000);
  }, [currentUser, projects, timeRange, userRoles]);

  const calculateAnalytics = () => {
    const days = parseInt(timeRange);
    const startDate = subDays(new Date(), days);
    
    // Filter projects within time range
    const filteredProjects = projects.filter(p => 
      new Date(p.createdAt) >= startDate
    );

    // Calculate metrics
    const totalProjects = filteredProjects.length;
    const activeProjects = filteredProjects.filter(p => 
      !['completed', 'cancelled'].includes(p.status)
    ).length;
    const completedProjects = filteredProjects.filter(p => 
      p.status === 'completed'
    ).length;

    // Status distribution
    const statusDistribution = filteredProjects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Team performance with mock data
    const teamPerformance = [...teamMembers, ...userRoles.filter(u => 
      !teamMembers.find(t => t.email === u.email)
    ).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      availability: 'available' as const
    }))].map(member => {
      const memberProjects = filteredProjects.filter(p => 
        p.assignedTranslator === member.id || p.createdBy === member.id
      );
      
      return {
        name: member.name,
        role: member.role,
        projectsCompleted: memberProjects.filter(p => p.status === 'completed').length,
        averageTime: Math.floor(Math.random() * 10) + 1,
        qualityScore: 85 + Math.floor(Math.random() * 15),
        avatar: member.avatar,
        productivity: 70 + Math.floor(Math.random() * 30),
        workload: memberProjects.filter(p => !['completed', 'cancelled'].includes(p.status)).length
      };
    });

    // Processing times
    const processingTimes = [
      { stage: 'OCR Processing', averageTime: 2.5, projectCount: totalProjects },
      { stage: 'Translation', averageTime: 24, projectCount: completedProjects },
      { stage: 'Review', averageTime: 4, projectCount: completedProjects },
      { stage: 'Final Approval', averageTime: 1, projectCount: completedProjects }
    ];

    // Language distribution
    const languageDistribution = filteredProjects.reduce((acc, project) => {
      project.targetLanguages.forEach(lang => {
        const existing = acc.find(l => l.language === lang);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ language: lang, count: 1 });
        }
      });
      return acc;
    }, [] as Array<{ language: string; count: number }>);

    // Client analytics with mock revenue data
    const clientAnalytics = Object.entries(
      filteredProjects.reduce((acc, project) => {
        if (!acc[project.clientName]) {
          acc[project.clientName] = { count: 0, revenue: 0 };
        }
        acc[project.clientName].count++;
        acc[project.clientName].revenue += 1000 + Math.random() * 4000; // Mock revenue
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>)
    ).map(([clientName, data]) => ({
      clientName,
      projectCount: data.count,
      totalRevenue: data.revenue,
      revenue: data.revenue,
      satisfaction: 85 + Math.floor(Math.random() * 15)
    }));

    // Quality metrics
    const qualityMetrics = {
      averageQuality: 92,
      revisionRate: 8.5,
      clientSatisfaction: 94,
      qualityScore: 92
    };

    // Time trends - generate data for chart
    const timeTrends = Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - i - 1);
      const dayProjects = filteredProjects.filter(p => 
        format(new Date(p.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      
      return {
        date: format(date, 'MMM dd'),
        projects: dayProjects.length,
        revenue: dayProjects.length * (1000 + Math.random() * 2000)
      };
    });

    // Bottlenecks
    const bottlenecks = [
      { stage: 'OCR Confirmation', projectsStuck: 3, impact: 'high' as const },
      { stage: 'Translator Assignment', projectsStuck: 5, impact: 'medium' as const },
      { stage: 'Final Review', projectsStuck: 2, impact: 'low' as const }
    ];

    // Productivity metrics
    const productivity = {
      projectsPerDay: totalProjects / days,
      efficiency: 85,
      completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0,
      trend: 'up' as const
    };

    // Revenue metrics
    const revenueMetrics = {
      totalRevenue: clientAnalytics.reduce((sum, client) => sum + client.revenue, 0),
      averageProjectValue: clientAnalytics.reduce((sum, client) => sum + client.revenue, 0) / totalProjects || 0,
      monthlyGrowth: 12.5,
      profitMargin: 35
    };

    setAnalyticsData({
      totalProjects,
      activeProjects,
      completedProjects,
      averageProjectDuration: 5.2,
      statusDistribution,
      teamPerformance,
      processingTimes,
      languageDistribution,
      clientAnalytics,
      qualityMetrics,
      timeTrends,
      bottlenecks,
      productivity,
      revenueMetrics
    });
  };

  // Prepare chart data
  const productivityChartData = analyticsData?.timeTrends.map(trend => ({
    date: trend.date,
    productivity: 70 + Math.floor(Math.random() * 30),
    quality: 85 + Math.floor(Math.random() * 15)
  })) || [];

  const statusChartData = Object.entries(analyticsData?.statusDistribution || {}).map(([status, count]) => ({
    status,
    count
  }));

  const revenueChartData = analyticsData?.timeTrends.map(trend => ({
    month: trend.date,
    revenue: trend.revenue,
    projects: trend.projects
  })) || [];

  const teamChartData = analyticsData?.teamPerformance.slice(0, 6).map(member => ({
    name: member.name,
    completed: member.projectsCompleted,
    quality: member.qualityScore,
    productivity: member.productivity
  })) || [];

  const languageChartData = analyticsData?.languageDistribution.map(lang => ({
    language: lang.language,
    projects: lang.count,
    revenue: lang.count * (2000 + Math.random() * 3000)
  })) || [];

  // Prepare activity feed data
  const activities = projects.slice(0, 10).map(project => ({
    id: project.id,
    user: {
      name: project.createdBy || 'System',
      avatar: undefined
    },
    action: 'created project',
    target: project.qCode,
    timestamp: formatDistanceToNow(new Date(project.createdAt), { addSuffix: true }),
    type: 'info' as const
  }));

  // Prepare team status data
  const teamStatus = analyticsData?.teamPerformance.map(member => ({
    id: member.name,
    name: member.name,
    avatar: member.avatar,
    role: member.role,
    status: member.workload > 3 ? 'busy' as const : 'available' as const,
    currentProjects: member.workload,
    completedToday: Math.floor(Math.random() * 3)
  })) || [];

  // Prepare deadline data
  const deadlines = projects
    .filter(p => p.deadline && !['completed', 'cancelled'].includes(p.status))
    .map(p => {
      const daysUntilDeadline = Math.floor((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: p.id,
        projectName: p.qCode,
        clientName: p.clientName,
        deadline: format(new Date(p.deadline), 'MMM dd'),
        status: daysUntilDeadline < 0 ? 'overdue' as const : daysUntilDeadline < 3 ? 'at-risk' as const : 'on-track' as const,
        progress: Math.floor(Math.random() * 100)
      };
    })
    .slice(0, 5);

  if (isLoading || !analyticsData) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  const formatDistanceToNow = (date: Date, options: { addSuffix: boolean }) => {
    // Simple implementation for demo
    return '2 hours ago';
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-600">Comprehensive insights into your translation projects</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overview Metrics with new MetricCard components */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Projects"
              value={analyticsData.totalProjects}
              change={12}
              trend="up"
              icon={FileText}
              sparklineData={revenueChartData.map(d => ({ value: d.projects }))}
            />
            
            <MetricCard
              title="Active Projects"
              value={analyticsData.activeProjects}
              icon={Activity}
              sparklineData={revenueChartData.map(d => ({ value: Math.random() * 10 }))}
            />
            
            <MetricCard
              title="Completion Rate"
              value={analyticsData.productivity.completionRate}
              suffix="%"
              change={analyticsData.productivity.trend === 'up' ? 5 : -5}
              trend={analyticsData.productivity.trend}
              icon={Target}
            />
            
            <MetricCard
              title="Total Revenue"
              value={analyticsData.revenueMetrics.totalRevenue}
              prefix="$"
              change={analyticsData.revenueMetrics.monthlyGrowth}
              trend="up"
              icon={DollarSign}
              sparklineData={revenueChartData.map(d => ({ value: d.revenue }))}
            />
          </div>

          {/* Key Performance Indicators with Progress Rings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Productivity Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-4">
                  <ProgressRing 
                    value={analyticsData.productivity.efficiency} 
                    size={120}
                    color="#f97316"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Projects per Day</span>
                    <span className="text-lg font-bold">{analyticsData.productivity.projectsPerDay.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Project Value</span>
                    <span className="text-lg font-bold">${(analyticsData.revenueMetrics.averageProjectValue / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Process Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.bottlenecks.map((bottleneck) => (
                    <div key={bottleneck.stage} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          bottleneck.impact === 'high' ? 'bg-red-500' :
                          bottleneck.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></div>
                        <span className="text-sm">{bottleneck.stage}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{bottleneck.projectsStuck}</div>
                        <div className="text-xs text-muted-foreground">stuck</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Quality & Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-4">
                  <ProgressRing 
                    value={analyticsData.qualityMetrics.qualityScore} 
                    size={120}
                    color="#eab308"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Profit Margin</span>
                    <span className="text-lg font-bold">{analyticsData.revenueMetrics.profitMargin}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Revision Rate</span>
                    <span className="text-sm font-medium">{analyticsData.qualityMetrics.revisionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProductivityChart data={productivityChartData} />
            <StatusDistributionChart data={statusChartData} />
            <RevenueChart data={revenueChartData} />
            <TeamPerformanceChart data={teamChartData} />
            <LanguageDistributionChart data={languageChartData} />
            
            {/* Activity Feed */}
            <ActivityFeed 
              activities={activities}
              maxItems={5}
              onViewAll={() => console.log('View all activities')}
            />
          </div>

          {/* Team and Deadline Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamStatusWidget 
              members={teamStatus}
              onMemberClick={(member) => console.log('Member clicked:', member)}
            />
            <DeadlineTracker 
              deadlines={deadlines}
              onDeadlineClick={(deadline) => console.log('Deadline clicked:', deadline)}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 