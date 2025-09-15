"use client";

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
import RestockForm from '@/components/restock-form';
import { products, suppliers } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';

export default function RestockAlertsPage() {
  const { user } = useAuth();
  const lowStockProducts = products.filter(p => p.stock < p.restockThreshold);

  const getSupplierName = (vendorId: string) => {
    return suppliers.find(s => s.id === vendorId)?.name || 'Unknown';
  };
  
  const canManageRestock = user?.role === 'admin' || user?.role === 'logistics';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Restock Alerts</h1>
        <p className="text-muted-foreground">Monitor inventory levels and generate restock alerts.</p>
      </div>

      {canManageRestock && <RestockForm />}

      <Card>
        <CardHeader>
          <CardTitle>Low Stock Items</CardTitle>
          <CardDescription>These products are below their restock threshold and require attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">Current Stock</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{getSupplierName(product.vendorId)}</TableCell>
                    <TableCell className="text-center">{product.stock}</TableCell>
                    <TableCell className="text-center">{product.restockThreshold}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant="destructive">Low Stock</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">All product inventory levels are healthy.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
