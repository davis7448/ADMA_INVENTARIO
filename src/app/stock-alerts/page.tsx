import { getOrGenerateStockAlerts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StockAlertsContent } from '@/components/stock-alerts-content';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const revalidate = 0; // Disable caching for this page

async function StockAlertsData() {
    const result = await getOrGenerateStockAlerts();
    return (
        <StockAlertsContent 
          initialAlerts={result.alerts} 
          error={result.error} 
          lastGenerated={result.lastGenerated}
        />
    );
}

function StockAlertsSkeleton() {
    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Disponibilidad de Stock</h1>
                <p className="text-muted-foreground">
                    Productos cuyo stock disponible para reservar es peligrosamente bajo en comparación con su demanda.
                </p>
            </div>
            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle>Productos en Riesgo</CardTitle>
                        <CardDescription>
                            Estos productos podrían quedarse sin stock para nuevas reservas si no se toman acciones. 
                            <br className="hidden sm:inline" />
                            La alerta se activa si el stock disponible es menor a 3 días de ventas promedio.
                        </CardDescription>
                        <Skeleton className="h-4 w-64 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-44" />
                </CardHeader>
                <CardContent>
                    <div className="p-4 mb-4 border rounded-lg bg-muted/50">
                         <Skeleton className="h-9 w-64" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function StockAlertsPage() {
    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'logistics', 'plataformas']}>
        <Suspense fallback={<StockAlertsSkeleton />}>
            <StockAlertsData />
        </Suspense>
      </AuthProviderWrapper>
    );
}
