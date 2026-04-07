

"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

const chartConfig = {
  annulled: {
    label: "Anulados",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig;

type DashboardAnnulledChartProps = {
  data: {
    date: string;
    annulled: number;
  }[];
};

export default function DashboardAnnulledChart({ data }: DashboardAnnulledChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <AreaChart 
            data={data} 
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorAnnulled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-annulled)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--color-annulled)" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <RechartsTooltip
            cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
            content={<ChartTooltipContent 
                indicator="dot"
                labelFormatter={(value) => format(new Date(`${value}T00:00:00`), 'eeee, dd MMM', { locale: es })}
            />}
          />
          <XAxis
            dataKey="date"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const dateParts = value.split('-');
              if (dateParts.length === 3) {
                return dateParts[2]; // Return only the day
              }
              return value;
            }}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            allowDecimals={false}
           />
          <Area 
            type="monotone" 
            dataKey="annulled" 
            stroke="var(--color-annulled)" 
            strokeWidth={2} 
            dot={data.length < 30}
            fillOpacity={1} 
            fill="url(#colorAnnulled)"
            />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
