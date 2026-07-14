"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingCart, Users, MailWarning, CheckCircle2, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadClientProductData, type ClientProductData } from '@/lib/crm-product-cache';
import { computeClientProductMetrics } from '@/lib/crm-product-metrics';

const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

type CrmProductViewProps = {
    range: { from: Date; to: Date };
};

export default function CrmProductView({ range }: CrmProductViewProps) {
    const [data, setData] = useState<ClientProductData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                setLoading(true);
                // Usa la caché en memoria: solo la primera carga golpea Firestore.
                const result = await loadClientProductData();
                if (active) setData(result);
            } catch (err) {
                console.error('Error loading product data:', err);
                if (active) setError('No se pudieron cargar los datos de producto (modificaciones/pedidos).');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            setError(null);
            const result = await loadClientProductData(true); // fuerza recarga desde Firestore
            setData(result);
        } catch (err) {
            console.error('Error refreshing product data:', err);
            setError('No se pudieron actualizar los datos de producto.');
        } finally {
            setRefreshing(false);
        }
    };

    // Recalcula en memoria al cambiar el rango o los datos (sin volver a consultar Firestore).
    const metrics = useMemo(() => {
        if (!data) return null;
        return computeClientProductMetrics(data.clients, data.orders, data.tests, data.modificaciones, range);
    }, [data, range]);

    const filteredClients = useMemo(() => {
        if (!metrics) return [];
        const withProduct = metrics.perClient.filter(
            (r) => r.totalUnits > 0 || r.testCount > 0 || r.distinctProductsReserved > 0,
        );
        if (!search.trim()) return withProduct.slice(0, 30);
        const q = search.toLowerCase();
        return withProduct.filter(
            (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
        ).slice(0, 50);
    }, [metrics, search]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!metrics) return null;
    const { totals, orphanEmails } = metrics;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Actualizando...' : 'Actualizar'}
                </Button>
            </div>

            {/* KPIs de producto */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-cyan-500/10 to-sky-600/10 border-cyan-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unidades reservadas</CardTitle>
                        <Package className="h-4 w-4 text-cyan-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{numberFormat.format(totals.totalUnitsReserved)}</div>
                        <p className="text-xs text-muted-foreground">Reservas (modificaciones) en el rango</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unidades en pedidos</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{numberFormat.format(totals.totalOrderUnits)}</div>
                        <p className="text-xs text-muted-foreground">En pedidos del CRM en el rango</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border-blue-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes con producto</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{numberFormat.format(totals.clientsWithProduct)}</div>
                        <p className="text-xs text-muted-foreground">Con reservas, pedidos o testeos</p>
                    </CardContent>
                </Card>

                <Card className={`backdrop-blur-sm ${totals.orphanEmailCount > 0 ? 'bg-gradient-to-br from-red-500/10 to-orange-600/10 border-red-200/50' : 'bg-gradient-to-br from-emerald-500/10 to-green-600/10 border-emerald-200/50'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Correos sin ficha</CardTitle>
                        <MailWarning className={`h-4 w-4 ${totals.orphanEmailCount > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{numberFormat.format(totals.orphanEmailCount)}</div>
                        <p className="text-xs text-muted-foreground">{numberFormat.format(totals.orphanUnits)} unidades sin cliente en CRM</p>
                    </CardContent>
                </Card>
            </div>

            {/* Correos huérfanos (con producto asignado pero sin ficha en el CRM) */}
            {orphanEmails.length > 0 ? (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{orphanEmails.length} correo(s) con producto pero sin cliente en el CRM</AlertTitle>
                    <AlertDescription>
                        Estos correos tienen reservas de inventario (modificaciones) pero no existen como cliente en el CRM,
                        por lo que no están asignados a ningún comercial. Conviene crearles ficha o revisar el correo.
                    </AlertDescription>
                    <div className="mt-4 overflow-x-auto rounded-md border bg-background/60">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Correo</TableHead>
                                    <TableHead>Comercial en modificación</TableHead>
                                    <TableHead className="text-right">Unidades</TableHead>
                                    <TableHead className="text-right"># Reservas</TableHead>
                                    <TableHead className="text-right">Productos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orphanEmails.slice(0, 50).map((row) => (
                                    <TableRow key={row.email}>
                                        <TableCell className="font-medium">{row.email}</TableCell>
                                        <TableCell>
                                            {row.commercialInMod
                                                ? row.commercialInMod
                                                : <Badge variant="outline" className="text-[10px]">sin comercial</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{numberFormat.format(row.unitsReserved)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{row.reservationsCount}</TableCell>
                                        <TableCell className="text-right tabular-nums">{row.distinctProducts}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {orphanEmails.length > 50 && (
                        <p className="mt-2 text-xs text-muted-foreground">Mostrando 50 de {orphanEmails.length} correos.</p>
                    )}
                </Alert>
            ) : (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Sin correos huérfanos</AlertTitle>
                    <AlertDescription>Todos los correos con producto asignado tienen ficha de cliente en el CRM.</AlertDescription>
                </Alert>
            )}

            {/* Producto por cliente */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Producto por cliente</CardTitle>
                    <CardDescription>Unidades asignadas (reservas), ofertadas (pedidos) y testeos por cliente en el rango seleccionado</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar cliente o correo..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Comercial</TableHead>
                                    <TableHead className="text-right">Unid. reservadas</TableHead>
                                    <TableHead className="text-right">Rotación (unid./mes)</TableHead>
                                    <TableHead className="text-right">Prod. reservados</TableHead>
                                    <TableHead className="text-right">Unid. pedidos</TableHead>
                                    <TableHead className="text-right">Testeos</TableHead>
                                    <TableHead className="text-right">Total unid.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                                            Sin coincidencias
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredClients.map((row) => (
                                        <TableRow key={row.clientId}>
                                            <TableCell>
                                                <div className="font-medium truncate max-w-[220px]">{row.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.email}</div>
                                            </TableCell>
                                            <TableCell className="text-sm">{row.commercialName}</TableCell>
                                            <TableCell className="text-right tabular-nums">{numberFormat.format(row.unitsReserved)}</TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">{decimalFormat.format(row.rotationPerMonth)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{row.distinctProductsReserved}</TableCell>
                                            <TableCell className="text-right tabular-nums">{numberFormat.format(row.orderUnits)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{row.testCount}</TableCell>
                                            <TableCell className="text-right font-semibold tabular-nums">{numberFormat.format(row.totalUnits)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {search.trim() ? 'Mostrando hasta 50 coincidencias.' : 'Mostrando el top 30 por total de unidades. Usa el buscador para ver más.'}
                        {' '}La <span className="font-medium">rotación</span> = unidades reservadas ÷ meses del rango seleccionado ({metrics.rangeMonths} mes(es)).
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
