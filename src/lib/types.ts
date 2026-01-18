

export type ProductVariant = {
  id: string; // Can be a temporary client-side ID before saving
  name: string;
  sku: string;
  priceDropshipping: number;
  priceWholesale?: number;
  stock: number;
};

export type Product = {
   id: string;
   sku?: string; // SKU is now optional for the parent product
   name: string;
   description: string;
   imageUrl: string;
   imageHint: string;
   categoryId: string;
   priceDropshipping: number;
   priceWholesale?: number;
   cost?: number;
   purchaseDate?: string;
   stock: number;
   pendingStock: number;
   damagedStock: number;
   vendorId: string;
   rotationCategoryName?: string;
   reservations?: Reservation[]; // This will now be populated on the fly
   contentLink?: string;
   productType: 'simple' | 'variable';
   variants?: ProductVariant[]; // Array to hold variants
   createdBy?: {
     id: string;
     name: string;
   };
   lastAuditedAt?: string;
   lastAuditedBy?: string;
   warehouseId?: string; // New field
   locationId?: string; // New field for location
   codigoERP?: string; // Código ERP field
 };

export type Reservation = {
  id: string; // Firestore document ID
  reservationId: string; // Human-readable ID
  productId: string;
  vendedorId: string;
  platformId: string;
  customerEmail: string;
  externalId: string;
  quantity: number;
  date: string;
  variantId?: string;
  variantSku?: string;
  createdBy?: {
    id: string;
    name: string;
  }
  warehouseId?: string; // New field
};

export type Supplier = {
  id: string;
  name:string;
  contact: {
    email: string;
    phone: string;
  };
  productCount: number;
  shippingPolicy: string;
  returnPolicy: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
};

export type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  date: string;
  status: 'Pendiente' | 'Procesando' | 'Enviado' | 'Entregado' | 'Cancelado';
  total: number;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  customerName: 'Jane Smith',
  productName: string;
  reason: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado';
  date: string;
};

export type UserRole = 'admin' | 'logistics' | 'commercial' | 'consulta' | 'plataformas';

export type User = {
   id: string;
   name: string;
   email: string;
   phone?: string;
   role: UserRole;
   avatarUrl: string;
   photoURL?: string; // For commercial dashboard
   salary?: number; // For commercial dashboard
   commissionPercentage?: number; // For commercial dashboard
   activeBusinessesTarget?: number; // KPI target for commercial
   billing?: number; // Total billing for commercial
   warehouseId?: string; // New field
   commercialCode?: string; // 4-digit code for commercial users
};

export type InventoryMovement = {
  id: string; // Firestore document ID
  movementId: number; // Sequential ID
  type: 'Entrada' | 'Salida' | 'Averia' | 'Anulado' | 'Eliminación' | 'Ajuste de Salida' | 'Ajuste de Entrada';
  productId: string;
  productName: string;
  quantity: number;
  date: string;
  notes: string;
  platformId?: string;
  carrierId?: string;
  dispatchId?: string;
  userId?: string;
  userName?: string;
  warehouseId?: string; // New field
};

export type Carrier = {
  id: string;
  name: string;
};

export type Platform = {
    id: string;
    name: string;
};

export interface DispatchOrderProduct {
    productId: string;
    variantId?: string;
    name: string;
    sku: string;
    quantity: number;
}

export interface DispatchExceptionProduct {
    productId: string;
    quantity: number;
    variantId?: string;
    variantSku?: string;
}

export interface DispatchException {
    trackingNumber: string;
    products: DispatchExceptionProduct[];
}
  
export interface DispatchOrder {
    id: string; // Firestore document ID
    dispatchId: string; // Human-readable ID
    date: Date;
    totalItems: number;
    platformId: string;
    carrierId: string;
    products: DispatchOrderProduct[];
    status: 'Pendiente' | 'Despachada' | 'Parcial' | 'Anulada';
    trackingNumbers: string[];
    exceptions: DispatchException[];
    cancelledExceptions?: DispatchException[];
    createdBy?: {
        id: string;
        name: string;
    }
    warehouseId?: string; // New field
}

export interface AuditAlert {
    id: string;
    date: string;
    productId: string;
    productName: string;
    productSku: string;
    message: string;
    dispatchId: string;
    exceptionTrackingNumber: string;
};

