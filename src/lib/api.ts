
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp } from "firebase/firestore";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category } from './types';

// Product Functions
export const getProducts = async (): Promise<Product[]> => {
  const productsCol = collection(db, 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  return productList;
};

export const getProductById = async (id: string): Promise<Product | null> => {
  const productDoc = doc(db, 'products', id);
  const productSnap = await getDoc(productDoc);
  if (productSnap.exists()) {
    return { id: productSnap.id, ...productSnap.data() } as Product;
  } else {
    return null;
  }
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const productsCol = collection(db, 'products');
  const docRef = await addDoc(productsCol, product);
  return docRef.id;
};

export const updateProductStock = async (productId: string, quantity: number, operation: 'add' | 'subtract') => {
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);
  if (productSnap.exists()) {
    const currentStock = productSnap.data().stock;
    let newStock;
    if (operation === 'add') {
      newStock = currentStock + quantity;
    } else {
      newStock = Math.max(0, currentStock - quantity);
    }
    await updateDoc(productRef, { stock: newStock });
  }
};

// Supplier Functions
export const getSuppliers = async (): Promise<Supplier[]> => {
    const suppliersCol = collection(db, 'suppliers');
    const supplierSnapshot = await getDocs(suppliersCol);
    const supplierList = supplierSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    return supplierList;
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
    const supplierDoc = doc(db, 'suppliers', id);
    const supplierSnap = await getDoc(supplierDoc);
    if (supplierSnap.exists()) {
        return { id: supplierSnap.id, ...supplierSnap.data() } as Supplier;
    } else {
        return null;
    }
};

export const addSupplier = async (supplier: Omit<Supplier, 'id' | 'productCount'>): Promise<string> => {
    const suppliersCol = collection(db, 'suppliers');
    const docRef = await addDoc(suppliersCol, {
        ...supplier,
        productCount: 0,
    });
    return docRef.id;
};

export const getSuppliersByIds = async (ids: string[]): Promise<Record<string, string>> => {
    if (ids.length === 0) return {};
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where('__name__', 'in', ids));
    const querySnapshot = await getDocs(q);
    const suppliers: Record<string, string> = {};
    querySnapshot.forEach((doc) => {
        suppliers[doc.id] = (doc.data() as Supplier).name;
    });
    return suppliers;
};

// Category Functions
export const getCategories = async (): Promise<Category[]> => {
    const categoriesCol = collection(db, 'categories');
    const categorySnapshot = await getDocs(categoriesCol);
    const categoryList = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    return categoryList;
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
    const categoriesCol = collection(db, 'categories');
    const docRef = await addDoc(categoriesCol, category);
    return docRef.id;
};

export const getCategoriesByIds = async (ids: string[]): Promise<Record<string, string>> => {
    if (ids.length === 0) return {};
    const categoriesRef = collection(db, "categories");
    const q = query(categoriesRef, where('__name__', 'in', ids));
    const querySnapshot = await getDocs(q);
    const categories: Record<string, string> = {};
    querySnapshot.forEach((doc) => {
        categories[doc.id] = (doc.data() as Category).name;
    });
    return categories;
};

// Order Functions
export const getOrders = async (): Promise<Order[]> => {
    const ordersCol = collection(db, 'orders');
    const orderSnapshot = await getDocs(ordersCol);
    const orderList = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    return orderList;
};

// Return Request Functions
export const getReturnRequests = async (): Promise<ReturnRequest[]> => {
    const returnsCol = collection(db, 'returnRequests');
    const returnSnapshot = await getDocs(returnsCol);
    const returnList = returnSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnRequest));
    return returnList;
};

// User Functions
export const getUsers = async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const userSnapshot = await getDocs(userSnapshot);
    const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    return userList;
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
};


// Inventory Movement Functions
export const getInventoryMovements = async (): Promise<InventoryMovement[]> => {
    const movementsCol = collection(db, 'inventoryMovements');
    const movementSnapshot = await getDocs(movementsCol);
    const movementList = movementSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as InventoryMovement
    });
    return movementList;
};

export const addInventoryMovement = async (movement: Omit<InventoryMovement, 'id' | 'date'>) => {
    const movementsCol = collection(db, 'inventoryMovements');
    await addDoc(movementsCol, {
        ...movement,
        date: new Date(),
    });
};
