'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Loader2, Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface HistoryContainerProps {
  initialPlatforms: any[];
  initialCarriers: any[];
  warehouseId?: string;
}

export function HistoryContainer({ 
  initialPlatforms, 
  initialCarriers,
  warehouseId 
}: HistoryContainerProps) {
  // Active tab state
  const [activeTab, setActiveTab] = useState<'movements' | 'orders'>('movements');
  
  // State for movements and pagination
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsHasMore, setMovementsHasMore] = useState(true);
  const [movementsCursors, setMovementsCursors] = useState<{[page: number]: string | null}>({1: null});
  const [movementsTotalLoaded, setMovementsTotalLoaded] = useState(0);
  const [movementsGoToPage, setMovementsGoToPage] = useState('');
  const [movementsJumpLoading, setMovementsJumpLoading] = useState(false);
  
  // State for orders and pagination
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [ordersCursors, setOrdersCursors] = useState<{[page: number]: string | null}>({1: null});
  const [ordersTotalLoaded, setOrdersTotalLoaded] = useState(0);
  const [ordersGoToPage, setOrdersGoToPage] = useState('');
  const [ordersJumpLoading, setOrdersJumpLoading] = useState(false);
  
  const hasInitialLoad = useRef({ movements: false, orders: false });
  
  // Filters (shared between tabs)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [platformId, setPlatformId] = useState<string>('all');
  const [carrierId, setCarrierId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Create lookup maps for platforms and carriers
  const platformMap = useMemo(() => {
    const map: {[key: string]: string} = {};
    initialPlatforms.forEach((p: any) => {
      map[p.id] = p.name;
    });
    return map;
  }, [initialPlatforms]);

  const carrierMap = useMemo(() => {
    const map: {[key: string]: string} = {};
    initialCarriers.forEach((c: any) => {
      map[c.id] = c.name;
    });
    return map;
  }, [initialCarriers]);

  // Fetch movements for current page
  const fetchMovements = useCallback(async (targetPage: number = 1) => {
    // Prevent duplicate requests
    if (movementsLoading) return;
    
    setMovementsLoading(true);
    setMovementsError(null);
    
    try {
      const cursor = movementsCursors[targetPage] || null;
      
      // Build query params
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '20');
      params.set('warehouseId', warehouseId || 'all');
      
      if (cursor) {
        params.set('cursor', cursor);
      }
      if (startDate) {
        params.set('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.set('endDate', endDate.toISOString());
      }
      if (platformId !== 'all') {
        params.set('platformId', platformId);
      }
      if (carrierId !== 'all') {
        params.set('carrierId', carrierId);
      }
      
      console.log('[Client] Fetching movements page', targetPage, 'cursor:', cursor);
      
      const response = await fetch(`/api/history/movements?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMovements(data.movements);
      setMovementsHasMore(data.hasMore);
      setMovementsPage(data.page);
      setMovementsTotalLoaded((data.page - 1) * 20 + data.movements.length);
      
      // Store cursor for next page
      if (data.nextCursor && data.hasMore) {
        setMovementsCursors(prev => ({
          ...prev,
          [data.page + 1]: data.nextCursor
        }));
      }
      
    } catch (err) {
      console.error('[Client] Error fetching movements:', err);
      setMovementsError((err as Error).message);
    } finally {
      setMovementsLoading(false);
    }
  }, [movementsCursors, startDate, endDate, platformId, carrierId, warehouseId, movementsLoading]);

  // Fetch orders for current page
  const fetchOrders = useCallback(async (targetPage: number = 1) => {
    // Prevent duplicate requests
    if (ordersLoading) return;
    
    setOrdersLoading(true);
    setOrdersError(null);
    
    try {
      const cursor = ordersCursors[targetPage] || null;
      
      // Build query params
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '20');
      params.set('warehouseId', warehouseId || 'all');
      
      if (cursor) {
        params.set('cursor', cursor);
      }
      if (startDate) {
        params.set('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.set('endDate', endDate.toISOString());
      }
      if (platformId !== 'all') {
        params.set('platformId', platformId);
      }
      if (carrierId !== 'all') {
        params.set('carrierId', carrierId);
      }
      if (status !== 'all') {
        params.set('status', status);
      }
      
      console.log('[Client] Fetching orders page', targetPage, 'cursor:', cursor);
      
      const response = await fetch(`/api/history/orders?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setOrders(data.orders);
      setOrdersHasMore(data.hasMore);
      setOrdersPage(data.page);
      setOrdersTotalLoaded((data.page - 1) * 20 + data.orders.length);
      
      // Store cursor for next page
      if (data.nextCursor && data.hasMore) {
        setOrdersCursors(prev => ({
          ...prev,
          [data.page + 1]: data.nextCursor
        }));
      }
      
    } catch (err) {
      console.error('[Client] Error fetching orders:', err);
      setOrdersError((err as Error).message);
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersCursors, startDate, endDate, platformId, carrierId, status, warehouseId, ordersLoading]);

  // Initial load - only once per tab
  useEffect(() => {
    if (!hasInitialLoad.current.movements) {
      hasInitialLoad.current.movements = true;
      fetchMovements(1);
    }
  }, [fetchMovements]);

  useEffect(() => {
    if (activeTab === 'orders' && !hasInitialLoad.current.orders) {
      hasInitialLoad.current.orders = true;
      fetchOrders(1);
    }
  }, [activeTab, fetchOrders]);

  // Jump to specific page for movements
  const jumpToMovementsPage = async (targetPage: number) => {
    if (targetPage < 1) return;
    if (targetPage === movementsPage) return;
    
    setMovementsJumpLoading(true);
    
    try {
      let currentPage = movementsPage;
      
      // If going forward, load pages sequentially
      if (targetPage > movementsPage) {
        while (currentPage < targetPage && movementsHasMore) {
          await fetchMovements(currentPage + 1);
          currentPage++;
        }
      } else {
        // If going backward, we need to reload from page 1
        // Clear cursors and start over
        setMovementsCursors({1: null});
        setMovementsPage(1);
        
        let pageNum = 1;
        while (pageNum < targetPage) {
          const cursor = movementsCursors[pageNum + 1];
          if (!cursor && pageNum > 1) {
            // We don't have cursor for this page, need to load sequentially
            await fetchMovements(pageNum + 1);
          }
          pageNum++;
        }
        
        // Now fetch the target page
        await fetchMovements(targetPage);
      }
    } catch (err) {
      console.error('Error jumping to movements page:', err);
    } finally {
      setMovementsJumpLoading(false);
      setMovementsGoToPage('');
    }
  };

  // Jump to specific page for orders
  const jumpToOrdersPage = async (targetPage: number) => {
    if (targetPage < 1) return;
    if (targetPage === ordersPage) return;
    
    setOrdersJumpLoading(true);
    
    try {
      let currentPage = ordersPage;
      
      // If going forward, load pages sequentially
      if (targetPage > ordersPage) {
        while (currentPage < targetPage && ordersHasMore) {
          await fetchOrders(currentPage + 1);
          currentPage++;
        }
      } else {
        // If going backward, we need to reload from page 1
        // Clear cursors and start over
        setOrdersCursors({1: null});
        setOrdersPage(1);
        
        let pageNum = 1;
        while (pageNum < targetPage) {
          const cursor = ordersCursors[pageNum + 1];
          if (!cursor && pageNum > 1) {
            // We don't have cursor for this page, need to load sequentially
            await fetchOrders(pageNum + 1);
          }
          pageNum++;
        }
        
        // Now fetch the target page
        await fetchOrders(targetPage);
      }
    } catch (err) {
      console.error('Error jumping to orders page:', err);
    } finally {
      setOrdersJumpLoading(false);
      setOrdersGoToPage('');
    }
  };

  // Search products
  const searchProducts = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearchingProducts(true);
    
    try {
      const response = await fetch(
        `/api/history/products/search?q=${encodeURIComponent(query)}&warehouseId=${warehouseId || 'all'}`
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setSearchResults(data.products || []);
    } catch (err) {
      console.error('Error searching products:', err);
      setSearchResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  // Handle product selection
  const selectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setSearchResults([]);
  };

  // Clear all filters
  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPlatformId('all');
    setCarrierId('all');
    setStatus('all');
    setProductSearch('');
    setSelectedProductId(null);
    setSearchResults([]);
    
    if (activeTab === 'movements') {
      setMovementsCursors({1: null});
      setMovementsPage(1);
      fetchMovements(1);
    } else {
      setOrdersCursors({1: null});
      setOrdersPage(1);
      fetchOrders(1);
    }
  };

  // Apply filters
  const applyFilters = () => {
    if (activeTab === 'movements') {
      setMovementsCursors({1: null});
      setMovementsPage(1);
      fetchMovements(1);
    } else {
      setOrdersCursors({1: null});
      setOrdersPage(1);
      fetchOrders(1);
    }
  };

  const hasActiveFilters = startDate || endDate || platformId !== 'all' || 
                          carrierId !== 'all' || status !== 'all' || selectedProductId;

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Pendiente':
        return 'default';
      case 'Despachada':
        return 'success';
      case 'Parcial':
        return 'warning';
      case 'Anulada':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : <span>Desde...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : <span>Hasta...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platformId} onValueChange={setPlatformId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {initialPlatforms.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Carrier */}
            <div className="space-y-2">
              <Label>Transportadora</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {initialCarriers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status - Only show in orders tab */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus} disabled={activeTab === 'movements'}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Despachada">Despachada</SelectItem>
                  <SelectItem value="Parcial">Parcial</SelectItem>
                  <SelectItem value="Anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Search */}
            <div className="space-y-2 relative lg:col-span-2">
              <Label>Producto</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    searchProducts(e.target.value);
                  }}
                  className="pl-8"
                />
                {searchingProducts && (
                  <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin" />
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      className="w-full px-4 py-2 text-left hover:bg-muted text-sm"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-muted-foreground text-xs">{product.sku}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Filters & Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {hasActiveFilters && (
                <>
                  <span className="text-sm text-muted-foreground">Filtros:</span>
                  {startDate && (
                    <Badge variant="secondary" className="gap-1">
                      Desde {format(startDate, "dd/MM/yyyy")}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setStartDate(undefined)} />
                    </Badge>
                  )}
                  {endDate && (
                    <Badge variant="secondary" className="gap-1">
                      Hasta {format(endDate, "dd/MM/yyyy")}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setEndDate(undefined)} />
                    </Badge>
                  )}
                  {platformId !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {initialPlatforms.find((p: any) => p.id === platformId)?.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setPlatformId('all')} />
                    </Badge>
                  )}
                  {carrierId !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {initialCarriers.find((c: any) => c.id === carrierId)?.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setCarrierId('all')} />
                    </Badge>
                  )}
                  {status !== 'all' && activeTab === 'orders' && (
                    <Badge variant="secondary" className="gap-1">
                      {status}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setStatus('all')} />
                    </Badge>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} size="sm">
                  Limpiar
                </Button>
              )}
              <Button onClick={applyFilters} size="sm" disabled={activeTab === 'movements' ? movementsLoading : ordersLoading}>
                {activeTab === 'movements' 
                  ? (movementsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar')
                  : (ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar')
                }
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'movements' | 'orders')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="orders">Órdenes de Despacho</TabsTrigger>
        </TabsList>

        {/* Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Movimientos</CardTitle>
                <span className="text-sm text-muted-foreground">
                  Página {movementsPage} | Total cargado: {movementsTotalLoaded}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {movementsError ? (
                <div className="p-8 text-center text-destructive">
                  <p>Error al cargar los movimientos:</p>
                  <p className="text-sm mt-2">{movementsError}</p>
                  <Button onClick={() => fetchMovements(movementsPage)} variant="outline" className="mt-4">
                    Reintentar
                  </Button>
                </div>
              ) : movementsLoading && movements.length === 0 ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando movimientos...</p>
                </div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No se encontraron movimientos</p>
                  <p className="text-sm mt-2">Intenta ajustar los filtros</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Usuario</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((movement: any) => (
                          <TableRow key={movement.id}>
                            <TableCell>
                              {movement.date && format(new Date(movement.date), "dd/MM/yyyy HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  movement.type === 'Entrada' ? 'default' :
                                  movement.type === 'Salida' ? 'secondary' :
                                  movement.type === 'Averia' ? 'destructive' :
                                  'outline'
                                }
                              >
                                {movement.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium max-w-xs truncate">
                              {movement.productName || movement.productId}
                            </TableCell>
                            <TableCell>{movement.quantity}</TableCell>
                            <TableCell>{platformMap[movement.platformId] || movement.platformId || '-'}</TableCell>
                            <TableCell>{carrierMap[movement.carrierId] || movement.carrierId || '-'}</TableCell>
                            <TableCell>{movement.userName || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    {/* Previous/Next */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMovements(movementsPage - 1)}
                        disabled={movementsPage <= 1 || movementsLoading}
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                      </Button>
                      
                      <span className="text-sm text-muted-foreground px-4">
                        Página <strong>{movementsPage}</strong>
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMovements(movementsPage + 1)}
                        disabled={!movementsHasMore || movementsLoading}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>

                    {/* Go to Page */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Ir a página:</span>
                      <Input
                        type="number"
                        min="1"
                        value={movementsGoToPage}
                        onChange={(e) => setMovementsGoToPage(e.target.value)}
                        className="w-20"
                        placeholder="#"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={!movementsGoToPage || movementsJumpLoading}
                        onClick={() => jumpToMovementsPage(Number(movementsGoToPage))}
                      >
                        {movementsJumpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ir'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Órdenes de Despacho</CardTitle>
                <span className="text-sm text-muted-foreground">
                  Página {ordersPage} | Total cargado: {ordersTotalLoaded}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {ordersError ? (
                <div className="p-8 text-center text-destructive">
                  <p>Error al cargar las órdenes:</p>
                  <p className="text-sm mt-2">{ordersError}</p>
                  <Button onClick={() => fetchOrders(ordersPage)} variant="outline" className="mt-4">
                    Reintentar
                  </Button>
                </div>
              ) : ordersLoading && orders.length === 0 ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <p className="mt-2 text-muted-foreground">Cargando órdenes...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No se encontraron órdenes</p>
                  <p className="text-sm mt-2">Intenta ajustar los filtros</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>ID Despacho</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Total Items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              {order.date && format(new Date(order.date), "dd/MM/yyyy HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.dispatchId || order.id}
                            </TableCell>
                            <TableCell>{platformMap[order.platformId] || order.platformId || '-'}</TableCell>
                            <TableCell>{carrierMap[order.carrierId] || order.carrierId || '-'}</TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate" title={order.products?.map((p: any) => p.name).join(', ')}>
                                {order.products?.map((p: any) => p.name).join(', ') || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{order.totalItems || order.items?.length || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    {/* Previous/Next */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOrders(ordersPage - 1)}
                        disabled={ordersPage <= 1 || ordersLoading}
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                      </Button>
                      
                      <span className="text-sm text-muted-foreground px-4">
                        Página <strong>{ordersPage}</strong>
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOrders(ordersPage + 1)}
                        disabled={!ordersHasMore || ordersLoading}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>

                    {/* Go to Page */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Ir a página:</span>
                      <Input
                        type="number"
                        min="1"
                        value={ordersGoToPage}
                        onChange={(e) => setOrdersGoToPage(e.target.value)}
                        className="w-20"
                        placeholder="#"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={!ordersGoToPage || ordersJumpLoading}
                        onClick={() => jumpToOrdersPage(Number(ordersGoToPage))}
                      >
                        {ordersJumpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ir'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
