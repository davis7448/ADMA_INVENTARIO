

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  categoryId: string;
  price: number;
  stock: number;
  pendingStock: number;
  damagedStock: number;
  restockThreshold: number;
  vendorId: string;
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
  customerName: string;
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
    name: string;
    sku: string;
    quantity: number;
}

export interface DispatchExceptionProduct {
    productId: string;
    quantity: number;
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
    quantity: number;
    dispatchId: string;
    trackingNumber: string;
    date: string; // Date of the original dispatch
}

export type RotationCategory = {
    id: string;
    name: string;
    description: string;
};
