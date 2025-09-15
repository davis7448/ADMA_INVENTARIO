
"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const chartConfig = {
    orders: {
      label: "Órdenes Pendientes",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

type DashboardPendingChartProps = {
  data: {
    date: string;
    orders: number;
  }[];
};

export default function DashboardPendingChart({ data }: DashboardPendingChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <LineChart 
            data={data} 
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
        >
          <RechartsTooltip
            cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
            content={<ChartTooltipContent 
                indicator="dot"
                labelFormatter={(value) => new Date(value).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
            />}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            allowDecimals={false}
           />
          <Line 
            type="monotone" 
            dataKey="orders" 
            stroke="var(--color-orders)" 
            strokeWidth={2} 
            dot={data.length < 30}
            />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
