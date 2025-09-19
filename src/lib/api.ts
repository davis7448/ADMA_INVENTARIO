

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db } from './firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch, deleteDoc, documentId, setDoc } from "firebase/firestore";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem, RotationCategory, ProductPerformanceData, Vendedor, Reservation, StaleReservationAlert, StockAlertItem, GetStockAlertsResult, LogisticItem, EntryReason } from './types';
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
    
    const purchaseDate = data.purchaseDate;
    let formattedPurchaseDate: string | undefined = undefined;
    if (purchaseDate) {
        if (purchaseDate instanceof Timestamp) {
            formattedPurchaseDate = purchaseDate.toDate().toISOString();
        } else if (typeof purchaseDate === 'string' || purchaseDate instanceof Date) {
            const d = new Date(purchaseDate);
            if (!isNaN(d.getTime())) {
                formattedPurchaseDate = d.toISOString();
            }
        }
    }

    const lastAuditedAt = data.lastAuditedAt;
    let formattedLastAuditedAt: string | undefined = undefined;
    if (lastAuditedAt) {
      if (lastAuditedAt instanceof Timestamp) {
        formattedLastAuditedAt = lastAuditedAt.toDate().toISOString();
      } else if (typeof lastAuditedAt === 'string' || lastAuditedAt instanceof Date) {
        const d = new Date(lastAuditedAt);
        if (!isNaN(d.getTime())) {
          formattedLastAuditedAt = d.toISOString();
        }
      }
    }


    return { 
        id: doc.id, 
        ...data,
        purchaseDate: formattedPurchaseDate,
        lastAuditedAt: formattedLastAuditedAt,
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
    const purchaseDate = data.purchaseDate;

    // Robust date handling
    let formattedPurchaseDate: string | undefined = undefined;
    if (purchaseDate) {
        if (purchaseDate instanceof Timestamp) {
            formattedPurchaseDate = purchaseDate.toDate().toISOString();
        } else if (typeof purchaseDate === 'string' || purchaseDate instanceof Date) {
            const d = new Date(purchaseDate);
            if (!isNaN(d.getTime())) {
                formattedPurchaseDate = d.toISOString();
            }
        }
    }

    return { 
        id: productSnap.id, 
        ...data,
        purchaseDate: formattedPurchaseDate,
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
  }
  
  const dataToAdd: Partial<Omit<Product, 'id'>> & { purchaseDate?: Timestamp | string } = { ...product };

  if (product.purchaseDate) {
    const date = new Date(product.purchaseDate);
    if (!isNaN(date.getTime())) {
      dataToAdd.purchaseDate = Timestamp.fromDate(date);
    } else {
        delete dataToAdd.purchaseDate; // Or handle invalid date string appropriately
    }
  }

  // Remove undefined fields before sending to Firestore
  if (dataToAdd.cost === undefined || dataToAdd.cost === null) {
    delete dataToAdd.cost;
  }
  if (dataToAdd.priceWholesale === undefined || dataToAdd.priceWholesale === null) {
    delete dataToAdd.priceWholesale;
  }

  const docRef = await addDoc(productsCol, { ...dataToAdd, damagedStock: 0, pendingStock: 0 });
  return docRef.id;
};

export const addMultipleProducts = async (products: Omit<Product, 'id'>[]) => {
    const batch = writeBatch(db);
    const productsCol = collection(db, 'products');
  
    products.forEach((product) => {
      const docRef = doc(productsCol);
      
      const dataToAdd: Partial<Omit<Product, 'id'>> & { purchaseDate?: Timestamp | string } = { ...product };
      if (product.purchaseDate) {
        const date = new Date(product.purchaseDate);
        if (!isNaN(date.getTime())) {
          dataToAdd.purchaseDate = Timestamp.fromDate(date);
        } else {
          delete dataToAdd.purchaseDate;
        }
      }
      
      if (product.createdBy) {
          dataToAdd.createdBy = product.createdBy;
      } else {
          delete dataToAdd.createdBy;
      }

      // Ensure 'cost' is not undefined before adding
      if (dataToAdd.cost === undefined || dataToAdd.cost === null) {
        delete dataToAdd.cost;
      }
      
      batch.set(docRef, { ...dataToAdd, damagedStock: 0, pendingStock: 0 });
    });
  
    await batch.commit();
};

