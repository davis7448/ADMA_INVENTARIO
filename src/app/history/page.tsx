
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
import { getInventoryMovements, getProducts, getPlatforms, getCarriers, getDispatchOrders } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import type { InventoryMovement, Product, Platform, Carrier, DispatchOrder } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { generatePickingListPDF } from '@/lib/pdf';
import { formatToTimeZone } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { HistoryContent } from '@/components/history-content';

async function HistoryPageContent() {
    const [
        fetchedMovements,
        fetchedDispatchOrders,
        fetchedProducts,
        fetchedPlatforms,
        fetchedCarriers
    ] = await Promise.all([
        getInventoryMovements(),
        getDispatchOrders(),
        getProducts(),
        getPlatforms(),
        getCarriers()
    ]);

    const movements = [...fetchedMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const dispatchOrders = [...fetchedDispatchOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const productsById = fetchedProducts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>);
    const platformNames = fetchedPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    const carrierNames = fetchedCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);

    return (
        <HistoryContent
            initialMovements={movements}
            initialDispatchOrders={dispatchOrders}
            productsById={productsById}
            platformNames={platformNames}
            carrierNames={carrierNames}
        />
    );
}


export default function HistoryPage() {
  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
      <HistoryPageContent />
    </AuthProviderWrapper>
  );
}
