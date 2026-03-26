import { app, db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, where, getDoc, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createReservation, deleteReservation } from '@/lib/api';

export type TipoModificacion = 'RESERVA_INVENTARIO' | 'AJUSTE_STOCK' | 'BAJA_PLATAFORMA';
export type EstadoSolicitud = 'pendiente' | 'completado';

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
    // Nuevos campos para integración con reservas
    tipoModificacion?: TipoModificacion;
    productId?: string;
    variantId?: string;
    platformId?: string;
    reservationId?: string;
    estadoSolicitud?: EstadoSolicitud;
    // Campos adicionales para reservas
    vendedorId?: string;
    customerEmail?: string;
    externalId?: string;
};

const MODIFICACIONES_EDIT_ROLES = new Set(['admin', 'plataformas']);

async function assertModificacionesRole(canDelete: boolean = false) {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
        throw new Error('No tienes permiso para realizar esta acción.');
    }

    const userQuery = query(
        collection(db, 'users'),
        where('email', '==', currentUser.email),
        limit(1)
    );
    const userSnapshot = await getDocs(userQuery);
    const role = userSnapshot.docs[0]?.data()?.role;

    if (canDelete) {
        if (role !== 'admin') {
            throw new Error('Solo los administradores pueden eliminar modificaciones.');
        }
        return;
    }

    if (!MODIFICACIONES_EDIT_ROLES.has(role)) {
        throw new Error('No tienes permiso para crear o editar modificaciones.');
    }
}

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
    await assertModificacionesRole(false);

    // Validar que PAIS sea obligatorio
    if (!data.PAIS || data.PAIS.trim() === '') {
        throw new Error('El campo PAIS es obligatorio');
    }

    let reservationId: string | undefined;
    let estadoSolicitud: 'pendiente' | 'completado' | undefined;

    // Si es una reserva de inventario, crear la reserva
    if (data.tipoModificacion === 'RESERVA_INVENTARIO') {
        // Validar campos requeridos para reserva
        if (!data.productId) {
            throw new Error('Se requiere productId para crear una reserva de inventario');
        }
        if (!data.platformId) {
            throw new Error('Se requiere platformId para crear una reserva de inventario');
        }
        if (!data.customerEmail && !data['CORREO_CODIGO']) {
            throw new Error('Se requiere email del cliente (customerEmail o CORREO_CODIGO) para crear una reserva');
        }
        if (!data["CANTIDAD SOLICITADA"] || data["CANTIDAD SOLICITADA"] <= 0) {
            throw new Error('Se requiere una cantidad válida para crear una reserva de inventario');
        }

        // Usar CODIGO COMERCIAL como vendedorId
        const vendedorId = data["CODIGO COMERCIAL"] || data.vendedorId;
        if (!vendedorId) {
            throw new Error('Se requiere el código comercial (vendedor) para crear una reserva');
        }

        // Email del cliente
        const customerEmail = data.customerEmail || data['CORREO_CODIGO'] || '';

        // External ID - usar ID consecutivo o generar uno
        const externalId = data.externalId || `MOD-${Date.now()}`;

        try {
            // Crear la reserva en Firestore y obtener los IDs
            const reservationResult = await createReservation({
                productId: data.productId,
                variantId: data.variantId,
                platformId: data.platformId,
                vendedorId: vendedorId,
                customerEmail: customerEmail,
                externalId: externalId,
                quantity: data["CANTIDAD SOLICITADA"] || 0,
            });

            // Guardar el ID del documento de Firestore para poder eliminar la reserva
            reservationId = reservationResult.docId;
            estadoSolicitud = 'completado';
        } catch (error) {
            console.error('Error al crear reserva:', error);
            throw new Error(`Error al crear la reserva de inventario: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }

    // Calcular ID consecutivo
    const existingModificaciones = await getModificaciones();
    const maxId = existingModificaciones.length > 0 
        ? Math.max(...existingModificaciones.map(m => m["ID CONSECUTIVO"] || 0)) 
        : 0;
    const nuevoIdConsecutivo = maxId + 1;

    // Preparar datos para guardar
    const modificacionData = {
        ...data,
        PAIS: data.PAIS,
        FECHA: data.FECHA || Date.now(),
        "ID CONSECUTIVO": nuevoIdConsecutivo,
    };

    // Agregar reservationId si se creó una reserva
    if (reservationId) {
        (modificacionData as any).reservationId = reservationId;
    }

    // Agregar estado de solicitud si aplica
    if (estadoSolicitud) {
        (modificacionData as any).estadoSolicitud = estadoSolicitud;
    }

    const docRef = await addDoc(collection(db, 'modificaciones'), modificacionData);
    return docRef.id;
}

export async function updateModificacion(id: string, data: Partial<Modificacion>) {
    await assertModificacionesRole(false);

    const docRef = doc(db, 'modificaciones', id);
    await updateDoc(docRef, data);
    return id;
}

export async function deleteModificacion(id: string) {
    await assertModificacionesRole(true);

    // Obtener la modificación antes de eliminarla para verificar si tiene una reserva
    const docRef = doc(db, 'modificaciones', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data() as Modificacion;
        
        // Si es una reserva de inventario, intentar cancelar la reserva
        if (data.tipoModificacion === 'RESERVA_INVENTARIO' && data.reservationId) {
            try {
                await deleteReservation(data.reservationId);
            } catch (error) {
                console.error('Error al eliminar la reserva:', error);
                // No lanzamos el error para permitir eliminar la modificación aunque falle la reserva
            }
        }
    }
    
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