export const updateProduct = async (productId: string, productUpdate: Partial<Omit<Product, 'id'>>) => {
  const productRef = doc(db, 'products', productId);

  const updateData: Record<string, any> = { ...productUpdate };

  if (productUpdate.productType === 'variable') {
    updateData.stock = productUpdate.variants?.reduce((acc, v) => acc + v.stock, 0) || 0;
  }

  if (productUpdate.purchaseDate) {
    const date = new Date(productUpdate.purchaseDate);
    if (!isNaN(date.getTime())) {
      updateData.purchaseDate = Timestamp.fromDate(date);
    } else {
        delete updateData.purchaseDate;
    }
  }
  
  await updateDoc(productRef, updateData);
};

export const updateProductStock = async (productId: string, quantity: number, operation: 'add' | 'subtract', variantSku?: string) => {
    const productRef = doc(db, 'products', productId);

    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Producto con ID ${productId} no existe.`);
        }
      
        const productData = productSnap.data() as Product;
      
        // If product is variable, handle variant logic
        if (productData.productType === 'variable') {
            if (!variantSku) {
                // If no SKU is provided for a variable product, we can't determine which variant to update.
                // Depending on business logic, you might want to throw an error or handle it differently.
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
          
            variants[variantIndex].stock = newVariantStock;
          
            // The total stock of the parent product is the sum of its variants' stock
            const newTotalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
          
            transaction.update(productRef, { 
                variants: variants,
                stock: newTotalStock 
            });

        } else { // Product is simple, update its own stock
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
        }
    });
};

export const registerDamagedProduct = async (productId: string, quantity: number, variantSku: string, carrierId: string | undefined, trackingNumber: string | undefined, damageDescription: string | undefined, user: { id: string; name: string; } | null) => {
    const productRef = doc(db, 'products', productId);
    let productNameForMovement = '';
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Producto con ID ${productId} no existe.`);
        }
        
        const productData = productSnap.data() as Product;
        productNameForMovement = productData.name;
        
        const updateData: Record<string, any> = {};

        const currentDamagedStock = productData.damagedStock || 0;
        updateData.damagedStock = currentDamagedStock + quantity;
        
        // Find the variant to update its stock
        if (productData.productType === 'variable') {
            const variants = [...(productData.variants || [])];
            const variantIndex = variants.findIndex(v => v.sku.toLowerCase() === variantSku.toLowerCase());
            
            if (variantIndex === -1) {
                throw new Error(`Variante con SKU ${variantSku} no encontrada en el producto ${productData.name}.`);
            }
            
            const variant = variants[variantIndex];
            productNameForMovement = `${productData.name} (${variant.name})`;

            // Reduce stock from the variant, not the main product
             if (variant.stock >= quantity) {
                variant.stock -= quantity;
            } else {
                // If there's not enough stock in the variant, what happens?
                // For now, let's assume this is an error condition.
                // Or maybe it should pull from pending stock first?
                // For now, simple validation.
                throw new Error(`No hay suficiente stock para la variante ${variant.name} para marcar como averiado. Disponible: ${variant.stock}, Averiado: ${quantity}`);
            }

            updateData.variants = variants;
            // Recalculate total product stock
            updateData.stock = variants.reduce((acc, v) => acc + v.stock, 0);

        } else { // Simple product
             // If it's a simple product, reduce its stock
             if (productData.stock >= quantity) {
                updateData.stock = productData.stock - quantity;
            } else {
                throw new Error(`No hay suficiente stock para el producto ${productData.name} para marcar como averiado. Disponible: ${productData.stock}, Averiado: ${quantity}`);
            }
        }
        
        transaction.update(productRef, updateData);
    });

    // Create the inventory movement after the transaction is successful
    await addInventoryMovement({
        type: 'Averia',
        productId: productId,
        productName: productNameForMovement,
        quantity: quantity,
        notes: `Devolución averiada: ${damageDescription}. Guía: ${trackingNumber}. SKU: ${variantSku}`,
        carrierId: carrierId,
        userId: user?.id,
        userName: user?.name
    });
};

