

import { db } from './firebase';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    where,
    Timestamp,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc,
    setDoc
} from "firebase/firestore";
import type {
    CommercialClient,
    CommercialChallenge,
    CommercialRating,
    AcademyResource,
    ClientStatus
} from "../types/commercial";
import type { Product } from '@/lib/types';
import { startOfDay, endOfDay } from 'date-fns';

// --- CLIENTS ---

export interface ClientExistsResult {
    exists: boolean;
    client?: CommercialClient & { assigned_commercial_name?: string };
}

export const checkClientExists = async (email: string, phone: string): Promise<ClientExistsResult> => {
    try {
        const clientsCol = collection(db, 'clients');
        
        // Buscar por email principal
        const emailQuery = query(clientsCol, where('email', '==', email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
            const doc = emailSnapshot.docs[0];
            const data = doc.data();
            return {
                exists: true,
                client: {
                    id: doc.id,
                    ...data,
                    assigned_commercial_name: data.assigned_commercial_name
                } as CommercialClient & { assigned_commercial_name?: string }
            };
        }
        
        // Buscar por emails adicionales
        const additionalEmailQuery = query(clientsCol, where('additional_emails', 'array-contains', email));
        const additionalEmailSnapshot = await getDocs(additionalEmailQuery);
        
        if (!additionalEmailSnapshot.empty) {
            const doc = additionalEmailSnapshot.docs[0];
            const data = doc.data();
            return {
                exists: true,
                client: {
                    id: doc.id,
                    ...data,
                    assigned_commercial_name: data.assigned_commercial_name
                } as CommercialClient & { assigned_commercial_name?: string }
            };
        }
        
        // Buscar por teléfono principal
        const phoneQuery = query(clientsCol, where('phone', '==', phone));
        const phoneSnapshot = await getDocs(phoneQuery);
        
        if (!phoneSnapshot.empty) {
            const doc = phoneSnapshot.docs[0];
            const data = doc.data();
            return {
                exists: true,
                client: {
                    id: doc.id,
                    ...data,
                    assigned_commercial_name: data.assigned_commercial_name
                } as CommercialClient & { assigned_commercial_name?: string }
            };
        }
        
        // Buscar por teléfonos adicionales
        const additionalPhoneQuery = query(clientsCol, where('additional_phones', 'array-contains', phone));
        const additionalPhoneSnapshot = await getDocs(additionalPhoneQuery);
        
        if (!additionalPhoneSnapshot.empty) {
            const doc = additionalPhoneSnapshot.docs[0];
            const data = doc.data();
            return {
                exists: true,
                client: {
                    id: doc.id,
                    ...data,
                    assigned_commercial_name: data.assigned_commercial_name
                } as CommercialClient & { assigned_commercial_name?: string }
            };
        }
        
        return { exists: false };
    } catch (error: any) {
        // Manejar errores de permisos - si no tiene permiso para leer otros clientes,
        // asumimos que no existe (el usuario podrá intentar crearlo)
        if (error.code === 'permission-denied') {
            console.warn("Permission denied when checking client existence. Assuming client does not exist.");
            return { exists: false };
        }
        console.error("Error checking client exists:", error);
        // En lugar de lanzar error, devolvemos false para no bloquear al usuario
        return { exists: false };
    }
};

export const createClient = async (client: CommercialClient): Promise<string> => {
    try {
        const clientsCol = collection(db, 'clients');
        const docRef = await addDoc(clientsCol, {
            ...client,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating client:", error);
        throw new Error("Failed to create client");
    }
};

export const updateClient = async (clientId: string, data: Partial<CommercialClient>) => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        await updateDoc(clientRef, {
            ...data,
            updated_at: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating client:", error);
        throw new Error("Failed to update client");
    }
};

export const getClientsByCommercial = async (commercialId: string): Promise<CommercialClient[]> => {
    try {
        const clientsCol = collection(db, 'clients');
        const q = query(clientsCol, where('assigned_commercial_id', '==', commercialId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate(),
            updated_at: doc.data().updated_at?.toDate(),
            birthday: doc.data().birthday?.toDate ? doc.data().birthday.toDate() : doc.data().birthday
        } as CommercialClient));
    } catch (error) {
        console.error("Error fetching clients:", error);
        return [];
    }
};

export const getAllClients = async (userRole?: string, userId?: string): Promise<CommercialClient[]> => {
    try {
        // Si es comercial (no admin/director/plataformas), usar getClientsByCommercial en su lugar
        if (userRole === 'commercial' && userId) {
            console.warn("Commercial users should use getClientsByCommercial instead of getAllClients");
            return getClientsByCommercial(userId);
        }
        
        const clientsCol = collection(db, 'clients');
        const snapshot = await getDocs(clientsCol);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate(),
            updated_at: doc.data().updated_at?.toDate(),
            birthday: doc.data().birthday?.toDate ? doc.data().birthday.toDate() : doc.data().birthday
        } as CommercialClient));
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.error("Permission denied when fetching all clients. User may not have admin/director/plataformas role.");
        } else {
            console.error("Error fetching all clients:", error);
        }
        return [];
    }
};

// Obtener usuario por ID para obtener nombre del comercial
export const getUserById = async (userId: string): Promise<{id: string, name: string, email: string, role: string} | null> => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            return {
                id: userSnap.id,
                name: data.name || 'Usuario',
                email: data.email || '',
                role: data.role || 'commercial'
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
};

export const getClientById = async (clientId: string): Promise<CommercialClient | null> => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const data = clientSnap.data();
            return {
                id: clientSnap.id,
                ...data,
                created_at: data.created_at?.toDate(),
                updated_at: data.updated_at?.toDate(),
                birthday: data.birthday?.toDate ? data.birthday.toDate() : data.birthday
            } as CommercialClient;
        }
        return null;
    } catch (error) {
        console.error("Error fetching client by id:", error);
        return null;
    }
};

