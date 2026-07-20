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
    sku?: string;
    commercialName?: string;
    assignedQty?: number; // unidades asignadas (privatizaciones/sumas)
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
    itemInfo?: Record<string, { sku?: string; productName?: string }>; // para auto-mapeo desde el archivo
    clientEmail?: string; // solo si el archivo trae columnas de dropshipper
    clientName?: string;
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
        if (row.quantity) prev.quantity = (prev.quantity || 0) + row.quantity;
        // TOTAL DE LA ORDEN es el mismo en todas las filas de la orden: no se suma
    }
    const grouped = Array.from(byGuia.values());

    if (grouped.length === 0) errors.push('No se encontraron filas válidas.');
    return { parsed: grouped, errors };
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

// Crea/actualiza mapeos desde las solicitudes de ADMA que tengan ID de plataforma
export async function buildMappingsFromSolicitudes(platform: string, itemIds: Set<string>, existing: Map<string, PlatformItemMapping>): Promise<number> {
    const missing = Array.from(itemIds).filter(id => !existing.has(id));
    if (missing.length === 0) return 0;

    const solsSnap = await getDocs(query(collection(db, 'modificaciones'), where('ID', '!=', null), limit(3000)));
    const byItemId = new Map<string, (Modificacion & { id: string })[]>();
    for (const d of solsSnap.docs) {
        const s = { id: d.id, ...d.data() } as Modificacion & { id: string };
        const itemId = String(s.ID ?? '').replace(/\.0$/, '');
        if (!itemId) continue;
        if (!byItemId.has(itemId)) byItemId.set(itemId, []);
        byItemId.get(itemId)!.push(s);
    }

    let created = 0;
    const batch = writeBatch(db);
    for (const itemId of missing) {
        const sols = byItemId.get(itemId);
        if (!sols?.length) continue;
        const latest = sols.sort((a, b) => (b.FECHA || 0) - (a.FECHA || 0))[0];
        const correo = (latest.CORREO_CODIGO || '').split(/[,;\s]+/)[0]?.trim().toLowerCase() || undefined;
        const assignedQty = sols.reduce((acc, s) => acc + (Number(s['CANTIDAD SOLICITADA']) || 0), 0);
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
            source: 'solicitud',
        };
        const clean: Record<string, any> = { ...mapping };
        Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);
        batch.set(doc(db, 'platformItemMappings', `${platform}_${itemId}`), clean, { merge: true });
        existing.set(itemId, mapping);
        created++;
    }
    if (created > 0) await batch.commit();
    return created;
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
    mapeosCreados: number;
    ofertasConvertidas: number;
    mesesAbiertos: string[];
};

export async function importPlatformSales(
    platform: string,
    parsed: ParsedRow[],
    reactivationDays: number,
    onProgress?: (msg: string) => void
): Promise<ImportSummary> {
    const progress = (msg: string) => onProgress?.(msg);

    // 1. Mapeos
    progress('Cargando mapeos de items…');
    const mappings = await loadMappings(platform);
    const itemIdsInFile = new Set(parsed.flatMap(p => p.itemIds));
    let mapeosCreados = await buildMappingsFromSolicitudes(platform, itemIdsInFile, mappings);

    // Si el archivo trae SKU/nombre por item (formato por-producto), crear mapeos
    // de producto para los items que sigan sin mapeo (sin cliente: quedan como
    // 'desconocido' hasta que una solicitud o un mapeo manual diga si son privados)
    const fileInfoBatch = writeBatch(db);
    let fileInfoCount = 0;
    for (const row of parsed) {
        for (const [itemId, info] of Object.entries(row.itemInfo || {})) {
            if (mappings.has(itemId) || (!info.sku && !info.productName)) continue;
            const mapping: PlatformItemMapping = {
                platform, itemId, visibility: 'desconocido',
                sku: info.sku, productName: info.productName, source: 'archivo',
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
    const summary: ImportSummary = { total: parsed.length, nuevas: 0, actualizadas: 0, entregadas: 0, atribuidas: 0, publicas: 0, sinMapear: 0, mapeosCreados, ofertasConvertidas: 0, mesesAbiertos: [] };
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
            importedAt: now,
        };

        // Atribución: columnas del archivo (si vienen) > mapeo del primer item
        const mapping = row.itemIds.map(id => mappings.get(id)).find(Boolean);
        const email = row.clientEmail || mapping?.clientEmail;
        if (mapping) {
            sale.productId = mapping.productId;
            sale.productName = mapping.productName;
            sale.commercialName = mapping.commercialName;
        }
        if (email && (row.clientEmail || mapping?.visibility === 'privado')) {
            sale.clientEmail = email;
            const client = emailToClient.get(email);
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

    for (const sale of all) {
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
    for (const sale of sales) {
        if (!sale.esEntregado) continue;
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

export async function getUnmappedItems(platform: string): Promise<Array<{ itemId: string; ventas: number; entregadas: number }>> {
    const snap = await getDocs(query(collection(db, 'platformSales'), where('platform', '==', platform), limit(10000)));
    const mappings = await loadMappings(platform);
    const counter = new Map<string, { ventas: number; entregadas: number }>();
    for (const d of snap.docs) {
        const sale = d.data() as PlatformSale;
        for (const itemId of sale.itemIds || []) {
            if (mappings.has(itemId)) continue;
            const c = counter.get(itemId) || { ventas: 0, entregadas: 0 };
            c.ventas++; if (sale.esEntregado) c.entregadas++;
            counter.set(itemId, c);
        }
    }
    return Array.from(counter.entries())
        .map(([itemId, c]) => ({ itemId, ...c }))
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
