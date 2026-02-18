

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
    setDoc,
    arrayUnion,
    type DocumentData
} from "firebase/firestore";
import type {
    CommercialClient,
    CommercialChallenge,
    CommercialRating,
    AcademyResource,
    ClientStatus,
    ClientTest,
    TaskPointsHistory
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
        
        // Convertir fechas a formato serializable (pero NO incluir history - ahora está en colección separada)
        const dataToSave: DocumentData = { ...data, updated_at: serverTimestamp() };
        
        // Eliminar campos que no deben guardarse directamente
        delete dataToSave.history;
        delete dataToSave.last_event_number;
        
        await setDoc(clientRef, dataToSave, { merge: true });
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
            
            // Convertir timestamps del historial a Date objects
            let convertedHistory: any[] = [];
            if (data.history && Array.isArray(data.history)) {
                convertedHistory = data.history.map((event: any) => ({
                    ...event,
                    created_at: event.created_at?.toDate 
                        ? event.created_at.toDate()
                        : event.created_at instanceof Date 
                            ? event.created_at 
                            : new Date(event.created_at)
                }));
            }
            
            return {
                id: clientSnap.id,
                ...data,
                history: convertedHistory,
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

// --- CLIENT TESTS / TESTING ---

export const createClientTest = async (test: Omit<ClientTest, 'id' | 'created_at'>): Promise<string> => {
    try {
        const testsCol = collection(db, 'client_tests');
        const docRef = await addDoc(testsCol, {
            ...test,
            created_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating client test:", error);
        throw error;
    }
};

export const getClientTests = async (clientId: string): Promise<ClientTest[]> => {
    try {
        const testsCol = collection(db, 'client_tests');
        const q = query(testsCol, where('clientId', '==', clientId), orderBy('created_at', 'desc'));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate() || doc.data().created_at
        } as ClientTest));
    } catch (error) {
        console.error("Error fetching client tests:", error);
        return [];
    }
};

export const deleteClientTest = async (testId: string): Promise<void> => {
    try {
        const testRef = doc(db, 'client_tests', testId);
        await deleteDoc(testRef);
    } catch (error) {
        console.error("Error deleting client test:", error);
        throw error;
    }
};

// --- CLIENT EVENTS (HISTORY) ---

export interface ClientEvent {
    id: string;
    clientId: string;
    type: 'status_change' | 'edit' | 'note' | 'order' | 'registered' | 'testing';
    description: string;
    details?: string;
    event_number: number;
    created_at: any;
    created_by: string;
    created_by_name?: string;
}

export const addClientEvent = async (
    clientId: string,
    type: ClientEvent['type'],
    description: string,
    userId: string,
    userName: string,
    details?: string
): Promise<string> => {
    try {
        // Get current event number
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        let currentEventNumber = 1;
        
        if (clientSnap.exists()) {
            const data = clientSnap.data();
            currentEventNumber = (data.last_event_number || 0) + 1;
        }
        
        // Create event
        const eventsCol = collection(db, 'client_events');
        const eventRef = await addDoc(eventsCol, {
            clientId,
            type,
            description,
            details,
            event_number: currentEventNumber,
            created_at: serverTimestamp(),
            created_by: userId,
            created_by_name: userName
        });
        
        // Update client's last_event_number
        await updateDoc(clientRef, { last_event_number: currentEventNumber });
        
        return eventRef.id;
    } catch (error) {
        console.error("Error adding client event:", error);
        throw error;
    }
};

export const getClientEvents = async (clientId: string): Promise<ClientEvent[]> => {
    try {
        const eventsCol = collection(db, 'client_events');
        const q = query(eventsCol, where('clientId', '==', clientId), orderBy('event_number', 'desc'));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate() || doc.data().created_at
        } as ClientEvent));
    } catch (error) {
        console.error("Error fetching client events:", error);
        return [];
    }
};

export const initializeClientEventsFromHistory = async (clientId: string, history: any[], currentEventNumber: number): Promise<void> => {
    try {
        if (!history || history.length === 0) return;
        
        const eventsCol = collection(db, 'client_events');
        const batch: Promise<any>[] = [];
        
        history.forEach((event: any) => {
            currentEventNumber++;
            batch.push(addDoc(eventsCol, {
                clientId,
                type: event.type || 'edit',
                description: event.description || 'Evento importado',
                details: event.details,
                event_number: currentEventNumber,
                created_at: event.created_at instanceof Date 
                    ? Timestamp.fromDate(event.created_at)
                    : event.created_at,
                created_by: event.created_by || 'Sistema',
                created_by_name: event.created_by_name
            }));
        });
        
        await Promise.all(batch);
        
        // Update client's last_event_number
        await updateDoc(doc(db, 'clients', clientId), { last_event_number: currentEventNumber });
        
        console.log(`[MIGRATION] Migrated ${history.length} events to client_events collection`);
    } catch (error) {
        console.error("Error migrating client events:", error);
    }
};

// ============================================
// 4DX SYSTEM - MCI (Metas Crucialmente Importantes)
// ============================================

import type { MCI, MDP, UserGamificationProfile, WeeklyHistory } from '@/types/commercial';
import { calculateStarsAndPoints, getCurrentWeekInfo, DEFAULT_LEVELS } from '@/types/commercial';

// Collection references
const MCI_COLLECTION = 'user_missions';
const GAMIFICATION_PROFILE_COLLECTION = 'user_gamification_profiles';

