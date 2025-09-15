

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { db, storage } from './firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch, deleteDoc, documentId } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem, RotationCategory, ProductPerformanceData, Vendedor, Reservation, StaleReservationAlert } from './types';
import {v4 as uuidv4} from 'uuid';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

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
  const productList = productSnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
        id: doc.id, 
        ...data, 
        damagedStock: data.damagedStock || 0,
        pendingStock: data.pendingStock || 0,
    } as Product
  });
  return productList;
};

export const getProductById = async (id: string): Promise<Product | null> => {
  const productDoc = doc(db, 'products', id);
  const productSnap = await getDoc(productDoc);
  if (productSnap.exists()) {
    const data = productSnap.data();
    const reservations = await getReservationsByProductId(id);
    return { 
        id: productSnap.id, 
        ...data, 
        damagedStock: data.damagedStock || 0,
        pendingStock: data.pendingStock || 0,
        reservations: reservations || [],
    } as Product;
  } else {
    return null;
  }
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const productsCol = collection(db, 'products');
  const docRef = await addDoc(productsCol, { ...product, damagedStock: 0, pendingStock: 0 });
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
        // Create an audit alert for stock discrepancy
        const auditAlertRef = doc(collection(db, 'auditAlerts'));
        const auditAlert: Omit<AuditAlert, 'id' | 'date'> = {
            productId: productId,
            productName: productSnap.data().name,
            productSku: productSnap.data().sku,
            message: `Intento de despachar ${quantity} unidades cuando solo habían ${currentStock} en stock.`,
            dispatchId: 'N/A',
            exceptionTrackingNumber: 'N/A',
        };
        transaction.set(auditAlertRef, {...auditAlert, date: new Date()});

        throw new Error(`No hay suficiente stock para ${productSnap.data().name}. Stock actual: ${currentStock}, se requieren: ${quantity}. Se ha generado una alerta de auditoría.`);
      }
      newStock = calculatedStock;
    }
    transaction.update(productRef, { stock: newStock });
  });
};

