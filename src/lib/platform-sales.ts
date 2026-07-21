// Ventas de plataformas (Dropi, etc.) importadas desde los reportes de despacho.
// Venta real = orden ENTREGADA. La atribución al cliente se hace por el mapeo
// ID de item → correo de privatización (solicitudes + histórico ClickUp + manual);
// los items públicos no se atribuyen a un cliente (van al producto y al comercial).
import { db } from '@/lib/firebase';
import {
    collection, doc, getDoc, getDocs, limit, query, setDoc, where, writeBatch,
} from 'firebase/firestore';
import type { Modificacion } from '@/app/actions/modificaciones';

export const FINAL_STATES = ['ENTREGADO', 'DEVOLUCION', 'CANCELADO', 'RECHAZADO'];

export type SaleClassification = 'activacion' | 'continuidad' | 'reactivacion' | 'publica' | 'sin_atribuir';

export type PlatformSale = {
    id?: string; // `${platform}_${guia}`
    platform: string;
    guia: string;
    orderDate: number | null; // epoch ms
    month: string | null; // YYYY-MM
    estado: string;
    esFinal: boolean;
    esEntregado: boolean;
    itemIds: string[];
    total: number;
    quantity?: number; // unidades reales (si el archivo trae CANTIDAD)
    itemQuantities?: Record<string, number>; // unidades por item
    // Atribución (se llena con el mapeo)
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    productId?: string;
    productName?: string;
    commercialId?: string;
    commercialName?: string;
    classification?: SaleClassification;
    sobreCupo?: boolean; // venta que excede el cupo asignado al dueño vigente
    tienda?: string; // tienda del dropshipper (columna TIENDA), desempate de items compartidos
    posibleCompartida?: boolean; // atribuida por tenencia pero con dueño anterior con remanente
    bodega?: string; // origen del reporte (INGENIO/LABORATORIO/IMPORTACIONES…)
    pais?: string;
    importedAt: number;
};

export type PlatformItemMapping = {
    id?: string; // `${platform}_${itemId}`
    platform: string;
    itemId: string;
    visibility: 'privado' | 'publico' | 'desconocido';
    clientEmail?: string;
    clientId?: string;
    clientName?: string;
    productId?: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    sku?: string;
    commercialName?: string;
    assignedQty?: number; // unidades asignadas (privatizaciones/sumas), en combos
    unitsPerOrder?: number; // unidades del producto base por venta (x2, x3, combo). Default 1
    bundleWith?: Array<{ productId?: string; productName: string }>; // productos DISTINTOS del bundle (SKU+SKU)
    needsComposition?: boolean; // detectado como combo/bundle sin factor confirmado
    source: 'solicitud' | 'clickup' | 'manual' | 'archivo';
};

export type ReportMonth = {
    id?: string; // `${platform}_${month}`
    platform: string;
    month: string;
    totalOrders: number;
    finalOrders: number;
    pendingOrders: number;
    entregadas: number;
    closed: boolean;
    lastImportAt: number;
};

export type ParsedRow = {
    guia: string;
    fecha: string; // como venga en el archivo
    estado: string;
    itemIds: string[];
    total: number;
    quantity?: number; // unidades reales (columna CANTIDAD)
    itemQuantities?: Record<string, number>;
    itemInfo?: Record<string, { sku?: string; productName?: string; variantName?: string }>; // para auto-mapeo desde el archivo
    clientEmail?: string; // solo si el archivo trae columnas de dropshipper
    clientName?: string;
    tienda?: string; // tienda del dropshipper que generó la orden
    bodega?: string; // columna BODEGA (formato COMPANY)
};

// --- Parser del reporte de Dropi (por nombre de columna, robusto al orden) ---

function parseDate(raw: string): number | null {
    if (!raw) return null;
    // dd-mm-yyyy o dd/mm/yyyy
    const m = String(raw).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.getTime();
}

// Normaliza encabezados: mayúsculas, sin tildes, espacios colapsados
function normHeader(value: any): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

