"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const chartConfig = {
  stock: {
    label: "Stock",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

type InventoryChartProps = {
  data: {
    name: string;
    stock: number;
  }[];
};

export default function InventoryChart({ data }: InventoryChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid horizontal={false} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={120}
            className="text-xs"
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.toString()}
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={<ChartTooltipContent />} 
          />
          <Bar dataKey="stock" fill="var(--color-stock)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
