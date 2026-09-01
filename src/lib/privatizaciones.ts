// Privatizaciones por cliente y por ID de plataforma.
//
// Una privatización no es una entidad propia: es el estado en el que queda un ID de
// plataforma tras la solicitud que lo pidió, guardada en `modificaciones`. Este módulo
// concentra las seis reglas de lectura que hacen que el dato cuadre con lo que ve el
// equipo en pantalla, para que ningún consumidor tenga que resolverlas por su cuenta:
//
//   1. CORREO_CODIGO puede traer VARIOS correos separados por coma; manda el primero.
//   2. No hay campo normalizado de correo: hay que comparar en minúsculas y sin espacios.
//   3. El ID a veces llegó como texto ("1234567.0") desde importaciones antiguas.
//   4. Un ID no es único entre plataformas.
//   5. Solicitud pedida ≠ privatización aplicada (pendiente/en_revision/rechazado no cuentan).
//   6. El estado vigente es la ÚLTIMA solicitud por fecha, no la suma de todas.
//
// Ver docs/integraciones/api-privatizaciones.md.
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import type { Modificacion } from '@/app/actions/modificaciones';

export type ModRegistro = Modificacion & { id: string };

/** Estados que llegaron a tocar la plataforma. Los históricos no traen el campo. */
const ESTADOS_EFECTIVOS = new Set(['aprobado', 'creado', 'completado']);

export type PrivatizacionVigente = {
    itemId: string;
    plataforma: string | null;
    producto: string | null;
    variante: string | null;
    sku: string | null;
    unidades: number;
    correo: string | null;
    comercial: string | null;
    desde: string | null;
    modificacionId: string;
};

export type EventoModificacion = {
    modificacionId: string;
    itemId: string | null;
    fecha: string | null;
    accion: 'privatizar' | 'quitar_privatizacion' | 'sin_cambio' | null;
    visibilidad: string | null;
    correo: string | null;
    estado: string | null;
    tipo: string | null;
    plataforma: string | null;
    producto: string | null;
    sku: string | null;
    unidades: number;
    solicitadoPor: string | null;
    efectiva: boolean;
};

export type ClienteResuelto = {
    id: string | null;
    nombre: string | null;
    correos: string[];
    comercial: string | null;
};

// --- Normalización (regla 1, 2, 3) ---

export const normalizarCorreo = (valor: unknown): string =>
    typeof valor === 'string' ? valor.trim().toLowerCase() : '';

/** Todos los correos que menciona una modificación, normalizados y sin repetir. */
export function correosDe(mod: Partial<Modificacion>): string[] {
    const crudos = [
        ...String(mod.CORREO_CODIGO ?? '').split(/[,;\s]+/),
        String(mod.customerEmail ?? ''),
    ];
    return [...new Set(crudos.map(normalizarCorreo).filter(Boolean))];
}

/** El correo que manda: el primero de CORREO_CODIGO, como hace el resto de la app. */
export function correoPrincipal(mod: Partial<Modificacion>): string | null {
    return correosDe(mod)[0] ?? null;
}

/** "1234567", "1234567.0" y 1234567 son el mismo ID. */
export function itemIdDe(mod: Partial<Modificacion>): string | null {
    const crudo = String(mod.ID ?? '').trim().replace(/\.0+$/, '');
    return crudo && crudo !== 'null' ? crudo : null;
}

/** FECHA es epoch ms, pero algún registro llega como Date o Timestamp. */
export function aMs(valor: unknown): number | null {
    if (valor == null) return null;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (valor instanceof Date) return valor.getTime();
    if (typeof valor === 'object' && typeof (valor as any).toDate === 'function') {
        return (valor as any).toDate().getTime();
    }
    const parseada = new Date(valor as any).getTime();
    return Number.isNaN(parseada) ? null : parseada;
}

const aIso = (ms: number | null): string | null => (ms == null ? null : new Date(ms).toISOString());

/** Regla 5: lo pendiente o rechazado no cambió nada en la plataforma. */
export function esEfectiva(mod: Partial<Modificacion>): boolean {
    if (!mod.estadoSolicitud) return true; // registros históricos, previos al flujo de estados
    return ESTADOS_EFECTIVOS.has(mod.estadoSolicitud);
}

const sinTildes = (valor: unknown): string =>
    String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** ¿El ID queda privado después de esta modificación? */
export function quedaPrivado(mod: Partial<Modificacion>): boolean {
    if (mod.ACCION_PRIVATIZACION === 'privatizar') return true;
    if (mod.ACCION_PRIVATIZACION === 'quitar_privatizacion') return false;
    return sinTildes(mod.PRIVADO_PUBLICO).startsWith('priv');
}

const cantidadDe = (mod: Partial<Modificacion>): number =>
    Number(mod['CANTIDAD SOLICITADA']) || 0;

const comercialDe = (mod: Partial<Modificacion>): string | null =>
    mod.solicitadoPor?.name || mod.COMERCIAL || null;

