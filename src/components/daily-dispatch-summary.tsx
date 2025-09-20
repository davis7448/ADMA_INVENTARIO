
"use client";

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyDispatchSummaryProps {
  data: Record<string, Record<string, Record<string, number>>>;
}

const DAYS_PER_PAGE = 4;

export default function DailyDispatchSummary({ data }: DailyDispatchSummaryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const sortedDays = Object.keys(data).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const totalPages = Math.ceil(sortedDays.length / DAYS_PER_PAGE);
  const startIndex = (currentPage - 1) * DAYS_PER_PAGE;
  const endIndex = startIndex + DAYS_PER_PAGE;
  const paginatedDays = sortedDays.slice(startIndex, endIndex);

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
          {paginatedDays.map((day) => {
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
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-end space-x-2 pt-4">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
            </Button>
            <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
            >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
        </CardFooter>
      )}
    </Card>
  );
}