// Create new MCI
export const createMCI = async (mciData: Omit<MCI, 'id' | 'createdAt' | 'updatedAt' | 'completionPercentage' | 'pointsAwarded' | 'starsEarned'>): Promise<string> => {
    try {
        const now = Timestamp.now();
        const mdpsWithIds = mciData.mdps.map((mdp, index) => ({
            ...mdp,
            id: crypto.randomUUID(),
            order: index,
            isCompleted: false
        }));

        const newMCI: Omit<MCI, 'id'> = {
            ...mciData,
            mdps: mdpsWithIds,
            completionPercentage: 0,
            pointsAwarded: 0,
            starsEarned: 0,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, MCI_COLLECTION), newMCI);
        
        // Update user's gamification profile with current week MCI
        await updateUserCurrentMCI(mciData.userId, docRef.id);
        
        return docRef.id;
    } catch (error) {
        console.error("Error creating MCI:", error);
        throw error;
    }
};

// Get MCI by ID
export const getMCIById = async (mciId: string): Promise<MCI | null> => {
    try {
        const docRef = doc(db, MCI_COLLECTION, mciId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as MCI;
        }
        return null;
    } catch (error) {
        console.error("Error getting MCI:", error);
        return null;
    }
};

// Get user's MCI for specific week
export const getUserMCIForWeek = async (userId: string, weekNumber: number, year: number): Promise<MCI | null> => {
    try {
        const q = query(
            collection(db, MCI_COLLECTION),
            where('userId', '==', userId),
            where('weekNumber', '==', weekNumber),
            where('year', '==', year)
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as MCI;
        }
        return null;
    } catch (error) {
        console.error("Error getting user MCI for week:", error);
        return null;
    }
};