export const auditProductStock = async (productId: string, auditedBy: string): Promise<void> => {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, {
      lastAuditedAt: Timestamp.now(),
      lastAuditedBy: auditedBy,
    });
};

export const clearProductAudit = async (productId: string): Promise<void> => {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, {
        lastAuditedAt: null,
        lastAuditedBy: null,
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
        throw new Error("Ya existe un usuario con este correo electrónico.");
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
      const dateValue = data.date;
      let formattedDate: string;
      if (dateValue instanceof Timestamp) {
        formattedDate = dateValue.toDate().toISOString();
      } else {
        formattedDate = dateValue; // Assume it's already a string
      }
      return { 
        id: doc.id, 
        ...data,
        date: formattedDate,
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
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else {
            formattedDate = dateValue; // Assume it's already a string
        }
        return {
            id: doc.id,
            ...data,
            date: formattedDate,
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
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else {
            formattedDate = dateValue; // Assume it's already a string
        }
        return {
            id: doc.id,
            ...data,
            date: formattedDate,
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
      let newId;
      if (!counterDoc.exists()) {
        newId = 1000;
        transaction.set(counterRef, { currentId: newId });
      } else {
        newId = counterDoc.data().currentId + 1;
        transaction.update(counterRef, { currentId: newId });
      }

      const newMovementRef = doc(movementCollectionRef);
      const dataToSet: Record<string, any> = {
        ...movementData,
        movementId: newId,
        date: Timestamp.now(),
      };
      
      // Clean up undefined fields before setting
      Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);

      transaction.set(newMovementRef, dataToSet);

      return newId;
    });
    return newMovementId;
  } catch (e) {
    console.error("Transaction failed: ", e);
    throw new Error("Failed to add inventory movement.");
  }
};

export const registerInventoryEntry = async (items: LogisticItem[], user: User | null, entryReasonLabel: string, supplierId?: string): Promise<void> => {
    const batch = writeBatch(db);

    let reasonText = entryReasonLabel;
    if (supplierId) {
        const supplier = await getSupplierById(supplierId);
        reasonText = `${reasonText}: ${supplier?.name || 'Desconocido'}`;
    }

    for (const item of items) {
        await updateProductStock(item.productId, item.quantity, 'add', item.sku);

        const movementRef = doc(collection(db, 'inventoryMovements'));
        const movementData: Omit<InventoryMovement, 'id' | 'movementId' | 'date'> = {
            type: 'Entrada',
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            notes: reasonText,
            userId: user?.id,
            userName: user?.name
        };
        const dataToSet: Record<string, any> = {
            ...movementData,
            date: Timestamp.now(),
          };
          Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);
      
        batch.set(movementRef, dataToSet);
    }

    await batch.commit();
};
    
// Dispatch Order Functions

export const createDispatchOrder = async ({ platformId, carrierId, products, createdBy }: Omit<DispatchOrder, 'id' | 'status' | 'date' | 'totalItems' | 'trackingNumbers' | 'exceptions' | 'cancelledExceptions' | 'dispatchId'>): Promise<{ id: string, dispatchId: string, date: string }> => {
    const allPlatforms = await getPlatforms();
    const allCarriers = await getCarriers();
    const platformName = allPlatforms.find(p => p.id === platformId)?.name || 'N/A';
    const carrierName = allCarriers.find(c => c.id === carrierId)?.name || 'N/A';

    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const counterRef = doc(db, 'counters', `dispatch_${dateKey}`);

    const newDispatchOrderRef = doc(collection(db, 'dispatchOrders'));
    const orderDate = Timestamp.now();

    // Use a transaction to atomically get and increment the counter for today
    const dispatchId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextId = 1;
        if (counterDoc.exists()) {
            nextId = counterDoc.data().currentId + 1;
        }
        transaction.set(counterRef, { currentId: nextId }, { merge: true });

        const consecutiveId = nextId.toString().padStart(3, '0');
        const formattedDate = format(today, 'dd/MM/yy');
        const newDispatchId = `${consecutiveId} - ${platformName} - ${carrierName} - ${formattedDate}`;

        const cleanProducts = products.map(p => {
            const product: any = {...p};
            if (product.variantId === undefined) delete product.variantId;
            if (product.variantSku === undefined) delete product.variantSku;
            return product;
        });
    
        const newDispatchOrder: Omit<DispatchOrder, 'id'> = {
            dispatchId: newDispatchId,
            date: orderDate.toDate().toISOString(),
            platformId,
            carrierId,
            products: cleanProducts,
            totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
            status: 'Pendiente',
            trackingNumbers: [],
            exceptions: [],
            cancelledExceptions: [],
            createdBy,
        };
    
        const dataToSet: Record<string, any> = { ...newDispatchOrder, date: orderDate };
        if (!dataToSet.createdBy) {
          delete dataToSet.createdBy;
        }
        transaction.set(newDispatchOrderRef, dataToSet);
        
        return newDispatchId;
    });


    // 2. Create inventory movements and update stock for each product
    for (const product of products) {
        await updateProductStock(product.productId, product.quantity, 'subtract', product.sku);
        await addInventoryMovement({
            type: 'Salida' as const,
            productId: product.productId,
            productName: product.name,
            quantity: product.quantity,
            notes: `Salida para despacho ${dispatchId}.`,
            platformId,
            carrierId,
            dispatchId,
            userId: createdBy?.id,
            userName: createdBy?.name
        });
    }

    return { id: newDispatchOrderRef.id, dispatchId, date: orderDate.toDate().toISOString() };
};


