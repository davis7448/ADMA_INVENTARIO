
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
import { getProducts, getSupplierById } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';

async function LowStockList() {
    const { products: allProducts } = await getProducts({});
    const lowStockProducts = allProducts.filter(p => p.stock <= 0);

    return (
         <Card>
            <CardHeader>
            <CardTitle>Productos con Poco Stock</CardTitle>
            <CardDescription>Estos productos están agotados y requieren atención.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-center">Stock Actual</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {lowStockProducts.length > 0 ? (
                    await Promise.all(lowStockProducts.map(async (product) => {
                        const supplier = await getSupplierById(product.vendorId);
                        const supplierName = supplier ? supplier.name : 'Desconocido';
                        return (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{supplierName}</TableCell>
                                <TableCell className="text-center">{product.stock}</TableCell>
                                <TableCell className="text-center">
                                <Badge variant="destructive">Agotado</Badge>
                                </TableCell>
                            </TableRow>
                        );
                    }))
                ) : (
                    <TableRow>
                    <TableCell colSpan={4} className="text-center">Todos los niveles de inventario de productos son saludables.</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
    );
}

function RestockAlertsPageContent() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Reabastecimiento</h1>
                <p className="text-muted-foreground">Monitorea los niveles de inventario y genera alertas de reabastecimiento.</p>
            </div>
            <RestockForm />
            <LowStockList />
        </div>
    );
}

export default function RestockAlertsPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
                <RestockAlertsPageContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
