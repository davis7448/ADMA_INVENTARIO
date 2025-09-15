
"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const chartConfig = {
  orders: {
    label: "Órdenes",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

type DashboardOrdersChartProps = {
  data: {
    date: string;
    orders: number;
  }[];
};

export default function DashboardOrdersChart({ data }: DashboardOrdersChartProps) {
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
  );
}