// Get all MCIs for a specific week (for leaderboard)
export const getAllMCIsForWeek = async (weekNumber: number, year: number): Promise<MCI[]> => {
    try {
        const q = query(
            collection(db, MCI_COLLECTION),
            where('weekNumber', '==', weekNumber),
            where('year', '==', year),
            orderBy('completionPercentage', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MCI);
    } catch (error) {
        console.error("Error getting all MCIs for week:", error);
        return [];
    }
};

// Update MCI
export const updateMCI = async (mciId: string, updates: Partial<MCI>): Promise<void> => {
    try {
        const docRef = doc(db, MCI_COLLECTION, mciId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error updating MCI:", error);
        throw error;
    }
};

// Delete MCI and recalculate user stats
export const deleteMCI = async (mciId: string): Promise<void> => {
    try {
        // Get MCI before deletion to know which user to update
        const mci = await getMCIById(mciId);
        if (!mci) throw new Error("MCI not found");
        
        const userId = mci.userId;
        
        // Delete the MCI
        await deleteDoc(doc(db, MCI_COLLECTION, mciId));
        
        // Recalculate user gamification stats (this will subtract points and update streak)
        await updateUserGamificationStats(userId);
        
    } catch (error) {
        console.error("Error deleting MCI:", error);
        throw error;
    }
};

// Toggle MDP completion
export const toggleMDP = async (mciId: string, mdpId: string, isCompleted: boolean): Promise<void> => {
    try {
        const mci = await getMCIById(mciId);
        if (!mci) throw new Error("MCI not found");
        
        // Update the specific MDP
        const updatedMdps = mci.mdps.map(mdp => {
            if (mdp.id === mdpId) {
                return {
                    ...mdp,
                    isCompleted,
                    completedAt: isCompleted ? Timestamp.now() : null
                };
            }
            return mdp;
        });
        
        // Calculate new completion percentage
        const completedCount = updatedMdps.filter(mdp => mdp.isCompleted).length;
        const completionPercentage = Math.round((completedCount / updatedMdps.length) * 100);
        
        // Calculate stars and points
        const { stars, points } = calculateStarsAndPoints(completionPercentage);
        
        // Determine status
        let status = mci.status;
        if (completionPercentage === 100) {
            status = 'completed';
        } else if (completionPercentage > 0) {
            status = 'active';
        }
        
        // Update MCI
        await updateDoc(doc(db, MCI_COLLECTION, mciId), {
            mdps: updatedMdps,
            completionPercentage,
            starsEarned: stars,
            pointsAwarded: points,
            status,
            completedAt: completionPercentage === 100 ? Timestamp.now() : null,
            updatedAt: Timestamp.now()
        });
        
        // Update user's gamification profile
        await updateUserGamificationStats(mci.userId);
        
    } catch (error) {
        console.error("Error toggling MDP:", error);
        throw error;
    }
};

// Add MDP to existing MCI
export const addMDPToMCI = async (mciId: string, mdp: Omit<MDP, 'id'>): Promise<void> => {
    try {
        const mci = await getMCIById(mciId);
        if (!mci) throw new Error("MCI not found");
        
        const newMdp: MDP = {
            ...mdp,
            id: crypto.randomUUID(),
            order: mci.mdps.length
        };
        
        const updatedMdps = [...mci.mdps, newMdp];
        
        // Recalculate completion percentage
        const completedCount = updatedMdps.filter(m => m.isCompleted).length;
        const completionPercentage = Math.round((completedCount / updatedMdps.length) * 100);
        
        await updateDoc(doc(db, MCI_COLLECTION, mciId), {
            mdps: updatedMdps,
            completionPercentage,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error adding MDP:", error);
        throw error;
    }
};

// Remove MDP from MCI
export const removeMDPFromMCI = async (mciId: string, mdpId: string): Promise<void> => {
    try {
        const mci = await getMCIById(mciId);
        if (!mci) throw new Error("MCI not found");
        
        const updatedMdps = mci.mdps.filter(mdp => mdp.id !== mdpId);
        
        // Recalculate completion percentage
        const completedCount = updatedMdps.filter(m => m.isCompleted).length;
        const completionPercentage = updatedMdps.length > 0 
            ? Math.round((completedCount / updatedMdps.length) * 100) 
            : 0;
        
        await updateDoc(doc(db, MCI_COLLECTION, mciId), {
            mdps: updatedMdps,
            completionPercentage,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error removing MDP:", error);
        throw error;
    }
};

// Get or create user gamification profile
export const getUserGamificationProfile = async (userId: string): Promise<UserGamificationProfile | null> => {
    try {
        const docRef = doc(db, GAMIFICATION_PROFILE_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { ...docSnap.data(), userId } as UserGamificationProfile;
        }
        return null;
    } catch (error) {
        console.error("Error getting gamification profile:", error);
        return null;
    }
};

// Create user gamification profile
export const createUserGamificationProfile = async (userId: string, userName: string, userAvatar?: string | null): Promise<void> => {
    try {
        const profile: any = {
            userId,
            userName,
            totalPoints: 0,
            totalStars: 0,
            level: 1,
            levelName: DEFAULT_LEVELS[0].name,
            streakWeeks: 0,
            missionsCompleted: 0,
            weeklyHistory: [],
            taskHistory: [],
            updatedAt: Timestamp.now()
        };
        
        // Only add userAvatar if it exists (Firestore doesn't accept undefined)
        if (userAvatar) {
            profile.userAvatar = userAvatar;
        }
        
        await setDoc(doc(db, GAMIFICATION_PROFILE_COLLECTION, userId), profile);
    } catch (error) {
        console.error("Error creating gamification profile:", error);
        throw error;
    }
};

// Update user's current week MCI reference
const updateUserCurrentMCI = async (userId: string, mciId: string): Promise<void> => {
    try {
        const docRef = doc(db, GAMIFICATION_PROFILE_COLLECTION, userId);
        await updateDoc(docRef, {
            currentWeekMCI: mciId,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error updating current MCI:", error);
    }
};

// Update user gamification stats after MCI changes
const updateUserGamificationStats = async (userId: string): Promise<void> => {
    try {
        const { weekNumber, year } = getCurrentWeekInfo();
        
        // Get all user's MCIs
        const q = query(
            collection(db, MCI_COLLECTION),
            where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        const mcis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MCI);
        
        // Calculate totals
        const totalPoints = mcis.reduce((sum, mci) => sum + (mci.pointsAwarded || 0), 0);
        const totalStars = mcis.reduce((sum, mci) => sum + (mci.starsEarned || 0), 0);
        const missionsCompleted = mcis.filter(mci => mci.status === 'completed').length;
        
        // Calculate level
        const level = DEFAULT_LEVELS.findIndex(l => totalPoints >= l.minPoints && totalPoints <= l.maxPoints) + 1 || 1;
        const levelName = DEFAULT_LEVELS[level - 1]?.name || DEFAULT_LEVELS[0].name;
        
        // Calculate streak (consecutive weeks with completed MCI)
        const sortedMCIs = mcis
            .filter(mci => mci.status === 'completed')
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.weekNumber - a.weekNumber;
            });
        
        let streakWeeks = 0;
        let currentWeek = weekNumber;
        let currentYear = year;
        
        for (const mci of sortedMCIs) {
            if (mci.weekNumber === currentWeek && mci.year === currentYear) {
                streakWeeks++;
                currentWeek--;
                if (currentWeek === 0) {
                    currentWeek = 52;
                    currentYear--;
                }
            } else {
                break;
            }
        }
        
        // Build weekly history
        const weeklyHistory: WeeklyHistory[] = mcis.map(mci => ({
            weekNumber: mci.weekNumber,
            year: mci.year,
            mciId: mci.id!,
            completionPercentage: mci.completionPercentage,
            pointsEarned: mci.pointsAwarded,
            starsEarned: mci.starsEarned
        }));
        
        // Update profile
        const docRef = doc(db, GAMIFICATION_PROFILE_COLLECTION, userId);
        await updateDoc(docRef, {
            totalPoints,
            totalStars,
            level,
            levelName,
            streakWeeks,
            missionsCompleted,
            weeklyHistory,
            updatedAt: Timestamp.now()
        });
        
    } catch (error) {
        console.error("Error updating gamification stats:", error);
    }
};

// Get user's MCI history
export const getUserMCIHistory = async (userId: string, limit_count: number = 10): Promise<MCI[]> => {
    try {
        const q = query(
            collection(db, MCI_COLLECTION),
            where('userId', '==', userId),
            orderBy('year', 'desc'),
            orderBy('weekNumber', 'desc'),
            limit(limit_count)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MCI);
    } catch (error) {
        console.error("Error getting user MCI history:", error);
        return [];
    }
};

// Admin: Update level configuration
export const updateLevelConfig = async (levels: typeof DEFAULT_LEVELS): Promise<void> => {
    try {
        // Store level config in a settings document
        await setDoc(doc(db, 'settings', 'level_config'), {
            levels,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error updating level config:", error);
        throw error;
    }
};

// Admin: Get level configuration
export const getLevelConfig = async (): Promise<typeof DEFAULT_LEVELS> => {
    try {
        const docRef = doc(db, 'settings', 'level_config');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data().levels || DEFAULT_LEVELS;
        }
        return DEFAULT_LEVELS;
    } catch (error) {
        console.error("Error getting level config:", error);
        return DEFAULT_LEVELS;
    }
};

// ============================================
// TASK SYSTEM - Sistema de Tareas y Workflow
// ============================================

import type { Area, UserPosition, Task, TaskNotification, TaskRejectionTracker, Subtask } from '@/types/commercial';

const AREAS_COLLECTION = 'areas';
const USER_POSITIONS_COLLECTION = 'user_positions';
const TASKS_COLLECTION = 'tasks';
const TASK_NOTIFICATIONS_COLLECTION = 'task_notifications';
const TASK_REJECTION_TRACKER_COLLECTION = 'task_rejection_tracker';

// ============================================
// AREAS (Admin only)
// ============================================

export const createArea = async (area: Omit<Area, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
        const now = Timestamp.now();
        const newArea = {
            ...area,
            createdAt: now,
            updatedAt: now
        };
        const docRef = await addDoc(collection(db, AREAS_COLLECTION), newArea);
        return docRef.id;
    } catch (error) {
        console.error("Error creating area:", error);
        throw error;
    }
};

export const updateArea = async (areaId: string, updates: Partial<Area>): Promise<void> => {
    try {
        await updateDoc(doc(db, AREAS_COLLECTION, areaId), {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error updating area:", error);
        throw error;
    }
};

export const deleteArea = async (areaId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, AREAS_COLLECTION, areaId));
    } catch (error) {
        console.error("Error deleting area:", error);
        throw error;
    }
};

export const getAllAreas = async (): Promise<Area[]> => {
    try {
        const q = query(collection(db, AREAS_COLLECTION), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Area);
    } catch (error) {
        console.error("Error getting areas:", error);
        return [];
    }
};

// ============================================
// USER POSITIONS
// ============================================

export const setUserPosition = async (
    userId: string, 
    position: Omit<UserPosition, 'id' | 'userId' | 'updatedAt'>
): Promise<void> => {
    try {
        const positionId = userId; // Usar userId como ID del documento
        const positionData: UserPosition = {
            id: positionId,
            userId,
            ...position,
            updatedAt: Timestamp.now()
        };
        await setDoc(doc(db, USER_POSITIONS_COLLECTION, positionId), positionData);
    } catch (error) {
        console.error("Error setting user position:", error);
        throw error;
    }
};

export const getUserPosition = async (userId: string): Promise<UserPosition | null> => {
    try {
        const docRef = doc(db, USER_POSITIONS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as UserPosition;
        }
        return null;
    } catch (error) {
        console.error("Error getting user position:", error);
        return null;
    }
};

export const getAllUserPositions = async (): Promise<UserPosition[]> => {
    try {
        const q = query(collection(db, USER_POSITIONS_COLLECTION));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserPosition);
    } catch (error) {
        console.error("Error getting user positions:", error);
        return [];
    }
};

export const getUsersByArea = async (areaId: string): Promise<UserPosition[]> => {
    try {
        const q = query(
            collection(db, USER_POSITIONS_COLLECTION),
            where('areaId', '==', areaId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserPosition);
    } catch (error) {
        console.error("Error getting users by area:", error);
        return [];
    }
};

// ============================================
// TASKS
// ============================================

export const createTask = async (
    task: Omit<Task, 'id' | 'createdAt' | 'status' | 'rejectionCount' | 'subtasks' | 'transferHistory' | 'history'>
): Promise<string> => {
    try {
        const now = Timestamp.now();
        const newTask = {
            title: task.title,
            description: task.description,
            createdBy: task.createdBy,
            areaId: task.areaId,
            assignedTo: task.assignedTo,
            originalAssignee: task.originalAssignee,
            priority: task.priority ?? null,
            deadline: task.deadline ?? null,
            allowSubtasks: task.allowSubtasks,
            status: 'pending',
            rejectionCount: 0,
            subtasks: [],
            transferHistory: [],
            history: [{
                action: 'created',
                userId: task.createdBy,
                timestamp: now,
                details: 'Tarea creada'
            }],
            createdAt: now
        };
        
        const docRef = await addDoc(collection(db, TASKS_COLLECTION), newTask);
        
        // Crear notificación para el asignado
        await createTaskNotification({
            userId: task.assignedTo,
            type: 'new_task',
            taskId: docRef.id,
            taskTitle: task.title,
            message: `Nueva tarea asignada: ${task.title}`,
            read: false,
            createdAt: now,
            expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000) // 7 días
        });
        
        return docRef.id;
    } catch (error) {
        console.error("Error creating task:", error);
        throw error;
    }
};

export const getTaskById = async (taskId: string): Promise<Task | null> => {
    try {
        const docRef = doc(db, TASKS_COLLECTION, taskId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return { ...data, id: data.id || docSnap.id } as Task;
        }
        return null;
    } catch (error) {
        console.error("Error getting task:", error);
        return null;
    }
};

const mapDocToTask = (doc: any): Task => {
    const data = doc.data();
    // IMPORTANTE: spread primero, luego sobrescribir id para que no se sobrescriba con valor vacío
    return { ...data, id: data.id || doc.id } as Task;
};

export const getTasksByAssignee = async (userId: string): Promise<Task[]> => {
    try {
        const q = query(
            collection(db, TASKS_COLLECTION),
            where('assignedTo', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToTask);
    } catch (error) {
        console.error("Error getting tasks by assignee:", error);
        return [];
    }
};

export const getTasksByCreator = async (userId: string): Promise<Task[]> => {
    try {
        const q = query(
            collection(db, TASKS_COLLECTION),
            where('createdBy', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToTask);
    } catch (error) {
        console.error("Error getting tasks by creator:", error);
        return [];
    }
};

export const getTasksByArea = async (areaId: string): Promise<Task[]> => {
    try {
        const q = query(
            collection(db, TASKS_COLLECTION),
            where('areaId', '==', areaId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToTask);
    } catch (error) {
        console.error("Error getting tasks by area:", error);
        return [];
    }
};

export const getAllTasks = async (): Promise<Task[]> => {
    try {
        const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return [];
        
        return snapshot.docs.map(mapDocToTask);
    } catch (error) {
        console.error("Error getting all tasks:", error);
        return [];
    }
};

// ============================================
// TASK ACTIONS
// ============================================

export const acceptTask = async (
    taskId: string, 
    userId: string, 
    priority: 'low' | 'medium' | 'high'
): Promise<void> => {
    try {
        const now = Timestamp.now();
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            status: 'in_progress',
            priority,
            acceptedAt: now,
            'history': arrayUnion({
                action: 'accepted',
                userId,
                timestamp: now,
                details: `Tarea aceptada con prioridad ${priority}`
            })
        });
        
        // Notificar al creador
        const task = await getTaskById(taskId);
        if (task) {
            await createTaskNotification({
                userId: task.createdBy,
                type: 'task_accepted',
                taskId,
                taskTitle: task.title,
                message: `Tu tarea "${task.title}" fue aceptada`,
                read: false,
                createdAt: now,
                expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
            });
        }
    } catch (error) {
        console.error("Error accepting task:", error);
        throw error;
    }
};

export const rejectTask = async (
    taskId: string, 
    userId: string, 
    reason: string
): Promise<{ penaltyApplied: boolean; pointsDeducted: number }> => {
    if (!taskId || taskId.trim() === '') {
        throw new Error("Invalid task ID");
    }
    
    try {
        const now = Timestamp.now();
        
        // Verificar que la tarea existe antes de actualizar
        const taskDoc = await getDoc(doc(db, TASKS_COLLECTION, taskId));
        if (!taskDoc.exists()) {
            throw new Error("Task not found");
        }
        
        // Obtener contador de rechazos del usuario
        const tracker = await getRejectionTracker(userId);
        const newRejectionCount = tracker.rejectionCount + 1;
        const penaltyApplied = newRejectionCount > 3;
        const pointsDeducted = penaltyApplied ? 3 : 0;
        
        // Actualizar tarea
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: now,
            rejectionCount: newRejectionCount,
            'history': arrayUnion({
                action: 'rejected',
                userId,
                timestamp: now,
                details: `Tarea rechazada. Razón: ${reason}`
            })
        });
        
        // Actualizar tracker de rechazos
        await updateRejectionTracker(userId, penaltyApplied);
        
        // Si hay penalización, restar puntos del perfil de gamificación
        if (penaltyApplied) {
            await applyRejectionPenalty(userId, pointsDeducted);
        }
        
        // Notificar al creador
        const task = await getTaskById(taskId);
        if (task) {
            await createTaskNotification({
                userId: task.createdBy,
                type: 'task_rejected',
                taskId,
                taskTitle: task.title,
                message: `Tu tarea "${task.title}" fue rechazada`,
                read: false,
                createdAt: now,
                expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
            });
        }
        
        return { penaltyApplied, pointsDeducted };
    } catch (error) {
        console.error("Error rejecting task:", error);
        throw error;
    }
};

export const transferTask = async (
    taskId: string,
    fromUserId: string,
    toUserId: string,
    reason: string
): Promise<void> => {
    try {
        const now = Timestamp.now();
        const task = await getTaskById(taskId);
        if (!task) throw new Error("Task not found");
        
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            assignedTo: toUserId,
            status: 'pending', // Vuelve a pendiente para el nuevo asignado
            priority: null, // Resetea prioridad
            transferHistory: arrayUnion({
                fromUserId,
                toUserId,
                reason,
                transferredAt: now,
                transferredBy: fromUserId
            }),
            'history': arrayUnion({
                action: 'transferred',
                userId: fromUserId,
                timestamp: now,
                details: `Tarea transferida. Razón: ${reason}`
            })
        });
        
        // Notificar al nuevo asignado
        await createTaskNotification({
            userId: toUserId,
            type: 'task_transferred',
            taskId,
            taskTitle: task.title,
            message: `Tarea transferida a ti: ${task.title}`,
            read: false,
            createdAt: now,
            expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error("Error transferring task:", error);
        throw error;
    }
};

export const completeTask = async (taskId: string, userId: string): Promise<number> => {
    try {
        const now = Timestamp.now();
        
        // Get task first to check priority
        const task = await getTaskById(taskId);
        if (!task) throw new Error("Task not found");
        
        // Award points based on priority
        const pointsToAdd = getPointsByPriority(task.priority);
        if (pointsToAdd > 0) {
            await addTaskPoints(userId, pointsToAdd, taskId, task.title);
        }
        
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            status: 'completed',
            completedAt: now,
            'history': arrayUnion({
                action: 'completed',
                userId,
                timestamp: now,
                details: `Tarea completada (+${pointsToAdd} puntos)`
            })
        });
        
        // Notificar al creador
        if (task) {
            await createTaskNotification({
                userId: task.createdBy,
                type: 'task_completed',
                taskId,
                taskTitle: task.title,
                message: `Tu tarea "${task.title}" fue completada (+${pointsToAdd} puntos)`,
                read: false,
                createdAt: now,
                expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
            });
        }
        
        return pointsToAdd;
    } catch (error) {
        console.error("Error completing task:", error);
        throw error;
    }
};

// ============================================
// SUBTASKS
// ============================================

export const addSubtask = async (
    taskId: string,
    subtask: Omit<Subtask, 'id' | 'createdAt' | 'status'>
): Promise<void> => {
    try {
        const now = Timestamp.now();
        const newSubtask: Subtask = {
            ...subtask,
            id: crypto.randomUUID(),
            status: 'pending',
            createdAt: now
        };
        
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            subtasks: arrayUnion(newSubtask),
            'history': arrayUnion({
                action: 'subtask_created',
                userId: subtask.createdBy,
                timestamp: now,
                details: `Subtarea creada: ${subtask.title}`
            })
        });
        
        // Notificar al asignado de la subtarea
        await createTaskNotification({
            userId: subtask.assignedTo,
            type: 'subtask_assigned',
            taskId,
            taskTitle: subtask.title,
            message: `Nueva subtarea asignada: ${subtask.title}`,
            read: false,
            createdAt: now,
            expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error("Error adding subtask:", error);
        throw error;
    }
};

export const completeSubtask = async (
    taskId: string,
    subtaskId: string,
    userId: string
): Promise<void> => {
    try {
        const now = Timestamp.now();
        const task = await getTaskById(taskId);
        if (!task) throw new Error("Task not found");
        
        const updatedSubtasks = task.subtasks.map(st => 
            st.id === subtaskId 
                ? { ...st, status: 'completed', completedAt: now }
                : st
        );
        
        await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
            subtasks: updatedSubtasks,
            'history': arrayUnion({
                action: 'subtask_completed',
                userId,
                timestamp: now,
                details: `Subtarea completada: ${subtaskId}`
            })
        });
        
        // Notificar al responsable principal de la tarea
        await createTaskNotification({
            userId: task.assignedTo,
            type: 'subtask_completed',
            taskId,
            taskTitle: task.title,
            message: `Una subtarea de "${task.title}" fue completada`,
            read: false,
            createdAt: now,
            expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error("Error completing subtask:", error);
        throw error;
    }
};

// ============================================
// NOTIFICATIONS
// ============================================

export const createTaskNotification = async (
    notification: Omit<TaskNotification, 'id'>
): Promise<void> => {
    try {
        await addDoc(collection(db, TASK_NOTIFICATIONS_COLLECTION), notification);
    } catch (error) {
        console.error("Error creating notification:", error);
        throw error;
    }
};

export const getUserNotifications = async (userId: string): Promise<TaskNotification[]> => {
    try {
        const now = Timestamp.now();
        const q = query(
            collection(db, TASK_NOTIFICATIONS_COLLECTION),
            where('userId', '==', userId),
            where('expiresAt', '>', now),
            orderBy('expiresAt', 'desc'),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as TaskNotification);
    } catch (error) {
        console.error("Error getting notifications:", error);
        return [];
    }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, TASK_NOTIFICATIONS_COLLECTION, notificationId), {
            read: true
        });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        throw error;
    }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, TASK_NOTIFICATIONS_COLLECTION, notificationId));
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
    }
};

