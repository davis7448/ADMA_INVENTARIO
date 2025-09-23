

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db } from './firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch, deleteDoc, documentId, setDoc, limit, startAfter, orderBy, type Query, type DocumentSnapshot } from "firebase/firestore";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem, RotationCategory, ProductPerformanceData, Vendedor, Reservation, StaleReservationAlert, StockAlertItem, GetStockAlertsResult, LogisticItem, EntryReason, Warehouse, DashboardData } from './types';
import {v4 as uuidv4} from 'uuid';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { checkStockAvailability } from "@/ai/flows/stock-monitoring";

const storage = getStorage();
const DEFAULT_WAREHOUSE_ID = 'wh-bog';

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
export const getProducts = async ({ page = 1, limit: itemsPerPage = 20, fetchAll = false, filters = {} }: { page?: number, limit?: number, fetchAll?: boolean, filters?: any } = {}): Promise<{ products: Product[], totalPages: number }> => {
    const { searchQuery, selectedCategory, selectedRotation, selectedVendedor, minStock, hasPending, hasReservations, onlyAudited, warehouseId } = filters;

    let productQuery: Query = collection(db, 'products');

    // Determine the warehouse IDs to query based on the filter
    const targetWarehouseIds: (string | null | undefined)[] = [];
    if (warehouseId) {
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined); // Include 'wh-bog' and documents without warehouseId
        } else {
            targetWarehouseIds.push(warehouseId); // Strict filtering for other warehouses
        }
    }
    // If no warehouseId is provided, we don't add a warehouse filter, effectively getting all products for roles like admin.

    if (targetWarehouseIds.length > 0) {
        productQuery = query(productQuery, where('warehouseId', 'in', targetWarehouseIds));
    }
    
    const allProductsSnapshot = await getDocs(productQuery);

    let allProducts = allProductsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...doc.data(),
            warehouseId: data.warehouseId || DEFAULT_WAREHOUSE_ID,
        } as Product
    });

    // Apply remaining client-side filters
    const filteredProducts = allProducts.filter(product => {
        const lowercasedQuery = searchQuery?.toLowerCase() || '';
        const searchMatch = !searchQuery || searchQuery.length <= 2
            ? true
            : product.name.toLowerCase().includes(lowercasedQuery) || 
              (product.sku && product.sku.toLowerCase().includes(lowercasedQuery)) ||
              (product.productType === 'variable' && product.variants?.some(variant => 
                  variant.name.toLowerCase().includes(lowercasedQuery) ||
                  variant.sku.toLowerCase().includes(lowercasedQuery)
              ));
        
        const rotationMatch = !selectedRotation || selectedRotation === 'all' || product.rotationCategoryName === selectedRotation;
        const stockMatch = !minStock || product.stock >= parseInt(minStock, 10);
        const pendingMatch = !hasPending || (product.pendingStock && product.pendingStock > 0);
        const reservationsMatch = !hasReservations || (product.reservations && product.reservations.length > 0);
        const vendedorMatch = !selectedVendedor || selectedVendedor === 'all' || (product.reservations && product.reservations.some(r => r.vendedorId === selectedVendedor));
        const categoryMatch = !selectedCategory || selectedCategory === 'all' || product.categoryId === selectedCategory;
        const auditedMatch = !onlyAudited || !!product.lastAuditedAt;

        return searchMatch && rotationMatch && stockMatch && pendingMatch && reservationsMatch && vendedorMatch && categoryMatch && auditedMatch;
    });

    const totalCount = filteredProducts.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const paginatedProducts = fetchAll ? filteredProducts : filteredProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const allReservations = await getAllReservations(warehouseId);
    const reservationsByProductId: Record<string, Reservation[]> = {};
  
    for (const reservation of allReservations) {
      if (!reservationsByProductId[reservation.productId]) {
          reservationsByProductId[reservation.productId] = [];
      }
      reservationsByProductId[reservation.productId].push(reservation);
    }
    
    const productsWithData = paginatedProducts.map(product => ({
        ...product,
        purchaseDate: product.purchaseDate ? parseFirestoreDate(product.purchaseDate).toISOString() : undefined,
        lastAuditedAt: product.lastAuditedAt ? parseFirestoreDate(product.lastAuditedAt).toISOString() : undefined,
        damagedStock: product.damagedStock || 0,
        pendingStock: product.pendingStock || 0,
        reservations: reservationsByProductId[product.id] || [],
    }));

    return { products: productsWithData, totalPages };
  };

export const getProductById = async (id: string): Promise<Product | null> => {
  const productDoc = doc(db, 'products', id);
  const productSnap = await getDoc(productDoc);
  if (productSnap.exists()) {
    const data = productSnap.data();
    const reservations = await getReservationsByProductId(id);
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

    return { 
        id: productSnap.id, 
        ...data,
        warehouseId: data.warehouseId || DEFAULT_WAREHOUSE_ID,
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
    
    const dataToAdd: Partial<Omit<Product, 'id'>> = { ...product };
  
    if (product.purchaseDate) {
      const date = new Date(product.purchaseDate);
      if (!isNaN(date.getTime())) {
        dataToAdd.purchaseDate = Timestamp.fromDate(date).toDate().toISOString();
      } else {
          delete dataToAdd.purchaseDate; 
      }
    } else {
        delete dataToAdd.purchaseDate;
    }
  
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
        
        const dataToAdd: Partial<Omit<Product, 'id'>> = { ...product };
        if (product.purchaseDate) {
          const date = new Date(product.purchaseDate);
          if (!isNaN(date.getTime())) {
            dataToAdd.purchaseDate = Timestamp.fromDate(date).toDate().toISOString();
          } else {
            delete dataToAdd.purchaseDate;
          }
        } else {
          delete dataToAdd.purchaseDate;
        }
        
        if (product.createdBy) {
            dataToAdd.createdBy = product.createdBy;
        } else {
            delete dataToAdd.createdBy;
        }
  
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
      updateData.purchaseDate = Timestamp.fromDate(date).toDate().toISOString();
    } else {
        delete updateData.purchaseDate;
    }
  } else {
    delete updateData.purchaseDate;
  }
  
  if (productUpdate.cost === undefined) {
    delete updateData.cost;
  }

  if (productUpdate.priceWholesale === undefined) {
    delete updateData.priceWholesale;
  }

  await updateDoc(productRef, updateData);
};

export const deleteProduct = async (productId: string, user: User | null): Promise<void> => {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
        throw new Error("El producto que intentas eliminar no existe.");
    }
    const productData = productSnap.data() as Product;

    await addInventoryMovement({
        type: 'Eliminación',
        productId: productId,
        productName: productData.name,
        quantity: productData.stock,
        notes: `Producto eliminado por ${user?.name || 'un usuario desconocido'}.`,
        userId: user?.id,
        userName: user?.name,
        warehouseId: productData.warehouseId,
    });

    const reservationsSnapshot = await getDocs(query(collection(db, 'reservations'), where('productId', '==', productId)));
    const batch = writeBatch(db);
    reservationsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    batch.delete(productRef);
    
    await batch.commit();
};