export function parseDropiRows(rows: any[][]): { parsed: ParsedRow[]; errors: string[] } {
    const errors: string[] = [];
    if (!rows.length) return { parsed: [], errors: ['Archivo vacío'] };

    // Detectar la fila de encabezados en las primeras 10 filas (algunos exports
    // traen títulos arriba): la que contenga GUIA y ESTATUS/ESTADO.
    let headerRow = -1;
    let headers: string[] = [];
    for (let r = 0; r < Math.min(10, rows.length); r++) {
        const h = (rows[r] || []).map(normHeader);
        if (h.some(x => x.includes('GUIA')) && h.some(x => x.includes('ESTATUS') || x.includes('ESTADO'))) {
            headerRow = r;
            headers = h;
            break;
        }
    }
    if (headerRow === -1) {
        const found = (rows[0] || []).map(normHeader).filter(Boolean).slice(0, 15).join(', ');
        return { parsed: [], errors: [`No se encontró la fila de encabezados (se busca una con GUIA y ESTATUS/ESTADO). Columnas de la primera fila: ${found || '(vacías)'}. Envíame una captura de los encabezados de tu archivo para agregar el formato.`] };
    }

    // Búsqueda flexible: exacto primero, luego por contención con exclusiones
    const find = (exact: string[], contains: string[], exclude: string[] = []): number => {
        for (const e of exact) {
            const i = headers.findIndex(h => h === e);
            if (i !== -1) return i;
        }
        return headers.findIndex(h =>
            contains.some(c => h.includes(c)) && !exclude.some(x => h.includes(x))
        );
    };

    const iGuia = find(['NUMERO GUIA', '# DE GUIA', 'GUIA'], ['GUIA'], ['ORIGINAL', 'GENERACION', 'FECHA']);
    const iEstado = find(['ESTATUS', 'ESTADO PEDIDO', 'ESTADO'], ['ESTATUS', 'ESTADO'], ['TRANSPORTE']);
    const iProductos = find(['PRODUCTOS', 'PRODUCTO'], ['PRODUCTO'], []);
    const iFecha = find(['FECHA'], ['FECHA'], ['REPORTE', 'NOVEDAD', 'SOLUCION', 'ENTREGADO', 'DEVOLUCION', 'MOVIMIENTO', 'ACLARACION', 'PENDIENTE', 'PROCESAM', 'PRODUCIDA', 'GENERACION', 'TRANSACCION', 'ALISTAMIENTO', 'RECOGIDA', 'PAGO']);
    const iTotal = find(['TOTAL DE LA ORDEN', 'TOTAL VENTA', 'TOTAL ORDEN'], ['TOTAL DE LA ORDEN', 'TOTAL VENTA'], []);
    const iEmail = find(['EMAIL'], ['EMAIL'], ['PROVEEDOR', 'FACTURACION', 'COMPRADOR', 'REFERIDO']);
    const iDropshipper = find(['DROPSHIPPER', 'TIENDA VENTA'], ['DROPSHIPPER'], ['ID', 'CATEGORIA', 'ORDEN']);
    // Formato "una fila por producto": PRODUCTO ID + SKU + CANTIDAD dedicados.
    // OJO: en ese formato EMAIL/NOMBRE CLIENTE son del comprador final, no del
    // dropshipper → solo se usa EMAIL como cliente si existe columna DROPSHIPPER.
    const iProductoId = find(['PRODUCTO ID'], [], []);
    const iSku = find(['SKU'], [], []);
    const iCantidad = find(['CANTIDAD'], [], ['PRECIO']);
    const iProductoNombre = find(['PRODUCTO'], [], []);
    const iVariacion = find(['VARIACION'], [], ['ID']);
    const iTienda = find(['TIENDA', 'NOMBRE TIENDA'], [], ['TIPO', 'ORDEN', 'PROVEEDOR', 'TELEFONO', 'PEDIDO']);
    const iBodega = find(['BODEGA'], [], ['ID']);
    const usarEmail = iDropshipper !== -1;

    const faltantes: string[] = [];
    if (iGuia === -1) faltantes.push('número de guía');
    if (iEstado === -1) faltantes.push('estado/estatus');
    if (iProductos === -1) faltantes.push('productos');
    if (faltantes.length > 0) {
        return { parsed: [], errors: [`Faltan columnas: ${faltantes.join(', ')}. Columnas detectadas: ${headers.filter(Boolean).slice(0, 20).join(', ')}. Envíame los encabezados de tu archivo para agregar el formato.`] };
    }

    const parsed: ParsedRow[] = [];
    for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const guia = String(row[iGuia] ?? '').trim();
        const estado = String(row[iEstado] ?? '').trim().toUpperCase();
        if (!guia || !estado) continue;

        let itemIds: string[] = [];
        if (iProductoId !== -1) {
            const pid = String(row[iProductoId] ?? '').replace(/\.0$/, '').trim();
            if (/^\d{3,}$/.test(pid)) itemIds = [pid];
        } else {
            const productosRaw = String(row[iProductos] ?? '');
            itemIds = productosRaw.split(/[-,;\s]+/).map(s => s.trim()).filter(s => /^\d{3,}$/.test(s));
        }

        const qty = iCantidad !== -1 ? (Number(row[iCantidad]) || 1) : undefined;
        const itemQuantities = qty !== undefined && itemIds.length === 1 ? { [itemIds[0]]: qty } : undefined;
        const itemInfo = itemIds.length === 1 && (iSku !== -1 || iProductoNombre !== -1) ? {
            [itemIds[0]]: {
                sku: iSku !== -1 ? String(row[iSku] ?? '').trim() || undefined : undefined,
                productName: iProductoNombre !== -1 ? String(row[iProductoNombre] ?? '').trim() || undefined : undefined,
                variantName: iVariacion !== -1 ? String(row[iVariacion] ?? '').trim() || undefined : undefined,
            }
        } : undefined;

        parsed.push({
            guia,
            fecha: iFecha !== -1 ? String(row[iFecha] ?? '') : '',
            estado,
            itemIds,
            total: iTotal !== -1 ? (Number(row[iTotal]) || 0) : 0,
            quantity: qty,
            itemQuantities,
            itemInfo,
            clientEmail: usarEmail && iEmail !== -1 ? String(row[iEmail] ?? '').trim().toLowerCase() || undefined : undefined,
            clientName: iDropshipper !== -1 ? String(row[iDropshipper] ?? '').trim() || undefined : undefined,
            tienda: iTienda !== -1 ? String(row[iTienda] ?? '').trim() || undefined : undefined,
            bodega: iBodega !== -1 ? String(row[iBodega] ?? '').trim() || undefined : undefined,
        });
    }

    // Agrupar por guía (el formato por-producto repite la guía en varias filas)
    const byGuia = new Map<string, ParsedRow>();
    for (const row of parsed) {
        const prev = byGuia.get(row.guia);
        if (!prev) { byGuia.set(row.guia, row); continue; }
        for (const id of row.itemIds) if (!prev.itemIds.includes(id)) prev.itemIds.push(id);
        if (row.itemQuantities) {
            prev.itemQuantities = prev.itemQuantities || {};
            for (const [id, q] of Object.entries(row.itemQuantities)) {
                prev.itemQuantities[id] = (prev.itemQuantities[id] || 0) + q;
            }
        }
        if (row.itemInfo) prev.itemInfo = { ...(prev.itemInfo || {}), ...row.itemInfo };
        if (row.tienda && !prev.tienda) prev.tienda = row.tienda;
        if (row.quantity) prev.quantity = (prev.quantity || 0) + row.quantity;
        // TOTAL DE LA ORDEN es el mismo en todas las filas de la orden: no se suma
    }
    const grouped = Array.from(byGuia.values());

    if (grouped.length === 0) errors.push('No se encontraron filas válidas.');
    return { parsed: grouped, errors };
}