// ============================================
// REJECTION TRACKER & PENALTIES
// ============================================

export const getRejectionTracker = async (userId: string): Promise<TaskRejectionTracker> => {
    try {
        const docRef = doc(db, TASK_REJECTION_TRACKER_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data() as TaskRejectionTracker;
        }
        
        // Crear tracker inicial si no existe
        const now = Timestamp.now();
        const newTracker: TaskRejectionTracker = {
            userId,
            rejectionCount: 0,
            penaltyPoints: 0,
            lastRejectionDate: now,
            currentPeriodStart: now
        };
        
        await setDoc(docRef, newTracker);
        return newTracker;
    } catch (error) {
        console.error("Error getting rejection tracker:", error);
        throw error;
    }
};

const updateRejectionTracker = async (
    userId: string, 
    penaltyApplied: boolean
): Promise<void> => {
    try {
        const tracker = await getRejectionTracker(userId);
        const now = Timestamp.now();
        
        // Verificar si hay que resetear el período (mensual)
        const oneMonthAgo = Timestamp.fromMillis(now.toMillis() - 30 * 24 * 60 * 60 * 1000);
        const shouldResetPeriod = tracker.currentPeriodStart.toMillis() < oneMonthAgo.toMillis();
        
        const updates: Partial<TaskRejectionTracker> = {
            rejectionCount: shouldResetPeriod ? 1 : tracker.rejectionCount + 1,
            lastRejectionDate: now,
            currentPeriodStart: shouldResetPeriod ? now : tracker.currentPeriodStart
        };
        
        if (penaltyApplied) {
            updates.penaltyPoints = tracker.penaltyPoints + 3;
        }
        
        await updateDoc(doc(db, TASK_REJECTION_TRACKER_COLLECTION, userId), updates);
    } catch (error) {
        console.error("Error updating rejection tracker:", error);
        throw error;
    }
};

