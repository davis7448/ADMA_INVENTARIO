

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db } from './firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where, Timestamp, runTransaction, writeBatch, deleteDoc, documentId, setDoc, limit, startAfter, orderBy, Query, DocumentSnapshot } from "firebase/firestore";
import type { Product, Supplier, Order, ReturnRequest, User, InventoryMovement, Category, Carrier, Platform, DispatchOrder, DispatchOrderProduct, DispatchException, AuditAlert, PendingInventoryItem, RotationCategory, ProductPerformanceData, Vendedor, Reservation, StaleReservationAlert, StockAlertItem, GetStockAlertsResult, LogisticItem, EntryReason, CancellationRequest } from './types';
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
export const getProducts = async ({ page = 1, limit: itemsPerPage = 20, filters = {} }: { page?: number, limit?: number, filters?: any } = {}): Promise<{ products: Product[], totalPages: number }> => {
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(productsCol);
    let productList = productSnapshot.docs.map(doc => {
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
  
    const productsWithData = productList.map(product => ({
      ...product,
      reservations: reservationsByProductId[product.id] || [],
    }));

    const filteredProducts = productsWithData.filter(product => {
        const { searchQuery, selectedCategory, selectedRotation, selectedVendedor, minStock, hasPending, hasReservations, onlyAudited } = filters;
        
        const lowercasedQuery = searchQuery?.toLowerCase() || '';
        const searchMatch = !searchQuery || searchQuery.length <= 2
            ? true
            : product.name.toLowerCase().includes(lowercasedQuery) || 
              (product.sku && product.sku.toLowerCase().includes(lowercasedQuery)) ||
              (product.productType === 'variable' && product.variants?.some(variant => 
                  variant.name.toLowerCase().includes(lowercasedQuery) ||
                  variant.sku.toLowerCase().includes(lowercasedQuery)
              ));
        
        const categoryMatch = !selectedCategory || selectedCategory === 'all' || product.categoryId === selectedCategory;
        const rotationMatch = !selectedRotation || selectedRotation === 'all' || product.rotationCategoryName === selectedRotation;
        const stockMatch = !minStock || product.stock >= parseInt(minStock, 10);
        const pendingMatch = !hasPending || (product.pendingStock && product.pendingStock > 0);
        const reservationsMatch = !hasReservations || (product.reservations && product.reservations.length > 0);
        const auditedMatch = !onlyAudited || !!product.lastAuditedAt;
        const vendedorMatch = !selectedVendedor || selectedVendedor === 'all' || (product.reservations && product.reservations.some(r => r.vendedorId === selectedVendedor));

        return searchMatch && categoryMatch && rotationMatch && stockMatch && pendingMatch && reservationsMatch && auditedMatch && vendedorMatch;
    });

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return { products: paginatedProducts, totalPages };
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
        delete dataToAdd.purchaseDate; 
    }
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
  
  // This logic is important to prevent non-admins from clearing the cost
  if (productUpdate.cost === undefined) {
    delete updateData.cost;
  }

  await updateDoc(productRef, updateData);
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
    const movementsCol = collection(db, 'inventoryMovements');
    
    const querySnapshot = await getDocs(query(movementsCol, orderBy('date', 'desc')));
    const allMovements = querySnapshot.docs.map(doc => {
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
          date: formattedDate,
        } as InventoryMovement
    });

    const filteredMovements = allMovements.filter(movement => {
        const { startDate, endDate, productId, platformId, carrierId, movementType } = filters;
        const movementDate = new Date(movement.date);
        
        const dateMatch = (!startDate || movementDate >= new Date(startDate)) && (!endDate || movementDate <= new Date(endDate));
        const productMatch = !productId || productId === 'all' || movement.productId === productId;
        const platformMatch = !platformId || platformId === 'all' || movement.platformId === platformId;
        const carrierMatch = !carrierId || carrierId === 'all' || movement.carrierId === carrierId;
        const typeMatch = !movementType || movementType === 'all' || movement.type === movementType;

        return dateMatch && productMatch && platformMatch && carrierMatch && typeMatch;
    });

    if (fetchAll) {
        return { movements: filteredMovements, totalPages: 1, totalCount: filteredMovements.length };
    }

    const totalCount = filteredMovements.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginatedMovements = filteredMovements.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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

export const registerInventoryEntry = async (items: (LogisticItem & { trackingNumber?: string })[], user: User | null, entryReasonLabel: string, supplierId?: string, carrierId?: string): Promise<void> => {

    for (const item of items) {
        await runTransaction(db, async (transaction) => {
            await updateProductStock(transaction, item.productId, item.quantity, 'add', item.sku);
        });
        
        let reasonText = entryReasonLabel;
        if (supplierId) {
            const supplier = await getSupplierById(supplierId);
            reasonText = `${reasonText}: ${supplier?.name || 'Desconocido'}`;
        }
        if (carrierId) {
            const carriers = await getCarriers();
            const carrier = carriers.find(c => c.id === carrierId);
            reasonText = `${reasonText} (Transportadora: ${carrier?.name || 'Desconocido'})`;
        }

        if (item.trackingNumber) {
            reasonText = `${reasonText} | Guía: ${item.trackingNumber}`;
        }

        await addInventoryMovement({
            type: 'Entrada',
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            notes: reasonText,
            userId: user?.id,
            userName: user?.name,
            carrierId,
        });
    }
};
    
// Dispatch Order Functions

export const createDispatchOrder = async ({ platformId, carrierId, products, createdBy }: Omit<DispatchOrder, 'id' | 'status' | 'date' | 'totalItems' | 'trackingNumbers' | 'exceptions' | 'cancelledExceptions' | 'dispatchId'>): Promise<{ id: string, dispatchId: string, date: Date }> => {
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
            userName: createdBy?.name
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
    const ordersCol = collection(db, 'dispatchOrders');
    
    const querySnapshot = await getDocs(query(ordersCol, orderBy('date', 'desc')));
    let allOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: parseFirestoreDate(doc.data().date) } as DispatchOrder));

    const { startDate, endDate, productId, platformId, carrierId } = filters;

    if (startDate || endDate || productId || platformId || carrierId) {
        allOrders = allOrders.filter(order => {
            const orderDate = new Date(order.date);
            const dateMatch = (!startDate || orderDate >= new Date(startDate)) && (!endDate || orderDate <= new Date(endDate));
            const productMatch = !productId || productId === 'all' || order.products.some(p => p.productId === productId);
            const platformMatch = !platformId || platformId === 'all' || order.platformId === platformId;
            const carrierMatch = !carrierId || carrierId === 'all' || order.carrierId === carrierId;
            return dateMatch && productMatch && platformMatch && carrierMatch;
        });
    }
    
    if (fetchAll) {
        return { orders: allOrders, totalPages: 1 };
    }

    const totalPages = Math.ceil(allOrders.length / itemsPerPage);
    const paginatedOrders = allOrders.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return { orders: paginatedOrders, totalPages };
}


