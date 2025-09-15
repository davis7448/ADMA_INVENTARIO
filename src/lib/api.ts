

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { db, storage } from './firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem } from './types';
import {v4 as uuidv4} from 'uuid';
import { startOfDay, endOfDay } from 'date-fns';

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
  
  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
        throw new Error(`Product with ID ${productId} does not exist!`);
    }
    const currentStock = productSnap.data().stock;
    let newStock;
    if (operation === 'add') {
      newStock = currentStock + quantity;
    } else {
      const calculatedStock = currentStock - quantity;
      if (calculatedStock < 0) {
        throw new Error(`Not enough stock for product ${productSnap.data().name}. Current stock: ${currentStock}, trying to subtract: ${quantity}`);
      }
      newStock = calculatedStock;
    }
    transaction.update(productRef, { stock: newStock });
  });
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

// Carrier Functions
export const getCarriers = async (): Promise<Carrier[]> => {
    const carriersCol = collection(db, 'carriers');
    const carrierSnapshot = await getDocs(carriersCol);
    const carrierList = carrierSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Carrier));
    return carrierList;
};

export const addCarrier = async (carrier: Omit<Carrier, 'id'>): Promise<string> => {
    const carriersCol = collection(db, 'carriers');
    const docRef = await addDoc(carriersCol, carrier);
    return docRef.id;
};

// Platform Functions
export const getPlatforms = async (): Promise<Platform[]> => {
    const platformsCol = collection(db, 'platforms');
    const platformSnapshot = await getDocs(platformsCol);
    const platformList = platformSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Platform));
    return platformList;
};

export const addPlatform = async (platform: Omit<Platform, 'id'>): Promise<string> => {
    const platformsCol = collection(db, 'platforms');
    const docRef = await addDoc(platformsCol, platform);
    return docRef.id;
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

export const getInventoryMovementsByDate = async (date: Date): Promise<InventoryMovement[]> => {
    const movementsCol = collection(db, 'inventoryMovements');
    const start = startOfDay(date);
    const end = endOfDay(date);

    const q = query(movementsCol, where('date', '>=', start), where('date', '<=', end));
    const movementSnapshot = await getDocs(q);
    
    const movementList = movementSnapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date instanceof Timestamp ? data.date.toDate().toISOString() : new Date().toISOString();
        return {
            id: doc.id,
            ...data,
            date,
        } as InventoryMovement;
    });

    return movementList;
};

export const addInventoryMovement = async (movementData: Omit<InventoryMovement, 'id' | 'movementId' | 'date'>): Promise<number> => {
  const counterRef = doc(db, 'counters', 'inventoryMovements');
  const movementCollectionRef = collection(db, 'inventoryMovements');

  try {
    const newMovementId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists()) {
        throw new Error("Counter document does not exist!");
      }

      const newId = counterDoc.data().currentId + 1;
      transaction.update(counterRef, { currentId: newId });

      const newMovementRef = doc(movementCollectionRef);
      transaction.set(newMovementRef, {
        ...movementData,
        movementId: newId,
        date: new Date(),
      });

      return newId;
    });
    return newMovementId;
  } catch (e) {
    console.error("Transaction failed: ", e);
    throw new Error("Failed to add inventory movement.");
  }
};
    
// Dispatch Order Functions

export const createDispatchOrder = async ({ dispatchId, platformId, carrierId, products }: Omit<DispatchOrder, 'id' | 'status' | 'date' | 'totalItems' | 'trackingNumbers' | 'exceptions'>) => {
    const batch = writeBatch(db);
    const dispatchOrderRef = doc(collection(db, 'dispatchOrders'));

    // 1. Create the new dispatch order document
    const newDispatchOrder: Omit<DispatchOrder, 'id'> = {
        dispatchId,
        date: new Date().toISOString(),
        platformId,
        carrierId,
        products,
        totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
        status: 'Pendiente',
        trackingNumbers: [],
        exceptions: [],
    };
    batch.set(dispatchOrderRef, newDispatchOrder);

    const platformName = (await getDoc(doc(db, 'platforms', platformId))).data()?.name || 'N/A';
    const carrierName = (await getDoc(doc(db, 'carriers', carrierId))).data()?.name || 'N/A';
    const notes = `Dispatch ID: ${dispatchId}. Plataforma: ${platformName}, Transportadora: ${carrierName}`;


    // 2. Create inventory movements and update stock for each product
    for (const product of products) {
        // Decrease stock
        const productRef = doc(db, 'products', product.productId);
        const productSnap = await getDoc(productRef);
        const currentStock = productSnap.data()?.stock || 0;

        if (currentStock < product.quantity) {
          throw new Error(`No hay suficiente stock para ${product.name}. Stock actual: ${currentStock}, se requieren: ${product.quantity}`);
        }
        
        batch.update(productRef, { 
            stock: currentStock - product.quantity 
        });

        // Create inventory movement
        const movementRef = doc(collection(db, 'inventoryMovements'));
        const movementData: Omit<InventoryMovement, 'id'| 'date' | 'movementId'> = {
            type: 'Salida' as const,
            productId: product.productId,
            productName: product.name,
            quantity: product.quantity,
            notes: notes,
        };
        
        // This won't have a sequential ID if done in a batch like this.
        // For simplicity, we'll let Firestore assign a random ID.
        // A Cloud Function trigger would be needed for sequential IDs on batched movements.
        batch.set(movementRef, {...movementData, date: new Date(), movementId: 0});
    }
    
    // Commit the batch
    await batch.commit();

    return dispatchOrderRef.id;
};