// Detecta multiplicidad (x2, x3) y bundles (A+B) desde SKU o nombre.
// factor = unidades del producto base por venta; isBundle = productos distintos.
export function detectComposition(sku?: string, productName?: string, comboUnits?: number): { factor: number; isBundle: boolean } {
    if (comboUnits && comboUnits > 1) return { factor: comboUnits, isBundle: false };
    const texts = [sku || '', productName || ''];
    // x2..x9 pegado o con espacio: "SKUx2", "COMBO X3", "PACK X 2"
    let factor = 1;
    for (const t of texts) {
        const m = t.toUpperCase().match(/X\s?([2-9])\b/);
        if (m) { factor = Math.max(factor, Number(m[1])); }
    }
    // Bundle de productos distintos: SKU con "+" o palabras clave con dos nombres
    const skuBundle = (sku || '').includes('+');
    const nameBundle = /\b(COMBO|KIT|PACK|DUO|TRIO|BUNDLE)\b/i.test(productName || '') && (productName || '').includes('+');
    const isBundle = skuBundle || nameBundle;
    return { factor, isBundle };
}

// --- Mapeo de items ---

export async function loadMappings(platform: string): Promise<Map<string, PlatformItemMapping>> {
    const snap = await getDocs(query(collection(db, 'platformItemMappings'), where('platform', '==', platform), limit(5000)));
    const map = new Map<string, PlatformItemMapping>();
    for (const d of snap.docs) {
        const m = { id: d.id, ...d.data() } as PlatformItemMapping;
        map.set(m.itemId, m);
    }
    return map;
}

// Vigencia de un item: quién era el dueño (correo/comercial) en cada momento,
// según las solicitudes ordenadas por fecha. Permite atribuir cada venta al
// dueño VIGENTE a la fecha de la venta (no al dueño actual).
export type ItemOwnership = { fecha: number; correo?: string; comercial?: string; cantidad?: number };
export type ItemTimelines = Map<string, ItemOwnership[]>;

export function ownerAtDate(timeline: ItemOwnership[] | undefined, saleDate: number | null): ItemOwnership | undefined {
    if (!timeline?.length) return undefined;
    if (!saleDate) return timeline[timeline.length - 1]; // sin fecha: dueño actual
    let owner: ItemOwnership | undefined;
    for (const entry of timeline) {
        if (entry.fecha <= saleDate) owner = entry;
        else break;
    }
    // Venta anterior a la primera solicitud: se asume el primer dueño conocido
    return owner ?? timeline[0];
}

// Crea/actualiza mapeos desde las solicitudes de ADMA que tengan ID de plataforma
export async function buildMappingsFromSolicitudes(platform: string, itemIds: Set<string>, existing: Map<string, PlatformItemMapping>): Promise<{ created: number; timelines: ItemTimelines }> {
    const solsSnap = await getDocs(query(collection(db, 'modificaciones'), where('ID', '!=', null), limit(3000)));
    const byItemId = new Map<string, (Modificacion & { id: string })[]>();
    for (const d of solsSnap.docs) {
        const s = { id: d.id, ...d.data() } as Modificacion & { id: string };
        const itemId = String(s.ID ?? '').replace(/\.0$/, '');
        if (!itemId) continue;
        if (!byItemId.has(itemId)) byItemId.set(itemId, []);
        byItemId.get(itemId)!.push(s);
    }

    // Línea de tiempo por item (todas las solicitudes, ordenadas por fecha)
    const timelines: ItemTimelines = new Map();
    for (const [itemId, sols] of byItemId) {
        const entries = sols
            .filter(s => s.FECHA)
            .sort((a, b) => (a.FECHA || 0) - (b.FECHA || 0))
            .map(s => ({
                fecha: s.FECHA!,
                correo: (s.CORREO_CODIGO || '').split(/[,;\s]+/)[0]?.trim().toLowerCase() || undefined,
                comercial: s.solicitadoPor?.name || s.COMERCIAL || undefined,
                cantidad: Number(s['CANTIDAD SOLICITADA']) || undefined,
            }));
        if (entries.length) timelines.set(itemId, entries);
    }

    const missing = Array.from(itemIds).filter(id => !existing.has(id));
    if (missing.length === 0) return { created: 0, timelines };

    let created = 0;
    const batch = writeBatch(db);
    for (const itemId of missing) {
        const sols = byItemId.get(itemId);
        if (!sols?.length) continue;
        const latest = sols.sort((a, b) => (b.FECHA || 0) - (a.FECHA || 0))[0];
        const correo = (latest.CORREO_CODIGO || '').split(/[,;\s]+/)[0]?.trim().toLowerCase() || undefined;
        // Stock asignado SOLO del dueño actual (no mezclar asignaciones de dueños anteriores)
        const assignedQty = sols
            .filter(s => ((s.CORREO_CODIGO || '').split(/[,;\s]+/)[0]?.trim().toLowerCase() || undefined) === correo)
            .reduce((acc, s) => acc + (Number(s['CANTIDAD SOLICITADA']) || 0), 0);
        const comboUnits = (latest as any).COMBO?.unidadesPorCombo as number | undefined;
        const det = detectComposition(latest['SKU '] ? String(latest['SKU ']) : undefined, latest.PRODUCTO || undefined, comboUnits);
        const mapping: PlatformItemMapping = {
            platform,
            itemId,
            visibility: latest.PRIVADO_PUBLICO === 'Privado' ? 'privado' : latest.PRIVADO_PUBLICO === 'Publico' ? 'publico' : 'desconocido',
            clientEmail: correo,
            productId: latest.productId || undefined,
            productName: latest.PRODUCTO || undefined,
            sku: latest['SKU '] ? String(latest['SKU ']) : undefined,
            commercialName: latest.solicitadoPor?.name || latest.COMERCIAL || undefined,
            assignedQty: assignedQty || undefined,
            unitsPerOrder: det.factor > 1 ? det.factor : undefined,
            needsComposition: det.isBundle || undefined,
            source: 'solicitud',
        };
        const clean: Record<string, any> = { ...mapping };
        Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);
        batch.set(doc(db, 'platformItemMappings', `${platform}_${itemId}`), clean, { merge: true });
        existing.set(itemId, mapping);
        created++;
    }
    if (created > 0) await batch.commit();
    return { created, timelines };
}