export const getPendingDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Pendiente'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            ...data,
            date: parseFirestoreDate(data.date),
        } as DispatchOrder
    });
}

export const getPartialDispatchOrders = async (): Promise<DispatchOrder[]> => {
    const q = query(collection(db, 'dispatchOrders'), where('status', '==', 'Parcial'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            ...data,
            date: parseFirestoreDate(data.date),
        } as DispatchOrder
    });
}

export const processDispatch = async (orderId: string, trackingNumbers: string[], newExceptions: DispatchException[]) => {
    const orderRef = doc(db, 'dispatchOrders', orderId);

    if (trackingNumbers.length > 0) {
        const cancellationRequestsCol = collection(db, 'cancellationRequests');
        const cancellationQuery = query(cancellationRequestsCol, where('trackingNumber', 'in', trackingNumbers), where('status', '==', 'pending'));
        const cancellationSnapshot = await getDocs(cancellationQuery);

        if (!cancellationSnapshot.empty) {
            const cancelledGuide = cancellationSnapshot.docs[0].data().trackingNumber;
            throw new Error(`La guía ${cancelledGuide} tiene una solicitud de anulación pendiente y no puede ser despachada.`);
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
    productsToCancel: { productId: string; variantId?: string; quantity: number }[],
    user: User | null,
    cancellationGuide: string
): Promise<Partial<DispatchOrder>> => {
    const orderRef = doc(db, 'dispatchOrders', orderId);
    let movementPromises: Promise<any>[] = [];

    const result = await runTransaction(db, async (transaction) => {
        // --- ALL READS MUST HAPPEN FIRST ---
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
            throw new Error("No se encontró la orden de despacho.");
        }
        
        const productIdsToRead = [...new Set(productsToCancel.map(p => p.productId))];
        const productRefs = productIdsToRead.map(id => doc(db, 'products', id));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        const reqQuery = query(collection(db, 'cancellationRequests'), where('trackingNumber', '==', cancellationGuide), where('status', '==', 'pending'));
        const reqSnap = await getDocs(reqQuery); // This is a read
        
        // --- PROCESS DATA AND PREPARE WRITES ---
        const orderData = orderSnap.data() as DispatchOrder;
        const isFromException = (orderData.exceptions || []).some(ex => ex.trackingNumber === cancellationGuide);
        
        const productDataMap = new Map<string, Product>();
        for (const snap of productSnaps) {
            if (snap.exists()) {
                productDataMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            }
        }

        for (const itemToCancel of productsToCancel) {
            const productData = productDataMap.get(itemToCancel.productId);
            if (!productData) {
                throw new Error(`Producto ${itemToCancel.productId} no encontrado.`);
            }

            let variantSkuToUpdate: string | undefined;
            if (itemToCancel.variantId) {
                const variant = productData.variants?.find(v => v.id === itemToCancel.variantId);
                variantSkuToUpdate = variant?.sku;
            } else {
                variantSkuToUpdate = productData.sku;
            }

            if (!variantSkuToUpdate) {
                throw new Error(`SKU no encontrado para el producto a anular.`);
            }
            
            if (isFromException) {
                const currentPending = productData.pendingStock || 0;
                const newPending = Math.max(0, currentPending - itemToCancel.quantity);
                transaction.update(doc(db, 'products', itemToCancel.productId), { pendingStock: newPending });
            } 
            
            await updateProductStock(transaction, itemToCancel.productId, itemToCancel.quantity, 'add', variantSkuToUpdate);

            movementPromises.push(addInventoryMovement({
                type: 'Anulado',
                productId: itemToCancel.productId,
                productName: productData.name,
                quantity: itemToCancel.quantity,
                notes: `Anulación de guía ${cancellationGuide} en despacho ${orderData.dispatchId} por ${user?.name}.`,
                platformId: orderData.platformId,
                carrierId: orderData.carrierId,
                dispatchId: orderData.dispatchId,
                userId: user?.id,
                userName: user?.name,
            }));
        }

        const updatedProducts: DispatchOrderProduct[] = JSON.parse(JSON.stringify(orderData.products));
        const updatedExceptions: DispatchException[] = JSON.parse(JSON.stringify(orderData.exceptions || []));

        for (const itemToCancel of productsToCancel) {
            const productInOrderIndex = updatedProducts.findIndex(p => p.productId === itemToCancel.productId && (p.variantId || undefined) === (itemToCancel.variantId || undefined));
            if (productInOrderIndex !== -1) {
                updatedProducts[productInOrderIndex].quantity -= itemToCancel.quantity;
                if (updatedProducts[productInOrderIndex].quantity <= 0) {
                    updatedProducts.splice(productInOrderIndex, 1);
                }
            }

            if (isFromException) {
                const exceptionIndex = updatedExceptions.findIndex(ex => ex.trackingNumber === cancellationGuide);
                if (exceptionIndex > -1) {
                    const productInExIndex = updatedExceptions[exceptionIndex].products.findIndex(p => p.productId === itemToCancel.productId && (p.variantId || undefined) === (itemToCancel.variantId || undefined));
                    if (productInExIndex !== -1) {
                        updatedExceptions[exceptionIndex].products[productInExIndex].quantity -= itemToCancel.quantity;
                        if (updatedExceptions[exceptionIndex].products[productInExIndex].quantity <= 0) {
                            updatedExceptions[exceptionIndex].products.splice(productInExIndex, 1);
                        }
                    }
                    if (updatedExceptions[exceptionIndex].products.length === 0) {
                        updatedExceptions.splice(exceptionIndex, 1);
                    }
                }
            }
        }
        
        const newTotalItems = updatedProducts.reduce((sum, p) => sum + p.quantity, 0);

        let finalStatus = orderData.status;
        if (newTotalItems === 0) {
            finalStatus = 'Anulada';
        } else if (updatedExceptions.length === 0 && (orderData.trackingNumbers.length > 0 || cancellationGuide)) {
            finalStatus = 'Despachada';
        }

        const updatePayload = {
            products: updatedProducts,
            totalItems: newTotalItems,
            exceptions: updatedExceptions,
            status: finalStatus,
        };

        // --- ALL WRITES HAPPEN AT THE END ---
        transaction.update(orderRef, updatePayload);
        
        if (!reqSnap.empty) {
            const reqDoc = reqSnap.docs[0];
            transaction.update(reqDoc.ref, { status: 'completed' });
        }
        
        return updatePayload;
    });
    
    // Execute non-transactional writes after the transaction is complete
    await Promise.all(movementPromises);

    return result;
};


// Audit Alert Functions
export const getAuditAlerts = async (): Promise<AuditAlert[]> => {
    const alertsCol = collection(db, 'auditAlerts');
    const alertSnapshot = await getDocs(query(alertsCol));
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
export const getPendingInventory = async (): Promise<PendingInventoryItem[]> => {
    const productsResult = await getProducts({ limit: 10000 });
    const productsById = new Map(productsResult.products.map(p => [p.id, p]));

    const dispatchOrders = await getPartialDispatchOrders();
    
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
export const getAllReservations = async (): Promise<Reservation[]> => {
    const q = query(collection(db, 'reservations'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            date: parseFirestoreDate(data.date).toISOString(),
        } as Reservation;
    });
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
export const getStaleReservationAlerts = async (): Promise<StaleReservationAlert[]> => {
    const alertsCol = collection(db, 'staleReservationAlerts');
    const alertSnapshot = await getDocs(query(alertsCol));
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
export const getOrGenerateStockAlerts = async (forceRegenerate = false): Promise<GetStockAlertsResult> => {
    const metadataRef = doc(db, 'stockAlertsCache', 'metadata');
    
    try {
        if (!forceRegenerate) {
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                const lastGenerated = (metadataSnap.data().lastGenerated as Timestamp).toDate();
                if (isToday(lastGenerated)) {
                    const alertsCol = collection(db, 'stockAlertsCache');
                    const q = query(alertsCol, where(documentId(), '!=', 'metadata'));
                    const alertSnapshot = await getDocs(q);
                    const alerts = alertSnapshot.docs.map(d => d.data() as StockAlertItem);
                    return { alerts, lastGenerated: lastGenerated.toISOString() };
                }
            }
        }

        const [productsResult, allMovementsResult] = await Promise.all([
            getProducts({ limit: 10000 }),
            getInventoryMovements({ limit: 10000, fetchAll: true, filters: { startDate: subDays(new Date(), 7).toISOString() } }),
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
        batch.set(metadataRef, { lastGenerated: newGeneratedDate });
        await batch.commit();

        return { alerts: newAlerts, lastGenerated: newGeneratedDate.toISOString() };

    } catch (e: any) {
        console.error("Failed to generate stock alerts:", e);
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

export const getCancellationRequests = async (): Promise<CancellationRequest[]> => {
    const requestsCol = collection(db, 'cancellationRequests');

    const requestsSnapshot = await getDocs(requestsCol);

    const requestList: CancellationRequest[] = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            requestDate: (data.requestDate as Timestamp).toDate().toISOString(),
            isDispatched: !!data.isDispatched,
        } as CancellationRequest;
    });

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
    
    

    


    



















    










    






    


    

