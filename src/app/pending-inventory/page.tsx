
import { getPendingInventory } from '@/lib/api';
import type { PendingInventoryItem } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
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
import Image from 'next/image';
import { format } from 'date-fns';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

async function PendingInventoryContent() {
    const pendingItems: PendingInventoryItem[] = await getPendingInventory();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Inventario Pendiente</h1>
                <p className="text-muted-foreground">
                    Productos que no fueron despachados y están a la espera de resolución.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Productos en Estado Pendiente</CardTitle>
                    <CardDescription>
                        Esta lista muestra los productos que se registraron como excepciones durante el despacho.
                        Investiga cada caso para decidir si el producto debe ser re-despachado o manejado de otra forma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                {pendingItems.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {pendingItems.map((item) => (
                            <AccordionItem value={item.id} key={item.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between items-center w-full pr-4">
                                        <div className="flex items-center gap-4 text-left">
                                            <Image
                                                src={item.imageUrl}
                                                alt={item.name}
                                                width={48}
                                                height={48}
                                                className="rounded-md object-cover"
                                            />
                                            <div>
                                                <p className="font-semibold">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">{item.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Total Pendiente</p>
                                            <p className="text-lg font-bold">{item.pendingStock}</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/50 rounded-md">
                                        <h4 className="font-semibold mb-2">Detalle de Excepciones</h4>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha Despacho</TableHead>
                                                    <TableHead>ID Despacho</TableHead>
                                                    <TableHead>Guía Excepción</TableHead>
                                                    <TableHead className="text-right">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {item.exceptionDetails.map((detail, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{format(new Date(detail.date), 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell>{detail.dispatchId}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">{detail.trackingNumber}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">{detail.quantity}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        No hay productos en el inventario pendiente.
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function PendingInventoryPage() {
    return (
      <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
        <PendingInventoryContent />
      </AuthProviderWrapper>
    );
}
