"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

const chartConfig = {
  count: { label: "Altas", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

type CrmAdditionsByCommercialChartProps = {
  data: {
    name: string;
    count: number;
  }[];
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="p-2 text-xs bg-background border rounded-md shadow-lg">
        <p className="font-bold">{item.name}</p>
        <p className="text-muted-foreground">{item.count} cliente(s) agregado(s)</p>
      </div>
    );
  }
  return null;
};

export default function CrmAdditionsByCommercialChart({ data }: CrmAdditionsByCommercialChartProps) {
  // Mostrar como máximo el top 10 para mantener el gráfico legible.
  const topData = data.slice(0, 10);

  if (topData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <BarChart data={topData} layout="vertical" margin={{ top: 5, right: 16, left: 10, bottom: 0 }}>
          <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#888888"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
            tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 16)}…` : value)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {topData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
