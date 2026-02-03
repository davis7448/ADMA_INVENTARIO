

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

export const getAllClients = async (): Promise<CommercialClient[]> => {
    try {
        const clientsCol = collection(db, 'clients');
        const snapshot = await getDocs(clientsCol);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate(),
            updated_at: doc.data().updated_at?.toDate(),
            birthday: doc.data().birthday?.toDate ? doc.data().birthday.toDate() : doc.data().birthday
        } as CommercialClient));
    } catch (error) {
        console.error("Error fetching all clients:", error);
        return [];
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
    if (!user || !user.email) return;

    try {
        // 1. Check if profile exists with correct UID
        const correctProfileRef = doc(db, 'users', user.uid);
        const correctProfileSnap = await getDoc(correctProfileRef);

        if (correctProfileSnap.exists()) {
            console.log("User profile is correct.");
            return;
        }

        // 2. If not, find by email
        const usersCol = collection(db, 'users');
        const q = query(usersCol, where('email', '==', user.email));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            console.log("Found disconnected profile. Migrating...");
            const oldDoc = snapshot.docs[0];
            const oldData = oldDoc.data();

            // 3. Create new profile with correct UID
            await setDoc(correctProfileRef, {
                ...oldData,
                id: user.uid, // Ensure ID is updated in data too
                migratedFrom: oldDoc.id,
                updated_at: serverTimestamp()
            });

            console.log("Profile migrated successfully to", user.uid);

            // Optional: Delete old if we could, but likely lack permissions.
        } else {
            // 4. If no profile at all, create one? 
            // Maybe better to wait for manual creation, but for Commercial Reps this might be needed.
            console.warn("No user profile found for email:", user.email);
        }

    } catch (error) {
        console.error("Error fixing user profile:", error);
    }
};