export const getDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispatchOrder));
}


export const getPendingDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Pendiente'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispatchOrder));
}

export const getPartialDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Parcial'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispatchOrder));
}

export const processDispatch = async (orderId: string, trackingNumbers: string[], exceptions: DispatchException[]) => {
    const batch = writeBatch(db);
    const orderRef = doc(db, 'dispatchOrders', orderId);
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.data() as DispatchOrder;

    // 1. Determine status
    const status = exceptions.length > 0 ? 'Parcial' : 'Despachada';

    // 2. Update the dispatch order status, tracking numbers, and exceptions
    batch.update(orderRef, {
        status: status,
        trackingNumbers: trackingNumbers,
        exceptions: exceptions
    });

    // 3. Handle exceptions
    for (const ex of exceptions) {
        for (const exProd of ex.products) {
            const productRef = doc(db, 'products', exProd.productId);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
                const productData = productSnap.data();
                const newPendingStock = (productData.pendingStock || 0) + exProd.quantity;
                batch.update(productRef, { pendingStock: newPendingStock });

                // Create "Entrada a Pendientes" movement
                const movementRef = doc(collection(db, 'inventoryMovements'));
                batch.set(movementRef, {
                    type: 'Entrada',
                    productId: exProd.productId,
                    productName: productData.name || 'Unknown Product',
                    quantity: exProd.quantity,
                    date: new Date(),
                    notes: `Excepción en despacho ID: ${orderData?.dispatchId}. Guía: ${ex.trackingNumber}. Movido a stock pendiente.`,
                    movementId: 0 
                });

                // Audit Alert Logic
                if (productData.stock > 0) {
                    const auditAlertRef = doc(collection(db, 'auditAlerts'));
                    batch.set(auditAlertRef, {
                        date: new Date(),
                        productId: exProd.productId,
                        productName: productData.name,
                        productSku: productData.sku,
                        message: `Se generó una excepción de ${exProd.quantity} unidad(es) para un producto que tenía ${productData.stock} unidad(es) en stock principal.`,
                        dispatchId: orderData?.dispatchId,
                        exceptionTrackingNumber: ex.trackingNumber
                    });
                }
            }
        }
    }

    await batch.commit();
}

// Audit Alert Functions
export const getAuditAlerts = async (): Promise<AuditAlert[]> => {
    const alertsCol = collection(db, 'auditAlerts');
    const alertSnapshot = await getDocs(query(alertsCol));
    const alertList = alertSnapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date instanceof Timestamp ? data.date.toDate().toISOString() : new Date().toISOString();
        return {
            id: doc.id,
            ...data,
            date,
        } as AuditAlert;
    });
    return alertList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Pending Inventory Functions
export const getPendingInventory = async (): Promise<PendingInventoryItem[]> => {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('pendingStock', '>', 0));
    const productSnapshot = await getDocs(q);
    
    if (productSnapshot.empty) {
        return [];
    }

    const pendingProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    const dispatchOrders = await getDispatchOrders();
    
    const pendingInventory: PendingInventoryItem[] = pendingProducts.map(product => {
        const exceptionDetails: PendingInventoryItem['exceptionDetails'] = [];

        for (const order of dispatchOrders) {
            if (order.exceptions && order.exceptions.length > 0) {
                for (const exception of order.exceptions) {
                    if (exception.products) {
                        for (const exProduct of exception.products) {
                            if (exProduct.productId === product.id) {
                                exceptionDetails.push({
                                    trackingNumber: exception.trackingNumber,
                                    quantity: exProduct.quantity,
                                    dispatchId: order.dispatchId,
                                    date: order.date,
                                });
                            }
                        }
                    }
                }
            }
        }
        return { ...product, exceptionDetails };
    });

    return pendingInventory;
};
