import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, where, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export type Modificacion = {
    FECHA: number | null;
    ID: number | null;
    PRODUCTO: string | null;
    VARIABLE: string | null;
    "SKU ": number | string | null;
    "PRECIO ": number | null;
    PLATAFORMA: string | null;
    BODEGA: string | null;
    COMERCIAL: string | null;
    "CODIGO COMERCIAL": string | null;
    "PRIVADO/PUBLICO": string | null;
    "CORREO/CODIGO": string | null;
    CREADO: string | null;
    SOLICITUD: string | null;
    "CANTIDAD PREVIA": number | null;
    "CANTIDAD SOLICITADA": number | null;
    "CANTIDAD POSTERIOR": number | null;
    "ID CONSECUTIVO": number | null;
};

export async function seedModificaciones(data: Modificacion[]) {
    const batch = [];
    for (const item of data) {
        batch.push(addDoc(collection(db, 'modificaciones'), item));
    }
    await Promise.all(batch);
}

export async function getModificaciones(startDate?: Date, endDate?: Date) {
    const now = new Date();
    const defaultStart = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultEnd = endDate || now;

    const q = query(
        collection(db, 'modificaciones'),
        where('FECHA', '>=', defaultStart.getTime()),
        where('FECHA', '<=', defaultEnd.getTime()),
        orderBy('FECHA', 'desc'),
        orderBy('ID CONSECUTIVO', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Modificacion & { id: string })[];
}

export async function createModificacion(data: Omit<Modificacion, 'ID CONSECUTIVO'>) {
    const docRef = await addDoc(collection(db, 'modificaciones'), {
        ...data,
        FECHA: data.FECHA || Date.now(),
        "ID CONSECUTIVO": Math.max(...(await getModificaciones()).map(m => m["ID CONSECUTIVO"] || 0)) + 1
    });
    return docRef.id;
}

export async function updateModificacion(id: string, data: Partial<Modificacion>) {
    const docRef = doc(db, 'modificaciones', id);
    await updateDoc(docRef, data);
    return id;
}

export async function deleteModificacion(id: string) {
    const docRef = doc(db, 'modificaciones', id);
    await deleteDoc(docRef);
    return id;
}

export async function getComercialUsers() {
    const q = query(collection(db, 'users'), where('role', '==', 'commercial'));
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(doc => doc.data().name || doc.data().email);
    return [...users, 'Maria del mar Garay', 'Camilo Useche'];
}

export async function getPlataformas() {
    const q = query(collection(db, 'platforms'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().name || doc.id);
}