// --- Mapeo tienda → cliente (desempate de items compartidos) ---

function normTienda(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export async function loadTiendaMappings(): Promise<Map<string, string>> {
    const snap = await getDocs(query(collection(db, 'tiendaClienteMappings'), limit(3000)));
    const map = new Map<string, string>();
    for (const d of snap.docs) {
        const data = d.data();
        if (data.tienda && data.clientEmail) map.set(normTienda(data.tienda), String(data.clientEmail).toLowerCase());
    }
    return map;
}

export async function saveTiendaMapping(tienda: string, clientEmail: string): Promise<void> {
    const norm = normTienda(tienda);
    await setDoc(doc(db, 'tiendaClienteMappings', norm.replace(/[^A-Z0-9]/g, '_').slice(0, 100) || 'X'), {
        tienda: tienda.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        updatedAt: Date.now(),
    }, { merge: true });
}

// Tiendas vistas en ventas sin mapeo a cliente (para la cola de vinculación)
export async function getUnmappedTiendas(platform: string): Promise<Array<{ tienda: string; ventas: number }>> {
    const [salesSnap, tiendaMap] = await Promise.all([
        getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), limit(10000))),
        loadTiendaMappings(),
    ]);
    const counter = new Map<string, { tienda: string; ventas: number }>();
    for (const d of salesSnap.docs) {
        const sale = d.data() as PlatformSale;
        if (!sale.tienda) continue;
        const norm = normTienda(sale.tienda);
        if (tiendaMap.has(norm)) continue;
        const entry = counter.get(norm) || { tienda: sale.tienda, ventas: 0 };
        entry.ventas++;
        counter.set(norm, entry);
    }
    return Array.from(counter.values()).sort((a, b) => b.ventas - a.ventas);
}

export async function saveManualMapping(platform: string, itemId: string, data: Partial<PlatformItemMapping>): Promise<void> {
    const clean: Record<string, any> = { platform, itemId, source: 'manual', ...data };
    Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);
    await setDoc(doc(db, 'platformItemMappings', `${platform}_${itemId}`), clean, { merge: true });
}

// --- Importación + clasificación ---

export type ImportSummary = {
    total: number;
    nuevas: number;
    actualizadas: number;
    entregadas: number;
    atribuidas: number;
    publicas: number;
    sinMapear: number;
    sobreCupo: number;
    posiblesCompartidas: number;
    tiendasAprendidas: number;
    mapeosCreados: number;
    ofertasConvertidas: number;
    mesesAbiertos: string[];
};

