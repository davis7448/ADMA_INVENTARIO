import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement } from './types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => {
  const image = PlaceHolderImages.find(img => img.id === id);
  return image ? { url: image.imageUrl, hint: image.imageHint, description: image.description } : { url: 'https://placehold.co/600x400', hint: 'placeholder', description: 'Placeholder image' };
};

export let products: Product[] = [
  {
    id: 'prod-1',
    sku: 'WM-ERGO-01',
    name: 'Ergo-Wireless Mouse',
    description: findImage('prod-1').description,
    imageUrl: findImage('prod-1').url,
    imageHint: findImage('prod-1').hint,
    category: 'Electronics',
    price: 79.99,
    stock: 15,
    restockThreshold: 20,
    vendorId: 'sup-1',
  },
  {
    id: 'prod-2',
    sku: 'KB-MECH-RGB-01',
    name: 'Mechanical RGB Keyboard',
    description: findImage('prod-2').description,
    imageUrl: findImage('prod-2').url,
    imageHint: findImage('prod-2').hint,
    category: 'Peripherals',
    price: 149.99,
    stock: 45,
    restockThreshold: 30,
    vendorId: 'sup-1',
  },
  {
    id: 'prod-3',
    sku: 'MON-UW-4K-01',
    name: '4K Ultra-Wide Monitor',
    description: findImage('prod-3').description,
    imageUrl: findImage('prod-3').url,
    imageHint: findImage('prod-3').hint,
    category: 'Monitors',
    price: 899.99,
    stock: 8,
    restockThreshold: 10,
    vendorId: 'sup-2',
  },
  {
    id: 'prod-4',
    sku: 'HP-NC-HIFI-01',
    name: 'Hi-Fi Noise-Cancelling Headphones',
    description: findImage('prod-4').description,
    imageUrl: findImage('prod-4').url,
    imageHint: findImage('prod-4').hint,
    category: 'Audio',
    price: 249.99,
    stock: 30,
    restockThreshold: 25,
    vendorId: 'sup-3',
  },
  {
    id: 'prod-5',
    sku: 'LAP-PRO-14-01',
    name: 'Pro Ultrabook 14"',
    description: findImage('prod-5').description,
    imageUrl: findImage('prod-5').url,
    imageHint: findImage('prod-5').hint,
    category: 'Laptops',
    price: 1299.99,
    stock: 12,
    restockThreshold: 15,
    vendorId: 'sup-2',
  },
  {
    id: 'prod-6',
    sku: 'SW-FIT-01',
    name: 'Smart Fitness Watch',
    description: findImage('prod-6').description,
    imageUrl: findImage('prod-6').url,
    imageHint: findImage('prod-6').hint,
    category: 'Wearables',
    price: 199.99,
    stock: 75,
    restockThreshold: 50,
    vendorId: 'sup-3',
  },
  {
    id: 'prod-7',
    sku: 'ACC-HUB-USBC-01',
    name: 'Multi-port USB-C Hub',
    description: findImage('prod-7').description,
    imageUrl: findImage('prod-7').url,
    imageHint: findImage('prod-7').hint,
    category: 'Accessories',
    price: 59.99,
    stock: 150,
    restockThreshold: 100,
    vendorId: 'sup-1',
  },
  {
    id: 'prod-8',
    sku: 'OFF-DESK-STD-01',
    name: 'Ergonomic Standing Desk',
    description: findImage('prod-8').description,
    imageUrl: findImage('prod-8').url,
    imageHint: findImage('prod-8').hint,
    category: 'Office',
    price: 499.99,
    stock: 22,
    restockThreshold: 20,
    vendorId: 'sup-4',
  },
];

export const addProduct = (product: Product) => {
  products.unshift(product);
};

export const updateProductStock = (productId: string, quantity: number) => {
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      products[productIndex].stock -= quantity;
    }
};

export let inventoryMovements: InventoryMovement[] = [];

export const addInventoryMovement = (movement: Omit<InventoryMovement, 'id' | 'date'>) => {
  inventoryMovements.unshift({
    id: `mov-${Date.now()}`,
    date: new Date().toISOString(),
    ...movement,
  });
};


