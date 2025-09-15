
"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

type CategoryChartProps = {
  data: {
    name: string;
    value: number;
  }[];
};

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardCategoryChart({ data }: CategoryChartProps) {
  const chartConfig = React.useMemo(() => {
    return data.reduce((acc, item, index) => {
        acc[item.name] = {
            label: item.name,
            color: CHART_COLORS[index % CHART_COLORS.length],
        };
        return acc;
    }, {} as any);
  }, [data]);


  if (data.length === 0) {
    return null;
  }

  const totalValue = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.value, 0);
  }, [data]);

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value) => `${value} (${((Number(value) / totalValue) * 100).toFixed(1)}%)`}
                hideLabel
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="50%"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
            ))}
          </Pie>
           <ChartLegend
            content={<ChartLegendContent nameKey="name" className="text-xs" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/3 [&>*]:justify-center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