export async function importPlatformSales(
    platform: string,
    parsed: ParsedRow[],
    reactivationDays: number,
    context?: { bodega?: string; pais?: string },
    onProgress?: (msg: string) => void
): Promise<ImportSummary> {
    const progress = (msg: string) => onProgress?.(msg);

    // 1. Mapeos
    progress('Cargando mapeos de items…');
    const mappings = await loadMappings(platform);
    const itemIdsInFile = new Set(parsed.flatMap(p => p.itemIds));
    const solicitudesResult = await buildMappingsFromSolicitudes(platform, itemIdsInFile, mappings);
    let mapeosCreados = solicitudesResult.created;
    let summaryTiendas = 0;
    const timelines = solicitudesResult.timelines;

    // Si el archivo trae SKU/nombre por item (formato por-producto), crear mapeos
    // de producto para los items que sigan sin mapeo (sin cliente: quedan como
    // 'desconocido' hasta que una solicitud o un mapeo manual diga si son privados)
    const fileInfoBatch = writeBatch(db);
    let fileInfoCount = 0;
    for (const row of parsed) {
        for (const [itemId, info] of Object.entries(row.itemInfo || {})) {
            if (mappings.has(itemId) || (!info.sku && !info.productName)) continue;
            const det = detectComposition(info.sku, info.productName);
            const mapping: PlatformItemMapping = {
                platform, itemId, visibility: 'desconocido',
                sku: info.sku, productName: info.productName, variantName: info.variantName,
                unitsPerOrder: det.factor > 1 ? det.factor : undefined,
                needsComposition: det.isBundle || undefined,
                source: 'archivo',
            };
            const clean: Record<string, any> = { ...mapping };
            Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);
            fileInfoBatch.set(doc(db, 'platformItemMappings', `${platform}_${itemId}`), clean, { merge: true });
            mappings.set(itemId, mapping);
            fileInfoCount++;
            if (fileInfoCount >= 400) break;
        }
        if (fileInfoCount >= 400) break;
    }
    if (fileInfoCount > 0) { await fileInfoBatch.commit(); mapeosCreados += fileInfoCount; }

    // 1b. Mapeos tienda → cliente (desempate de items compartidos)
    const tiendaMap = await loadTiendaMappings();
    // Auto-aprendizaje: filas que traen dropshipper (email) Y tienda enseñan el vínculo
    const tiendaLearnBatch = writeBatch(db);
    let tiendasAprendidas = 0;
    const yaAprendidas = new Set<string>();
    for (const row of parsed) {
        if (!row.clientEmail || !row.tienda) continue;
        const norm = normTienda(row.tienda);
        if (tiendaMap.has(norm) || yaAprendidas.has(norm)) continue;
        tiendaLearnBatch.set(doc(db, 'tiendaClienteMappings', norm.replace(/[^A-Z0-9]/g, '_').slice(0, 100) || 'X'), {
            tienda: row.tienda, clientEmail: row.clientEmail, source: 'archivo', updatedAt: Date.now(),
        }, { merge: true });
        tiendaMap.set(norm, row.clientEmail);
        yaAprendidas.add(norm);
        tiendasAprendidas++;
        if (tiendasAprendidas >= 400) break;
    }
    if (tiendasAprendidas > 0) await tiendaLearnBatch.commit();
    summaryTiendas = tiendasAprendidas;

    // 2. Clientes por correo
    progress('Cargando clientes del CRM…');
    const clientsSnap = await getDocs(query(collection(db, 'clients'), limit(3000)));
    const emailToClient = new Map<string, { id: string; name: string }>();
    for (const d of clientsSnap.docs) {
        const data = d.data();
        const entry = { id: d.id, name: data.name || '' };
        if (data.email) emailToClient.set(String(data.email).toLowerCase(), entry);
        for (const e of data.additional_emails || []) emailToClient.set(String(e).toLowerCase(), entry);
    }

    // 3. Historial existente de ventas de la plataforma (para clasificar)
    progress('Cargando historial de ventas…');
    const prevSnap = await getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), limit(10000)));
    const prevSales = new Map<string, PlatformSale>();
    for (const d of prevSnap.docs) prevSales.set(d.id, { id: d.id, ...d.data() } as PlatformSale);

    // 4. Construir las ventas del archivo
    const now = Date.now();
    const summary: ImportSummary = { total: parsed.length, nuevas: 0, actualizadas: 0, entregadas: 0, atribuidas: 0, publicas: 0, sinMapear: 0, sobreCupo: 0, posiblesCompartidas: 0, tiendasAprendidas: 0, mapeosCreados, ofertasConvertidas: 0, mesesAbiertos: [] };
    const sales: PlatformSale[] = [];

    for (const row of parsed) {
        const orderDate = parseDate(row.fecha);
        const month = orderDate ? new Date(orderDate).toISOString().slice(0, 7) : null;
        const esFinal = FINAL_STATES.includes(row.estado);
        const esEntregado = row.estado === 'ENTREGADO';
        const docId = `${platform}_${row.guia}`;

        const sale: PlatformSale = {
            id: docId, platform, guia: row.guia, orderDate, month,
            estado: row.estado, esFinal, esEntregado,
            itemIds: row.itemIds, total: row.total,
            quantity: row.quantity, itemQuantities: row.itemQuantities,
            tienda: row.tienda,
            bodega: row.bodega || context?.bodega,
            pais: context?.pais,
            importedAt: now,
        };

        // Producto desde el mapeo; el cliente por vigencia+cupo se resuelve en el
        // pase cronológico. Si el archivo trae columnas de dropshipper, ese
        // cliente manda (dato directo de la plataforma).
        const mapping = row.itemIds.map(id => mappings.get(id)).find(Boolean);
        if (mapping) {
            sale.productId = mapping.productId;
            sale.productName = mapping.productName;
            sale.commercialName = mapping.commercialName;
        }
        if (row.clientEmail) {
            sale.clientEmail = row.clientEmail;
            const client = emailToClient.get(row.clientEmail);
            if (client) { sale.clientId = client.id; sale.clientName = client.name; }
            else if (row.clientName) sale.clientName = row.clientName;
        }

        if (prevSales.has(docId)) summary.actualizadas++; else summary.nuevas++;
        if (esEntregado) summary.entregadas++;
        sales.push(sale);
        prevSales.set(docId, sale); // el archivo manda sobre lo anterior
    }

    // 5. Clasificación de las ENTREGADAS (con el historial completo en memoria)
    progress('Clasificando ventas…');
    const all = Array.from(prevSales.values()).sort((a, b) => (a.orderDate || 0) - (b.orderDate || 0));
    const firstSaleByClientProduct = new Map<string, number>(); // clientId_productKey → fecha primera entrega
    const lastSaleByClient = new Map<string, number>();
    // Cupos por tenencia: cada solicitud abre un cupo (correo, comercial,
    // cantidad, desde su fecha). Reglas:
    // 1. Un cupo se CIERRA por fecha cuando entra una solicitud de OTRO cliente
    //    (la privatización cambió: el anterior ya no puede vender, aunque le
    //    sobraran unidades — el remanente se pierde, no absorbe ventas ajenas).
    // 2. Dentro de la tenencia, el tope es la cantidad: exceso → sobreCupo.
    // 3. Cupos del MISMO cliente se encadenan (no se cierran entre sí).
    type Cupo = { fecha: number; correo?: string; comercial?: string; cantidad?: number; consumido: number; cerradoDesde?: number };
    const cuposPorItem = new Map<string, Cupo[]>();
    const getCupos = (itemId: string): Cupo[] => {
        if (!cuposPorItem.has(itemId)) {
            const timeline = timelines.get(itemId) || [];
            const cupos: Cupo[] = timeline.map(e => ({ fecha: e.fecha, correo: e.correo, comercial: e.comercial, cantidad: e.cantidad, consumido: 0 }));
            // Todo cupo se cierra cuando llega una solicitud de OTRO correo
            for (let i = 0; i < cupos.length; i++) {
                const next = cupos.slice(i + 1).find(x => x.correo !== cupos[i].correo);
                if (next) cupos[i].cerradoDesde = next.fecha;
            }
            cuposPorItem.set(itemId, cupos);
        }
        return cuposPorItem.get(itemId)!;
    };
    const saleUnits = (sale: PlatformSale) => {
        const qty = Object.values(sale.itemQuantities || {}).reduce((a, b) => a + b, 0);
        return qty > 0 ? qty : 1;
    };

    for (const sale of all) {
        const itemId = sale.itemIds[0];
        const cupos = itemId ? getCupos(itemId) : [];

        if (!sale.clientEmail && cupos.length > 0) {
            const units = saleUnits(sale);
            const fecha = sale.orderDate || 0;
            const iniciados = cupos.filter(q => q.fecha <= fecha);
            const candidatos = iniciados.length > 0 ? iniciados : [cupos[0]];

            // PRIORIDAD 1 — Evidencia de TIENDA: si la tienda que generó la orden
            // pertenece a un cliente con cupo iniciado, la venta es suya aunque el
            // cupo esté "cerrado" por una solicitud posterior (items compartidos:
            // varios correos privatizados vendiendo a la vez).
            const tiendaCorreo = sale.tienda ? tiendaMap.get(normTienda(sale.tienda)) : undefined;
            const cupoTienda = tiendaCorreo ? candidatos.find(q => q.correo === tiendaCorreo) : undefined;

            // PRIORIDAD 2 — Tenencia: el cupo más antiguo abierto con espacio
            const cupoTenencia = candidatos.find(q => {
                if (q.cerradoDesde && fecha >= q.cerradoDesde) return false;
                if (q.cantidad === undefined) return true;
                return q.consumido + units <= q.cantidad;
            });

            const cupo = cupoTienda || cupoTenencia;
            if (cupo?.correo) {
                sale.clientEmail = cupo.correo;
                const client = emailToClient.get(cupo.correo);
                if (client) { sale.clientId = client.id; sale.clientName = client.name; }
                sale.commercialName = cupo.comercial || sale.commercialName;
                if (sale.esEntregado) cupo.consumido += units;

                // Sin evidencia de tienda y con un dueño anterior que aún tenía
                // remanente al cerrarse: la atribución por tenencia es incierta
                if (!cupoTienda && sale.esEntregado) {
                    const anteriorConRemanente = candidatos.some(q =>
                        q !== cupo && q.correo && q.correo !== cupo.correo &&
                        q.cerradoDesde && fecha >= q.cerradoDesde &&
                        (q.cantidad === undefined || q.consumido < q.cantidad)
                    );
                    if (anteriorConRemanente) sale.posibleCompartida = true;
                }
            } else if (sale.esEntregado) {
                sale.sobreCupo = true;
                const ultimo = candidatos[candidatos.length - 1];
                sale.commercialName = ultimo?.comercial || sale.commercialName;
            }
        } else if (sale.clientEmail && sale.esEntregado && cupos.length > 0) {
            // Cliente directo del archivo: consume su propio cupo si existe
            const propio = cupos.find(q => q.correo === sale.clientEmail && (q.cantidad === undefined || q.consumido + saleUnits(sale) <= q.cantidad));
            if (propio) propio.consumido += saleUnits(sale);
        }

        if (!sale.esEntregado) continue;
        const productKey = sale.productId || sale.itemIds[0] || '?';
        if (sale.clientId) {
            const cpKey = `${sale.clientId}_${productKey}`;
            const firstCP = firstSaleByClientProduct.get(cpKey);
            const lastAny = lastSaleByClient.get(sale.clientId);

            if (firstCP === undefined) sale.classification = 'activacion';
            else if (lastAny !== undefined && sale.orderDate && (sale.orderDate - lastAny) >= reactivationDays * 86400000) sale.classification = 'reactivacion';
            else sale.classification = 'continuidad';

            if (firstCP === undefined && sale.orderDate) firstSaleByClientProduct.set(cpKey, sale.orderDate);
            if (sale.orderDate) lastSaleByClient.set(sale.clientId, Math.max(lastAny || 0, sale.orderDate));
        } else if (sale.productId || sale.commercialName) {
            sale.classification = 'publica';
        } else {
            sale.classification = 'sin_atribuir';
        }
    }
    summary.tiendasAprendidas = summaryTiendas;
    for (const sale of sales) {
        if (!sale.esEntregado) continue;
        if (sale.sobreCupo) summary.sobreCupo++;
        if (sale.posibleCompartida) summary.posiblesCompartidas++;
        if (sale.classification === 'publica') summary.publicas++;
        else if (sale.classification === 'sin_atribuir') summary.sinMapear++;
        else if (sale.clientId) summary.atribuidas++;
    }

    // 6. Guardar ventas en lotes
    progress(`Guardando ${sales.length} órdenes…`);
    for (let i = 0; i < sales.length; i += 400) {
        const batch = writeBatch(db);
        for (const sale of sales.slice(i, i + 400)) {
            const clean: Record<string, any> = { ...sale };
            delete clean.id;
            Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);
            batch.set(doc(db, 'platformSales', sale.id!), clean, { merge: true });
        }
        await batch.commit();
    }

    // 7. Cierre de meses (sobre TODO el historial de la plataforma)
    progress('Calculando cierre de meses…');
    const byMonth = new Map<string, { total: number; final: number; entregadas: number }>();
    for (const sale of prevSales.values()) {
        if (!sale.month) continue;
        const m = byMonth.get(sale.month) || { total: 0, final: 0, entregadas: 0 };
        m.total++; if (sale.esFinal) m.final++; if (sale.esEntregado) m.entregadas++;
        byMonth.set(sale.month, m);
    }
    const monthBatch = writeBatch(db);
    for (const [month, m] of byMonth) {
        const pending = m.total - m.final;
        if (pending > 0) summary.mesesAbiertos.push(month);
        monthBatch.set(doc(db, 'platformReportMonths', `${platform}_${month}`), {
            platform, month, totalOrders: m.total, finalOrders: m.final,
            pendingOrders: pending, entregadas: m.entregadas,
            closed: pending === 0, lastImportAt: now,
        });
    }
    await monthBatch.commit();
    summary.mesesAbiertos.sort();

    // 8. Conversión automática: ventas atribuidas ENTREGADAS marcan ofertas como 'pedido'
    progress('Actualizando conversión de ofertas…');
    try {
        const promosSnap = await getDocs(query(collection(db, 'productPromotions'), limit(3000)));
        const promoBatch = writeBatch(db);
        let converted = 0;
        for (const pd of promosSnap.docs) {
            const promo = pd.data();
            if (promo.outcome === 'pedido') continue;
            const match = sales.find(s =>
                s.esEntregado && s.clientId && s.clientId === promo.clientId &&
                (s.productId === promo.productId || (s.productName && promo.productName && s.productName.toUpperCase() === String(promo.productName).toUpperCase())) &&
                s.orderDate && promo.date && s.orderDate >= promo.date &&
                (s.orderDate - promo.date) <= 60 * 86400000
            );
            if (match) { promoBatch.update(pd.ref, { outcome: 'pedido' }); converted++; }
        }
        if (converted > 0) await promoBatch.commit();
        summary.ofertasConvertidas = converted;
    } catch (error) {
        console.error('No se pudo actualizar la conversión de ofertas:', error);
    }

    // 9. Totales de plataforma por cliente (para el tier de volumen)
    progress('Actualizando volumen de clientes…');
    try {
        const totals = new Map<string, number>();
        for (const sale of prevSales.values()) {
            if (sale.esEntregado && sale.clientId) totals.set(sale.clientId, (totals.get(sale.clientId) || 0) + (sale.total || 0));
        }
        const affected = new Set(sales.filter(s => s.clientId).map(s => s.clientId!));
        const clientBatch = writeBatch(db);
        for (const clientId of affected) {
            clientBatch.set(doc(db, 'clients', clientId), { platform_sales_total: totals.get(clientId) || 0 }, { merge: true });
        }
        if (affected.size > 0) await clientBatch.commit();
    } catch (error) {
        console.error('No se pudo actualizar el volumen de clientes:', error);
    }

    return summary;
}

