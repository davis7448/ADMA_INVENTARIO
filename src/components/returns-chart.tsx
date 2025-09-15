
"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const chartConfig = {
  returns: {
    label: "Returns",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

type ReturnsChartProps = {
  data: {
    date: string;
    returns: number;
  }[];
};

export default function ReturnsChart({ data }: ReturnsChartProps) {
    if (!data || data.length === 0 || data.every(d => d.returns === 0)) {
        return (
            <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
                No se registraron devoluciones en el período.
            </div>
        );
    }
  
  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
           />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={<ChartTooltipContent indicator="line" />} 
          />
          <Area type="monotone" dataKey="returns" stroke="var(--color-returns)" fill="var(--color-returns)" fillOpacity={0.4} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