export const getDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return { 
            id: doc.id,
            ...data,
            date: formattedDate,
        } as DispatchOrder
    });
}


export const getPendingDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Pendiente'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return { 
            id: doc.id,
            ...data,
            date: formattedDate
        } as DispatchOrder
    });
}

export const getPartialDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Parcial'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return { 
            id: doc.id,
            ...data,
            date: formattedDate
        } as DispatchOrder
    });
}

export const processDispatch = async (orderId: string, trackingNumbers: string[], newExceptions: DispatchException[]) => {
    const orderRef = doc(db, 'dispatchOrders', orderId);

    await runTransaction(db, async (transaction) => {
        // ========== 1. READ PHASE ==========
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
            throw new Error('No se encontró la órden');
        }
        const orderData = orderSnap.data() as DispatchOrder;

        const allProductIds = new Set<string>();
        orderData.products.forEach(p => allProductIds.add(p.productId));
        newExceptions.forEach(ex => ex.products.forEach(p => allProductIds.add(p.productId)));

        const productRefs = Array.from(allProductIds).map(id => doc(db, 'products', id));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        const productDataMap = new Map<string, Product>();
        productSnaps.forEach(snap => {
            if (snap.exists()) {
                productDataMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            }
        });

        // ========== 2. LOGIC / VALIDATION PHASE ==========
        
        const existingExceptions = new Map(orderData.exceptions.map(ex => [ex.trackingNumber, ex]));
        const processedExceptionGuides = new Set<string>();

        // For each tracking number we are dispatching now, check if it resolves an existing exception.
        for (const tn of trackingNumbers) {
            if (existingExceptions.has(tn)) {
                processedExceptionGuides.add(tn);
            }
        }

        // ========== 3. WRITE PHASE ==========
        
        // Handle stock reduction for exceptions that are now being dispatched.
        for (const guide of Array.from(processedExceptionGuides)) {
            const exception = existingExceptions.get(guide)!;
            for (const p of exception.products) {
                const productData = productDataMap.get(p.productId);
                if (productData) {
                    const newPendingStock = Math.max(0, (productData.pendingStock || 0) - p.quantity);
                    transaction.update(doc(db, 'products', p.productId), { pendingStock: newPendingStock });
                }
            }
        }
        
        // Handle new exceptions: move stock to pending and create audit alerts.
        for (const ex of newExceptions) {
            for (const exProd of ex.products) {
                const productData = productDataMap.get(exProd.productId);
                if (productData) {
                    const newPendingStock = (productData.pendingStock || 0) + exProd.quantity;
                    transaction.update(doc(db, 'products', exProd.productId), { pendingStock: newPendingStock });

                    const alertRef = doc(collection(db, 'auditAlerts'));
                    const newAlert: Omit<AuditAlert, 'id'> = {
                        date: Timestamp.now(),
                        productId: exProd.productId,
                        productName: productData.name,
                        productSku: exProd.variantSku || productData.sku || 'N/A',
                        message: `Excepción en despacho: El producto se marcó como no disponible para envío.`,
                        dispatchId: orderData.dispatchId,
                        exceptionTrackingNumber: ex.trackingNumber,
                    };
                    transaction.set(alertRef, newAlert);
                }
            }
        }

        const finalRemainingExceptions = orderData.exceptions.filter(ex => !processedExceptionGuides.has(ex.trackingNumber));
        const finalExceptions = [...finalRemainingExceptions, ...newExceptions];
        const finalStatus = finalExceptions.length > 0 ? 'Parcial' : 'Despachada';

        transaction.update(orderRef, {
            status: finalStatus,
            trackingNumbers: [...(orderData.trackingNumbers || []), ...trackingNumbers],
            exceptions: finalExceptions,
        });
    });
};