export const suppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Global Tech Supplies',
    contact: { email: 'contact@globaltech.com', phone: '1-800-555-0101' },
    productCount: 3,
    shippingPolicy: 'Ships worldwide within 5-7 business days. Free shipping on orders over $100.',
    returnPolicy: '30-day return policy on unopened items. Customer pays for return shipping.',
  },
  {
    id: 'sup-2',
    name: 'Display Innovations Inc.',
    contact: { email: 'sales@displayinc.com', phone: '1-800-555-0102' },
    productCount: 2,
    shippingPolicy: 'Ships to North America and Europe within 3-5 business days. Flat rate shipping $25.',
    returnPolicy: '45-day return policy, including open-box items. 15% restocking fee may apply.',
  },
  {
    id: 'sup-3',
    name: 'AudioVibes Ltd.',
    contact: { email: 'support@audiovibes.com', phone: '1-888-555-0103' },
    productCount: 2,
    shippingPolicy: 'Express 2-day shipping available in the US. Standard international shipping 7-10 days.',
    returnPolicy: '60-day hassle-free returns. Free return shipping labels provided.',
  },
  {
    id: 'sup-4',
    name: 'Office Pro Gear',
    contact: { email: 'orders@officepro.com', phone: '1-877-555-0104' },
    productCount: 1,
    shippingPolicy: 'Specializes in oversized items. Freight shipping required, 5-10 business days.',
    returnPolicy: 'Returns accepted for damaged items only. All claims must be made within 7 days of delivery.',
  },
];

export const orders: Order[] = [
  { id: 'ORD-001', customerName: 'Alice Johnson', customerEmail: 'alice@example.com', date: '2023-10-26', status: 'Delivered', total: 165.98 },
  { id: 'ORD-002', customerName: 'Bob Williams', customerEmail: 'bob@example.com', date: '2023-10-25', status: 'Shipped', total: 899.99 },
  { id: 'ORD-003', customerName: 'Charlie Brown', customerEmail: 'charlie@example.com', date: '2023-10-25', status: 'Processing', total: 79.99 },
  { id: 'ORD-004', customerName: 'Diana Prince', customerEmail: 'diana@example.com', date: '2023-10-24', status: 'Delivered', total: 249.99 },
  { id: 'ORD-005', customerName: 'Ethan Hunt', customerEmail: 'ethan@example.com', date: '2023-10-23', status: 'Pending', total: 1299.99 },
  { id: 'ORD-006', customerName: 'Fiona Glenanne', customerEmail: 'fiona@example.com', date: '2023-10-22', status: 'Cancelled', total: 59.99 },
  { id: 'ORD-007', customerName: 'George Costanza', customerEmail: 'george@example.com', date: '2023-10-21', status: 'Delivered', total: 199.99 },
  { id: 'ORD-008', customerName: 'Hannah Montana', customerEmail: 'hannah@example.com', date: '2023-10-20', status: 'Shipped', total: 499.99 },
];

export const returnRequests: ReturnRequest[] = [
  { id: 'RET-001', orderId: 'ORD-001', customerName: 'Alice Johnson', productName: 'Mechanical RGB Keyboard', reason: 'Defective Key', status: 'Approved', date: '2023-10-28' },
  { id: 'RET-002', orderId: 'ORD-004', customerName: 'Diana Prince', productName: 'Hi-Fi Noise-Cancelling Headphones', reason: 'Changed my mind', status: 'Pending', date: '2023-10-27' },
  { id: 'RET-003', orderId: 'ORD-007', customerName: 'George Costanza', productName: 'Smart Fitness Watch', reason: 'Not compatible with phone', status: 'Rejected', date: '2023-10-25' },
];

export const users: User[] = [
  { id: 'usr-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', avatarUrl: 'https://i.pravatar.cc/150?u=admin' },
  { id: 'usr-2', name: 'Logistics User', email: 'logistics@example.com', role: 'logistics', avatarUrl: 'https://i.pravatar.cc/150?u=logistics' },
  { id: 'usr-3', name: 'Commercial User', email: 'commercial@example.com', role: 'commercial', avatarUrl: 'https://i.pravatar.cc/150?u=commercial' },
];
