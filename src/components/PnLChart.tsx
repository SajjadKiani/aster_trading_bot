'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
} from 'lucide-react';
import websocketService from '@/lib/services/websocketService';
import { useConfig } from '@/components/ConfigProvider';

type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
type ChartType = 'daily' | 'cumulative';
type DisplayMode = 'usdt' | 'percent';

interface DailyPnL {
  date: string;
  realizedPnl: number;
  commission: number;
  fundingFee: number;
  netPnl: number;
  tradeCount: number;
  cumulativePnl?: number; // Optional field added when chartType is 'cumulative'
}

interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  profitableDays: number;
  lossDays: number;
  bestDay: DailyPnL | null;
  worstDay: DailyPnL | null;
  avgDailyPnl: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
}

interface PnLData {
  dailyPnL: DailyPnL[];
  metrics: PerformanceMetrics;
  range: string;
  error?: string;
}

export default function PnLChart() {
  const { config } = useConfig();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [chartType, setChartType] = useState<ChartType>('cumulative');
  const [displayMode, _setDisplayMode] = useState<DisplayMode>('usdt');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [realtimePnL, setRealtimePnL] = useState<any>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if API keys are configured
  const hasApiKeys = config?.api?.apiKey && config?.api?.secretKey;

  // Data validation helper
  const validateDailyPnLData = (data: any[]): DailyPnL[] => {
    return data.filter(item => {
      return (
        item &&
        typeof item.date === 'string' &&
        typeof item.netPnl === 'number' &&
        typeof item.realizedPnl === 'number' &&
        typeof item.commission === 'number' &&
        typeof item.fundingFee === 'number' &&
        typeof item.tradeCount === 'number' &&
        !isNaN(item.netPnl) &&
        !isNaN(item.realizedPnl) &&
        !isNaN(item.commission) &&
        !isNaN(item.fundingFee) &&
        !isNaN(item.tradeCount)
      );
    });
  };

  // Fetch PnL data function
  const fetchPnLData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/income?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        // Validate and clean data structure
        if (data && data.metrics && Array.isArray(data.dailyPnL)) {
          const validatedDailyPnL = validateDailyPnLData(data.dailyPnL);
          setPnlData({
            ...data,
            dailyPnL: validatedDailyPnL
          });
          console.log(`[PnL Chart] Loaded ${validatedDailyPnL.length} valid daily PnL records for ${timeRange}`);
          console.log(`[PnL Chart] Daily PnL data for ${timeRange}:`, validatedDailyPnL);
        } else {
          console.error('Invalid PnL data structure:', data);
          setPnlData(null);
        }
      } else {
        console.error('Failed to fetch PnL data, status:', response.status);
        setPnlData(null);
      }
    } catch (error) {
      console.error('Failed to fetch PnL data:', error);
      setPnlData(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  // Fetch historical PnL data on mount and when timeRange changes
  useEffect(() => {
    if (hasApiKeys) {
      fetchPnLData();
    } else {
      setIsLoading(false);
      setPnlData(null);
    }
  }, [timeRange, hasApiKeys, fetchPnLData]);

  // Fetch initial real-time session data and balance
  useEffect(() => {
    if (!hasApiKeys) return;

    const fetchRealtimeData = async () => {
      try {
        // Fetch realtime PnL
        const response = await fetch('/api/pnl/realtime');
        if (response.ok) {
          const data = await response.json();
          setRealtimePnL(data);
        }

        // Fetch balance
        const balanceResponse = await fetch('/api/balance');
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setTotalBalance(balanceData.totalBalance || 0);
        }
      } catch (error) {
        console.error('Failed to fetch realtime PnL or balance:', error);
      }
    };

    fetchRealtimeData();
  }, [hasApiKeys]);

  // Subscribe to real-time PnL updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'pnl_update') {
        setRealtimePnL(message.data);
      }
    };

    const cleanup = websocketService.addMessageHandler(handleMessage);
    return cleanup;
  }, []);

  // Enhanced data processing with better real-time integration
  const chartData = useMemo(() => {
    if (!pnlData?.dailyPnL) return [];

    console.log(`[PnL Chart] Processing data for ${timeRange}:`);
    console.log(`[PnL Chart] - Historical data: ${pnlData.dailyPnL.length} days`);
    console.log(`[PnL Chart] - Session data available: ${!!realtimePnL?.session}`);

    const today = new Date().toISOString().split('T')[0];
    let processedData = [...pnlData.dailyPnL];

    // Log initial data state
    const todayInHistorical = processedData.find(d => d.date === today);
    if (todayInHistorical) {
      console.log(`[PnL Chart] Today's historical data:`, todayInHistorical);
    } else {
      console.log(`[PnL Chart] No historical data for today (${today})`);
    }

    // DISABLED: Session data integration removed since we want to show actual historical trading data
    // The APIs now provide complete and consistent historical data including today's trades
    console.log(`[PnL Chart] Using pure historical data without session integration`);

    // Ensure data is sorted chronologically
    processedData.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`[PnL Chart] Before filtering: ${processedData.length} days`);
    if (processedData.length > 0) {
      console.log(`[PnL Chart] Date range: ${processedData[0].date} to ${processedData[processedData.length - 1].date}`);
    }

    // CRITICAL FIX: Remove client-side filtering for shorter ranges
    // The API already filters correctly, and client-side filtering can cause data inconsistencies
    if (timeRange === '1y' || timeRange === 'all') {
      // Only filter for very long ranges where we might want to limit chart performance
      const cutoffDate = new Date();
      if (timeRange === '1y') {
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      } else {
        // For 'all', limit to 2 years for performance
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
      }
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      console.log(`[PnL Chart] Filtering ${timeRange}: cutoff date = ${cutoffDateString}`);

      const beforeFilter = processedData.length;
      processedData = processedData.filter(d => d.date >= cutoffDateString);

      console.log(`[PnL Chart] After filtering: ${processedData.length} days (removed ${beforeFilter - processedData.length})`);
    } else {
      console.log(`[PnL Chart] No client-side filtering for ${timeRange} - using API-filtered data directly`);
    }

    // Calculate cumulative PnL if needed
    if (chartType === 'cumulative') {
      let cumulative = 0;
      return processedData.map(day => {
        cumulative += day.netPnl;
        return {
          ...day,
          cumulativePnl: cumulative,
        };
      });
    }

    console.log(`[PnL Chart] Final chart data for ${timeRange}: ${processedData.length} days`);
    if (processedData.length > 0) {
      const lastDay = processedData[processedData.length - 1];
      console.log(`[PnL Chart] Last day in ${timeRange}:`, lastDay);
    }

    return processedData;
  }, [pnlData, realtimePnL, chartType, timeRange]);

  // Format value based on display mode
  const _formatValue = (value: number) => {
    if (displayMode === 'percent') {
      return `${value.toFixed(2)}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Smart date formatting based on time range
  const formatDateTick = (value: string) => {
    // CRITICAL FIX: Parse date string correctly to avoid timezone shift
    // "2025-09-26" should display as 9/26, not 9/25
    const [year, month, day] = value.split('-').map(Number);

    switch (timeRange) {
      case '24h':
        return `${month}/${day}`;  // Show month/day for daily data
      case '7d':
        return `${month}/${day}`;
      case '30d':
      case '90d':
        return `${month}/${day}`;
      case '1y':
      case 'all':
        return `${year}-${month.toString().padStart(2, '0')}`;
      default:
        return `${month}/${day}`;
    }
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Custom tooltip - more compact
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isDaily = chartType === 'daily';
      const displayValue = isDaily ? data.netPnl : data.cumulativePnl;

      return (
        <div className="bg-background/95 backdrop-blur border rounded-md shadow-lg p-1.5">
          <p className="text-[10px] font-medium text-muted-foreground">{new Date(label).toLocaleDateString()}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-sm font-semibold ${displayValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatTooltipValue(displayValue)}
            </span>
            {data.tradeCount > 0 && (
              <Badge variant="secondary" className="h-3.5 text-[9px] px-1">
                {data.tradeCount} trades
              </Badge>
            )}
          </div>
          {isDaily && (
            <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>Real: {formatTooltipValue(data.realizedPnl)}</span>
              <span>Fee: {formatTooltipValue(Math.abs(data.commission))}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Handle empty data state
  if (!pnlData || chartData.length === 0) {
    const isApiKeysMissing = !hasApiKeys;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance
              </CardTitle>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            {!isCollapsed && !isApiKeysMissing && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fetchPnLData(true)}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24h</SelectItem>
                    <SelectItem value="7d">7d</SelectItem>
                    <SelectItem value="30d">30d</SelectItem>
                    <SelectItem value="90d">90d</SelectItem>
                    <SelectItem value="1y">1y</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                <Tabs value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                  <TabsList className="h-7">
                    <TabsTrigger value="daily" className="h-6 text-xs">Daily</TabsTrigger>
                    <TabsTrigger value="cumulative" className="h-6 text-xs">Total</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <div className="flex items-center justify-center h-[150px] text-muted-foreground">
              <div className="text-center space-y-1">
                <BarChart3 className="h-6 w-6 mx-auto opacity-50" />
                <p className="text-xs font-medium">
                  {isApiKeysMissing ? 'API keys required' : 'No trading data'}
                </p>
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                  {isApiKeysMissing
                    ? 'Complete setup to view data'
                    : pnlData?.error
                      ? `Error: ${pnlData.error}`
                      : `${timeRange} period`
                  }
                </Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const metrics = pnlData?.metrics;

  // Calculate PnL percentage and APR
  const pnlPercentage = totalBalance > 0 ? (metrics?.totalPnl ?? 0) / totalBalance * 100 : 0;

  // Calculate APR based on the time range and actual days with data
  const calculateAPR = () => {
    if (!metrics || !chartData.length || totalBalance <= 0) return 0;

    const daysWithData = chartData.length;
    const totalReturn = metrics.totalPnl / totalBalance;

    // Annualize the return based on actual trading days
    const annualizedReturn = (totalReturn / daysWithData) * 365;
    return annualizedReturn * 100; // Convert to percentage
  };

  const apr = calculateAPR();

  // Defensive check for metrics
  const safeMetrics = metrics ? {
    totalPnl: metrics.totalPnl ?? 0,
    winRate: metrics.winRate ?? 0,
    profitFactor: metrics.profitFactor ?? 0,
    sharpeRatio: metrics.sharpeRatio ?? 0,
    bestDay: metrics.bestDay,
    worstDay: metrics.worstDay,
    avgDailyPnl: metrics.avgDailyPnl ?? 0,
    maxDrawdown: metrics.maxDrawdown ?? 0,
  } : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performance
            </CardTitle>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => fetchPnLData(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24h</SelectItem>
                  <SelectItem value="7d">7d</SelectItem>
                  <SelectItem value="30d">30d</SelectItem>
                  <SelectItem value="90d">90d</SelectItem>
                  <SelectItem value="1y">1y</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Tabs value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                <TabsList className="h-7">
                  <TabsTrigger value="daily" className="h-6 text-xs">Daily</TabsTrigger>
                  <TabsTrigger value="cumulative" className="h-6 text-xs">Total</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
        {/* Performance Summary - Minimal inline design */}
        {safeMetrics && (
          <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b">
            <div className="flex items-center gap-1.5">
              {safeMetrics.totalPnl >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
              <span className={`text-sm font-semibold ${safeMetrics.totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatTooltipValue(safeMetrics.totalPnl)}
              </span>
              <Badge
                variant={safeMetrics.totalPnl >= 0 ? "outline" : "destructive"}
                className={`h-4 text-[10px] px-1 ${safeMetrics.totalPnl >= 0 ? 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400' : ''}`}
              >
                {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
              </Badge>
            </div>

            <div className="w-px h-4 bg-border" />

            <div className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Win</span>
              <Badge variant="secondary" className="h-4 text-[10px] px-1">
                {safeMetrics.winRate.toFixed(1)}%
              </Badge>
            </div>

            <div className="w-px h-4 bg-border" />

            <div className="flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">APR</span>
              <Badge
                variant={apr >= 0 ? "outline" : "destructive"}
                className={`h-4 text-[10px] px-1 ${apr >= 0 ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : ''}`}
              >
                {apr >= 0 ? '+' : ''}{apr.toFixed(1)}%
              </Badge>
            </div>

            <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Best: <span className="text-green-600">{safeMetrics.bestDay ? formatTooltipValue(safeMetrics.bestDay.netPnl) : '-'}</span></span>
              <span>Worst: <span className="text-red-600">{safeMetrics.worstDay ? formatTooltipValue(safeMetrics.worstDay.netPnl) : '-'}</span></span>
              <span>Avg: {formatTooltipValue(safeMetrics.avgDailyPnl)}</span>
            </div>
          </div>
        )}

        {/* Chart with refresh overlay */}
        <div className="relative">
          {isRefreshing && (
            <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <ResponsiveContainer width="100%" height={200}>
            {chartType === 'daily' ? (
            <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateTick}
                domain={['dataMin', 'dataMax']}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar
                dataKey="netPnl"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netPnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateTick}
              />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={chartData.length > 0 && (chartData[chartData.length - 1].cumulativePnl ?? 0) >= 0 ? "#10b981" : "#ef4444"}
                fill={chartData.length > 0 && (chartData[chartData.length - 1].cumulativePnl ?? 0) >= 0 ? "#10b98140" : "#ef444440"}
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
        </div>

        {/* Additional Metrics - Inline badges */}
        {safeMetrics && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
            <Badge variant="outline" className="h-5 text-[10px] gap-1">
              <span className="text-muted-foreground">Profit Factor</span>
              <span className="font-semibold">{safeMetrics.profitFactor.toFixed(2)}</span>
            </Badge>
            <Badge variant="outline" className="h-5 text-[10px] gap-1">
              <span className="text-muted-foreground">Sharpe</span>
              <span className="font-semibold">{safeMetrics.sharpeRatio.toFixed(2)}</span>
            </Badge>
            <Badge variant="outline" className="h-5 text-[10px] gap-1">
              <span className="text-muted-foreground">Drawdown</span>
              <span className="font-semibold text-orange-600">{formatTooltipValue(Math.abs(safeMetrics.maxDrawdown))}</span>
            </Badge>
            <Badge variant="outline" className="h-5 text-[10px] gap-1">
              <span className="text-muted-foreground">Days</span>
              <span className="font-semibold">{chartData.length}</span>
            </Badge>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}