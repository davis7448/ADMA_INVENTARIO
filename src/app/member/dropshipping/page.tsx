"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Package, 
  Loader2,
  Plus,
  Search
} from 'lucide-react';

// Mock data for dropshipping products
const MOCK_PRODUCTS = [
  { id: '1', name: 'Camiseta Básica', price: 15000, stock: 100 },
  { id: '2', name: 'Pantalón Jeans', price: 45000, stock: 50 },
  { id: '3', name: 'Zapatillas Urbanas', price: 80000, stock: 30 },
  { id: '4', name: 'Gorra Snapback', price: 12000, stock: 200 },
  { id: '5', name: 'Chaqueta de Cuero', price: 150000, stock: 15 },
];

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export default function MemberDropshippingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filteredProducts = MOCK_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function addToCart(product: typeof MOCK_PRODUCTS[0]) {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1 
      }];
    });
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => 
      prev.map(item => 
        item.productId === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  }

  function getCartTotal(): number {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  async function submitRequest() {
    if (cart.length === 0) return;
    
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Clear cart after successful submission
    setCart([]);
    setShowCart(false);
    setIsLoading(false);
    
    alert('Solicitud enviada exitosamente. El líder procesará tu pedido.');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dropshipping</h1>
          <p className="text-muted-foreground">Solicita productos para dropshipping</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowCart(!showCart)}
          className="relative"
        >
          <Package className="h-4 w-4 mr-2" />
          Carrito
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Products List */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Productos</CardTitle>
              <CardDescription>
                Selecciona los productos que deseas solicitar para dropshipping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar productos..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{product.name}</h3>
                        <span className="text-sm text-muted-foreground">
                          Stock: {product.stock}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">
                          ${product.price.toLocaleString()}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No se encontraron productos
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Sidebar */}
        {showCart && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tu Carrito</CardTitle>
                <CardDescription>
                  {cart.length} producto(s) seleccionado(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Tu carrito está vacío
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${item.price.toLocaleString()} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>${getCartTotal().toLocaleString()}</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={submitRequest}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar Solicitud'
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Información</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Tu solicitud será revisada por el líder de tu comunidad. 
                  Una vez aprobada, recibirás los productos para comenzar a vender.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
