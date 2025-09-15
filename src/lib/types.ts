

export type ProductVariant = {
  id: string; // Can be a temporary client-side ID before saving
  name: string;
  sku: string;
  price: number;
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
  price: number;
  cost?: number;
  purchaseDate?: string;
  stock: number;
  pendingStock: number;
  damagedStock: number;
  restockThreshold: number;
  vendorId: string;
  rotationCategoryName?: string;
  reservations?: Reservation[]; // This will now be populated on the fly
  contentLink?: string;
  productType: 'simple' | 'variable';
  variants?: ProductVariant[]; // Array to hold variants
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
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  total: number;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  customerName: 'Jane Smith',
  productName: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
};

export type UserRole = 'admin' | 'logistics' | 'commercial';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
};

export type InventoryMovement = {
  id: string; // Firestore document ID
  movementId: number; // Sequential ID
  type: 'Entrada' | 'Salida' | 'Averia';
  productId: string;
  productName: string;
  quantity: number;
  date: string;
  notes: string;
  variantSku?: string; // Add this to track variant returns
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
    date: string;
    totalItems: number;
    platformId: string;
    carrierId: string;
    products: DispatchOrderProduct[];
    status: 'Pendiente' | 'Despachada' | 'Parcial';
    trackingNumbers: string[];
    exceptions: DispatchException[];
    cancelledExceptions?: DispatchException[];
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
}

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
}

export interface GetStockAlertsResult {
    alerts: StockAlertItem[];
    error?: string;
    lastGenerated?: string;
}
