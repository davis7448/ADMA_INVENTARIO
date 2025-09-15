
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip as ChartTooltipContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type PlatformCarrierChartProps = {
  data: any[];
  carriers: string[];
};

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPlatformCarrierChart({ data, carriers }: PlatformCarrierChartProps) {
  const chartConfig = carriers.reduce((acc, carrier, index) => {
    acc[carrier] = {
      label: carrier,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {} as ChartConfig);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="p-2 text-xs bg-background border rounded-md shadow-lg">
          <p className="font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value} (${((entry.value / total) * 100).toFixed(1)}%)`}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <BarChart data={data} stackOffset="expand">
          <YAxis
            type="number"
            hide
            domain={[0, 1]}
            tickFormatter={(value) => `${value * 100}%`}
          />
          <XAxis
            type="category"
            dataKey="name"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Legend />
          {carriers.map((carrier, index) => (
            <Bar 
                key={carrier} 
                dataKey={carrier} 
                stackId="a" 
                fill={CHART_COLORS[index % CHART_COLORS.length]} 
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