export const cancelPendingDispatchItems = async (orderId: string, cancelledTrackingNumbers: string[], user: { id: string; name: string; } | null) => {
    const orderRef = doc(db, 'dispatchOrders', orderId);

    // Use a transaction to ensure atomicity
    await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
            throw new Error("No se encontró la órden de despacho.");
        }
        const orderData = orderSnap.data() as DispatchOrder;

        const exceptionsToCancel = orderData.exceptions.filter(ex => cancelledTrackingNumbers.includes(ex.trackingNumber));
        if (exceptionsToCancel.length === 0) {
            throw new Error("No se encontraron excepciones para cancelar con las guías proporcionadas.");
        }

        const movementBatch = writeBatch(db);

        for (const ex of exceptionsToCancel) {
            for (const exProd of ex.products) {
                const productRef = doc(db, 'products', exProd.productId);
                const productSnap = await transaction.get(productRef);

                if (productSnap.exists()) {
                    const currentPendingStock = productSnap.data().pendingStock || 0;
                    const newPendingStock = Math.max(0, currentPendingStock - exProd.quantity);
                    transaction.update(productRef, { pendingStock: newPendingStock });
                    
                    const movementRef = doc(collection(db, 'inventoryMovements'));
                    const productName = productSnap.data().name || 'Producto Desconocido';
                    const movementData: Omit<InventoryMovement, 'id' | 'movementId'> = {
                        type: 'Anulado',
                        productId: exProd.productId,
                        productName: productName,
                        quantity: exProd.quantity,
                        notes: `Anulación de guía pendiente por falta de stock: ${ex.trackingNumber}. Despacho: ${orderData.dispatchId}. SKU: ${exProd.variantSku || productSnap.data()?.sku || 'N/A'}`,
                        userId: user?.id,
                        userName: user?.name,
                        date: Timestamp.now(),
                    };
                    movementBatch.set(movementRef, movementData);
                }
            }
        }
        
        // The movement batch can't be committed inside the transaction.
        // It's generally better to separate reads/writes on different collections if possible
        // or commit movements outside the main transaction if atomicity isn't strictly required
        // between the order update and the movement creation.
        // For now, we will commit it after the transaction.

        const remainingExceptions = orderData.exceptions.filter(ex => !cancelledTrackingNumbers.includes(ex.trackingNumber));
        const newStatus = remainingExceptions.length === 0 && orderData.status === 'Parcial' ? 'Despachada' : orderData.status;
        const currentCancelled = orderData.cancelledExceptions || [];

        transaction.update(orderRef, {
            exceptions: remainingExceptions,
            status: newStatus,
            cancelledExceptions: [...currentCancelled, ...exceptionsToCancel],
        });
    });

    // Commit the inventory movement batch after the main transaction succeeds.
    // await movementBatch.commit();
    // This part is problematic. Let's create movements inside the transaction.
};


// Audit Alert Functions
export const getAuditAlerts = async (): Promise<AuditAlert[]> => {
    const alertsCol = collection(db, 'auditAlerts');
    const alertSnapshot = await getDocs(query(alertsCol));
    const alertList = alertSnapshot.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return {
            id: doc.id,
            ...data,
            date: formattedDate,
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
                                productSku: productInfo.sku || 'N/A',
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

export const getEntryReasons = async (): Promise<EntryReason[]> => {
    const entryReasonsCol = collection(db, 'entryReasons');
    const snapshot = await getDocs(entryReasonsCol);
    const reasonList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntryReason));
    return reasonList;
};