export const registerDamagedProduct = async (productId: string, quantity: number) => {
    const productRef = doc(db, 'products', productId);
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Product with ID ${productId} does not exist!`);
        }
        
        const data = productSnap.data();
        const currentDamagedStock = data.damagedStock || 0;
        const newDamagedStock = currentDamagedStock + quantity;

        transaction.update(productRef, { damagedStock: newDamagedStock });
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

export const getInventoryMovementsByProductId = async (productId: string): Promise<InventoryMovement[]> => {
    const movementsCol = collection(db, 'inventoryMovements');
    const q = query(movementsCol, where('productId', '==', productId));
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
}

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

export const createDispatchOrder = async ({ dispatchId, platformId, carrierId, products }: Omit<DispatchOrder, 'id' | 'status' | 'date' | 'totalItems' | 'trackingNumbers' | 'exceptions' | 'cancelledExceptions'>) => {
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
        cancelledExceptions: [],
    };
    batch.set(dispatchOrderRef, newDispatchOrder);

    const platformName = (await getDoc(doc(db, 'platforms', platformId))).data()?.name || 'N/A';
    const carrierName = (await getDoc(doc(db, 'carriers', carrierId))).data()?.name || 'N-A';
    const notes = `Dispatch ID: ${dispatchId}. Plataforma: ${platformName}, Transportadora: ${carrierName}`;


    // 2. Create inventory movements and update stock for each product
    for (const product of products) {
        // Decrease stock
        const productRef = doc(db, 'products', product.productId);
        
        await runTransaction(db, async (transaction) => {
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) {
                throw `Product with id ${product.productId} not found`;
            }
            const productData = productSnap.data() as Product | undefined;
            const currentStock = productData?.stock || 0;

            if (currentStock < product.quantity) {
            throw new Error(`No hay suficiente stock para ${product.name}. Stock actual: ${currentStock}, se requieren: ${product.quantity}`);
            }
            
            transaction.update(productRef, { 
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
            transaction.set(movementRef, {...movementData, date: new Date(), movementId: 0});
        });
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
    if (!orderSnap.exists()) {
        throw new Error('Order not found');
    }
    const orderData = orderSnap.data() as DispatchOrder;

    const currentExceptions = orderData.exceptions || [];
    const newExceptions = [...currentExceptions, ...exceptions];

    // 1. Determine status
    const status = newExceptions.length > 0 ? 'Parcial' : 'Despachada';

    // 2. Update the dispatch order status, tracking numbers, and exceptions
    batch.update(orderRef, {
        status: status,
        trackingNumbers: [...(orderData.trackingNumbers || []), ...trackingNumbers],
        exceptions: newExceptions
    });

    // 3. Handle exceptions by moving stock to pending
    for (const ex of exceptions) {
        for (const exProd of ex.products) {
            const productRef = doc(db, 'products', exProd.productId);
            await runTransaction(db, async (transaction) => {
                const productSnap = await transaction.get(productRef);
                
                if (productSnap.exists()) {
                    const productData = productSnap.data() as Product;
                    // Move stock to pending
                    const newPendingStock = (productData.pendingStock || 0) + exProd.quantity;
                    transaction.update(productRef, { pendingStock: newPendingStock });
                }
            });
        }
    }

    await batch.commit();
}


export const cancelPendingDispatchItems = async (orderId: string, cancelledTrackingNumbers: string[]) => {
    const batch = writeBatch(db);
    const orderRef = doc(db, 'dispatchOrders', orderId);

    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
        throw new Error("Dispatch order not found.");
    }
    const orderData = orderSnap.data() as DispatchOrder;

    const exceptionsToCancel = orderData.exceptions.filter(ex => cancelledTrackingNumbers.includes(ex.trackingNumber));
    const remainingExceptions = orderData.exceptions.filter(ex => !cancelledTrackingNumbers.includes(ex.trackingNumber));

    if (exceptionsToCancel.length === 0) {
        throw new Error("No matching exceptions found to cancel.");
    }

    // 1. Move stock from pending back to main inventory and create inventory movements
    for (const ex of exceptionsToCancel) {
        for (const exProd of ex.products) {
            const productRef = doc(db, 'products', exProd.productId);
            
            await runTransaction(db, async (transaction) => {
                const productSnap = await transaction.get(productRef);

                if (productSnap.exists()) {
                    const productData = productSnap.data() as Product;
                    // Decrease pending stock, increase main stock
                    const newPendingStock = (productData.pendingStock || 0) - exProd.quantity;
                    const newStock = (productData.stock || 0) + exProd.quantity;

                    transaction.update(productRef, { 
                        stock: newStock < 0 ? 0 : newStock,
                        pendingStock: newPendingStock < 0 ? 0 : newPendingStock
                    });

                    // Create "Entrada" movement for the cancellation
                    const movementRef = doc(collection(db, 'inventoryMovements'));
                    transaction.set(movementRef, {
                        type: 'Entrada',
                        productId: exProd.productId,
                        productName: productData.name || 'Unknown Product',
                        quantity: exProd.quantity,
                        date: new Date(),
                        notes: `Anulación de guía pendiente: ${ex.trackingNumber} del despacho ${orderData.dispatchId}.`,
                        movementId: 0,
                    });
                }
            });
        }
    }

    // 2. Update the dispatch order
    const newStatus = remainingExceptions.length === 0 ? 'Despachada' : 'Parcial';
    const currentCancelled = orderData.cancelledExceptions || [];
    batch.update(orderRef, {
        exceptions: remainingExceptions,
        status: newStatus,
        cancelledExceptions: [...currentCancelled, ...exceptionsToCancel],
    });

    await batch.commit();
};


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
    // 1. Get all products to create a lookup map
    const products = await getProducts();
    const productsById = new Map(products.map(p => [p.id, p]));

    // 2. Get all dispatch orders with exceptions
    const dispatchOrders = await getPartialDispatchOrders();
    
    // 3. Create a flat list of all individual pending items
    const pendingItems: PendingInventoryItem[] = [];

    for (const order of dispatchOrders) {
        if (order.exceptions?.length) {
            for (const exception of order.exceptions) {
                if(exception.products?.length) {
                    for (const exProduct of exception.products) {
                        const productInfo = productsById.get(exProduct.productId);
                        if (productInfo) {
                            pendingItems.push({
                                id: `${order.id}-${exception.trackingNumber}-${exProduct.productId}`,
                                productId: exProduct.productId,
                                productName: productInfo.name,
                                productSku: productInfo.sku,
                                productImageUrl: productInfo.imageUrl,
                                quantity: exProduct.quantity,
                                dispatchId: order.dispatchId,
                                trackingNumber: exception.trackingNumber,
                                date: order.date,
                            });
                        }
                    }
                }
            }
        }
    }

    return pendingItems;
};

// Settings Functions
export const getRotationCategories = async (): Promise<RotationCategory[]> => {
    const rotationCategoriesCol = collection(db, 'rotationCategories');
    const snapshot = await getDocs(rotationCategoriesCol);
    const categoryList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RotationCategory));
    // Sort by salesThreshold in descending order
    return categoryList.sort((a, b) => b.salesThreshold - a.salesThreshold);
};

export const addRotationCategory = async (category: Omit<RotationCategory, 'id'>): Promise<string> => {
    const rotationCategoriesCol = collection(db, 'rotationCategories');
    const docRef = await addDoc(rotationCategoriesCol, category);
    return docRef.id;
};

export const updateRotationCategories = async (categories: RotationCategory[]): Promise<void> => {
    const batch = writeBatch(db);
    categories.forEach(category => {
        const docRef = doc(db, 'rotationCategories', category.id);
        batch.update(docRef, { salesThreshold: category.salesThreshold });
    });
    await batch.commit();
};

export const getProductPerformanceData = async (productId: string): Promise<ProductPerformanceData> => {
    const [dispatchOrders, movements, carriers, platforms] = await Promise.all([
        getDispatchOrders(),
        getInventoryMovementsByProductId(productId),
        getCarriers(),
        getPlatforms(),
    ]);

    const carrierMap = new Map(carriers.map(c => [c.id, c.name]));
    const platformMap = new Map(platforms.map(p => [p.id, p.name]));

    const salesByCarrier: Record<string, number> = {};
    const salesByPlatform: Record<string, number> = {};
    const salesByDay: Record<string, number> = {};
    const returnsByDay: Record<string, number> = {};
    const returnsByCarrier: Record<string, number> = {};

    // Process dispatch orders for sales data
    for (const order of dispatchOrders) {
        const productInOrder = order.products.find(p => p.productId === productId);
        if (productInOrder) {
            const carrierName = carrierMap.get(order.carrierId) || 'Unknown Carrier';
            const platformName = platformMap.get(order.platformId) || 'Unknown Platform';

            salesByCarrier[carrierName] = (salesByCarrier[carrierName] || 0) + productInOrder.quantity;
            salesByPlatform[platformName] = (salesByPlatform[platformName] || 0) + productInOrder.quantity;
            
            const day = format(startOfDay(new Date(order.date)), 'yyyy-MM-dd');
            salesByDay[day] = (salesByDay[day] || 0) + productInOrder.quantity;
        }
    }
    
    // Process movements for returns data
    const thirtyDaysAgo = subDays(new Date(), 30);
    const returnMovements = movements.filter(m => 
        m.type === 'Entrada' && 
        (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia')) &&
        new Date(m.date) >= thirtyDaysAgo
    );

    for (const movement of returnMovements) {
        const day = format(startOfDay(new Date(movement.date)), 'yyyy-MM-dd');
        returnsByDay[day] = (returnsByDay[day] || 0) + movement.quantity;
        
        // Extract carrier from notes
        const carrierMatch = movement.notes.match(/Transportadora: (.*?)$/);
        const carrierName = carrierMatch ? carrierMatch[1].trim() : 'Unknown';
        returnsByCarrier[carrierName] = (returnsByCarrier[carrierName] || 0) + movement.quantity;
    }

    return {
        salesByCarrier: Object.entries(salesByCarrier).map(([name, value]) => ({ name, value })),
        salesByPlatform: Object.entries(salesByPlatform).map(([name, value]) => ({ name, value })),
        returnsByCarrier: Object.entries(returnsByCarrier).map(([name, value]) => ({ name, value })),
        salesByDay,
        returnsByDay,
    };
};

// Vendedor Functions
export const getVendedores = async (): Promise<Vendedor[]> => {
    const vendedoresCol = collection(db, 'vendedores');
    const snapshot = await getDocs(vendedoresCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendedor));
};

export const addVendedor = async (vendedor: Omit<Vendedor, 'id'>): Promise<string> => {
    const vendedoresCol = collection(db, 'vendedores');
    const docRef = await addDoc(vendedoresCol, vendedor);
    return docRef.id;
};

// Reservation Functions
export const getAllReservations = async (): Promise<Reservation[]> => {
    const q = query(collection(db, 'reservations'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            date: (data.date as Timestamp).toDate().toISOString(),
        } as Reservation;
    });
}

export const getReservationsByProductId = async (productId: string): Promise<Reservation[]> => {
    const q = query(collection(db, 'reservations'), where('productId', '==', productId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date instanceof Timestamp ? data.date.toDate().toISOString() : new Date().toISOString();
        return { 
            id: doc.id, 
            ...data,
            date,
        } as Reservation;
    });
};

export const createReservation = async (reservationData: Omit<Reservation, 'id' | 'reservationId' | 'date'>) => {
    const productRef = doc(db, 'products', reservationData.productId);
    const reservationsCol = collection(db, 'reservations');
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error("Producto no encontrado.");
        }
        
        const productData = productSnap.data() as Product;
        const totalReserved = (await getReservationsByProductId(reservationData.productId)).reduce((sum, res) => sum + res.quantity, 0);
        const availableStock = productData.stock - totalReserved;

        if (reservationData.quantity > availableStock) {
            throw new Error(`No hay suficiente stock para reservar. Stock disponible: ${availableStock}, se intentó reservar: ${reservationData.quantity}.`);
        }

        const newReservationRef = doc(reservationsCol);
        const reservationId = `RES-${Date.now()}`;
        transaction.set(newReservationRef, {
            ...reservationData,
            reservationId,
            date: new Date(),
        });
    });
};

export const deleteReservation = async (reservationId: string) => {
    const q = query(collection(db, 'reservations'), where('id', '==', reservationId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const docToDelete = snapshot.docs[0];
        await deleteDoc(docToDelete.ref);
    } else {
        // Fallback for when the direct ID is passed
        const reservationRef = doc(db, 'reservations', reservationId);
         await deleteDoc(reservationRef);
    }
};

// Stale Reservation Alert Functions
export const getStaleReservationAlerts = async (): Promise<StaleReservationAlert[]> => {
    const alertsCol = collection(db, 'staleReservationAlerts');
    const snapshot = await getDocs(alertsCol);
    const alertList = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        alertDate: (data.alertDate as Timestamp).toDate().toISOString(),
        reservationDate: (data.reservationDate as Timestamp).toDate().toISOString(),
      } as StaleReservationAlert;
    });
    return alertList.sort((a,b) => new Date(b.alertDate).getTime() - new Date(a.alertDate).getTime());
};

export const checkForStaleReservations = async (): Promise<void> => {
    const FIVE_DAYS_AGO = subDays(new Date(), 5);
    const THIRTY_DAYS_AGO = subDays(new Date(), 30);
    
    const batch = writeBatch(db);

    const [allReservations, allMovements, allAlerts, products, vendedores] = await Promise.all([
        getAllReservations(),
        getDocs(query(collection(db, 'inventoryMovements'), where('date', '>=', THIRTY_DAYS_AGO))),
        getStaleReservationAlerts(),
        getProducts(),
        getVendedores(),
    ]);

    const productMap = new Map(products.map(p => [p.id, p]));
    const vendedorMap = new Map(vendedores.map(v => [v.id, v.name]));
    const existingAlertReservationIds = new Set(allAlerts.map(a => a.reservationId));

    const movements = allMovements.docs.map(doc => doc.data() as InventoryMovement);

    for (const reservation of allReservations) {
        const reservationDate = new Date(reservation.date);

        // Check if reservation is older than 5 days and not already alerted
        if (reservationDate <= FIVE_DAYS_AGO && !existingAlertReservationIds.has(reservation.id)) {
            // Check for any 'Salida' movement for this product after the reservation was made
            const hasRecentSale = movements.some(m => 
                m.productId === reservation.productId &&
                m.type === 'Salida' &&
                new Date(m.date) > reservationDate
            );

            if (!hasRecentSale) {
                // This is a stale reservation, create an alert
                const productInfo = productMap.get(reservation.productId);
                const vendedorName = vendedorMap.get(reservation.vendedorId) || 'Desconocido';

                if (productInfo) {
                    const alertRef = doc(collection(db, 'staleReservationAlerts'));
                    const newAlert: Omit<StaleReservationAlert, 'id'> = {
                        alertDate: new Date().toISOString(),
                        reservationId: reservation.id,
                        reservationDate: reservation.date,
                        productId: reservation.productId,
                        productName: productInfo.name,
                        productSku: productInfo.sku,
                        vendedorName: vendedorName,
                        quantity: reservation.quantity,
                    };
                    batch.set(alertRef, newAlert);
                }
            }
        }
    }
    
    await batch.commit();
}

export const resolveStaleReservationAlert = async (alertId: string): Promise<void> => {
    const alertRef = doc(db, 'staleReservationAlerts', alertId);
    const alertSnap = await getDoc(alertRef);

    if (!alertSnap.exists()) {
        throw new Error("Alert not found.");
    }

    const alertData = alertSnap.data() as StaleReservationAlert;
    const reservationRef = doc(db, 'reservations', alertData.reservationId);

    const batch = writeBatch(db);
    batch.delete(reservationRef);
    batch.delete(alertRef);
    
    await batch.commit();
}
