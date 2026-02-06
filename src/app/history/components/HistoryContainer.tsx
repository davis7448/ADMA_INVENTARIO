'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  // State for movements and pagination
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [cursors, setCursors] = useState<{[page: number]: string | null}>({1: null});
  const [totalLoaded, setTotalLoaded] = useState(0);
  
  // Filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [platformId, setPlatformId] = useState<string>('all');
  const [carrierId, setCarrierId] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  
  // Page selector
  const [goToPage, setGoToPage] = useState('');
  const [jumpLoading, setJumpLoading] = useState(false);

  // Fetch movements for current page
  const fetchMovements = useCallback(async (targetPage: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const cursor = cursors[targetPage] || null;
      
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
      
      console.log('[Client] Fetching page', targetPage, 'cursor:', cursor);
      
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
      setHasMore(data.hasMore);
      setPage(data.page);
      setTotalLoaded((data.page - 1) * 20 + data.movements.length);
      
      // Store cursor for next page
      if (data.nextCursor && data.hasMore) {
        setCursors(prev => ({
          ...prev,
          [data.page + 1]: data.nextCursor
        }));
      }
      
    } catch (err) {
      console.error('[Client] Error fetching movements:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cursors, startDate, endDate, platformId, carrierId, warehouseId]);

  // Initial load
  useEffect(() => {
    fetchMovements(1);
  }, [fetchMovements]);

  // Jump to specific page (load all intermediate pages)
  const jumpToPage = async (targetPage: number) => {
    if (targetPage < 1) return;
    if (targetPage === page) return;
    
    setJumpLoading(true);
    
    try {
      let currentPage = page;
      
      // If going forward, load pages sequentially
      if (targetPage > page) {
        while (currentPage < targetPage && hasMore) {
          await fetchMovements(currentPage + 1);
          currentPage++;
        }
      } else {
        // If going backward, we need to reload from page 1
        // Clear cursors and start over
        setCursors({1: null});
        setPage(1);
        
        let pageNum = 1;
        while (pageNum < targetPage) {
          const cursor = cursors[pageNum + 1];
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
      console.error('Error jumping to page:', err);
    } finally {
      setJumpLoading(false);
      setGoToPage('');
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
    setProductSearch('');
    setSelectedProductId(null);
    setSearchResults([]);
    setCursors({1: null});
    setPage(1);
    fetchMovements(1);
  };

  // Apply filters
  const applyFilters = () => {
    setCursors({1: null});
    setPage(1);
    fetchMovements(1);
  };

  const hasActiveFilters = startDate || endDate || platformId !== 'all' || 
                          carrierId !== 'all' || selectedProductId;

  return (
    <div className="space-y-6">
      {/* Filters Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} size="sm">
                  Limpiar
                </Button>
              )}
              <Button onClick={applyFilters} size="sm" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Movimientos</CardTitle>
            <span className="text-sm text-muted-foreground">
              Página {page} | Total cargado: {totalLoaded}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-8 text-center text-destructive">
              <p>Error al cargar los movimientos:</p>
              <p className="text-sm mt-2">{error}</p>
              <Button onClick={() => fetchMovements(page)} variant="outline" className="mt-4">
                Reintentar
              </Button>
            </div>
          ) : loading ? (
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
                        <TableCell>{movement.platformId || '-'}</TableCell>
                        <TableCell>{movement.carrierId || '-'}</TableCell>
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
                    onClick={() => fetchMovements(page - 1)}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  
                  <span className="text-sm text-muted-foreground px-4">
                    Página <strong>{page}</strong>
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMovements(page + 1)}
                    disabled={!hasMore || loading}
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
                    value={goToPage}
                    onChange={(e) => setGoToPage(e.target.value)}
                    className="w-20"
                    placeholder="#"
                  />
                  <Button 
                    size="sm" 
                    variant="secondary"
                    disabled={!goToPage || jumpLoading}
                    onClick={() => jumpToPage(Number(goToPage))}
                  >
                    {jumpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ir'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