export const updateProductStock = async (transaction: any, productId: string, quantity: number, operation: 'add' | 'subtract' | 'subtract-pending', variantSku?: string) => {
    const productRef = doc(db, 'products', productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists()) {
        throw new Error(`Producto con ID ${productId} no existe.`);
    }
  
    const productData = productSnap.data() as Product;
  
    if (operation === 'subtract-pending') {
        const currentPendingStock = productData.pendingStock || 0;
        const newPendingStock = Math.max(0, currentPendingStock - quantity);
        transaction.update(productRef, { pendingStock: newPendingStock });
        return; 
    }

    if (productData.productType === 'variable') {
        if (!variantSku) {
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
      
        const newTotalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
      
        transaction.update(productRef, { 
            variants: variants,
            stock: newTotalStock 
        });

    } else { 
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
};

export const registerDamagedProduct = async (productId: string, quantity: number, variantSku: string, carrierId: string | undefined, trackingNumber: string | undefined, damageDescription: string | undefined, user: { id: string; name: string; } | null) => {
    const productRef = doc(db, 'products', productId);
    let productNameForMovement = '';
    let warehouseId;
    
    await runTransaction(db, async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Producto con ID ${productId} no existe.`);
        }
        
        const productData = productSnap.data() as Product;
        productNameForMovement = productData.name;
        warehouseId = productData.warehouseId;
        
        const updateData: Record<string, any> = {};

        const currentDamagedStock = productData.damagedStock || 0;
        updateData.damagedStock = currentDamagedStock + quantity;
        
        if (productData.productType === 'variable') {
            const variants = [...(productData.variants || [])];
            const variantIndex = variants.findIndex(v => v.sku.toLowerCase() === variantSku.toLowerCase());
            
            if (variantIndex === -1) {
                throw new Error(`Variante con SKU ${variantSku} no encontrada en el producto ${productData.name}.`);
            }
            
            const variant = variants[variantIndex];
            productNameForMovement = `${productData.name} (${variant.name})`;

             if (variant.stock >= quantity) {
                variant.stock -= quantity;
            } else {
                throw new Error(`No hay suficiente stock para la variante ${variant.name} para marcar como averiado. Disponible: ${variant.stock}, Averiado: ${quantity}`);
            }

            updateData.variants = variants;
            updateData.stock = variants.reduce((acc, v) => acc + v.stock, 0);

        } else { 
             if (productData.stock >= quantity) {
                updateData.stock = productData.stock - quantity;
            } else {
                throw new Error(`No hay suficiente stock para el producto ${productData.name} para marcar como averiado. Disponible: ${productData.stock}, Averiado: ${quantity}`);
            }
        }
        
        transaction.update(productRef, updateData);
    });

    await addInventoryMovement({
        type: 'Averia',
        productId: productId,
        productName: productNameForMovement,
        quantity: quantity,
        notes: `Devolución averiada: ${damageDescription}. Guía: ${trackingNumber}. SKU: ${variantSku}`,
        carrierId: carrierId,
        userId: user?.id,
        userName: user?.name,
        warehouseId,
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

export const updateUserWarehouseInDb = async (userId: string, warehouseId: string) => {
    const userRef = doc(db, 'users', userId);
    const finalWarehouseId = warehouseId === 'none' ? null : warehouseId;
    await updateDoc(userRef, { warehouseId: finalWarehouseId });
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
export const getInventoryMovements = async ({ page = 1, limit: itemsPerPage = 10, fetchAll = false, filters = {} }: { page?: number, limit?: number, fetchAll?: boolean, filters?: any } = {}): Promise<{ movements: InventoryMovement[], totalPages: number, totalCount: number }> => {
    const { startDate, endDate, productId, platformId, carrierId, movementType, warehouseId, productIds } = filters;
    
    let baseQuery: Query = collection(db, 'inventoryMovements');

    const targetWarehouseIds: (string | null | undefined)[] = [];
    if (warehouseId) {
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined); 
        } else {
            targetWarehouseIds.push(warehouseId);
        }
    }
    
    let movementsQuery = baseQuery;
    if (targetWarehouseIds.length > 0) {
        movementsQuery = query(movementsQuery, where('warehouseId', 'in', targetWarehouseIds));
    }


    if (startDate) {
        movementsQuery = query(movementsQuery, where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
        movementsQuery = query(movementsQuery, where('date', '<=', new Date(endDate)));
    }
    if (productId && productId !== 'all') {
        movementsQuery = query(movementsQuery, where('productId', '==', productId));
    }
    if (productIds && productIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < productIds.length; i += 30) {
            chunks.push(productIds.slice(i, i + 30));
        }
        movementsQuery = query(movementsQuery, where('productId', 'in', chunks.flat()));
    }
    if (platformId && platformId !== 'all') {
        movementsQuery = query(movementsQuery, where('platformId', '==', platformId));
    }
    if (carrierId && carrierId !== 'all') {
        movementsQuery = query(movementsQuery, where('carrierId', '==', carrierId));
    }
    if (movementType && movementType !== 'all') {
        movementsQuery = query(movementsQuery, where('type', '==', movementType));
    }
    
    const snapshot = await getDocs(movementsQuery);
    
    let allMovements = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: parseFirestoreDate(data.date).toISOString(),
        } as InventoryMovement
    });
    
    const sortedMovements = allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (fetchAll) {
        return { movements: sortedMovements, totalPages: 1, totalCount: sortedMovements.length };
    }

    const totalCount = sortedMovements.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginatedMovements = sortedMovements.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return { movements: paginatedMovements, totalPages, totalCount };
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
            formattedDate = dateValue; 
        }
        return {
            id: doc.id,
            ...data,
            warehouseId: data.warehouseId || DEFAULT_WAREHOUSE_ID,
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
            formattedDate = dateValue; 
        }
        return {
            id: doc.id,
            ...data,
            warehouseId: data.warehouseId || DEFAULT_WAREHOUSE_ID,
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
        warehouseId: movementData.warehouseId,
      };
      
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

export const registerInventoryEntry = async (items: (LogisticItem & { trackingNumber?: string })[], user: User | null, reasonLabel: string, supplierId?: string, carrierId?: string): Promise<void> => {
    let operation: 'add' | 'subtract' = 'add';
    let movementType: InventoryMovement['type'] = 'Entrada';
    let notes = reasonLabel;

    if (reasonLabel === 'Ajuste de Salida') {
        operation = 'subtract';
        movementType = 'Ajuste de Salida';
        notes = 'Ajuste de Salida manual';
    } else if (reasonLabel === 'Ajuste de Entrada') {
        movementType = 'Ajuste de Entrada';
        notes = 'Ajuste de Entrada manual';
    } else if (reasonLabel === 'Devolución de Cliente') {
        movementType = 'Entrada';
    } else { // Recepción de Proveedor
        const supplier = await getSupplierById(supplierId!);
        notes = `Recepción de Proveedor: ${supplier?.name || 'Desconocido'}`;
    }

    for (const item of items) {
        if (reasonLabel === 'Devolución de Cliente') {
            notes = `Devolución de cliente. Guía: ${item.trackingNumber}`;
        }
        
        await runTransaction(db, async (transaction) => {
            await updateProductStock(transaction, item.productId, item.quantity, operation, item.sku);
        });
        
        await addInventoryMovement({
            type: movementType,
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            notes: notes,
            userId: user?.id,
            userName: user?.name,
            carrierId,
            warehouseId: user?.warehouseId || DEFAULT_WAREHOUSE_ID, // Use user's warehouse
        });
    }
};

// Dispatch Order Functions

export const createDispatchOrder = async ({ platformId, carrierId, products, createdBy, warehouseId }: Omit<DispatchOrder, 'id' | 'status' | 'date' | 'totalItems' | 'trackingNumbers' | 'exceptions' | 'cancelledExceptions' | 'dispatchId'>): Promise<{ id: string, dispatchId: string, date: Date }> => {
    const allPlatforms = await getPlatforms();
    const allCarriers = await getCarriers();
    const platformName = allPlatforms.find(p => p.id === platformId)?.name || 'N/A';
    const carrierName = allCarriers.find(c => c.id === carrierId)?.name || 'N/A';

    const today = new Date();
    const dateKey = format(today, 'yyyy-MM-dd');
    const counterRef = doc(db, 'counters', `dispatch_${dateKey}`);

    const newDispatchOrderRef = doc(collection(db, 'dispatchOrders'));
    const orderDate = Timestamp.now();

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
            date: orderDate.toDate(),
            platformId,
            carrierId,
            products: cleanProducts,
            totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
            status: 'Pendiente',
            trackingNumbers: [],
            exceptions: [],
            cancelledExceptions: [],
            createdBy,
            warehouseId: warehouseId || DEFAULT_WAREHOUSE_ID, // Use provided warehouseId or default
        };
    
        const dataToSet: Record<string, any> = { ...newDispatchOrder, date: orderDate }; 
        if (!dataToSet.createdBy) {
          delete dataToSet.createdBy;
        }
       
        transaction.set(newDispatchOrderRef, dataToSet);
        
        return newDispatchId;
    });


    for (const product of products) {
        await runTransaction(db, async (transaction) => {
            await updateProductStock(transaction, product.productId, product.quantity, 'subtract', product.sku);
        });
        
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
            userName: createdBy?.name,
            warehouseId: warehouseId || DEFAULT_WAREHOUSE_ID,
        });
    }

    return { id: newDispatchOrderRef.id, dispatchId, date: orderDate.toDate() };
};


const parseFirestoreDate = (dateValue: any): Date => {
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate();
    } else if (typeof dateValue === 'string') {
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        return d;
      }
    } else if (dateValue instanceof Date) {
        return dateValue;
    }
    console.warn("Unexpected date format from Firestore, using current date as fallback:", dateValue);
    return new Date();
  };

  export const getDispatchOrders = async ({ page = 1, limit: itemsPerPage = 10, fetchAll = false, filters = {} }: { page?: number, limit?: number, fetchAll?: boolean, filters?: any } = {}): Promise<{ orders: DispatchOrder[], totalPages: number }> => {
    const { startDate, endDate, productId, platformId, carrierId, warehouseId } = filters;
    
    let baseQuery: Query = collection(db, 'dispatchOrders');

    const targetWarehouseIds: (string | null | undefined)[] = [];
    if (warehouseId) {
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined);
        } else {
            targetWarehouseIds.push(warehouseId);
        }
    }
    
    let ordersQuery = baseQuery;
    if (targetWarehouseIds.length > 0) {
        ordersQuery = query(ordersQuery, where('warehouseId', 'in', targetWarehouseIds));
    }


    if (startDate) {
        ordersQuery = query(ordersQuery, where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
        ordersQuery = query(ordersQuery, where('date', '<=', new Date(endDate)));
    }
    if (platformId && platformId !== 'all') {
        ordersQuery = query(ordersQuery, where('platformId', '==', platformId));
    }
    if (carrierId && carrierId !== 'all') {
        ordersQuery = query(ordersQuery, where('carrierId', '==', carrierId));
    }

    const snapshot = await getDocs(ordersQuery);

    let allOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: parseFirestoreDate(doc.data().date)
    } as DispatchOrder));

    const filteredOrders = allOrders.filter(order => {
        const productMatch = !productId || productId === 'all' || order.products.some(p => p.productId === productId);
        return productMatch;
    }).sort((a, b) => b.date.getTime() - a.date.getTime());

    if (fetchAll) {
        return { orders: filteredOrders, totalPages: 1 };
    }

    const totalCount = filteredOrders.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginatedOrders = filteredOrders.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    
    return { orders: paginatedOrders, totalPages };
};


export const getPendingDispatchOrders = async (warehouseId?: string): Promise<DispatchOrder[]> => {
    let baseQuery: Query = query(collection(db, 'dispatchOrders'), where('status', '==', 'Pendiente'));
    
    const targetWarehouseIds: (string | null | undefined)[] = [];
    if (warehouseId) {
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined);
        } else {
            targetWarehouseIds.push(warehouseId);
        }
    }

    let q = baseQuery;
    if (targetWarehouseIds.length > 0) {
        q = query(q, where('warehouseId', 'in', targetWarehouseIds));
    }
    
    const snapshot = await getDocs(q);

    let allOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            ...data,
            date: parseFirestoreDate(data.date),
        } as DispatchOrder
    });

    return allOrders;
}

export const getPartialDispatchOrders = async (warehouseId?: string): Promise<DispatchOrder[]> => {
    let baseQuery: Query = query(collection(db, 'dispatchOrders'), where('status', '==', 'Parcial'));
    
    const targetWarehouseIds: (string | null | undefined)[] = [];
    if (warehouseId) {
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined);
        } else {
            targetWarehouseIds.push(warehouseId);
        }
    }
    
    let q = baseQuery;
    if (targetWarehouseIds.length > 0) {
        q = query(q, where('warehouseId', 'in', targetWarehouseIds));
    }


    const snapshot = await getDocs(q);

    let allOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            ...data,
            date: parseFirestoreDate(data.date),
        } as DispatchOrder
    });
    
    return allOrders;
}

export const processDispatch = async (orderId: string, trackingNumbers: string[], newExceptions: DispatchException[]) => {
    const orderRef = doc(db, 'dispatchOrders', orderId);

    if (trackingNumbers.length > 0) {
        const cancellationRequestsCol = collection(db, 'cancellationRequests');
        const CHUNK_SIZE = 30; // Firestore 'in' query limit

        for (let i = 0; i < trackingNumbers.length; i += CHUNK_SIZE) {
            const chunk = trackingNumbers.slice(i, i + CHUNK_SIZE);
            const cancellationQuery = query(cancellationRequestsCol, where('trackingNumber', 'in', chunk), where('status', '==', 'pending'));
            const cancellationSnapshot = await getDocs(cancellationQuery);

            if (!cancellationSnapshot.empty) {
                const cancelledGuide = cancellationSnapshot.docs[0].data().trackingNumber;
                const cancellationRequestId = cancellationSnapshot.docs[0].id;
                // Throw a specific error that includes the request ID
                const error = new Error(`La guía ${cancelledGuide} tiene una solicitud de anulación pendiente y no puede ser despachada.`);
                (error as any).cancellationRequestId = cancellationRequestId;
                throw error;
            }
        }
    }


    await runTransaction(db, async (transaction) => {
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
        
        const existingExceptions = new Map((orderData.exceptions || []).map(ex => [ex.trackingNumber, ex]));
        const processedExceptionGuides = new Set<string>();

        for (const tn of trackingNumbers) {
            if (existingExceptions.has(tn)) {
                processedExceptionGuides.add(tn);
            }
        }
        
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

        const finalRemainingExceptions = (orderData.exceptions || []).filter(ex => !processedExceptionGuides.has(ex.trackingNumber));
        const finalExceptions = [...finalRemainingExceptions, ...newExceptions];
        const finalStatus = finalExceptions.length > 0 ? 'Parcial' : 'Despachada';

        transaction.update(orderRef, {
            status: finalStatus,
            trackingNumbers: [...(orderData.trackingNumbers || []), ...trackingNumbers],
            exceptions: finalExceptions,
        });
    });
};

export const cancelPendingDispatchItems = async (
    orderId: string,
    itemsToCancel: { productId: string; variantId?: string; quantity: number, trackingNumber: string }[],
    user: User | null,
    cancellationGuides: string[]
): Promise<Partial<DispatchOrder>> => {
    const orderRef = doc(db, 'dispatchOrders', orderId);

    const movementsToCreate: Omit<InventoryMovement, 'id' | 'movementId' | 'date'>[] = [];
    let orderData: DispatchOrder;

    const updatedOrderData = await runTransaction(db, async (transaction) => {
        // --- 1. READS ---
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
            throw new Error("No se encontró la orden de despacho.");
        }
        orderData = { id: orderSnap.id, ...orderSnap.data(), date: parseFirestoreDate(orderSnap.data().date) } as DispatchOrder;

        const productIdsToRead = [...new Set(itemsToCancel.map(p => p.productId))];
        const productDocs = productIdsToRead.length > 0
            ? await Promise.all(productIdsToRead.map(id => transaction.get(doc(db, 'products', id))))
            : [];
        
        const productDataMap = new Map<string, Product>();
        productDocs.forEach(snap => {
            if (snap.exists()) {
                productDataMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            }
        });

        // --- 2. LOGIC & WRITES ---
        const guidesSet = new Set(cancellationGuides);
        const exceptionsToCancel = (orderData.exceptions || []).filter(ex => guidesSet.has(ex.trackingNumber));

        for (const exception of exceptionsToCancel) {
            for (const itemToCancel of exception.products) {
                const productData = productDataMap.get(itemToCancel.productId);
                if (!productData) {
                    console.warn(`Producto ${itemToCancel.productId} no encontrado durante anulación. Se omitirá la actualización de stock pendiente.`);
                    continue;
                }

                // Logic to reduce pending stock
                await updateProductStock(transaction, itemToCancel.productId, itemToCancel.quantity, 'subtract-pending', itemToCancel.variantSku);

                movementsToCreate.push({
                    type: 'Anulado',
                    productId: itemToCancel.productId,
                    productName: productData.name + (itemToCancel.variantId ? ` - ${productData.variants?.find(v => v.id === itemToCancel.variantId)?.name}` : ''),
                    quantity: itemToCancel.quantity,
                    notes: `Anulación de excepción ${exception.trackingNumber} en despacho ${orderData.dispatchId} por ${user?.name}.`,
                    platformId: orderData.platformId,
                    carrierId: orderData.carrierId,
                    dispatchId: orderData.dispatchId,
                    userId: user?.id,
                    userName: user?.name,
                    warehouseId: orderData.warehouseId,
                });
            }
        }
        
        const updatedExceptions = (orderData.exceptions || []).filter(ex => !guidesSet.has(ex.trackingNumber));
        const updatedCancelledExceptions = [...(orderData.cancelledExceptions || []), ...exceptionsToCancel];
        
        const updatePayload: Record<string, any> = {
            exceptions: updatedExceptions,
            cancelledExceptions: updatedCancelledExceptions,
        };

        const allOriginalProductsInExceptions = (orderData.exceptions || []).flatMap(ex => ex.products);
        if (allOriginalProductsInExceptions.length > 0 && updatedExceptions.length === 0) {
            updatePayload.status = orderData.trackingNumbers.length > 0 ? 'Despachada' : 'Anulada';
        }

        transaction.update(orderRef, updatePayload);
        
        return {
            ...orderData,
            ...updatePayload,
        };
    });
    
    // --- 3. POST-TRANSACTION OPERATIONS ---
    for (const movement of movementsToCreate) {
        await addInventoryMovement(movement);
    }
    
    return updatedOrderData;
};

export const annulDispatchedGuideItems = async (
    cancellationRequestId: string,
    orderId: string,
    itemsToAnnul: { productId: string; variantId?: string; sku?: string; quantity: number }[],
    user: User | null,
    annulledGuide: string
): Promise<void> => {
    const orderRef = doc(db, 'dispatchOrders', orderId);
    const cancellationRequestRef = doc(db, 'cancellationRequests', cancellationRequestId);
    const movementsToCreate: Omit<InventoryMovement, 'id' | 'movementId' | 'date'>[] = [];

    await runTransaction(db, async (transaction) => {
        // --- 1. READS ---
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
            throw new Error("No se encontró la orden de despacho.");
        }
        const orderData = orderSnap.data() as DispatchOrder;

        const productIds = [...new Set(itemsToAnnul.map(item => item.productId))];
        const productRefs = productIds.map(id => doc(db, 'products', id));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        const productDataMap = new Map<string, Product>();
        productDocs.forEach(snap => {
            if (snap.exists()) {
                productDataMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            }
        });

        // --- 2. LOGIC & WRITES ---
        for (const item of itemsToAnnul) {
            const productData = productDataMap.get(item.productId);
            if (!productData) {
                console.warn(`Producto ${item.productId} no encontrado durante la anulación. Se omitirá la actualización de stock.`);
                continue;
            }
            
            await updateProductStock(transaction, item.productId, item.quantity, 'add', item.sku);

            movementsToCreate.push({
                type: 'Anulado',
                productId: item.productId,
                productName: productData.name + (item.variantId ? ` - ${productData.variants?.find(v => v.id === item.variantId)?.name}` : ''),
                quantity: item.quantity,
                notes: `Anulación de guía despachada ${annulledGuide} por ${user?.name}.`,
                platformId: orderData.platformId,
                carrierId: orderData.carrierId,
                dispatchId: orderData.dispatchId,
                userId: user?.id,
                userName: user?.name,
                warehouseId: orderData.warehouseId,
            });
        }

        const updatedTrackingNumbers = (orderData.trackingNumbers || []).filter(tn => tn !== annulledGuide);
        
        const annulledExceptionProduct: Partial<DispatchException> = {
            trackingNumber: annulledGuide,
            products: itemsToAnnul.map(p => {
                const cleanProduct: Partial<DispatchExceptionProduct> = { 
                    productId: p.productId, 
                    quantity: p.quantity,
                };
                if (p.variantId) cleanProduct.variantId = p.variantId;
                if (p.sku) cleanProduct.variantSku = p.sku;
                return cleanProduct as DispatchExceptionProduct;
            })
        };

        const updatedCancelledExceptions = [...(orderData.cancelledExceptions || []), annulledExceptionProduct as DispatchException];

        transaction.update(orderRef, {
            trackingNumbers: updatedTrackingNumbers,
            cancelledExceptions: updatedCancelledExceptions
        });
        
        transaction.update(cancellationRequestRef, {
            status: 'completed'
        });
    });

    for (const movement of movementsToCreate) {
        await addInventoryMovement(movement);
    }
};

export const annulGuideDuringDispatch = async (
    cancellationRequestId: string,
    order: DispatchOrder,
    itemsToAnnul: { productId: string; variantId?: string; sku?: string; quantity: number }[],
    user: User | null
): Promise<Partial<DispatchOrder>> => {
    const orderRef = doc(db, 'dispatchOrders', order.id);
    const cancellationRequestRef = doc(db, 'cancellationRequests', cancellationRequestId);
    
    const movementsToCreate: Omit<InventoryMovement, 'id' | 'movementId' | 'date'>[] = [];

    const updatedOrderData = await runTransaction(db, async (transaction) => {
        // All reads must happen first. We already have the order object, so we just need products.
        const productIds = [...new Set(itemsToAnnul.map(item => item.productId))];
        const productDocs = await Promise.all(productIds.map(id => transaction.get(doc(db, 'products', id))));

        const productDataMap = new Map<string, Product>();
        productDocs.forEach(snap => {
            if (snap.exists()) {
                productDataMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            }
        });

        // Now, prepare all writes.
        const updatedProducts: DispatchOrderProduct[] = [...order.products];
        
        for (const item of itemsToAnnul) {
            const productData = productDataMap.get(item.productId);
            if (productData) {
                await updateProductStock(transaction, item.productId, item.quantity, 'add', item.sku);

                movementsToCreate.push({
                    type: 'Anulado',
                    productId: item.productId,
                    productName: productData.name + (item.variantId ? ` - ${productData.variants?.find(v => v.id === item.variantId)?.name}` : ''),
                    quantity: item.quantity,
                    notes: `Anulación de guía durante despacho ${order.dispatchId} por ${user?.name}.`,
                    platformId: order.platformId,
                    carrierId: order.carrierId,
                    userId: user?.id,
                    userName: user?.name,
                    warehouseId: order.warehouseId,
                });
            }

            const productIndex = updatedProducts.findIndex(p => p.productId === item.productId && p.variantId === item.variantId);
            if (productIndex > -1) {
                updatedProducts[productIndex].quantity -= item.quantity;
                if (updatedProducts[productIndex].quantity <= 0) {
                    updatedProducts.splice(productIndex, 1);
                }
            }
        }
        
        const newTotalItems = updatedProducts.reduce((sum, p) => sum + p.quantity, 0);
        const finalStatus = newTotalItems === 0 ? 'Anulada' : order.status;

        const updatePayload = {
            products: updatedProducts,
            totalItems: newTotalItems,
            status: finalStatus,
        };

        transaction.update(orderRef, updatePayload);
        transaction.update(cancellationRequestRef, { status: 'completed' });

        return updatePayload;
    });

    for (const movement of movementsToCreate) {
        await addInventoryMovement(movement);
    }
    
    return updatedOrderData;
};



// Audit Alert Functions
export const getAuditAlerts = async (warehouseId?: string): Promise<AuditAlert[]> => {
    let q: Query = query(collection(db, 'auditAlerts'));

    if (warehouseId && warehouseId !== 'all') {
        q = query(q, where('warehouseId', '==', warehouseId));
    }

    const alertSnapshot = await getDocs(q);
    const alertList = alertSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: parseFirestoreDate(data.date).toISOString(),
        } as AuditAlert;
    });
    return alertList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Pending Inventory Functions
export const getPendingInventory = async (warehouseId?: string): Promise<PendingInventoryItem[]> => {
    const productsResult = await getProducts({ fetchAll: true, filters: { warehouseId } });
    const productsById = new Map(productsResult.products.map(p => [p.id, p]));

    const dispatchOrders = await getPartialDispatchOrders(warehouseId);
    
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
                                date: order.date.toISOString(),
                                warehouseId: order.warehouseId || DEFAULT_WAREHOUSE_ID,
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

// ... other functions remain unchanged

export const getProductPerformanceData = async (productId: string): Promise<ProductPerformanceData> => {
    const [product, dispatchOrdersResult, movements, carriers, platforms] = await Promise.all([
        getProductById(productId),
        getDispatchOrders({ limit: 1000 }), 
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

    for (const order of dispatchOrdersResult.orders) {
        for (const p of order.products) {
            if (p.productId === productId) {
                const carrierName = carrierMap.get(order.carrierId) || 'Unknown Carrier';
                const platformName = platformMap.get(order.platformId) || 'Unknown Platform';
                const day = format(startOfDay(order.date), 'yyyy-MM-dd');
                const qty = p.quantity;

                salesByCarrier[carrierName] = (salesByCarrier[carrierName] || 0) + qty;
                salesByPlatform[platformName] = (salesByPlatform[platformName] || 0) + qty;
                salesByDay[day] = (salesByDay[day] || 0) + qty;

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
export const getAllReservations = async (warehouseId?: string): Promise<Reservation[]> => {
    let q: Query = collection(db, 'reservations');
    
    if (warehouseId && warehouseId !== 'all') {
        const targetWarehouseIds: (string | null | undefined)[] = [];
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined);
        } else {
            targetWarehouseIds.push(warehouseId);
        }
        q = query(q, where('warehouseId', 'in', targetWarehouseIds));
    }
    
    const snapshot = await getDocs(q);
    
    let allReservations = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            date: parseFirestoreDate(data.date).toISOString(),
        } as Reservation;
    });
    
    return allReservations;
}

export const getReservationsByProductId = async (productId: string): Promise<Reservation[]> => {
    const q = query(collection(db, 'reservations'), where('productId', '==', productId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            date: parseFirestoreDate(data.date).toISOString(),
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
            warehouseId: productData.warehouseId,
        };

        if (dataToSet.createdBy === undefined) {
            delete dataToSet.createdBy;
        }
        
        transaction.set(newReservationRef, dataToSet);
    });
};

export const deleteReservation = async (reservationId: string) => {
    if (!reservationId) {
        throw new Error("Se requiere ID de la reserva.");
    }
    const reservationRef = doc(db, 'reservations', reservationId);
    await deleteDoc(reservationRef);
};

// Stale Reservation Alert Functions
export const getStaleReservationAlerts = async (warehouseId?: string): Promise<StaleReservationAlert[]> => {
    let q: Query = query(collection(db, 'staleReservationAlerts'));
    
    if (warehouseId && warehouseId !== 'all') {
        const targetWarehouseIds: (string | null | undefined)[] = [];
        if (warehouseId === 'wh-bog') {
            targetWarehouseIds.push('wh-bog', null, undefined);
        } else {
            targetWarehouseIds.push(warehouseId);
        }
        q = query(q, where('warehouseId', 'in', targetWarehouseIds));
    }

    const alertSnapshot = await getDocs(q);
    
    const alertList = alertSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            alertDate: parseFirestoreDate(data.alertDate).toISOString(),
            reservationDate: parseFirestoreDate(data.reservationDate).toISOString(),
        } as StaleReservationAlert;
    });

    return alertList.sort((a, b) => new Date(b.alertDate).getTime() - new Date(a.reservationDate).getTime());
};

export const checkForStaleReservations = async (): Promise<void> => {
    const FIVE_DAYS_AGO = subDays(new Date(), 5);
    const THIRTY_DAYS_AGO = subDays(new Date(), 30);
    
    const batch = writeBatch(db);

    const [allReservations, allMovements, allAlerts, productsResult, vendedores] = await Promise.all([
        getAllReservations(),
        getDocs(query(collection(db, 'inventoryMovements'), where('date', '>=', THIRTY_DAYS_AGO))),
        getStaleReservationAlerts(),
        getProducts({ limit: 10000 }),
        getVendedores(),
    ]);

    const productMap = new Map(productsResult.products.map(p => [p.id, p]));
    const vendedorMap = new Map(vendedores.map(v => [v.id, v.name]));
    const existingAlertReservationIds = new Set(allAlerts.map(a => a.reservationId));

    const movements = allMovements.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            date: parseFirestoreDate(data.date).toISOString()
        } as InventoryMovement;
    });

    for (const reservation of allReservations) {
        const reservationDate = new Date(reservation.date);

        if (reservationDate <= FIVE_DAYS_AGO && !existingAlertReservationIds.has(reservation.id)) {
            const hasRecentSale = movements.some(m => 
                m.productId === reservation.productId &&
                m.type === 'Salida' &&
                new Date(m.date) > reservationDate
            );

            if (!hasRecentSale) {
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
                        warehouseId: productInfo.warehouseId,
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
    
    await deleteReservation(alertData.reservationId);
    await deleteDoc(alertRef);
};

// Stock Alert Functions
export const getOrGenerateStockAlerts = async (forceRegenerate = false, warehouseId?: string): Promise<GetStockAlertsResult> => {
    const metadataRef = doc(db, 'stockAlertsCache', 'metadata');
    
    try {
        const metadataSnap = await getDoc(metadataRef);
        if (metadataSnap.exists() && !forceRegenerate) {
            let q: Query = query(collection(db, 'stockAlertsCache'), where(documentId(), '!=', 'metadata'));
            if (warehouseId && warehouseId !== 'all') {
                const targetWarehouseIds: (string | null | undefined)[] = [];
                if (warehouseId === 'wh-bog') {
                    targetWarehouseIds.push('wh-bog', null, undefined);
                } else {
                    targetWarehouseIds.push(warehouseId);
                }
                q = query(q, where('warehouseId', 'in', targetWarehouseIds));
            }
            const alertSnapshot = await getDocs(q);
            const alerts = alertSnapshot.docs.map(d => d.data() as StockAlertItem);
            return { alerts, lastGenerated: (metadataSnap.data().lastGenerated as Timestamp).toDate().toISOString() };
        } else {
             // Return empty alerts if not forcing and no cache exists, to be populated by manual generation
            return { alerts: [], lastGenerated: metadataSnap.exists() ? (metadataSnap.data().lastGenerated as Timestamp).toDate().toISOString() : undefined };
        }
    } catch (e: any) {
        console.error("Failed to fetch stock alerts from cache:", e);
        return { alerts: [], error: e.message || "Ocurrió un error desconocido al obtener las alertas." };
    }
};

export const generateAndCacheStockAlerts = async (warehouseId?: string): Promise<GetStockAlertsResult> => {
    try {
        const [productsResult, allMovementsResult] = await Promise.all([
            getProducts({ fetchAll: true, filters: { warehouseId } }),
            getInventoryMovements({ fetchAll: true, filters: { warehouseId, startDate: subDays(new Date(), 7).toISOString() } }),
        ]);

        const salesByProductId: Record<string, number[]> = {};
        for (const movement of allMovementsResult.movements) {
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
        for (const product of productsResult.products) {
            const salesLast7Days = salesByProductId[product.id] || Array(7).fill(0);

            if (product.productType === 'simple' && product.sku) {
                const totalReserved = Array.isArray(product.reservations) ? product.reservations.reduce((sum, res) => sum + res.quantity, 0) : 0;
                itemsToCheck.push({
                    id: product.id,
                    productName: product.name,
                    physicalStock: product.stock,
                    reservedStock: totalReserved,
                    salesLast7Days,
                    name: product.name, sku: product.sku, imageUrl: product.imageUrl,
                    warehouseId: product.warehouseId,
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
                        salesLast7Days, 
                        name: `${product.name} - ${variant.name}`, sku: variant.sku, imageUrl: product.imageUrl,
                        warehouseId: product.warehouseId,
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
            
            if (!hasSales) {
                return analysis.availableForSale <= 5 && analysis.availableForSale > 0;
            }
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
                warehouseId: item.warehouseId,
            };
        });
        
        const batch = writeBatch(db);
        const alertsCol = collection(db, 'stockAlertsCache');
        const oldAlertsSnap = await getDocs(query(alertsCol, where(documentId(), '!=', 'metadata')));
        oldAlertsSnap.forEach(doc => batch.delete(doc.ref));

        newAlerts.forEach(alert => {
            const docRef = doc(alertsCol, alert.id);
            batch.set(docRef, alert);
        });

        const newGeneratedDate = new Date();
        batch.set(doc(alertsCol, 'metadata'), { lastGenerated: newGeneratedDate });
        await batch.commit();

        return { alerts: newAlerts, lastGenerated: newGeneratedDate.toISOString() };
    } catch (e: any) {
         console.error("Failed to generate and cache stock alerts:", e);
         return { alerts: [], error: e.message || "Ocurrió un error desconocido al generar las alertas." };
    }
}


// Cancellation Request Functions
export const createCancellationRequests = async (trackingNumbers: string[], user: User): Promise<{ alreadyDispatched: string[] }> => {
    const batch = writeBatch(db);
    const requestsCol = collection(db, 'cancellationRequests');
    const dispatchOrdersCol = collection(db, 'dispatchOrders');
    
    const alreadyDispatched: string[] = [];

    if (trackingNumbers.length === 0) {
        return { alreadyDispatched: [] };
    }
    
    const dispatchedQuery = query(dispatchOrdersCol, where('trackingNumbers', 'array-contains-any', trackingNumbers));
    const dispatchedSnapshot = await getDocs(dispatchedQuery);

    const dispatchedGuides = new Set<string>();
    dispatchedSnapshot.forEach(doc => {
        const order = doc.data() as DispatchOrder;
        order.trackingNumbers?.forEach(tn => {
            if (trackingNumbers.includes(tn)) {
                dispatchedGuides.add(tn);
            }
        });
    });

    for (const tn of trackingNumbers) {
        const isDispatched = dispatchedGuides.has(tn);
        if (isDispatched) {
            alreadyDispatched.push(tn);
        }
        const newRequest: Omit<CancellationRequest, 'id'> = {
            trackingNumber: tn,
            requestedBy: { id: user.id, name: user.name },
            requestDate: Timestamp.now(),
            status: 'pending',
            isDispatched,
        };
        const docRef = doc(requestsCol);
        batch.set(docRef, newRequest);
    }

    await batch.commit();
    return { alreadyDispatched };
};

export const getCancellationRequests = async (warehouseId?: string): Promise<CancellationRequest[]> => {
    const q: Query = query(collection(db, 'cancellationRequests'));
    const requestsSnapshot = await getDocs(q);

    let requestList: CancellationRequest[] = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            requestDate: (data.requestDate as Timestamp).toDate().toISOString(),
            isDispatched: !!data.isDispatched,
            warehouseId: data.warehouseId || DEFAULT_WAREHOUSE_ID,
        } as CancellationRequest;
    });

    const allWarehouses = await getWarehouses();
    
    if (warehouseId && warehouseId !== 'all') {
        requestList = requestList.filter(req => req.warehouseId === warehouseId);
    }

    return requestList.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
};
    
export const updateCancellationRequestStatus = async (requestId: string, status: 'completed' | 'rejected', user: User | null): Promise<void> => {
    const requestRef = doc(db, 'cancellationRequests', requestId);

    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists()) {
            throw new Error("Solicitud de anulación no encontrada.");
        }
        
        const requestData = requestSnap.data() as CancellationRequest;

        if (status === 'completed') {
            console.warn(`La guía ${requestData.trackingNumber} fue marcada como anulada. La reversión de stock debe manejarse por separado si no es una excepción.`);
        }
        
        transaction.update(requestRef, { status });
    });
};
    
export const getWarehouses = async (): Promise<Warehouse[]> => {
    const warehousesCol = collection(db, 'warehouses');
    const warehouseSnapshot = await getDocs(warehousesCol);
    if (warehouseSnapshot.empty) {
        // Seed initial data if collection is empty
        const batch = writeBatch(db);
        const initialWarehouses: Warehouse[] = [
            { id: 'wh-bog', name: 'Bodega INGENIO' },
        ];
        initialWarehouses.forEach(wh => {
            const docRef = doc(warehousesCol, wh.id);
            batch.set(docRef, { name: wh.name });
        });
        await batch.commit();
        return initialWarehouses;
    }
    const warehouseList = warehouseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
    return warehouseList;
};

export const addWarehouse = async (name: string): Promise<string> => {
    const warehousesCol = collection(db, 'warehouses');
    const newId = `wh-${name.toLowerCase().replace(/\s+/g, '-').slice(0, 10)}`;
    const docRef = doc(warehousesCol, newId);
    await setDoc(docRef, { name });
    return newId;
};

export const updateWarehouse = async (id: string, name: string): Promise<void> => {
    const warehouseRef = doc(db, 'warehouses', id);
    await updateDoc(warehouseRef, { name });
};

export async function getDashboardData(filters: { dateRange?: { from?: Date; to?: Date }; warehouseId?: string; platformIds: string[]; carrierIds: string[]; categoryIds: string[]; productIds: string[] }): Promise<DashboardData> {
    const { from: fromDate, to: toDate } = filters.dateRange || {};
    const fromDateStart = fromDate ? startOfDay(fromDate) : null;
    const toDateEnd = toDate ? endOfDay(toDate) : null;
    const { warehouseId } = filters;
    
    // Pass warehouseId filter to the data fetching functions
    const [ordersResult, movementsResult, allProducts, allCategories, allPlatforms, allCarriers] = await Promise.all([
        getDispatchOrders({ fetchAll: true, filters: { startDate: fromDateStart?.toISOString(), endDate: toDateEnd?.toISOString(), warehouseId } }),
        getInventoryMovements({ fetchAll: true, filters: { startDate: fromDateStart?.toISOString(), endDate: toDateEnd?.toISOString(), warehouseId } }),
        getProducts({ fetchAll: true, filters: { warehouseId } }),
        getCategories(),
        getPlatforms(),
        getCarriers(),
    ]);

    let filteredOrders = ordersResult.orders;
    let filteredMovements = movementsResult.movements;
  
    const productIdsInCategory = filters.categoryIds.length > 0
      ? allProducts.products.filter(p => p.categoryId && filters.categoryIds.includes(p.categoryId)).map(p => p.id)
      : null;
    
    const platformNameMap = allPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    const carrierNameMap = allCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);
    const allCarrierNames = allCarriers.map(c => c.name);
    
    const ordersInPeriod = filteredOrders.filter(order => {
        const platformMatch = filters.platformIds.length === 0 || filters.platformIds.includes(order.platformId);
        const carrierMatch = filters.carrierIds.length === 0 || filters.carrierIds.includes(order.carrierId);
        
        let productMatch = true;
        if (filters.productIds.length > 0) {
            productMatch = order.products.some(p => filters.productIds.includes(p.productId));
        } else if (productIdsInCategory) {
            productMatch = order.products.some(p => productIdsInCategory.includes(p.productId));
        }
    
        return platformMatch && carrierMatch && productMatch;
    });

    const movementsInPeriod = filteredMovements.filter(m => {
        let productMatch = true;
        if (filters.productIds.length > 0) {
            productMatch = filters.productIds.includes(m.productId);
        } else if (productIdsInCategory) {
            productMatch = productIdsInCategory.includes(m.productId);
        }
        return productMatch;
    });
  
    const ordersByDay: Record<string, number> = {};
    const annulledByDay: Record<string, number> = {};

    ordersInPeriod.forEach(order => {
        const day = format(order.date, 'yyyy-MM-dd');

        let dispatchedInOrder = order.products.reduce((sum, p) => sum + p.quantity, 0);

        if (order.status === 'Parcial' && order.exceptions) {
            const exceptionsTotal = order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            dispatchedInOrder -= exceptionsTotal;
        }

        if (order.cancelledExceptions) {
            const cancelledTotal = order.cancelledExceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            annulledByDay[day] = (annulledByDay[day] || 0) + cancelledTotal;
            dispatchedInOrder -= cancelledTotal;
        }
        ordersByDay[day] = (ordersByDay[day] || 0) + dispatchedInOrder;
    });

    const totalItemsDispatched = Object.values(ordersByDay).reduce((sum, count) => sum + count, 0);
    const totalAnnulledItems = Object.values(annulledByDay).reduce((sum, count) => sum + count, 0);

    let totalAdjustIn = 0;
    let totalAdjustOut = 0;
    const adjustInByDay: Record<string, number> = {};
    const adjustOutByDay: Record<string, number> = {};

    movementsInPeriod.forEach(m => {
        const day = format(new Date(m.date), 'yyyy-MM-dd');
        if (m.type === 'Ajuste de Entrada') {
            totalAdjustIn += m.quantity;
            adjustInByDay[day] = (adjustInByDay[day] || 0) + m.quantity;
        } else if (m.type === 'Ajuste de Salida') {
            totalAdjustOut += m.quantity;
            adjustOutByDay[day] = (adjustOutByDay[day] || 0) + m.quantity;
        }
    });

    let totalPendingUnits = 0;
    const pendingUnitsByDay: Record<string, number> = {};
    ordersInPeriod
        .filter(o => o.status === 'Pendiente' || o.status === 'Parcial')
        .forEach(order => {
            const day = format(order.date, 'yyyy-MM-dd');
            let unitsInOrder = 0;
            if (order.status === 'Pendiente') {
                unitsInOrder = order.totalItems;
            } else if (order.status === 'Parcial' && order.exceptions) {
                unitsInOrder = order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            }
            totalPendingUnits += unitsInOrder;
            pendingUnitsByDay[day] = (pendingUnitsByDay[day] || 0) + unitsInOrder;
    });
  
    let totalReturns = 0;
    const returnsByDay: Record<string, number> = {};
    movementsInPeriod
        .filter(m => m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia')))
        .forEach(m => {
            totalReturns += m.quantity;
            const day = format(new Date(m.date), 'yyyy-MM-dd');
            returnsByDay[day] = (returnsByDay[day] || 0) + m.quantity;
    });
  
    const chartData = [];
    const pendingChartData = [];
    const returnsChartData = [];
    const annulledChartData = [];
    const adjustInChartData = [];
    const adjustOutChartData = [];

    if (fromDate && toDate) {
        let currentDate = startOfDay(fromDate);
        while (currentDate <= toDate) {
            const dayKey = format(currentDate, 'yyyy-MM-dd');
            chartData.push({ date: dayKey, orders: ordersByDay[dayKey] || 0 });
            pendingChartData.push({ date: dayKey, orders: pendingUnitsByDay[dayKey] || 0 });
            returnsChartData.push({ date: dayKey, returns: returnsByDay[dayKey] || 0 });
            annulledChartData.push({ date: dayKey, annulled: annulledByDay[dayKey] || 0 });
            adjustInChartData.push({ date: dayKey, value: adjustInByDay[dayKey] || 0 });
            adjustOutChartData.push({ date: dayKey, value: adjustOutByDay[dayKey] || 0 });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
  
    const productInfoMap = allProducts.products.reduce((acc, product) => ({ ...acc, [product.id]: product }), {} as Record<string, Product>);
    const categoryNameMap = allCategories.reduce((acc, category) => ({ ...acc, [category.id]: category.name }), {} as Record<string, string>);
  
    const salesByProduct: Record<string, { total: number; variants: Record<string, number> }> = {};
    let totalItemsSold = 0;
    ordersInPeriod.forEach(order => {
        order.products.forEach(p => {
            const product = productInfoMap[p.productId];
            if (!product) return;
            if (!salesByProduct[p.productId]) {
                salesByProduct[p.productId] = { total: 0, variants: {} };
            }
            salesByProduct[p.productId].total += p.quantity;
            if (p.variantId) {
                if (!salesByProduct[p.productId].variants[p.variantId]) {
                    salesByProduct[p.productId].variants[p.variantId] = 0;
                }
                salesByProduct[p.productId].variants[p.variantId] += p.quantity;
            }
            totalItemsSold += p.quantity;
        });
    });

    const productChartData = Object.entries(salesByProduct).map(([productId, salesData]) => {
        const product = productInfoMap[productId];
        return {
            id: productId,
            name: product.name,
            productType: product.productType,
            value: salesData.total,
            percentage: totalItemsSold > 0 ? (salesData.total / totalItemsSold) * 100 : 0,
            variants: product.variants?.map(v => ({ ...v, sales: salesData.variants[v.id] || 0 })) || [],
        };
    }).sort((a, b) => b.value - a.value);

    const salesByCategory: Record<string, number> = {};
    Object.entries(salesByProduct).forEach(([productId, salesData]) => {
        const product = productInfoMap[productId];
        if (product?.categoryId) {
            salesByCategory[product.categoryId] = (salesByCategory[product.categoryId] || 0) + salesData.total;
        }
    });

    const categoryChartData = Object.entries(salesByCategory).map(([categoryId, count]) => ({
        name: categoryNameMap[categoryId] || 'Unknown',
        value: count,
        percentage: totalItemsSold > 0 ? (count / totalItemsSold) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    const platformCarrierMap: { [platformName: string]: { [carrierName: string]: number } } = {};
    allPlatforms.forEach(p => {
        platformCarrierMap[p.name] = {};
    });

    const platformOrderCount: { [platformName: string]: number } = {};
    const carrierUsageCount: { [carrierName: string]: number } = {};
    let totalProductsShipped = 0;
    const dailyDispatchSummaryData: Record<string, Record<string, Record<string, number>>> = {};

    ordersInPeriod.forEach(order => {
        const platformName = platformNameMap[order.platformId] || 'Unknown Platform';
        const carrierName = carrierNameMap[order.carrierId] || 'Unknown Carrier';

        if (platformName !== 'Unknown Platform' && carrierName !== 'Unknown Carrier') {
            if (!platformCarrierMap[platformName]) {
                platformCarrierMap[platformName] = {};
            }
            platformCarrierMap[platformName][carrierName] = (platformCarrierMap[platformName][carrierName] || 0) + order.totalItems;
        }

        platformOrderCount[platformName] = (platformOrderCount[platformName] || 0) + 1;
        if(carrierName !== 'Unknown Carrier') {
            carrierUsageCount[carrierName] = (carrierUsageCount[carrierName] || 0) + order.totalItems;
        }
        totalProductsShipped += order.totalItems;
        const day = format(order.date, 'yyyy-MM-dd');
        const guideCount = order.trackingNumbers?.length || 0;
        if (guideCount > 0 && carrierName !== 'Unknown Carrier' && platformName !== 'Unknown Platform') {
            if (!dailyDispatchSummaryData[day]) dailyDispatchSummaryData[day] = {};
            if (!dailyDispatchSummaryData[day][carrierName]) dailyDispatchSummaryData[day][carrierName] = {};
            dailyDispatchSummaryData[day][carrierName][platformName] = (dailyDispatchSummaryData[day][carrierName][platformName] || 0) + guideCount;
        }
    });

    const platformCarrierChartData = Object.entries(platformCarrierMap).map(([platformName, carriers]) => {
      const chartEntry: { [key: string]: string | number } = { name: platformName };
      allCarrierNames.forEach(carrierName => {
        chartEntry[carrierName] = carriers[carrierName] || 0;
      });
      return chartEntry;
    });

    const mostUsedCarrierEntry = Object.entries(carrierUsageCount).sort((a, b) => b[1] - a[1])[0];
    const platformWithMostOrdersEntry = Object.entries(platformOrderCount).sort((a, b) => b[1] - a[1])[0];
    
    return {
      totalItemsDispatched: totalItemsDispatched,
      totalAnnulledItems,
      totalPendingUnits,
      totalReturns,
      totalAdjustIn,
      totalAdjustOut,
      chartData,
      pendingChartData,
      returnsChartData,
      annulledChartData,
      adjustInChartData,
      adjustOutChartData,
      productChartData,
      categoryChartData,
      platformCarrierChartData,
      allCarrierNames,
      mostUsedCarrier: {
        name: mostUsedCarrierEntry?.[0] || 'N/A',
        count: mostUsedCarrierEntry?.[1] || 0,
        percentage: totalProductsShipped > 0 ? ((mostUsedCarrierEntry?.[1] || 0) / totalProductsShipped) * 100 : 0,
      },
      platformWithMostOrders: {
        name: platformWithMostOrdersEntry?.[0] || 'N/A',
        count: platformWithMostOrdersEntry?.[1] || 0,
        percentage: ordersInPeriod.length > 0 ? ((platformWithMostOrdersEntry?.[1] || 0) / ordersInPeriod.length) * 100 : 0,
      },
      dailyDispatchSummaryData,
    };
}
