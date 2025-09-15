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
import { Button } from '@/components/ui/button';
import { getSuppliers } from '@/lib/api';

export default function SuppliersPage() {
  const suppliers = getSuppliers();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground">Manage your relationships with suppliers.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Supplier Directory</CardTitle>
          <CardDescription>A list of all your suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Policies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <div>{supplier.contact.email}</div>
                    <div className="text-sm text-muted-foreground">{supplier.contact.phone}</div>
                  </TableCell>
                  <TableCell>{supplier.productCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                       <Button variant="link" className="p-0 h-auto">Shipping</Button>
                       <Button variant="link" className="p-0 h-auto">Returns</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
