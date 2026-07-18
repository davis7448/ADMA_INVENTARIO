import { app, db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, where, getDoc, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createReservation, deleteReservation } from '@/lib/api';

export type TipoModificacion = 'RESERVA_INVENTARIO' | 'AJUSTE_STOCK' | 'BAJA_PLATAFORMA' | 'CREACION_ITEM';
// Flujo de solicitudes (migrado de ClickUp): pendiente → en_revision → aprobado → creado, o rechazado.
// 'completado' se conserva por compatibilidad con modificaciones históricas.
export type EstadoSolicitud = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'creado' | 'completado';

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
    // Campos de solicitudes migradas de ClickUp (fase 4)
    ENLACE_DRIVE?: string;
    TIPO_PRECIO?: 'DROPSHIPPING' | 'ESPECIAL';
    OBSERVACIONES?: string;
    motivoRechazo?: string;
    solicitadoPor?: { id: string; name: string; email?: string };
    // Puente con ClickUp (fase 4b)
    clickupTaskId?: string;
    clickupSync?: 'synced' | 'error' | 'pending';
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
    const start = startDate || new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); // 6 meses atrás por defecto
    const end = endDate || now;

    const q = query(
        collection(db, 'modificaciones'),
        where('FECHA', '>=', start.getTime()),
        where('FECHA', '<=', end.getTime()),
        orderBy('FECHA', 'desc')
    );

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Firestore tardó demasiado en responder')), 15000)
    );

    const querySnapshot = await Promise.race([getDocs(q), timeout]);
    let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Modificacion & { id: string })[];

    if (pais && pais !== 'todos') {
        results = results.filter(m => m.PAIS === pais);
    }

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

    // Calcular ID consecutivo consultando el máximo global (no acotado por fecha)
    const maxIdQuery = query(
        collection(db, 'modificaciones'),
        orderBy('ID CONSECUTIVO', 'desc'),
        limit(1)
    );
    const maxIdSnap = await getDocs(maxIdQuery);
    const maxId = maxIdSnap.docs[0]?.data()?.['ID CONSECUTIVO'] || 0;
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

// --- Solicitudes (migración de ClickUp, fase 4) ---

const SOLICITUD_CREATE_ROLES = new Set(['admin', 'plataformas', 'commercial', 'commercial_director', 'coordinacion']);
const SOLICITUD_TIPOS = new Set<TipoModificacion>(['CREACION_ITEM', 'AJUSTE_STOCK']);

async function getCurrentUserRole(): Promise<{ role: string; email: string } | null> {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return null;
    const userQuery = query(collection(db, 'users'), where('email', '==', currentUser.email), limit(1));
    const userSnapshot = await getDocs(userQuery);
    const role = userSnapshot.docs[0]?.data()?.role;
    return role ? { role, email: currentUser.email } : null;
}

async function nextConsecutivo(): Promise<number> {
    const maxIdQuery = query(collection(db, 'modificaciones'), orderBy('ID CONSECUTIVO', 'desc'), limit(1));
    const maxIdSnap = await getDocs(maxIdQuery);
    return (maxIdSnap.docs[0]?.data()?.['ID CONSECUTIVO'] || 0) + 1;
}

// Los comerciales crean solicitudes (equivalente al formulario de ClickUp); quedan 'pendiente'.
export async function createSolicitud(data: Omit<Modificacion, 'ID CONSECUTIVO'>): Promise<string> {
    const current = await getCurrentUserRole();
    if (!current || !SOLICITUD_CREATE_ROLES.has(current.role)) {
        throw new Error('No tienes permiso para crear solicitudes.');
    }
    if (!data.tipoModificacion || !SOLICITUD_TIPOS.has(data.tipoModificacion)) {
        throw new Error('Tipo de solicitud inválido.');
    }
    if (!data.PAIS || data.PAIS.trim() === '') {
        throw new Error('El campo PAIS es obligatorio');
    }

    const solicitudData: Record<string, any> = {
        ...data,
        FECHA: data.FECHA || Date.now(),
        CREADO: 'NO',
        estadoSolicitud: 'pendiente',
        'ID CONSECUTIVO': await nextConsecutivo(),
    };
    Object.keys(solicitudData).forEach(k => solicitudData[k] === undefined && delete solicitudData[k]);

    const docRef = await addDoc(collection(db, 'modificaciones'), solicitudData);
    return docRef.id;
}

export async function getSolicitudesByEmail(email: string) {
    // Sin orderBy para no requerir índice compuesto; se ordena en memoria.
    const q = query(
        collection(db, 'modificaciones'),
        where('solicitadoPor.email', '==', email),
        limit(200)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }) as Modificacion & { id: string })
        .sort((a, b) => (b.FECHA || 0) - (a.FECHA || 0));
}

// Transición de estado por parte de plataformas/admin, con efectos al marcar 'creado'.
export async function updateSolicitudEstado(
    id: string,
    estado: EstadoSolicitud,
    opts?: { motivoRechazo?: string }
): Promise<void> {
    await assertModificacionesRole(false);

    if (estado === 'rechazado' && !opts?.motivoRechazo?.trim()) {
        throw new Error('El motivo de rechazo es obligatorio.');
    }

    const docRef = doc(db, 'modificaciones', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('La solicitud no existe.');
    const solicitud = snap.data() as Modificacion;

    const updates: Record<string, any> = { estadoSolicitud: estado };
    if (estado === 'rechazado') updates.motivoRechazo = opts!.motivoRechazo!.trim();
    if (estado === 'creado') updates.CREADO = 'SI';
    await updateDoc(docRef, updates);

    // Efectos al crear el item en plataforma (activación del producto)
    if (estado === 'creado' && solicitud.tipoModificacion === 'CREACION_ITEM' && solicitud.productId) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'products', solicitud.productId), {
            activationStatus: 'activo',
            activatedAt: now,
            activationModificacionId: id,
        }).catch(err => console.error('No se pudo actualizar el producto activado:', err));

        // Avanzar las líneas de OC almacenadas/liquidadas de ese producto
        try {
            const poItems = await getDocs(query(
                collection(db, 'purchaseOrderItems'),
                where('productId', '==', solicitud.productId),
                where('status', 'in', ['almacenada', 'liquidada'])
            ));
            await Promise.all(poItems.docs.map(d => updateDoc(d.ref, { status: 'activada', updatedAt: now })));
        } catch (err) {
            console.error('No se pudieron avanzar las líneas de OC:', err);
        }

        // Refrescar catálogo externo (webhook n8n ACTIVACION)
        try {
            await fetch('/api/webhook', { method: 'POST' });
        } catch (err) {
            console.error('No se pudo disparar el webhook de activación:', err);
        }
    }
}

export async function getComercialUsers() {
    const q = query(collection(db, 'users'), where('role', '==', 'commercial'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { name: data.name || data.email, code: data.commercialCode || data.email };
    });
}

// Obtener TODAS las modificaciones sin paginación (para exportación a Excel)
export async function getAllModificacionesForExport(startDate?: Date, endDate?: Date, pais?: string, comercial?: string) {
    const now = new Date();
    const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
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