// --- Lecturas para la página ---

export async function getReportMonths(): Promise<ReportMonth[]> {
    const snap = await getDocs(query(collection(db, 'platformReportMonths'), limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReportMonth))
        .sort((a, b) => b.month.localeCompare(a.month));
}

// Items que necesitan revisión: sin mapeo alguno, o con producto pero SIN cliente
// (visibilidad desconocida — típico de mapeos aprendidos del archivo)
export async function getUnmappedItems(platform: string): Promise<Array<{ itemId: string; ventas: number; entregadas: number; productName?: string; variantName?: string; motivo: 'sin_mapeo' | 'sin_cliente' }>> {
    const snap = await getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), limit(10000)));
    const mappings = await loadMappings(platform);
    const counter = new Map<string, { ventas: number; entregadas: number }>();
    for (const d of snap.docs) {
        const sale = d.data() as PlatformSale;
        for (const itemId of sale.itemIds || []) {
            const m = mappings.get(itemId);
            // Completo: tiene cliente, o está declarado público
            if (m && (m.clientEmail || m.visibility === 'publico')) continue;
            const c = counter.get(itemId) || { ventas: 0, entregadas: 0 };
            c.ventas++; if (sale.esEntregado) c.entregadas++;
            counter.set(itemId, c);
        }
    }
    return Array.from(counter.entries())
        .map(([itemId, c]) => {
            const m = mappings.get(itemId);
            return {
                itemId, ...c,
                productName: m?.productName,
                variantName: m?.variantName,
                motivo: (m ? 'sin_cliente' : 'sin_mapeo') as 'sin_mapeo' | 'sin_cliente',
            };
        })
        .sort((a, b) => b.entregadas - a.entregadas);
}