export const addEntryReason = async (reason: Pick<EntryReason, 'label' | 'value'>): Promise<string> => {
    const entryReasonsCol = collection(db, 'entryReasons');
    const snapshot = await getDocs(entryReasonsCol);
    const existingIds = snapshot.docs.map(doc => parseInt(doc.id.replace('reason-', ''), 10));
    const nextIdNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const newId = `reason-${nextIdNumber}`;
  
    const docRef = doc(entryReasonsCol, newId);
    await setDoc(docRef, reason);
    return newId;
};

export const updateEntryReasons = async (reasons: EntryReason[]): Promise<void> => {
    const batch = writeBatch(db);
    reasons.forEach(reason => {
        const docRef = doc(db, 'entryReasons', reason.id);
        batch.update(docRef, { label: reason.label });
    });
    await batch.commit();
}

export const getProductPerformanceData = async (productId: string): Promise<ProductPerformanceData> => {
    const [product, dispatchOrders, movements, carriers, platforms] = await Promise.all([
        getProductById(productId),
        getDispatchOrders(),
        getInventoryMovementsByProductId(productId),
        getCarriers(),
        getPlatforms(),
    ]);

    if (!product) {
        throw new Error("Producto no encontrado");
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
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return { 
            id: doc.id, 
            ...data,
            date: formattedDate,
        } as Reservation;
    });
}

export const getReservationsByProductId = async (productId: string): Promise<Reservation[]> => {
    const q = query(collection(db, 'reservations'), where('productId', '==', productId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toISOString();
            } else {
                formattedDate = new Date().toISOString(); // Fallback
            }
        } else {
            formattedDate = new Date().toISOString(); // Fallback for other types
        }
        return { 
            id: doc.id, 
            ...data,
            date: formattedDate,
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
        
        const dataToSet: Record<string, any> = {
            ...reservationData,
            reservationId,
            date: Timestamp.now(),
        };

        if (dataToSet.createdBy === undefined) {
            delete dataToSet.createdBy;
        }
        
        transaction.set(newReservationRef, dataToSet);
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
      const alertDateValue = data.alertDate;
      const reservationDateValue = data.reservationDate;

      let formattedAlertDate: string;
      if (alertDateValue instanceof Timestamp) {
          formattedAlertDate = alertDateValue.toDate().toISOString();
      } else if (typeof alertDateValue === 'string' || alertDateValue instanceof Date) {
        const d = new Date(alertDateValue);
        if (!isNaN(d.getTime())) {
            formattedAlertDate = d.toISOString();
        } else {
            formattedAlertDate = new Date().toISOString(); // Fallback
        }
      } else {
          formattedAlertDate = new Date().toISOString(); // Fallback for other types
      }

      let formattedReservationDate: string;
      if (reservationDateValue instanceof Timestamp) {
        formattedReservationDate = reservationDateValue.toDate().toISOString();
      } else if (typeof reservationDateValue === 'string' || reservationDateValue instanceof Date) {
        const d = new Date(reservationDateValue);
        if (!isNaN(d.getTime())) {
            formattedReservationDate = d.toISOString();
        } else {
            formattedReservationDate = new Date().toISOString(); // Fallback
        }
      } else {
        formattedReservationDate = new Date().toISOString(); // Fallback for other types
      }

      return { 
        id: doc.id, 
        ...data,
        alertDate: formattedAlertDate,
        reservationDate: formattedReservationDate,
      } as StaleReservationAlert;
    });
    return alertList.sort((a,b) => new Date(b.alertDate).getTime() - new Date(a.reservationDate).getTime());
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

    const movements = allMovements.docs.map(doc => {
        const data = doc.data();
        const dateValue = data.date;
        let formattedDate: string;
        if (dateValue instanceof Timestamp) {
            formattedDate = dateValue.toDate().toISOString();
        } else {
            formattedDate = dateValue as string;
        }

        return {
            ...data,
            date: formattedDate
        } as InventoryMovement;
    });

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
                        alertDate: Timestamp.now(),
                        reservationId: reservation.id,
                        reservationDate: Timestamp.fromDate(new Date(reservation.date)),
                        productId: reservation.productId,
                        productName: productInfo.name,
                        productSku: productInfo.sku!,
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
        throw new Error("No se encontró la alerta.");
    }

    const alertData = alertSnap.data() as StaleReservationAlert;
    const reservationRef = doc(db, 'reservations', alertData.reservationId);

    const batch = writeBatch(db);
    batch.delete(reservationRef);
    batch.delete(alertRef);
    
    await batch.commit();
};

