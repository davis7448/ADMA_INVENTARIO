"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type CrmDonutChartProps = {
  data: {
    name: string;
    value: number;
  }[];
};

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

// Donut reutilizable para distribuciones (etapa del pipeline, categoría, tipo, etc.).
export default function CrmStatusChart({ data }: CrmDonutChartProps) {
  const filteredData = React.useMemo(() => data.filter((d) => d.value > 0), [data]);

  const chartConfig = React.useMemo(() => {
    return filteredData.reduce((acc, item, index) => {
      acc[item.name] = { label: item.name, color: CHART_COLORS[index % CHART_COLORS.length] };
      return acc;
    }, {} as any);
  }, [filteredData]);

  const totalValue = React.useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.value, 0),
    [filteredData],
  );

  if (filteredData.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        Sin datos
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-4 sm:flex-row">
      <div className="h-40 w-40 shrink-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => `${name}: ${value} (${((Number(value) / totalValue) * 100).toFixed(1)}%)`}
                    hideLabel
                  />
                }
              />
              <Pie data={filteredData} dataKey="value" nameKey="name" innerRadius="55%" strokeWidth={2} legendType="none">
                {filteredData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {filteredData.map((entry, index) => (
          <li key={entry.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums">
              {entry.value}
              <span className="ml-1 text-xs text-muted-foreground">
                ({((entry.value / totalValue) * 100).toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