export async function getSalesByMonthAndCommercial(): Promise<Map<string, Map<string, { ventas: number; total: number; activaciones: number; reactivaciones: number; publicas: number }>>> {
    const snap = await getDocs(query(collection(db, 'platformSales'), where('esEntregado', '==', true), limit(10000)));
    const result = new Map<string, Map<string, { ventas: number; total: number; activaciones: number; reactivaciones: number; publicas: number }>>();
    for (const d of snap.docs) {
        const sale = d.data() as PlatformSale;
        if (!sale.month) continue;
        const commercial = sale.commercialName || '(sin comercial)';
        if (!result.has(sale.month)) result.set(sale.month, new Map());
        const byCom = result.get(sale.month)!;
        const entry = byCom.get(commercial) || { ventas: 0, total: 0, activaciones: 0, reactivaciones: 0, publicas: 0 };
        entry.ventas++;
        entry.total += sale.total || 0;
        if (sale.classification === 'activacion') entry.activaciones++;
        if (sale.classification === 'reactivacion') entry.reactivaciones++;
        if (sale.classification === 'publica') entry.publicas++;
        byCom.set(commercial, entry);
    }
    return result;
}

// Desglose de ventas entregadas por bodega y por país (mes a mes)
export async function getSalesBreakdown(): Promise<{
    byBodega: Map<string, Map<string, { ventas: number; total: number }>>;
    byPais: Map<string, Map<string, { ventas: number; total: number }>>;
}> {
    const snap = await getDocs(query(collection(db, 'platformSales'), where('esEntregado', '==', true), limit(10000)));
    const byBodega = new Map<string, Map<string, { ventas: number; total: number }>>();
    const byPais = new Map<string, Map<string, { ventas: number; total: number }>>();
    for (const d of snap.docs) {
        const sale = d.data() as PlatformSale;
        if (!sale.month) continue;
        for (const [map, key] of [[byBodega, sale.bodega || '(sin bodega)'], [byPais, sale.pais || '(sin país)']] as const) {
            if (!map.has(sale.month)) map.set(sale.month, new Map());
            const inner = map.get(sale.month)!;
            const entry = inner.get(key) || { ventas: 0, total: 0 };
            entry.ventas++;
            entry.total += sale.total || 0;
            inner.set(key, entry);
        }
    }
    return { byBodega, byPais };
}