const applyRejectionPenalty = async (userId: string, points: number): Promise<void> => {
    try {
        const profile = await getUserGamificationProfile(userId);
        if (profile) {
            await updateDoc(doc(db, 'user_gamification_profiles', userId), {
                totalPoints: Math.max(0, profile.totalPoints - points),
                updatedAt: Timestamp.now()
            });
        }
    } catch (error) {
        console.error("Error applying rejection penalty:", error);
        throw error;
    }
};

const addTaskPoints = async (userId: string, points: number, taskId: string, taskTitle: string): Promise<void> => {
    try {
        const profile = await getUserGamificationProfile(userId);
        if (profile) {
            const { weekNumber, year } = getCurrentWeekInfo();
            
            const newTaskEntry: TaskPointsHistory = {
                weekNumber,
                year,
                taskId,
                taskTitle,
                pointsEarned: points,
                completedAt: Timestamp.now()
            };
            
            const currentTaskHistory = profile.taskHistory || [];
            
            await updateDoc(doc(db, 'user_gamification_profiles', userId), {
                totalPoints: profile.totalPoints + points,
                taskHistory: [...currentTaskHistory, newTaskEntry],
                updatedAt: Timestamp.now()
            });
        }
    } catch (error) {
        console.error("Error adding task points:", error);
        throw error;
    }
};

