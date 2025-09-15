
"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';


const chartConfig = {
    orders: {
      label: "Órdenes",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

type DashboardPendingChartProps = {
  data: {
    name: string;
    orders: number;
  }[];
};

export default function DashboardPendingChart({ data }: DashboardPendingChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart 
                data={data} 
                layout="vertical" 
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
                 <ChartTooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={5}
                    axisLine={false}
                    className="text-xs"
                    interval={0}
                />
                <Bar 
                    dataKey="orders" 
                    fill="var(--color-orders)" 
                    radius={4} 
                    barSize={20}
                />
            </BarChart>
        </ResponsiveContainer>
    </ChartContainer>
  )
}
