
import { getAuditAlerts } from '@/lib/api';
import type { AuditAlert } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { formatToTimeZone } from '@/lib/utils';

async function AuditAlertsContent() {
    const alerts: AuditAlert[] = await getAuditAlerts();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Auditoría de Stock</h1>
                <p className="text-muted-foreground">
                    Discrepancias de inventario detectadas durante el proceso de despacho.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Registros de Alertas</CardTitle>
                    <CardDescription>
                        Se genera una alerta cuando un producto no puede ser despachado (excepción),
                        pero el sistema indicaba que había stock disponible. Esto sugiere un desajuste
                        en el inventario que requiere investigación.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Mensaje</TableHead>
                                <TableHead>ID Despacho</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alerts.length > 0 ? (
                                alerts.map((alert) => (
                                    <TableRow key={alert.id} className="hover:bg-destructive/5">
                                        <TableCell className="font-medium">
                                            {formatToTimeZone(new Date(alert.date), 'dd/MM/yyyy HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold">{alert.productName}</div>
                                            <div className="text-xs text-muted-foreground">{alert.productSku}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                                <p className="text-destructive-foreground">{alert.message}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{alert.dispatchId}</Badge>
                                            <p className="text-xs text-muted-foreground mt-1">Guía Excepción: {alert.exceptionTrackingNumber}</p>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        No hay alertas de auditoría. ¡Buen trabajo!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}


export default function AuditAlertsPage() {
    return (
      <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
        <AuditAlertsContent />
      </AuthProviderWrapper>
    );
}
