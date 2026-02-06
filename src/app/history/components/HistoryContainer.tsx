'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Search, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  // State
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [platformId, setPlatformId] = useState<string>('all');
  const [carrierId, setCarrierId] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Fetch movements
  const fetchMovements = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: any = {
        warehouseId: warehouseId || 'all',
      };
      
      if (dateRange.from) {
        filters.startDate = dateRange.from.toISOString();
      }
      if (dateRange.to) {
        filters.endDate = dateRange.to.toISOString();
      }
      if (platformId !== 'all') {
        filters.platformId = platformId;
      }
      if (carrierId !== 'all') {
        filters.carrierId = carrierId;
      }
      
      console.log('[Client] Fetching movements:', { page: pageNum, filters });
      
      const response = await fetch('/api/history/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pageNum,
          limit: 20,
          filters
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMovements(data.movements);
      setTotalPages(data.totalPages);
      setPage(data.page);
      
    } catch (err) {
      console.error('[Client] Error fetching movements:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, platformId, carrierId, warehouseId]);

  // Initial load
  useEffect(() => {
    fetchMovements(1);
  }, [fetchMovements]);

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
    // TODO: Filter movements by product
  };

  // Clear all filters
  const clearFilters = () => {
    setDateRange({});
    setPlatformId('all');
    setCarrierId('all');
    setProductSearch('');
    setSelectedProductId(null);
    setSearchResults([]);
    fetchMovements(1);
  };

  // Apply filters
  const applyFilters = () => {
    fetchMovements(1);
  };

  const hasActiveFilters = dateRange.from || dateRange.to || platformId !== 'all' || 
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
              <Label>Rango de Fechas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: es })
                      )
                    ) : (
                      <span>Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to
                    }}
                    onSelect={(range) => {
                      setDateRange({
                        from: range?.from,
                        to: range?.to
                      });
                    }}
                    numberOfMonths={2}
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
            <div className="space-y-2 relative">
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
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <>
                  <span className="text-sm text-muted-foreground">Filtros activos:</span>
                  {dateRange.from && (
                    <Badge variant="secondary" className="gap-1">
                      Fecha
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setDateRange({})}
                      />
                    </Badge>
                  )}
                  {platformId !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {initialPlatforms.find((p: any) => p.id === platformId)?.name}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setPlatformId('all')}
                      />
                    </Badge>
                  )}
                  {carrierId !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      {initialCarriers.find((c: any) => c.id === carrierId)?.name}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => setCarrierId('all')}
                      />
                    </Badge>
                  )}
                  {selectedProductId && (
                    <Badge variant="secondary" className="gap-1">
                      Producto
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => {
                          setSelectedProductId(null);
                          setProductSearch('');
                        }}
                      />
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
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Aplicar'
                )}
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
              Página {page} de {totalPages}
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
                        <TableCell className="font-medium">
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

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMovements(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMovements(page + 1)}
                  disabled={page >= totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