const getPointsByPriority = (priority: string | null): number => {
    switch (priority) {
        case 'high': return 10;
        case 'medium': return 5;
        case 'low': return 2;
        default: return 5;
    }
};

// ============================================
// CLIENT NOTES, ORDERS, TESTS - CRM Functions
// ============================================

import type { ClientNote, ClientOrder } from '@/types/commercial';

// Helper: Transform legacy client data to new format
interface LegacyHistoryEntry {
    id: string;
    type: 'note' | 'testing' | 'order';
    description: string;
    details: string;
    created_at: any;
    created_by: string;
}

function transformLegacyClientData(data: any): {
    notes: ClientNote[];
    orders: ClientOrder[];
    tests: ClientTest[];
} {
    let notes: ClientNote[] = [];
    let orders: ClientOrder[] = [];
    let tests: ClientTest[] = [];

    // 1. Handle legacy notes (string format)
    if (typeof data.notes === 'string' && data.notes.trim()) {
        const legacyNote = {
            id: `legacy-note-${Date.now()}`,
            clientId: '', // Will be set when assigning to client
            content: data.notes.trim(),
            created_at: data.updated_at || data.created_at || new Date(),
            created_by: data.assigned_commercial_name || 'Usuario'
        } as ClientNote;
        notes.push(legacyNote);
    }

    // 2. Handle legacy history array
    const legacyHistory: LegacyHistoryEntry[] = data.history || [];
    for (const entry of legacyHistory) {
        const entryDate = entry.created_at?.toDate ? entry.created_at.toDate() : 
                          entry.created_at ? new Date(entry.created_at) : new Date();
        const entryContent = entry.description && entry.details ? 
            `${entry.description}: ${entry.details}` : 
            (entry.details || entry.description || '');

        switch (entry.type) {
            case 'note':
                notes.push({
                    id: entry.id || `legacy-note-${Date.now()}`,
                    clientId: '', // Will be set when assigning to client
                    content: entryContent,
                    created_at: entryDate,
                    created_by: entry.created_by
                } as ClientNote);
                break;
            case 'testing':
                tests.push({
                    id: entry.id || `legacy-test-${Date.now()}`,
                    clientId: '',
                    productId: '',
                    productName: entry.description || 'Testeo legacy',
                    product_name: entry.description || 'Testeo legacy',
                    productSku: '',
                    platform: '',
                    status: 'completed',
                    result: 'pending',
                    notes: entry.details || '',
                    created_at: entryDate,
                    created_by: entry.created_by
                } as ClientTest);
                break;
            case 'order':
                orders.push({
                    id: entry.id || `legacy-order-${Date.now()}`,
                    clientId: '',
                    items: [],
                    total: 0,
                    status: 'pending',
                    created_at: entryDate,
                    created_by: entry.created_by
                });
                break;
        }
    }

    // 3. Merge with new format
    const newNotes: ClientNote[] = Array.isArray(data.notes) ? data.notes : [];
    const newOrders: ClientOrder[] = Array.isArray(data.orders) ? data.orders : [];
    const newTests: ClientTest[] = Array.isArray(data.tests) ? data.tests : [];

    return {
        notes: [...notes, ...newNotes],
        orders: [...orders, ...newOrders],
        tests: [...tests, ...newTests]
    };
}

