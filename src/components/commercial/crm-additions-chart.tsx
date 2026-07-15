"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

const chartConfig = {
  altas: {
    label: "Altas (clientes)",
    color: "hsl(var(--primary))",
  },
  reservasCount: {
    label: "N.º de reservas",
    color: "hsl(var(--chart-2))",
  },
  reservasUnits: {
    label: "Cantidad reservada",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

type CrmAdditionsChartProps = {
  data: {
    date: string;
    altas: number;
    reservasCount?: number;
    reservasUnits?: number;
  }[];
  showReservas?: boolean; // superpone las reservas de inventario (solo director/admin)
};

export default function CrmAdditionsChart({ data, showReservas = false }: CrmAdditionsChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 5, right: showReservas ? 4 : 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCrmAltas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-altas)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-altas)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <RechartsTooltip
            cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
            content={<ChartTooltipContent
              indicator="dot"
              labelFormatter={(value) => format(new Date(`${value}T00:00:00`), 'eeee, dd MMM', { locale: es })}
            />}
          />
          {showReservas && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
          <XAxis
            dataKey="date"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const dateParts = value.split('-');
              return dateParts.length === 3 ? dateParts[2] : value;
            }}
          />
          {/* Eje izquierdo: conteos (altas y n.º de reservas) */}
          <YAxis
            yAxisId="count"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            allowDecimals={false}
          />
          {/* Eje derecho: cantidad reservada (unidades) */}
          {showReservas && (
            <YAxis
              yAxisId="units"
              orientation="right"
              stroke="var(--color-reservasUnits)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              allowDecimals={false}
              width={40}
            />
          )}
          <Area
            yAxisId="count"
            type="monotone"
            dataKey="altas"
            name="Altas (clientes)"
            stroke="var(--color-altas)"
            strokeWidth={2}
            dot={data.length < 30}
            fillOpacity={1}
            fill="url(#colorCrmAltas)"
          />
          {showReservas && (
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="reservasCount"
              name="N.º de reservas"
              stroke="var(--color-reservasCount)"
              strokeWidth={2}
              dot={false}
            />
          )}
          {showReservas && (
            <Line
              yAxisId="units"
              type="monotone"
              dataKey="reservasUnits"
              name="Cantidad reservada"
              stroke="var(--color-reservasUnits)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
