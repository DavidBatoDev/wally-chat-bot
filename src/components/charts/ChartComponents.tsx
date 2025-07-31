'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Color palette optimized for accessibility
const CHART_COLORS = {
  primary: '#3b82f6', // blue-500
  secondary: '#10b981', // green-500
  tertiary: '#f59e0b', // amber-500
  quaternary: '#ef4444', // red-500
  quinary: '#8b5cf6', // violet-500
  senary: '#ec4899', // pink-500
  septenary: '#14b8a6', // teal-500
  octonary: '#6366f1', // indigo-500
};

const STATUS_COLORS = {
  'ocr-processing': '#a855f7', // purple-500
  'pending-confirmation': '#f97316', // orange-500
  'assigning-translator': '#3b82f6', // blue-500
  'assigned': '#3b82f6', // blue-500
  'in-progress': '#eab308', // yellow-500
  'sent-back': '#ef4444', // red-500
  'pm-review': '#ec4899', // pink-500
  'completed': '#10b981', // green-500
};

interface ChartWrapperProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ 
  title, 
  description, 
  children, 
  className,
  loading = false 
}) => {
  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          {title && <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />}
          {description && <div className="h-4 bg-gray-200 rounded w-2/3 mt-2 animate-pulse" />}
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="p-6">
        {children}
      </CardContent>
    </Card>
  );
};

// Custom tooltip with better styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Productivity Line Chart
interface ProductivityChartProps {
  data: Array<{ date: string; productivity: number; quality: number }>;
  loading?: boolean;
}

export const ProductivityChart: React.FC<ProductivityChartProps> = ({ data, loading }) => {
  const chartData = useMemo(() => data, [data]);

  return (
    <ChartWrapper 
      title="Productivity Trends" 
      description="Team productivity and quality scores over time"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="productivity" 
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.primary, r: 4 }}
            activeDot={{ r: 6 }}
            name="Productivity %"
          />
          <Line 
            type="monotone" 
            dataKey="quality" 
            stroke={CHART_COLORS.secondary}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.secondary, r: 4 }}
            activeDot={{ r: 6 }}
            name="Quality Score %"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Status Distribution Donut Chart
interface StatusDistributionChartProps {
  data: Array<{ status: string; count: number }>;
  loading?: boolean;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({ data, loading }) => {
  const chartData = useMemo(() => 
    data.map(item => ({
      ...item,
      percentage: 0, // Will be calculated by the chart
    })), [data]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const renderLabel = (entry: any) => {
    const percentage = ((entry.count / total) * 100).toFixed(1);
    return `${percentage}%`;
  };

  return (
    <ChartWrapper 
      title="Project Status Distribution" 
      description="Current distribution of projects by status"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="count"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || CHART_COLORS.primary} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || CHART_COLORS.primary }}
            />
            <span className="text-sm text-gray-600 capitalize">
              {item.status.replace('-', ' ')}: {item.count}
            </span>
          </div>
        ))}
      </div>
    </ChartWrapper>
  );
};

// Revenue Area Chart
interface RevenueChartProps {
  data: Array<{ month: string; revenue: number; projects: number }>;
  loading?: boolean;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading }) => {
  const chartData = useMemo(() => data, [data]);

  return (
    <ChartWrapper 
      title="Revenue Trends" 
      description="Monthly revenue and project volume"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="month" 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke={CHART_COLORS.primary} 
            fillOpacity={1} 
            fill="url(#colorRevenue)"
            name="Revenue ($)"
          />
          <Area 
            type="monotone" 
            dataKey="projects" 
            stroke={CHART_COLORS.secondary} 
            fillOpacity={1} 
            fill="url(#colorProjects)"
            name="Projects"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Team Performance Bar Chart
interface TeamPerformanceChartProps {
  data: Array<{ name: string; completed: number; quality: number; productivity: number }>;
  loading?: boolean;
}

export const TeamPerformanceChart: React.FC<TeamPerformanceChartProps> = ({ data, loading }) => {
  const chartData = useMemo(() => data, [data]);

  return (
    <ChartWrapper 
      title="Team Performance" 
      description="Individual team member performance metrics"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
          />
          <Bar dataKey="completed" fill={CHART_COLORS.primary} name="Completed Projects" />
          <Bar dataKey="quality" fill={CHART_COLORS.secondary} name="Quality Score" />
          <Bar dataKey="productivity" fill={CHART_COLORS.tertiary} name="Productivity %" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Language Distribution Radar Chart
interface LanguageDistributionProps {
  data: Array<{ language: string; projects: number; revenue: number }>;
  loading?: boolean;
}

export const LanguageDistributionChart: React.FC<LanguageDistributionProps> = ({ data, loading }) => {
  const chartData = useMemo(() => 
    data.map(item => ({
      ...item,
      fullMark: Math.max(...data.map(d => Math.max(d.projects, d.revenue / 1000)))
    })), [data]);

  return (
    <ChartWrapper 
      title="Language Distribution" 
      description="Project volume and revenue by language"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="language" fontSize={12} />
          <PolarRadiusAxis fontSize={10} />
          <Radar 
            name="Projects" 
            dataKey="projects" 
            stroke={CHART_COLORS.primary} 
            fill={CHART_COLORS.primary} 
            fillOpacity={0.6} 
          />
          <Radar 
            name="Revenue (K)" 
            dataKey={(item) => item.revenue / 1000} 
            stroke={CHART_COLORS.secondary} 
            fill={CHART_COLORS.secondary} 
            fillOpacity={0.6} 
          />
          <Legend />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

// Mini Sparkline Chart for widgets
interface SparklineProps {
  data: Array<{ value: number }>;
  color?: string;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ 
  data, 
  color = CHART_COLORS.primary,
  height = 40 
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          strokeWidth={2} 
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}; 