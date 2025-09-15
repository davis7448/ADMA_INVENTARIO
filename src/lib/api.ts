
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { db, storage } from './firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category } from './types';
import {v4 as uuidv4} from 'uuid';

// Image Upload Function
export const uploadImageAndGetURL = async (imageFile: File): Promise<string> => {
  if (!imageFile) {
    throw new Error("No image file provided.");
  }
  const fileExtension = imageFile.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const storageRef = ref(storage, `product-images/${fileName}`);

  try {
    const snapshot = await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error);
    throw new Error("Failed to upload image.");
  }
};


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

export const updateProduct = async (productId: string, productUpdate: Partial<Omit<Product, 'id'>>) => {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, productUpdate);
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
export const getOrders = (): Order[] => {
    // This is mock data
    return [
      { id: 'ORD001', customerName: 'John Doe', customerEmail: 'john.doe@example.com', date: '2023-05-20', status: 'Delivered', total: 150.00 },
      { id: 'ORD002', customerName: 'Jane Smith', customerEmail: 'jane.smith@example.com', date: '2023-05-21', status: 'Shipped', total: 75.50 },
      { id: 'ORD003', customerName: 'Alice Johnson', customerEmail: 'alice.j@example.com', date: '2023-05-22', status: 'Processing', total: 200.00 },
      { id: 'ORD004', customerName: 'Bob Brown', customerEmail: 'bob.b@example.com', date: '2023-05-23', status: 'Pending', total: 45.00 },
      { id: 'ORD005', customerName: 'Charlie Davis', customerEmail: 'charlie.d@example.com', date: '2023-05-23', status: 'Cancelled', total: 99.99 },
    ];
  };

// Return Request Functions
export const getReturnRequests = (): ReturnRequest[] => {
    return [
        { id: 'RET001', orderId: 'ORD002', customerName: 'Jane Smith', productName: 'Mechanical Keyboard Pro', reason: 'Defective key', status: 'Pending', date: '2023-05-25' },
        { id: 'RET002', orderId: 'ORD001', customerName: 'John Doe', productName: 'Ergo-Wireless Mouse', reason: 'Accidental order', status: 'Approved', date: '2023-05-24' },
        { id: 'RET003', orderId: 'ORD003', customerName: 'Alice Johnson', productName: '4K UHD Monitor', reason: 'Does not fit desk', status: 'Rejected', date: '2023-05-26' },
    ];
};


// User Functions
export const getUsers = async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const userSnapshot = await getDocs(usersCol);
    const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    return userList;
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
};


// Inventory Movement Functions
export const getInventoryMovements = async (): Promise<InventoryMovement[]> => {
    const movementsCol = collection(db, 'inventoryMovements');
    const movementSnapshot = await getDocs(movementsCol);
    const movementList = movementSnapshot.docs.map(doc => {
      const data = doc.data();
      // Firestore Timestamps need to be converted to strings
      const date = data.date instanceof Timestamp ? data.date.toDate().toISOString() : new Date().toISOString();
      return { 
        id: doc.id, 
        ...data,
        date,
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
