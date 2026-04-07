"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip as ChartTooltipContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import * as React from 'react';

type PlatformCarrierChartProps = {
  data: any[];
  carriers: string[];
};

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-1) / 0.7)", "hsl(var(--chart-2) / 0.7)", "hsl(var(--chart-3) / 0.7)", "hsl(var(--chart-4) / 0.7)", "hsl(var(--chart-5) / 0.7)"];

export default function DashboardPlatformCarrierChart({ data, carriers }: PlatformCarrierChartProps) {
  const chartConfig = carriers.reduce((acc, carrier, index) => {
    acc[carrier] = {
      label: carrier,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {} as ChartConfig);

  const processedData = React.useMemo(() => {
    if (data.length <= 15) {
      return data;
    }

    const sortedData = [...data].sort((a, b) => {
      const totalA = Object.keys(a).filter(key => key !== 'name').reduce((sum, key) => sum + a[key], 0);
      const totalB = Object.keys(b).filter(key => key !== 'name').reduce((sum, key) => sum + b[key], 0);
      return totalB - totalA;
    });

    const top15 = sortedData.slice(0, 15);
    const others = sortedData.slice(15);
    
    if (others.length > 0) {
        const otherEntry: { [key: string]: string | number } = { name: 'Otros' };
        carriers.forEach(carrier => {
          otherEntry[carrier] = others.reduce((sum, item) => sum + (item[carrier] || 0), 0);
        });
        return [...top15, otherEntry];
    }

    return top15;

  }, [data, carriers]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="p-2 text-xs bg-background border rounded-md shadow-lg">
          <p className="font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </div>
          ))}
           <p className="font-semibold mt-2 pt-2 border-t">Total: {total}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <BarChart data={processedData}>
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <XAxis
            type="category"
            dataKey="name"
            stroke="#888888"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Legend wrapperStyle={{fontSize: "10px", paddingTop: "20px"}} />
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