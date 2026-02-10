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
    "PRIVADO_PUBLICO": string | null;
    "CORREO_CODIGO": string | null;
    CREADO: string | null;
    SOLICITUD: string | null;
    "CANTIDAD PREVIA": number | null;
    "CANTIDAD SOLICITADA": number | null;
    "CANTIDAD POSTERIOR": number | null;
    "ID CONSECUTIVO": number | null;
    PAIS: string | null;
};

export async function seedModificaciones(data: Modificacion[]) {
    const batch = [];
    for (const item of data) {
        batch.push(addDoc(collection(db, 'modificaciones'), item));
    }
    await Promise.all(batch);
}

export async function getModificaciones(startDate?: Date, endDate?: Date, pais?: string, comercial?: string) {
    const now = new Date();
    const defaultStart = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultEnd = endDate || now;

    let q = query(
        collection(db, 'modificaciones'),
        where('FECHA', '>=', defaultStart.getTime()),
        where('FECHA', '<=', defaultEnd.getTime()),
        orderBy('FECHA', 'desc'),
        orderBy('ID CONSECUTIVO', 'desc')
    );

    // Firestore no permite múltiples filtros de desigualdad en campos diferentes
    // así que obtendremos todos y filtraremos en memoria para país y comercial
    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Modificacion & { id: string })[];

    // Filtrar por país si se especifica
    if (pais && pais !== 'todos') {
        results = results.filter(m => m.PAIS === pais);
    }

    // Filtrar por comercial si se especifica
    if (comercial && comercial !== 'todos') {
        results = results.filter(m => m["CODIGO COMERCIAL"] === comercial);
    }

    return results;
}

export async function createModificacion(data: Omit<Modificacion, 'ID CONSECUTIVO'>) {
    // Validar que PAIS sea obligatorio
    if (!data.PAIS || data.PAIS.trim() === '') {
        throw new Error('El campo PAIS es obligatorio');
    }

    const docRef = await addDoc(collection(db, 'modificaciones'), {
        ...data,
        PAIS: data.PAIS,
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
    const users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { name: data.name || data.email, code: data.commercialCode || data.email };
    });
    return [...users, { name: 'Camilo Useche', code: 'Camilo Useche' }];
}

// Obtener TODAS las modificaciones sin paginación (para exportación a Excel)
export async function getAllModificacionesForExport(startDate?: Date, endDate?: Date, pais?: string, comercial?: string) {
    const now = new Date();
    const defaultStart = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 días para exportación
    const defaultEnd = endDate || now;

    let q = query(
        collection(db, 'modificaciones'),
        where('FECHA', '>=', defaultStart.getTime()),
        where('FECHA', '<=', defaultEnd.getTime()),
        orderBy('FECHA', 'desc')
    );

    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Modificacion & { id: string })[];

    // Filtrar por país si se especifica
    if (pais && pais !== 'todos') {
        results = results.filter(m => m.PAIS === pais);
    }

    // Filtrar por comercial si se especifica
    if (comercial && comercial !== 'todos') {
        results = results.filter(m => m["CODIGO COMERCIAL"] === comercial);
    }

    return results;
}

export async function getPlataformas() {
    const q = query(collection(db, 'platforms'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().name || doc.id);
}