// --- CHALLENGES ---

export const createChallenge = async (challenge: CommercialChallenge): Promise<string> => {
    try {
        const col = collection(db, 'commercial_challenges');
        const docRef = await addDoc(col, {
            ...challenge,
            created_at: serverTimestamp(),
            is_active: true
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating challenge:", error);
        throw new Error("Failed to create challenge");
    }
};

export const getActiveChallenges = async (type?: 'daily' | 'monthly'): Promise<CommercialChallenge[]> => {
    try {
        const col = collection(db, 'commercial_challenges');
        let q = query(col, where('is_active', '==', true));

        if (type) {
            q = query(q, where('type', '==', type));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate()
        } as CommercialChallenge));
    } catch (error) {
        console.error("Error fetching challenges:", error);
        return [];
    }
};

// --- RATINGS ---

export const addRating = async (rating: CommercialRating): Promise<void> => {
    try {
        // Check for daily limit: User can only give 1 rating per day
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const col = collection(db, 'commercial_ratings');
        const q = query(
            col,
            where('from_user_id', '==', rating.from_user_id),
            where('created_at', '>=', Timestamp.fromDate(todayStart)),
            where('created_at', '<=', Timestamp.fromDate(todayEnd))
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            throw new Error("Solo puedes otorgar una calificación por día.");
        }

        await addDoc(col, {
            ...rating,
            created_at: serverTimestamp()
        });
    } catch (error) {
        console.error("Error adding rating:", error);
        throw error;
    }
};

export const getRatingsForUser = async (userId: string): Promise<CommercialRating[]> => {
    try {
        const col = collection(db, 'commercial_ratings');
        const q = query(col, where('to_user_id', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate()
        } as CommercialRating));
    } catch (error) {
        console.error("Error fetching ratings:", error);
        return [];
    }
};

// --- ACADEMY ---

export const addAcademyResource = async (resource: AcademyResource): Promise<string> => {
    try {
        const col = collection(db, 'academy_resources');
        const docRef = await addDoc(col, {
            ...resource,
            created_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating resource:", error);
        throw new Error("Failed to create resource");
    }
}

export const getAcademyResources = async (): Promise<AcademyResource[]> => {
    try {
        const col = collection(db, 'academy_resources');
        const q = query(col, orderBy('created_at', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate()
        } as AcademyResource));
    } catch (error) {
        console.error("Error fetching resources:", error);
        return [];
    }
};

// --- CATALOG ---

export const getProductsForCatalog = async (): Promise<Product[]> => {
    try {
        const productsCol = collection(db, 'products');
        // Simple fetch, optimized for catalog which might need all items for client-side sort
        // In production with 1000+ items, we should implement paginated queries per tab.
        // For MVP, limit to 500.
        const q = query(productsCol, limit(500));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Handle potential date fields if they exist as timestamps
                // purchaseDate is often a string in this codebase, but let's be safe
                purchaseDate: data.purchaseDate // assuming string ISO
            } as Product;
        });
    } catch (error) {
        console.error("Error fetching catalog products:", error);
        return [];
    }
};

// --- USER FIX / MIGRATION ---

export const fixUserProfile = async (user: any) => {
    // Validación robusta de datos de entrada
    if (!user || typeof user !== 'object') {
        console.warn("fixUserProfile: Invalid user object provided");
        return;
    }

    // El ID del usuario puede venir en user.id (desde Firestore) o user.uid (desde Firebase Auth)
    const userId = user.id || user.uid;
    const userEmail = user.email;

    if (!userId) {
        console.warn("fixUserProfile: User ID is missing (neither user.id nor user.uid found)");
        return;
    }

    if (!userEmail || typeof userEmail !== 'string') {
        console.warn("fixUserProfile: User email is missing or invalid");
        return;
    }

    // Validar que el ID sea un string válido para Firestore
    if (typeof userId !== 'string' || userId.trim() === '') {
        console.warn("fixUserProfile: User ID must be a non-empty string");
        return;
    }

    try {
        // 1. Check if profile exists with correct UID
        const correctProfileRef = doc(db, 'users', userId);
        const correctProfileSnap = await getDoc(correctProfileRef);

        if (correctProfileSnap.exists()) {
            console.log("User profile is correct. ID:", userId);
            return;
        }

        // 2. If not, find by email
        const usersCol = collection(db, 'users');
        const q = query(usersCol, where('email', '==', userEmail));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            console.log("Found disconnected profile. Migrating to ID:", userId);
            const oldDoc = snapshot.docs[0];
            const oldData = oldDoc.data();

            // 3. Create new profile with correct UID
            await setDoc(correctProfileRef, {
                ...oldData,
                id: userId, // Ensure ID is updated in data too
                migratedFrom: oldDoc.id,
                updated_at: serverTimestamp()
            });

            console.log("Profile migrated successfully to", userId);

            // Optional: Delete old if we could, but likely lack permissions.
        } else {
            // 4. If no profile at all, create one? 
            // Maybe better to wait for manual creation, but for Commercial Reps this might be needed.
            console.warn("No user profile found for email:", userEmail);
        }

    } catch (error: any) {
        // Manejar específicamente errores de Firebase
        if (error.code === 'permission-denied') {
            console.error("Permission denied when fixing user profile. User may not have access to users collection.");
        } else if (error.message && error.message.includes('indexOf')) {
            console.error("Invalid document ID format:", userId);
        } else {
            console.error("Error fixing user profile:", error);
        }
    }
};