export interface PendingInventoryItem {
    id: string; // Unique ID for the specific pending item instance
    productId: string;
    productName: string;
    productSku: string;
    productImageUrl: string;
    variantName?: string;
    variantSku?: string;
    quantity: number;
    dispatchId: string;
    trackingNumber: string;
    date: string; // Date of the original dispatch
    warehouseId?: string; // New field
}

export type RotationCategory = {
    id: string;
    name: string;
    description: string;
    salesThreshold: number;
};

export interface ProductPerformanceData {
    salesByCarrier: { name: string; value: number }[];
    salesByPlatform: { name: string; value: number }[];
    returnsByCarrier: { name: string; value: number }[];
    salesByDay: Record<string, number>;
    returnsByDay: Record<string, number>;
    salesByVariant?: {
        [variantId: string]: {
            byCarrier: { name: string; value: number }[];
            byPlatform: { name: string; value: number }[];
            byDay: Record<string, number>;
        }
    };
    returnsByVariant?: {
        [variantId: string]: {
            byCarrier: { name: string; value: number }[];
            byDay: Record<string, number>;
        }
    };
}

export type Vendedor = {
  id: string;
  name: string;
  contact: {
    email: string;
    phone: string;
  };
};

export type StaleReservationAlert = {
    id: string; // Firestore document ID
    alertDate: string;
    reservationId: string;
    reservationDate: string;
    productId: string;
    productName: string;
    productSku: string;
    vendedorName: string;
    quantity: number;
    warehouseId?: string;
};

export interface StockAlertItem {
    id: string; // Composite ID like `product-id` or `product-id-variant-id`
    name: string;
    sku: string;
    imageUrl: string;
    physicalStock: number;
    reservedStock: number;
    availableForSale: number;
    dailyAverageSales: number;
    alertMessage: string;
    warehouseId?: string;
}

export interface GetStockAlertsResult {
    alerts: StockAlertItem[];
    error?: string;
    lastGenerated?: string;
}

// Represents a product or variant in one of the logistics lists
export interface LogisticItem {
    productId: string; // Always the parent product ID
    variantId?: string; // The variant's own ID
    name: string; // Can be product or variant name
    sku: string;
    imageUrl: string;
    quantity: number;
}

export type EntryReason = {
    id: string;
    value: string;
    label: string;
};

export type CancellationRequest = {
    id: string;
    trackingNumber: string;
    requestedBy: {
        id: string;
        name: string;
    };
    requestDate: string;
    status: 'pending' | 'completed' | 'rejected';
    isDispatched?: boolean;
    isPendingOrder?: boolean;
    warehouseId?: string;
};

export type Warehouse = {
    id: string;
    name: string;
};

export type Location = {
    id: string;
    name: string;
};


export type DashboardData = {
    totalItemsDispatched: number;
    totalAnnulledItems: number;
    totalPendingUnits: number;
    totalReturns: number;
    totalAdjustIn: number;
    totalAdjustOut: number;
    chartData: { date: string; orders: number }[];
    pendingChartData: { date: string; orders: number }[];
    returnsChartData: { date: string; returns: number }[];
    annulledChartData: { date: string; annulled: number }[];
    adjustInChartData: { date: string; value: number }[];
    adjustOutChartData: { date: string; value: number }[];
    productChartData: { id: string; name: string; value: number, percentage: number; productType: 'simple' | 'variable'; variants: any[] }[];
    categoryChartData: { name: string; value: number, percentage: number }[];
    platformCarrierChartData: any[];
    allCarrierNames: string[];
    mostUsedCarrier: { name: string; count: number, percentage: number };
    platformWithMostOrders: { name: string; count: number, percentage: number };
    dailyDispatchSummaryData: Record<string, Record<string, Record<string, number>>>;
    dailyProductDispatch: Record<string, Record<string, { name: string, quantity: number }>>;
};

export interface ReturnsByProduct {
  productId: string;
  productName: string;
  productSku: string;
  totalReturns: number;
  returnMovements: InventoryMovement[];
}

export interface DamagesReport {
  productId: string;
  productName: string;
  productSku: string;
  totalDamaged: number;
  damageMovements: InventoryMovement[];
}

export type ImportRequest = {
  id: string;
  requestDate: string;
  requestedBy: {
    id: string;
    name: string;
  };
  productName: string;
  imageUrl?: string;
  referenceLink?: string;
  status: 'solicitado' | 'en_proceso' | 'completado' | 'cancelado';
  createdAt: string;
  updatedAt: string;
};
