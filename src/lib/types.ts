export type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  category: string;
  price: number;
  stock: number;
  restockThreshold: number;
  vendorId: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: {
    email: string;
    phone: string;
  };
  productCount: number;
  shippingPolicy: string;
  returnPolicy: string;
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
