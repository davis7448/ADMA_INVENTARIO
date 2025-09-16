

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db } from './firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch, deleteDoc, documentId, setDoc } from "firebase/firestore";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem, RotationCategory, ProductPerformanceData, Vendedor, Reservation, StaleReservationAlert, ProductVariant, GetStockAlertsResult, StockAlertItem } from './types';
import {v4 as uuidv4} from 'uuid';
import { startOfDay, endOfDay, subDays, format, isToday } from 'date-fns';
import { checkStockAvailability } from "@/ai/flows/stock-monitoring";

const storage = getStorage();

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

  const allReservations = await getAllReservations();
  const reservationsByProductId: Record<string, Reservation[]> = {};

  for (const reservation of allReservations) {
    if (!reservationsByProductId[reservation.productId]) {
        reservationsByProductId[reservation.productId] = [];
    }
    reservationsByProductId[reservation.productId].push(reservation);
  }

  return productList.map(product => ({
    ...product,
    reservations: reservationsByProductId[product.id] || [],
  }));
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
  
  if (product.productType === 'variable') {
    product.stock = product.variants?.reduce((acc, v) => acc + v.stock, 0) || 0;
    // For variable products, price could be the lowest variant price, or 0. Let's use 0 for now.
    product.price = 0; 
  }

  const docRef = await addDoc(productsCol, { ...product, damagedStock: 0, pendingStock: 0 });
  return docRef.id;
};

export const updateProduct = async (productId: string, productUpdate: Partial<Omit<Product, 'id'>>) => {
  const productRef = doc(db, 'products', productId);

  if (productUpdate.productType === 'variable') {
    productUpdate.stock = productUpdate.variants?.reduce((acc, v) => acc + v.stock, 0) || 0;
    productUpdate.price = 0;
  }

  await updateDoc(productRef, productUpdate);
};

export const updateProductStock = async (productId: string, quantity: number, operation: 'add' | 'subtract', variantSku?: string) => {
    const productRef = doc(db, 'products', productId);
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Product with ID ${productId} does not exist!`);
        }
      
        const productData = productSnap.data() as Product;
      
        // If it's a simple product, just update its stock regardless of variantSku
        if (productData.productType === 'simple') {
            const currentStock = productData.stock || 0;
            let newStock;
            if (operation === 'add') {
                newStock = currentStock + quantity;
            } else {
                if (currentStock < quantity) {
                    throw new Error(`No hay suficiente stock para ${productData.name}. Stock actual: ${currentStock}, se requieren: ${quantity}.`);
                }
                newStock = currentStock - quantity;
            }
            transaction.update(productRef, { stock: newStock });
        } else { // It's a variable product
            if (!variantSku) {
                // This case should be handled carefully. If no SKU, what to do?
                // For now, let's throw an error to enforce providing a SKU for variable products.
                throw new Error(`Debe proporcionar un SKU de variante para actualizar el stock de un producto variable como ${productData.name}.`);
            }
            const variants = productData.variants ? [...productData.variants] : [];
            const variantIndex = variants.findIndex(v => v.sku === variantSku);
  
            if (variantIndex === -1) {
                throw new Error(`Variante con SKU ${variantSku} no encontrada en el producto ${productData.name}.`);
            }
  
            const variant = variants[variantIndex];
            const currentVariantStock = variant.stock || 0;
            let newVariantStock;
  
            if (operation === 'add') {
                newVariantStock = currentVariantStock + quantity;
            } else {
                if (currentVariantStock < quantity) {
                    throw new Error(`No hay suficiente stock para la variante ${variant.name}. Stock actual: ${currentVariantStock}, se requieren: ${quantity}.`);
                }
                newVariantStock = currentVariantStock - quantity;
            }
          
            // Update the specific variant's stock
            variants[variantIndex].stock = newVariantStock;
          
            // Recalculate the parent product's total stock
            const newTotalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
          
            transaction.update(productRef, { 
                variants: variants,
                stock: newTotalStock 
            });
      }
    });
};

export const registerDamagedProduct = async (productId: string, quantity: number, variantSku?: string) => {
    const productRef = doc(db, 'products', productId);
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Product with ID ${productId} does not exist!`);
        }
        
        const productData = productSnap.data() as Product;
        const currentDamagedStock = productData.damagedStock || 0;
        const newDamagedStock = currentDamagedStock + quantity;
        
        let updateData: { damagedStock: number, variants?: ProductVariant[], stock?: number } = { damagedStock: newDamagedStock };

        // Also decrement stock from the correct variant if applicable
        if (productData.productType === 'variable' && variantSku) {
            const variants = productData.variants ? [...productData.variants] : [];
            const variantIndex = variants.findIndex(v => v.sku.toLowerCase() === variantSku.toLowerCase());
    
            if (variantIndex !== -1) {
                const variant = variants[variantIndex];
                const currentVariantStock = variant.stock || 0;

                if (currentVariantStock < quantity) {
                    throw new Error(`No hay suficiente stock para marcar como averiado en la variante ${variant.name}. Stock actual: ${currentVariantStock}, se requieren: ${quantity}.`);
                }
                
                variants[variantIndex].stock = currentVariantStock - quantity;
                const newTotalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                
                updateData.variants = variants;
                updateData.stock = newTotalStock;
            }
        } else if (productData.productType === 'simple') {
            const currentStock = productData.stock || 0;
            if (currentStock < quantity) {
                throw new Error(`No hay suficiente stock para marcar como averiado en ${productData.name}. Stock actual: ${currentStock}, se requieren: ${quantity}.`);
            }
            updateData.stock = currentStock - quantity;
        }

        transaction.update(productRef, updateData);
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
    if (!id) return null;
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
    const q = query(suppliersRef, where(documentId(), 'in', ids));
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
    const q = query(categoriesRef, where(documentId(), 'in', ids));
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
    return [];
  };