// Consumo real de inventario en UNIDADES BASE por producto: cada orden entregada
// aporta unitsPerOrder unidades del producto principal + 1 de cada producto del
// bundle (SKU+SKU). Vista aparte del "asignado vs vendido" (que va en combos).
export async function getBaseUnitConsumption(platform: string): Promise<Array<{ productName: string; ordenes: number; unidadesBase: number; tieneCombo: boolean }>> {
    const [mappings, salesSnap] = await Promise.all([
        loadMappings(platform),
        getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), where('esEntregado', '==', true), limit(10000))),
    ]);
    const acc = new Map<string, { ordenes: number; unidadesBase: number; tieneCombo: boolean }>();
    const add = (name: string, ordenes: number, unidades: number, combo: boolean) => {
        const e = acc.get(name) || { ordenes: 0, unidadesBase: 0, tieneCombo: false };
        e.ordenes += ordenes; e.unidadesBase += unidades; e.tieneCombo = e.tieneCombo || combo;
        acc.set(name, e);
    };
    for (const d of salesSnap.docs) {
        const sale = d.data() as PlatformSale;
        for (const itemId of sale.itemIds || []) {
            const m = mappings.get(itemId);
            if (!m?.productName) continue;
            const ordenes = sale.itemQuantities?.[itemId] ?? 1; // órdenes/combos vendidos
            const factor = m.unitsPerOrder && m.unitsPerOrder > 1 ? m.unitsPerOrder : 1;
            add(m.productName, ordenes, ordenes * factor, factor > 1);
            for (const bp of m.bundleWith || []) add(bp.productName, ordenes, ordenes, true);
        }
    }
    return Array.from(acc.entries())
        .map(([productName, v]) => ({ productName, ...v }))
        .sort((a, b) => b.unidadesBase - a.unidadesBase);
}

// Items detectados como combo/bundle que necesitan confirmar su composición
export async function getItemsNeedingComposition(platform: string): Promise<Array<{ itemId: string; productName?: string; sku?: string; unitsPerOrder?: number }>> {
    const mappings = await loadMappings(platform);
    return Array.from(mappings.values())
        .filter(m => m.needsComposition)
        .map(m => ({ itemId: m.itemId, productName: m.productName, sku: m.sku, unitsPerOrder: m.unitsPerOrder }));
}

// Consumo del stock asignado por item privado (asignado vs vendido)
export async function getAssignmentConsumption(platform: string): Promise<Array<{ itemId: string; productName?: string; clientEmail?: string; assignedQty: number; soldQty: number; pct: number }>> {
    const [mappings, salesSnap] = await Promise.all([
        loadMappings(platform),
        getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), where('esEntregado', '==', true), limit(10000))),
    ]);
    const soldByItem = new Map<string, number>();
    for (const d of salesSnap.docs) {
        const sale = d.data() as PlatformSale;
        for (const itemId of sale.itemIds || []) {
            const qty = sale.itemQuantities?.[itemId] ?? 1; // unidades reales si el archivo las trae
            soldByItem.set(itemId, (soldByItem.get(itemId) || 0) + qty);
        }
    }
    const rows = [];
    for (const [itemId, m] of mappings) {
        if (!m.assignedQty || m.visibility !== 'privado') continue;
        const soldQty = soldByItem.get(itemId) || 0;
        rows.push({
            itemId,
            productName: m.productName,
            clientEmail: m.clientEmail,
            assignedQty: m.assignedQty,
            soldQty,
            pct: m.assignedQty > 0 ? soldQty / m.assignedQty * 100 : 0,
        });
    }
    return rows.sort((a, b) => b.pct - a.pct);
}