const skuDe = (mod: Partial<Modificacion>): string | null => {
    const sku = mod['SKU '] ?? (mod as any).SKU; // la clave del campo lleva un espacio final
    return sku == null || sku === '' ? null : String(sku);
};

// --- Resolución del estado vigente (regla 6) ---

/**
 * Última modificación efectiva de cada ID. Es la que manda: un ID puede privatizarse,
 * liberarse y reasignarse a otro cliente, y solo la última fila describe el presente.
 * Una FECHA nula se trata como la más antigua, para que nunca gane a una fechada.
 */
export function ultimaPorItem(mods: ModRegistro[]): Map<string, ModRegistro> {
    const porItem = new Map<string, ModRegistro>();
    for (const mod of mods) {
        if (!esEfectiva(mod)) continue;
        const itemId = itemIdDe(mod);
        if (!itemId) continue;

        const previa = porItem.get(itemId);
        if (!previa || (aMs(mod.FECHA) ?? 0) > (aMs(previa.FECHA) ?? 0)) porItem.set(itemId, mod);
    }
    return porItem;
}

/**
 * IDs que están privatizados ahora mismo. Si se pasan correos, solo los de ese cliente.
 *
 * Las unidades se suman SOLO sobre las solicitudes del dueño actual, no sobre todas las
 * del ID: mezclarlas contaría el stock que en su día se asignó a un dueño anterior.
 * Es el mismo criterio que usa buildMappingsFromSolicitudes() en platform-sales.ts.
 */
export function resolverVigentes(mods: ModRegistro[], correos?: string[]): PrivatizacionVigente[] {
    const filtro = correos?.length ? new Set(correos.map(normalizarCorreo)) : null;
    const efectivas = mods.filter(esEfectiva);
    const vigentes: PrivatizacionVigente[] = [];

    for (const [itemId, ultima] of ultimaPorItem(mods)) {
        if (!quedaPrivado(ultima)) continue;

        const dueno = correoPrincipal(ultima);
        if (filtro && (!dueno || !filtro.has(dueno))) continue;

        const unidades = efectivas
            .filter(m => itemIdDe(m) === itemId && correoPrincipal(m) === dueno)
            .reduce((total, m) => total + cantidadDe(m), 0);

        vigentes.push({
            itemId,
            plataforma: ultima.PLATAFORMA || null,
            producto: ultima.PRODUCTO || null,
            variante: ultima.VARIABLE || null,
            sku: skuDe(ultima),
            unidades,
            correo: dueno,
            comercial: comercialDe(ultima),
            desde: aIso(aMs(ultima.FECHA)),
            modificacionId: ultima.id,
        });
    }

    return vigentes.sort((a, b) => (b.desde ?? '').localeCompare(a.desde ?? ''));
}

/** Todas las modificaciones como eventos planos, de la más reciente a la más antigua. */
export function construirHistorial(mods: ModRegistro[]): EventoModificacion[] {
    return mods
        .map(mod => ({
            modificacionId: mod.id,
            itemId: itemIdDe(mod),
            fecha: aIso(aMs(mod.FECHA)),
            accion: mod.ACCION_PRIVATIZACION ?? null,
            visibilidad: mod.PRIVADO_PUBLICO || null,
            correo: correoPrincipal(mod),
            estado: mod.estadoSolicitud ?? null,
            tipo: mod.tipoModificacion ?? null,
            plataforma: mod.PLATAFORMA || null,
            producto: mod.PRODUCTO || null,
            sku: skuDe(mod),
            unidades: cantidadDe(mod),
            solicitadoPor: comercialDe(mod),
            efectiva: esEfectiva(mod),
        }))
        .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

// --- Acceso a datos ---

async function fs() {
    return getFirestore(await getApp());
}

// La colección entera son ~6.700 documentos (medido el 1/9/2026) y hay que barrerla: es la
// única forma de aplicar las reglas 1 y 2, porque Firestore no sabe buscar "contiene" y una
// igualdad sobre CORREO_CODIGO se deja fuera las filas con varios correos o con mayúsculas.
//
// Pero se traen SOLO los campos que se leen. Sin proyección son 4,8 MB de JSON y ~60 MB de
// heap retenidos por la caché; con ella, 1,9 MB y ~30 MB. Importa porque la instancia de
// App Hosting tiene 512 MiB y en este repo ya hubo 503 por agotarla leyendo colecciones
// enteras (ver el comentario de search-guides sobre los ~26 MB de despachos).
const CAMPOS = [
    'ID', 'CORREO_CODIGO', 'customerEmail', 'PRIVADO_PUBLICO', 'ACCION_PRIVATIZACION',
    'estadoSolicitud', 'FECHA', 'PLATAFORMA', 'PRODUCTO', 'VARIABLE', 'SKU ', 'SKU',
    'CANTIDAD SOLICITADA', 'COMERCIAL', 'solicitadoPor', 'tipoModificacion',
] as const;

const CACHE_MS = 5 * 60 * 1000;
let cache: { ts: number; mods: ModRegistro[] } | null = null;

export async function cargarModificaciones(forzar = false): Promise<ModRegistro[]> {
    if (!forzar && cache && Date.now() - cache.ts < CACHE_MS) return cache.mods;

    const snap = await (await fs()).collection('modificaciones').select(...CAMPOS).get();
    const mods = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ModRegistro);
    cache = { ts: Date.now(), mods };
    return mods;
}