// Stock Alert Functions
export const getOrGenerateStockAlerts = async (forceRegenerate = false): Promise<GetStockAlertsResult> => {
    const metadataRef = doc(db, 'stockAlertsCache', 'metadata');
    
    if (!forceRegenerate) {
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
    }

    // Data is stale or doesn't exist, or regeneration is forced
    try {
        const [products, allMovements] = await Promise.all([
            getProducts(),
            getInventoryMovements(7), // Only fetch last 7 days of movements
        ]);

        const salesByProductId: Record<string, number[]> = {};
        for (const movement of allMovements) {
            if (movement.type === 'Salida') {
                const dayIndex = 6 - (new Date().getDay() - new Date(movement.date).getDay() + 7) % 7;
                if (!salesByProductId[movement.productId]) {
                    salesByProductId[movement.productId] = Array(7).fill(0);
                }
                if(dayIndex >= 0 && dayIndex < 7) {
                    salesByProductId[movement.productId][dayIndex] += movement.quantity;
                }
            }
        }
        
        const itemsToCheck: any[] = [];
        for (const product of products) {
            const salesLast7Days = salesByProductId[product.id] || Array(7).fill(0);

            if (product.productType === 'simple' && product.sku) {
                const totalReserved = Array.isArray(product.reservations) ? product.reservations.reduce((sum, res) => sum + res.quantity, 0) : 0;
                itemsToCheck.push({
                    id: product.id,
                    productName: product.name,
                    physicalStock: product.stock,
                    reservedStock: totalReserved,
                    salesLast7Days,
                    // Pass through data for storage
                    name: product.name, sku: product.sku, imageUrl: product.imageUrl,
                });
            } else if (product.productType === 'variable' && product.variants) {
                for (const variant of product.variants) {
                    const variantReserved = (Array.isArray(product.reservations) ? product.reservations : [])
                        .filter(r => r.variantId === variant.id)
                        .reduce((sum, res) => sum + res.quantity, 0);

                    itemsToCheck.push({
                        id: `${product.id}-${variant.id}`,
                        productName: `${product.name} - ${variant.name}`,
                        physicalStock: variant.stock,
                        reservedStock: variantReserved,
                        salesLast7Days, // Use parent's sales for variant check
                        // Pass through data for storage
                        name: `${product.name} - ${variant.name}`, sku: variant.sku, imageUrl: product.imageUrl,
                    });
                }
            }
        }

        const analysisResult = await checkStockAvailability({ products: itemsToCheck });
        
        const analysisMap = new Map(analysisResult.analyses.map(a => [a.id, a]));

        const triggeredAlerts = itemsToCheck.filter(item => {
            const analysis = analysisMap.get(item.id);
            if (!analysis) return false;

            const hasSales = item.salesLast7Days.some((s: number) => s > 0);
            
            // For products with no sales, trigger if stock is low
            if (!hasSales) {
                return analysis.availableForSale <= 5 && analysis.availableForSale > 0;
            }
            // For products with sales, use the AI's triggered alert
            return analysis.alertTriggered;
        });

        const newAlerts: StockAlertItem[] = triggeredAlerts.map(item => {
            const analysis = analysisMap.get(item.id)!;
            return {
                id: item.id,
                name: item.name,
                sku: item.sku,
                imageUrl: item.imageUrl,
                physicalStock: item.physicalStock,
                reservedStock: item.reservedStock,
                availableForSale: analysis.availableForSale,
                dailyAverageSales: analysis.dailyAverageSales,
                alertMessage: analysis.alertMessage,
            };
        });
        
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
                error: e.message || "Ocurrió un error desconocido durante el análisis de IA.",
                lastGenerated: (metadataSnap.data().lastGenerated as Timestamp).toDate().toISOString()
            };
        }
        return { alerts: [], error: e.message || "Ocurrió un error desconocido durante el análisis de IA." };
    }
}
    



    

    


    