export const addNoteToClient = async (clientId: string, content: string): Promise<string> => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        const snapshot = await getDoc(clientRef);
        
        if (!snapshot.exists()) {
            throw new Error("Cliente no encontrado");
        }
        
        const data = snapshot.data();
        
        // Handle both legacy (string) and new (array) format
        let notes: ClientNote[];
        if (typeof data.notes === 'string') {
            if (data.notes.trim()) {
                notes = [{
                    id: `legacy-${Date.now()}`,
                    clientId: '', // Will be set when assigning to client
                    content: data.notes.trim(),
                    created_at: data.updated_at?.toDate ? data.updated_at.toDate() : new Date(),
                    created_by: data.assigned_commercial_name || 'Usuario'
                } as ClientNote];
            } else {
                notes = [];
            }
        } else if (Array.isArray(data.notes)) {
            notes = data.notes;
        } else {
            notes = [];
        }
        
        const now = Timestamp.now().toDate();
        const newNote: ClientNote = {
            id: crypto.randomUUID(),
            clientId, // Add clientId to the note
            content,
            created_at: now,
            created_by: 'Usuario'
        };
        
        notes.push(newNote);
        
        await updateDoc(clientRef, {
            notes,
            updated_at: serverTimestamp()
        });
        
        return newNote.id;
    } catch (error) {
        console.error("Error adding note to client:", error);
        throw new Error("Failed to add note");
    }
};