/** Ficha del cliente por id de documento o por cualquiera de sus correos. */
export async function buscarCliente(params: { clientId?: string; correo?: string }): Promise<ClienteResuelto | null> {
    const db = await fs();

    if (params.clientId) {
        const snap = await db.collection('clients').doc(params.clientId).get();
        if (!snap.exists) return null;
        return aClienteResuelto(snap.id, snap.data());
    }

    const correo = normalizarCorreo(params.correo);
    if (!correo) return null;

    // Los correos se guardan tal cual los escribió el comercial, así que la igualdad
    // exacta puede fallar por mayúsculas. Se intenta primero por índice (barato) y,
    // si no aparece, se recorre la colección (~1.200 fichas) comparando normalizado.
    for (const campo of ['email', 'additional_emails'] as const) {
        const q = campo === 'email'
            ? db.collection('clients').where('email', '==', params.correo).limit(1)
            : db.collection('clients').where('additional_emails', 'array-contains', params.correo).limit(1);
        const snap = await q.get();
        if (!snap.empty) return aClienteResuelto(snap.docs[0].id, snap.docs[0].data());
    }

    const todos = await db.collection('clients').get();
    const encontrado = todos.docs.find(d => aClienteResuelto(d.id, d.data()).correos.includes(correo));
    return encontrado ? aClienteResuelto(encontrado.id, encontrado.data()) : null;
}

function aClienteResuelto(id: string, datos: any): ClienteResuelto {
    const correos = [datos?.email, ...(Array.isArray(datos?.additional_emails) ? datos.additional_emails : [])]
        .map(normalizarCorreo)
        .filter(Boolean);
    return {
        id,
        nombre: datos?.name ?? null,
        correos: [...new Set(correos)],
        comercial: datos?.assigned_commercial_name ?? null,
    };
}

// --- Consulta completa ---

export type ConsultaPrivatizaciones = {
    clientId?: string;
    correo?: string;
    itemId?: string;
    plataforma?: string;
    desde?: number;
    hasta?: number;
    incluirHistorial?: boolean;
};

export type RespuestaPrivatizaciones = {
    cliente: ClienteResuelto | null;
    vigentes: PrivatizacionVigente[];
    historial: EventoModificacion[];
    total: { vigentes: number; unidades: number; eventos: number };
};

export async function consultarPrivatizaciones(consulta: ConsultaPrivatizaciones): Promise<RespuestaPrivatizaciones> {
    const cliente = consulta.clientId || consulta.correo
        ? await buscarCliente({ clientId: consulta.clientId, correo: consulta.correo })
        : null;

    // Correos con los que filtrar: los de la ficha, más el que pidió el llamante por si
    // la modificación quedó a un correo que la ficha del CRM ya no lista.
    const correos = [...new Set([
        ...(cliente?.correos ?? []),
        normalizarCorreo(consulta.correo),
    ].filter(Boolean))];

    if ((consulta.clientId || consulta.correo) && correos.length === 0) {
        return { cliente, vigentes: [], historial: [], total: { vigentes: 0, unidades: 0, eventos: 0 } };
    }

    const todas = await cargarModificaciones();

    // Regla 4: el mismo número de ID puede existir en dos plataformas.
    const enPlataforma = (mod: ModRegistro) => !consulta.plataforma
        || sinTildes(mod.PLATAFORMA) === sinTildes(consulta.plataforma);

    const delAmbito = todas.filter(mod => {
        if (!enPlataforma(mod)) return false;
        if (consulta.itemId && itemIdDe(mod) !== consulta.itemId) return false;
        if (correos.length && !correosDe(mod).some(c => correos.includes(c))) return false;
        return true;
    });

    // Las vigentes se calculan sobre TODAS las modificaciones del ID, no solo sobre las
    // del cliente: si otro se lo quedó después, ya no está privatizado a este.
    const idsDelAmbito = new Set(delAmbito.map(itemIdDe).filter(Boolean) as string[]);
    const paraVigentes = todas.filter(mod => {
        const itemId = itemIdDe(mod);
        return itemId != null && idsDelAmbito.has(itemId) && enPlataforma(mod);
    });

    const vigentes = resolverVigentes(paraVigentes, correos.length ? correos : undefined);

    const enRango = (mod: ModRegistro) => {
        const ms = aMs(mod.FECHA);
        if (consulta.desde != null && (ms == null || ms < consulta.desde)) return false;
        if (consulta.hasta != null && (ms == null || ms > consulta.hasta)) return false;
        return true;
    };

    const historial = consulta.incluirHistorial === false
        ? []
        : construirHistorial(delAmbito.filter(enRango));

    return {
        cliente,
        vigentes,
        historial,
        total: {
            vigentes: vigentes.length,
            unidades: vigentes.reduce((t, v) => t + v.unidades, 0),
            eventos: historial.length,
        },
    };
}
