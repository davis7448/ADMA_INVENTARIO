"use client";

import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarIcon, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { getReturnsByProduct, getDamagesReport, getWarehouses, getInventoryMovements } from '@/lib/api';
import type { ReturnsByProduct, DamagesReport, Warehouse, InventoryMovement } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/use-auth';

function ReturnsDamagesPageContent() {
  const { user } = useAuth();
  const [returnsData, setReturnsData] = useState<ReturnsByProduct[]>([]);
  const [returnsPagination, setReturnsPagination] = useState({ totalCount: 0, totalPages: 0, currentPage: 1 });
  const [damagesData, setDamagesData] = useState<DamagesReport[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    if (user?.role === 'logistics' && user.warehouseId) {
      return user.warehouseId;
    }
    return 'all';
  });
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>(() => {
    const today = new Date();
    return {
      from: subDays(today, 6), // 7 días incluyendo hoy
      to: today,
    };
  });
  const [returnsPage, setReturnsPage] = useState(1);
  const [dailyReturns, setDailyReturns] = useState<Record<string, number>>({});
  const [trackingSearch, setTrackingSearch] = useState(''); // For damages tab search
  const [globalTrackingSearch, setGlobalTrackingSearch] = useState(''); // For global tracking search
  const [globalSearchResults, setGlobalSearchResults] = useState<InventoryMovement[]>([]);
  const [globalSearchPagination, setGlobalSearchPagination] = useState({ totalCount: 0, totalPages: 0, currentPage: 1 });
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

  // Filter damages data based on tracking search
  const filteredDamagesData = damagesData.filter(item =>
    item.damageMovements.some(movement => {
      const trackingMatch = movement.notes.match(/Guía:\s*([^\s.,]+)/);
      const trackingNumber = trackingMatch ? trackingMatch[1] : '';
      return trackingSearch === '' ||
             trackingNumber.toLowerCase().includes(trackingSearch.toLowerCase()) ||
             movement.notes.toLowerCase().includes(trackingSearch.toLowerCase());
    })
  );

  useEffect(() => {
    loadData();
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const warehousesData = await getWarehouses();
      setWarehouses(warehousesData);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
        warehouseId: selectedWarehouse,
      };

      const [returnsResult, damages] = await Promise.all([
        getReturnsByProduct({ ...filters, page: returnsPage, limit: 20 }),
        getDamagesReport(filters),
      ]);

      setReturnsData(returnsResult.data);
      setReturnsPagination({
        totalCount: returnsResult.totalCount,
        totalPages: returnsResult.totalPages,
        currentPage: returnsPage
      });
      setDamagesData(damages);

      // Calculate daily returns for visualization
      const dailyData: Record<string, number> = {};
      returnsResult.data.forEach(product => {
        product.returnMovements.forEach(movement => {
          const day = format(new Date(movement.date), 'yyyy-MM-dd');
          dailyData[day] = (dailyData[day] || 0) + movement.quantity;
        });
      });
      setDailyReturns(dailyData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouse, dateRange, returnsPage]);

  const searchGlobalTracking = async (page = 1) => {
    if (!globalTrackingSearch.trim()) {
      setGlobalSearchResults([]);
      setGlobalSearchPagination({ totalCount: 0, totalPages: 0, currentPage: 1 });
      return;
    }

    setGlobalSearchLoading(true);
    try {
      // Search in inventory movements for tracking numbers
      // Note: We fetch more than needed and filter client-side to avoid complex Firestore indexes
      const movementsResult = await getInventoryMovements({
        page: 1, // Always start from page 1 and filter client-side
        limit: 1000, // Fetch more to allow client-side filtering
        filters: {
          warehouseId: selectedWarehouse === 'all' ? undefined : selectedWarehouse,
          // We'll filter by tracking number in notes on the client side since Firestore doesn't support regex searches easily
        }
      });

      // Filter movements that contain the search term in their notes (tracking numbers)
      const filteredMovements = movementsResult.movements.filter(movement => {
        if (!movement.notes) return false;

        const notes = movement.notes.toLowerCase();
        const searchTerm = globalTrackingSearch.toLowerCase();

        // Check if search term is in notes (most inclusive search)
        if (notes.includes(searchTerm)) return true;

        // Also check for tracking numbers in various formats
        // Look for patterns like "Guía: XXX", "- Guía: XXX", "XXX" as standalone numbers
        const trackingPatterns = [
          /Guía:\s*([^\s.,]+)/i,  // "Guía: XXX"
          /- Guía:\s*([^\s.,]+)/i, // "- Guía: XXX"
          /\b\d{8,12}\b/g,        // Standalone numbers (8-12 digits, typical for tracking)
        ];

        for (const pattern of trackingPatterns) {
          const matches = movement.notes.match(pattern);
          if (matches) {
            for (const match of matches) {
              // If it's a full pattern match, extract the number part
              if (match.includes('Guía:')) {
                const numberMatch = match.match(/Guía:\s*([^\s.,]+)/i);
                if (numberMatch && numberMatch[1] && numberMatch[1].toLowerCase().includes(searchTerm)) {
                  return true;
                }
              } else if (match.toLowerCase().includes(searchTerm)) {
                // Direct match for standalone numbers
                return true;
              }
            }
          }
        }

        return false;
      });

      // Apply client-side pagination
      const startIndex = (page - 1) * 30;
      const endIndex = startIndex + 30;
      const paginatedResults = filteredMovements.slice(startIndex, endIndex);

      setGlobalSearchResults(paginatedResults);
      setGlobalSearchPagination({
        totalCount: filteredMovements.length,
        totalPages: Math.ceil(filteredMovements.length / 30),
        currentPage: page
      });
    } catch (error) {
      console.error('Error searching tracking numbers:', error);
      setGlobalSearchResults([]);
      setGlobalSearchPagination({ totalCount: 0, totalPages: 0, currentPage: 1 });
    } finally {
      setGlobalSearchLoading(false);
    }
  };

  useEffect(() => {
    if (globalTrackingSearch.trim()) {
      searchGlobalTracking(1);
    } else {
      setGlobalSearchResults([]);
      setGlobalSearchPagination({ totalCount: 0, totalPages: 0, currentPage: 1 });
    }
  }, [globalTrackingSearch, selectedWarehouse]);

  const exportToXLSX = (data: any[], filename: string, sheetName: string = 'Datos') => {
    if (data.length === 0) return;

    let exportData: any[] = [];

    if (filename.includes('averias')) {
      // For damages, flatten individual movements
      exportData = data.flatMap((item: any) =>
        item.damageMovements.map((movement: any) => {
          // Extract tracking number from notes
          const trackingMatch = movement.notes.match(/Guía:\s*([^\s.,]+)/);
          const trackingNumber = trackingMatch ? trackingMatch[1] : 'N/A';

          return {
            Fecha: format(new Date(movement.date), 'dd/MM/yyyy'),
            Producto: item.productName,
            SKU: item.productSku,
            Cantidad: movement.quantity,
            Guía: trackingNumber,
            'Motivo de Avería': movement.notes.includes('Devolución averiada:') ?
              movement.notes.split('Devolución averiada:')[1]?.split('.')[0]?.trim() ||
              movement.notes.split('Devolución averiada:')[1]?.trim() :
              movement.notes,
            Usuario: movement.userName || 'N/A'
          };
        })
      );
    } else {
      // For returns, keep consolidated view
      exportData = data.map(item => {
        const cleanItem: any = {};
        Object.keys(item).forEach(key => {
          if (key !== 'returnMovements' && key !== 'damageMovements') {
            cleanItem[key] = item[key];
          }
        });
        return cleanItem;
      });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, ...exportData.map(row => String(row[key] || '').length))
    }));
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate and download file
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Devoluciones y Averías</h1>
          <p className="text-muted-foreground">Reporte de devoluciones por producto y averías reportadas con sus motivos.</p>
        </div>
      </div>

      {/* Global Tracking Search */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Guías de Devolución</CardTitle>
          <CardDescription>
            Busca guías específicas en todo el historial de movimientos de inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por número de guía..."
                value={globalTrackingSearch}
                onChange={(e) => setGlobalTrackingSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
            {globalTrackingSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGlobalTrackingSearch('')}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* Global Search Results */}
          {globalTrackingSearch && (
            <div className="mt-4">
              {globalSearchLoading ? (
                <div className="flex justify-center py-4">
                  <div className="text-muted-foreground">Buscando guías...</div>
                </div>
              ) : globalSearchResults.length > 0 ? (
                <>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Encontrados {globalSearchPagination.totalCount} resultados para "{globalTrackingSearch}"
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Guía</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead>Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalSearchResults.map((movement, index) => {
                          const trackingMatch = movement.notes?.match(/Guía:\s*([^\s.,]+)/);
                          const trackingNumber = trackingMatch ? trackingMatch[1] : 'N/A';

                          return (
                            <TableRow key={`${movement.id || index}`}>
                              <TableCell className="font-medium">
                                {format(new Date(movement.date), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                <Badge variant={movement.type === 'Entrada' ? 'default' : 'secondary'}>
                                  {movement.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{movement.productName}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={movement.quantity > 0 ? 'default' : 'destructive'}>
                                  {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {trackingNumber}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {movement.notes}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {movement.userName || 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>

                  {/* Pagination for global search */}
                  {globalSearchPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((globalSearchPagination.currentPage - 1) * 30) + 1} - {Math.min(globalSearchPagination.currentPage * 30, globalSearchPagination.totalCount)} de {globalSearchPagination.totalCount} resultados
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => searchGlobalTracking(globalSearchPagination.currentPage - 1)}
                          disabled={globalSearchPagination.currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <span className="text-sm">
                          Página {globalSearchPagination.currentPage} de {globalSearchPagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => searchGlobalTracking(globalSearchPagination.currentPage + 1)}
                          disabled={globalSearchPagination.currentPage === globalSearchPagination.totalPages}
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : globalTrackingSearch ? (
                <div className="text-center py-4 text-muted-foreground">
                  No se encontraron guías que coincidan con "{globalTrackingSearch}"
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bodega</label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar bodega" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las bodegas</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha desde</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha hasta</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setDateRange({ from: undefined, to: undefined })}
              >
                Limpiar fechas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="returns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="returns">Devoluciones por Producto</TabsTrigger>
          <TabsTrigger value="damages">Averías Reportadas</TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="space-y-4">
          {/* Daily Returns Chart */}
          {Object.keys(dailyReturns).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Devoluciones por Día</CardTitle>
                <CardDescription>
                  Visualización diaria de las devoluciones en el período seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={Object.entries(dailyReturns).map(([date, returns]) => ({
                      date: format(new Date(date), 'dd/MM'),
                      returns
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="returns" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Devoluciones por Producto</CardTitle>
                <CardDescription>
                  Total de unidades devueltas agrupadas por producto ({returnsPagination.totalCount} productos)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => exportToXLSX(returnsData, 'devoluciones-por-producto.xlsx', 'Devoluciones')}
                disabled={returnsData.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Cargando...</div>
                </div>
              ) : returnsData.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Total Devoluciones</TableHead>
                        <TableHead className="text-right">Movimientos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnsData.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.productSku}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{item.totalReturns}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.returnMovements.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination Controls */}
                  {returnsPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((returnsPagination.currentPage - 1) * 20) + 1} - {Math.min(returnsPagination.currentPage * 20, returnsPagination.totalCount)} de {returnsPagination.totalCount} productos
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReturnsPage(prev => Math.max(1, prev - 1))}
                          disabled={returnsPagination.currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Anterior
                        </Button>
                        <span className="text-sm">
                          Página {returnsPagination.currentPage} de {returnsPagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReturnsPage(prev => Math.min(returnsPagination.totalPages, prev + 1))}
                          disabled={returnsPagination.currentPage === returnsPagination.totalPages}
                        >
                          Siguiente
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron devoluciones en el período seleccionado.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="damages" className="space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <CardTitle>Averías Reportadas</CardTitle>
                 <CardDescription>
                   Desglose individual de productos averiados con sus motivos
                 </CardDescription>
               </div>
               <Button
                 variant="outline"
                 onClick={() => exportToXLSX(filteredDamagesData, 'averias-reportadas.xlsx', 'Averías')}
                 disabled={filteredDamagesData.length === 0}
               >
                 <Download className="mr-2 h-4 w-4" />
                 Exportar Excel
               </Button>
             </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Cargando...</div>
                </div>
              ) : filteredDamagesData.length > 0 ? (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Fecha</TableHead>
                       <TableHead>Producto</TableHead>
                       <TableHead>SKU</TableHead>
                       <TableHead className="text-right">Cantidad</TableHead>
                       <TableHead>Guía</TableHead>
                       <TableHead>Motivo de Avería</TableHead>
                       <TableHead>Usuario</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredDamagesData.flatMap((item) =>
                       item.damageMovements
                         .filter((movement: any) => {
                           const trackingMatch = movement.notes.match(/Guía:\s*([^\s.,]+)/);
                           const trackingNumber = trackingMatch ? trackingMatch[1] : '';
                           return trackingSearch === '' ||
                                  trackingNumber.toLowerCase().includes(trackingSearch.toLowerCase()) ||
                                  movement.notes.toLowerCase().includes(trackingSearch.toLowerCase());
                         })
                         .map((movement: any, index: number) => {
                           // Extract tracking number from notes
                           const trackingMatch = movement.notes.match(/Guía:\s*([^\s.,]+)/);
                           const trackingNumber = trackingMatch ? trackingMatch[1] : 'N/A';

                           return (
                             <TableRow key={`${item.productId}-${index}`}>
                               <TableCell className="font-medium">
                                 {format(new Date(movement.date), 'dd/MM/yyyy')}
                               </TableCell>
                               <TableCell>{item.productName}</TableCell>
                               <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                               <TableCell className="text-right">
                                 <Badge variant="destructive">{movement.quantity}</Badge>
                               </TableCell>
                               <TableCell className="font-mono text-sm">
                                 {trackingNumber}
                               </TableCell>
                               <TableCell>
                                 {movement.notes.includes('Devolución averiada:') ?
                                   movement.notes.split('Devolución averiada:')[1]?.split('.')[0]?.trim() ||
                                   movement.notes.split('Devolución averiada:')[1]?.trim() :
                                   movement.notes
                                 }
                               </TableCell>
                               <TableCell className="text-sm text-muted-foreground">
                                 {movement.userName || 'N/A'}
                               </TableCell>
                             </TableRow>
                           );
                         })
                     )}
                   </TableBody>
                 </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {trackingSearch ? 'No se encontraron averías que coincidan con la búsqueda.' : 'No se encontraron averías en el período seleccionado.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ReturnsDamagesPage() {
  return (
    <Suspense>
      <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'commercial']}>
        <ReturnsDamagesPageContent />
      </AuthProviderWrapper>
    </Suspense>
  );
}