// Return Request Functions
export const getReturnRequests = (): ReturnRequest[] => {
    return [];
};


// User Functions
export const getUsers = async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const userSnapshot = await getDocs(usersCol);
    const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    return userList;
};

export const addUser = async (user: Omit<User, 'id'>): Promise<string> => {
    const usersCol = collection(db, 'users');
    // Ensure email is unique
    const q = query(usersCol, where("email", "==", user.email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        throw new Error("A user with this email already exists.");
    }
    const docRef = await addDoc(usersCol, user);
    return docRef.id;
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

export const updateUserRoleInDb = async (userId: string, role: User['role']) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role });
};

export const updateUserProfile = async (userId: string, profileUpdate: Partial<Omit<User, 'id'>>) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, profileUpdate);
}

export const sendPasswordReset = async (email: string) => {
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
};

// Inventory Movement Functions
export const getInventoryMovements = async (days?: number): Promise<InventoryMovement[]> => {
    const movementsCol = collection(db, 'inventoryMovements');
    let q = query(movementsCol);

    if (days) {
        const startDate = subDays(new Date(), days);
        q = query(movementsCol, where('date', '>=', startDate));
    }

    const movementSnapshot = await getDocs(q);
    const movementList = movementSnapshot.docs.map(doc => {
      const data = doc.data();
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
    await setDoc(dispatchOrderRef, newDispatchOrder);


    const platformName = (await getDoc(doc(db, 'platforms', platformId))).data()?.name || 'N/A';
    const carrierName = (await getDoc(doc(db, 'carriers', carrierId))).data()?.name || 'N/A';
    const notes = `Dispatch ID: ${dispatchId}. Plataforma: ${platformName}, Transportadora: ${carrierName}`;


    // 2. Create inventory movements and update stock for each product
    for (const product of products) {
        await updateProductStock(product.productId, product.quantity, 'subtract', product.sku);
        await addInventoryMovement({
            type: 'Salida' as const,
            productId: product.productId,
            productName: product.name,
            quantity: product.quantity,
            notes: notes,
        });
    }

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

                    transaction.update(productRef, { 
                        pendingStock: newPendingStock < 0 ? 0 : newPendingStock
                    });

                    // Update variant stock if applicable
                    await updateProductStock(exProd.productId, exProd.quantity, 'add', exProd.variantSku);

                    // Create "Entrada" movement for the cancellation
                    const movementRef = doc(collection(db, 'inventoryMovements'));
                    transaction.set(movementRef, {
                        type: 'Entrada',
                        productId: exProd.productId,
                        productName: productData.name || 'Unknown Product',
                        quantity: exProd.quantity,
                        date: new Date(),
                        notes: `Anulación de guía pendiente: ${ex.trackingNumber} del despacho ${orderData.dispatchId}. SKU: ${exProd.variantSku || productData.sku}`,
                        movementId: 0, // This will be set by addInventoryMovement if we refactor to use it
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
                            const item: PendingInventoryItem = {
                                id: `${order.id}-${exception.trackingNumber}-${exProduct.productId}-${exProduct.variantId || 'simple'}`,
                                productId: exProduct.productId,
                                productName: productInfo.name,
                                productSku: productInfo.sku || '',
                                productImageUrl: productInfo.imageUrl,
                                quantity: exProduct.quantity,
                                dispatchId: order.dispatchId,
                                trackingNumber: exception.trackingNumber,
                                date: order.date,
                            };

                            if (exProduct.variantId && productInfo.variants) {
                                const variant = productInfo.variants.find(v => v.id === exProduct.variantId);
                                if (variant) {
                                    item.variantName = variant.name;
                                    item.variantSku = variant.sku;
                                }
                            }
                            pendingItems.push(item);
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
    const [product, dispatchOrders, movements, carriers, platforms] = await Promise.all([
        getProductById(productId),
        getDispatchOrders(),
        getInventoryMovementsByProductId(productId),
        getCarriers(),
        getPlatforms(),
    ]);

    if (!product) {
        throw new Error("Product not found");
    }

    const carrierMap = new Map(carriers.map(c => [c.id, c.name]));
    const platformMap = new Map(platforms.map(p => [p.id, p.name]));

    const salesByCarrier: Record<string, number> = {};
    const salesByPlatform: Record<string, number> = {};
    const salesByDay: Record<string, number> = {};
    const returnsByDay: Record<string, number> = {};
    const returnsByCarrier: Record<string, number> = {};
    
    const salesByVariant: NonNullable<ProductPerformanceData['salesByVariant']> = {};
    const returnsByVariant: NonNullable<ProductPerformanceData['returnsByVariant']> = {};
    
    const initializeVariantData = (variantId: string) => {
        if (!salesByVariant[variantId]) {
            salesByVariant[variantId] = { byCarrier: [], byPlatform: [], byDay: {} };
        }
        if (!returnsByVariant[variantId]) {
            returnsByVariant[variantId] = { byCarrier: [], byDay: {} };
        }
    };

    if (product.productType === 'variable' && product.variants) {
        product.variants.forEach(v => initializeVariantData(v.id));
    }

    // Process dispatch orders for sales data
    for (const order of dispatchOrders) {
        for (const p of order.products) {
            if (p.productId === productId) {
                const carrierName = carrierMap.get(order.carrierId) || 'Unknown Carrier';
                const platformName = platformMap.get(order.platformId) || 'Unknown Platform';
                const day = format(startOfDay(new Date(order.date)), 'yyyy-MM-dd');
                const qty = p.quantity;

                // Aggregate total data
                salesByCarrier[carrierName] = (salesByCarrier[carrierName] || 0) + qty;
                salesByPlatform[platformName] = (salesByPlatform[platformName] || 0) + qty;
                salesByDay[day] = (salesByDay[day] || 0) + qty;

                // Aggregate variant data
                if (p.variantId && salesByVariant[p.variantId]) {
                    const variantSales = salesByVariant[p.variantId];
                    variantSales.byDay[day] = (variantSales.byDay[day] || 0) + qty;

                    const carrierRecord = variantSales.byCarrier.find(c => c.name === carrierName);
                    if (carrierRecord) carrierRecord.value += qty;
                    else variantSales.byCarrier.push({ name: carrierName, value: qty });
                    
                    const platformRecord = variantSales.byPlatform.find(pl => pl.name === platformName);
                    if (platformRecord) platformRecord.value += qty;
                    else variantSales.byPlatform.push({ name: platformName, value: qty });
                }
            }
        }
    }
    
    // Process movements for returns data
    const thirtyDaysAgo = subDays(new Date(), 30);
    const returnMovements = movements.filter(m => 
        (m.type === 'Entrada' || m.type === 'Averia') && 
        (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia')) &&
        new Date(m.date) >= thirtyDaysAgo
    );

    for (const movement of returnMovements) {
        const day = format(startOfDay(new Date(movement.date)), 'yyyy-MM-dd');
        const qty = movement.quantity;
        const carrierMatch = movement.notes.match(/Transportadora: (.*?)(?:\.|$)/);
        const carrierName = carrierMatch ? carrierMatch[1].trim() : 'Unknown';
        
        returnsByDay[day] = (returnsByDay[day] || 0) + qty;
        returnsByCarrier[carrierName] = (returnsByCarrier[carrierName] || 0) + qty;

        if (product.productType === 'variable' && product.variants) {
            const skuMatch = movement.notes.match(/SKU: (\S+)/);
            if (skuMatch) {
                const variantSku = skuMatch[1];
                const variant = product.variants.find(v => v.sku === variantSku);
                if (variant && variant.id && returnsByVariant[variant.id]) {
                    const variantReturns = returnsByVariant[variant.id];
                    variantReturns.byDay[day] = (variantReturns.byDay[day] || 0) + qty;
                    
                    const carrierRecord = variantReturns.byCarrier.find(c => c.name === carrierName);
                    if (carrierRecord) carrierRecord.value += qty;
                    else variantReturns.byCarrier.push({ name: carrierName, value: qty });
                }
            }
        }
    }


    return {
        salesByCarrier: Object.entries(salesByCarrier).map(([name, value]) => ({ name, value })),
        salesByPlatform: Object.entries(salesByPlatform).map(([name, value]) => ({ name, value })),
        returnsByCarrier: Object.entries(returnsByCarrier).map(([name, value]) => ({ name, value })),
        salesByDay,
        returnsByDay,
        salesByVariant,
        returnsByVariant
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
        let stockToCheck = productData.stock;
        
        if (reservationData.variantId && productData.variants) {
            const variant = productData.variants.find(v => v.id === reservationData.variantId);
            if (!variant) {
                throw new Error("Variante no encontrada.");
            }
            stockToCheck = variant.stock;
        }

        const reservations = await getReservationsByProductId(reservationData.productId);
        const totalReservedForProductOrVariant = reservations
            .filter(r => reservationData.variantId ? r.variantId === reservationData.variantId : !r.variantId)
            .reduce((sum, r) => sum + r.quantity, 0);

        const availableStock = stockToCheck - totalReservedForProductOrVariant;

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
    return alertList.sort((a,b) => new Date(b.alertDate).getTime() - new Date(a.date).getTime());
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
};

// Stock Alert Functions
export const getOrGenerateStockAlerts = async (): Promise<GetStockAlertsResult> => {
    const metadataRef = doc(db, 'stockAlertsCache', 'metadata');
    const metadataSnap = await getDoc(metadataRef);

    if (metadataSnap.exists()) {
        const lastGenerated = (metadataSnap.data().lastGenerated as Timestamp).toDate();
        if (isToday(lastGenerated)) {
            // Data is fresh, return from cache
            const alertsCol = collection(db, 'stockAlertsCache');
            const q = query(alertsCol, where(documentId(), '!=', 'metadata'));
            const alertSnapshot = await getDocs(q);
            const alerts = alertSnapshot.docs.map(d => d.data() as StockAlertItem);
            return { alerts, lastGenerated: lastGenerated.toISOString() };
        }
    }

    // Data is stale or doesn't exist, regenerate
    try {
        const [products, allMovements, rotationCategories] = await Promise.all([
            getProducts(),
            getInventoryMovements(7), // Only fetch last 7 days of movements
            getRotationCategories(),
        ]);

        const salesByProductId: Record<string, number> = {};
        for (const movement of allMovements) {
            if (movement.type === 'Salida') {
                salesByProductId[movement.productId] = (salesByProductId[movement.productId] || 0) + movement.quantity;
            }
        }
        
        const sortedRotationCategories = [...rotationCategories].sort((a,b) => b.salesThreshold - a.salesThreshold);
        const getRotationCategoryName = (productId: string): string => {
            const sales = salesByProductId[productId] || 0;
            for (const category of sortedRotationCategories) {
                if (sales >= category.salesThreshold) {
                    return category.name;
                }
            }
            return 'Inactivo';
        }

        const itemsToCheck: any[] = [];
        for (const product of products) {
            const rotationName = getRotationCategoryName(product.id);
            if (rotationName === 'Inactivo') continue;

            const salesLast7Days = salesByProductId[product.id] || 0;

            if (product.productType === 'simple' && product.sku) {
                const totalReserved = Array.isArray(product.reservations) ? product.reservations.reduce((sum, res) => sum + res.quantity, 0) : 0;
                itemsToCheck.push({
                    productName: product.name,
                    physicalStock: product.stock,
                    reservedStock: totalReserved,
                    salesLast7Days: salesLast7Days,
                    // Pass through data for storage
                    id: product.id, name: product.name, sku: product.sku, imageUrl: product.imageUrl,
                });
            } else if (product.productType === 'variable' && product.variants) {
                for (const variant of product.variants) {
                    const variantReserved = (Array.isArray(product.reservations) ? product.reservations : [])
                        .filter(r => r.variantId === variant.id)
                        .reduce((sum, res) => sum + res.quantity, 0);

                    itemsToCheck.push({
                        productName: `${product.name} - ${variant.name}`,
                        physicalStock: variant.stock,
                        reservedStock: variantReserved,
                        salesLast7Days: salesLast7Days, // Use parent's sales for variant check
                        // Pass through data for storage
                        id: `${product.id}-${variant.id}`, name: `${product.name} - ${variant.name}`, sku: variant.sku, imageUrl: product.imageUrl,
                    });
                }
            }
        }

        const analysisPromises = itemsToCheck.map(item => 
            checkStockAvailability({
                productName: item.productName,
                physicalStock: item.physicalStock,
                reservedStock: item.reservedStock,
                salesLast7Days: item.salesLast7Days
            }).then(analysis => ({...item, analysis}))
        );

        const allAnalyses = await Promise.all(analysisPromises);
        const triggeredAlerts = allAnalyses.filter(item => item.analysis.alertTriggered);

        const newAlerts: StockAlertItem[] = triggeredAlerts.map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            imageUrl: item.imageUrl,
            physicalStock: item.physicalStock,
            reservedStock: item.reservedStock,
            availableForSale: item.analysis.availableForSale,
            dailyAverageSales: item.analysis.dailyAverageSales,
            alertMessage: item.analysis.alertMessage,
        }));
        
        // Cache new alerts in Firestore
        const batch = writeBatch(db);
        const alertsCol = collection(db, 'stockAlertsCache');
        // Clear old alerts first
        const oldAlertsSnap = await getDocs(query(alertsCol, where(documentId(), '!=', 'metadata')));
        oldAlertsSnap.forEach(doc => batch.delete(doc.ref));

        newAlerts.forEach(alert => {
            const docRef = doc(alertsCol, alert.id);
            batch.set(docRef, alert);
        });

        const newGeneratedDate = new Date();
        batch.set(metadataRef, { lastGenerated: newGeneratedDate });
        await batch.commit();

        return { alerts: newAlerts, lastGenerated: newGeneratedDate.toISOString() };

    } catch (e: any) {
        console.error("Failed to generate stock alerts:", e);
        // Try to return cached data if generation fails
        const metadataSnap = await getDoc(metadataRef);
        if (metadataSnap.exists()) {
            const alertsCol = collection(db, 'stockAlertsCache');
            const q = query(alertsCol, where(documentId(), '!=', 'metadata'));
            const alertSnapshot = await getDocs(q);
            const alerts = alertSnapshot.docs.map(d => d.data() as StockAlertItem);
            return {
                alerts,
                error: e.message || "An unknown error occurred during AI analysis.",
                lastGenerated: (metadataSnap.data().lastGenerated as Timestamp).toDate().toISOString()
            };
        }
        return { alerts: [], error: e.message || "An unknown error occurred during AI analysis." };
    }
}
