
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { formatToTimeZone } from '@/lib/utils';
import { Badge } from './ui/badge';
import { es } from 'date-fns/locale';

interface DailyDispatchSummaryProps {
  data: Record<string, Record<string, Record<string, number>>>;
}

export default function DailyDispatchSummary({ data }: DailyDispatchSummaryProps) {
  const sortedDays = Object.keys(data).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (sortedDays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen Diario de Guías Despachadas</CardTitle>
          <CardDescription>
            Recuento de guías enviadas por día, transportadora y plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            No hay datos de guías despachadas en el período seleccionado.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Diario de Guías Despachadas</CardTitle>
        <CardDescription>
          Recuento de guías enviadas por día, transportadora y plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-2">
          {sortedDays.map((day) => {
            const carriers = data[day];
            const totalGuidesForDay = Object.values(carriers).reduce(
              (dayTotal, platforms) =>
                dayTotal +
                Object.values(platforms).reduce(
                  (carrierTotal, count) => carrierTotal + count,
                  0
                ),
              0
            );

            return (
              <AccordionItem value={day} key={day} className="border rounded-lg px-4">
                <AccordionTrigger>
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-lg capitalize">
                      {formatToTimeZone(new Date(`${day}T00:00:00`), 'eeee, dd MMM yyyy', { locale: es })}
                    </span>
                    <Badge variant="secondary">{totalGuidesForDay} Guías</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {Object.entries(carriers).map(([carrierName, platforms]) => {
                      const totalForCarrier = Object.values(platforms).reduce((sum, count) => sum + count, 0);
                      return (
                        <div key={carrierName} className="border-l-2 pl-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium">{carrierName}</h4>
                            <Badge variant="outline">{totalForCarrier} Guías</Badge>
                          </div>
                          <ul className="list-disc list-inside text-muted-foreground mt-2">
                            {Object.entries(platforms).map(([platformName, count]) => (
                              <li key={platformName}>
                                {platformName}: <span className="font-semibold text-foreground">{count}</span> guías
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