export const addOrderToClient = async (
    clientId: string, 
    items: { product_id: string; product_name: string; quantity: number; unit_price: number }[],
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' = 'pending'
): Promise<string> => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        const snapshot = await getDoc(clientRef);
        
        if (!snapshot.exists()) {
            throw new Error("Cliente no encontrado");
        }
        
        const data = snapshot.data();
        
        let orders: ClientOrder[];
        if (Array.isArray(data.orders)) {
            orders = data.orders;
        } else {
            orders = [];
        }
        
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const now = Timestamp.now().toDate();
        
        const newOrder: ClientOrder = {
            id: crypto.randomUUID(),
            clientId,
            items: items.map(item => ({
                ...item,
                total: item.quantity * item.unit_price
            })),
            total,
            status,
            created_at: now,
            created_by: 'Usuario'
        };
        
        orders.push(newOrder);
        
        await updateDoc(clientRef, {
            orders,
            updated_at: serverTimestamp()
        });
        
        return newOrder.id;
    } catch (error) {
        console.error("Error adding order to client:", error);
        throw new Error("Failed to add order");
    }
};

export const addTestToClient = async (
    clientId: string,
    productId: string,
    productName: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending',
    result: 'positive' | 'negative' | 'neutral' | 'pending' = 'pending',
    notes?: string
): Promise<string> => {
    try {
        const clientRef = doc(db, 'clients', clientId);
        const snapshot = await getDoc(clientRef);
        
        if (!snapshot.exists()) {
            throw new Error("Cliente no encontrado");
        }
        
        const data = snapshot.data();
        
        let tests: ClientTest[];
        if (Array.isArray(data.tests)) {
            tests = data.tests;
        } else {
            tests = [];
        }
        
        const now = Timestamp.now().toDate();
        const newTest: ClientTest = {
            id: crypto.randomUUID(),
            clientId,
            productId,
            productName,
            productSku: '',
            platform: '',
            status,
            result,
            notes,
            created_at: now,
            created_by: 'Usuario'
        };
        
        tests.push(newTest);
        
        await updateDoc(clientRef, {
            tests,
            updated_at: serverTimestamp()
        });
        
        return newTest.id;
    } catch (error) {
        console.error("Error adding test to client:", error);
        throw new Error("Failed to add test");
    }
};

// Get all history (notes, orders, tests) from all clients
export const getAllClientHistory = async (): Promise<{
    clients: CommercialClient[];
    allNotes: (ClientNote & { clientId: string; clientName: string })[];
    allOrders: (ClientOrder & { clientId: string; clientName: string })[];
    allTests: (ClientTest & { clientId: string; clientName: string })[];
}> => {
    try {
        const clientsCol = collection(db, 'clients');
        const snapshot = await getDocs(clientsCol);
        
        const clients: CommercialClient[] = [];
        const allNotes: (ClientNote & { clientId: string; clientName: string })[] = [];
        const allOrders: (ClientOrder & { clientId: string; clientName: string })[] = [];
        const allTests: (ClientTest & { clientId: string; clientName: string })[] = [];
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const { notes, orders, tests } = transformLegacyClientData(data);
            
            const client: CommercialClient = {
                id: docSnap.id,
                ...data,
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                birthday: data.birthday || null,
                category: data.category || 'laboratorio',
                type: data.type || 'mixto',
                avg_sales: data.avg_sales || 0,
                city: data.city || '',
                status: data.status || 'finding_winner',
                assigned_commercial_id: data.assigned_commercial_id || '',
                created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
                updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
            };
            
            // Add notes, orders, and tests as extended properties
            (client as any).notes = notes;
            (client as any).orders = orders;
            (client as any).tests = tests;
            
            clients.push(client);
            
            for (const note of notes) {
                allNotes.push({
                    ...note,
                    clientId: client.id || '',
                    clientName: client.name
                });
            }
            for (const order of orders) {
                allOrders.push({
                    ...order,
                    clientId: client.id || '',
                    clientName: client.name
                });
            }
            for (const test of tests) {
                allTests.push({
                    ...test,
                    clientId: client.id || '',
                    clientName: client.name
                });
            }
        }
        
        // Sort by date descending
        allNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        allTests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        return { clients, allNotes, allOrders, allTests };
    } catch (error) {
        console.error("Error fetching all client history:", error);
        return { clients: [], allNotes: [], allOrders: [], allTests: [] };
    }
};
