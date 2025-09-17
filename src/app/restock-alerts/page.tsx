
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

async function LowStockList() {
    const allProducts = await getProducts();
    const lowStockProducts = allProducts.filter(p => p.stock <= 0);

    return (
         <Card>
            <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>These products are out of stock and require attention.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {lowStockProducts.length > 0 ? (
                    await Promise.all(lowStockProducts.map(async (product) => {
                        const supplierName = (await getSupplierById(product.vendorId))?.name || 'Unknown';
                        return (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{supplierName}</TableCell>
                                <TableCell className="text-center">{product.stock}</TableCell>
                                <TableCell className="text-center">
                                <Badge variant="destructive">Out of Stock</Badge>
                                </TableCell>
                            </TableRow>
                        );
                    }))
                ) : (
                    <TableRow>
                    <TableCell colSpan={4} className="text-center">All product inventory levels are healthy.</TableCell>
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
                <h1 className="text-3xl font-bold font-headline tracking-tight">Restock Alerts</h1>
                <p className="text-muted-foreground">Monitor inventory levels and generate restock alerts.</p>
            </div>
            <RestockForm />
            <LowStockList />
        </div>
    );
}

export default function RestockAlertsPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
            <RestockAlertsPageContent />
        </AuthProviderWrapper>
    );
}
