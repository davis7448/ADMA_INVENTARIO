// Integración EFFI (Colombia) — requiere DOS archivos que se cruzan por `ID guía`:
//  1) "reporte de alistamiento.xls" → en realidad HTML/latin1, 1 fila por PRODUCTO
//     (SKU/Referencia, descripción, cantidad, fecha, estado por línea).
//  2) "guias de transporte effi.xlsx" → 1 fila por GUÍA (estado limpio, distribuidor
//     = cliente, y `Total venta proveedor` = ingreso ADMA).
// Ambos son necesarios: el ingreso/cliente/estado están en guías; los productos en
// alistamiento. Se producen las mismas ParsedRow que consume el motor de plataformas.
import type { ParsedRow } from '@/lib/platform-sales';

// Estado global de la guía (EFFI) → estados internos del motor.
// Venta real = ENTREGADO. Finales = ENTREGADO / DEVOLUCION / CANCELADO / RECHAZADO.
const STATUS_MAP: Record<string, string> = {
    'ENTREGADA A DESTINO': 'ENTREGADO',
    'DEVOLUCION A ORIGEN': 'DEVOLUCION',
    'INDEMNIZACION POR SINIESTRO': 'CANCELADO',
    'GENERADA': 'GENERADA',
    'EN TRANSITO': 'EN TRANSITO',
    'EN REPARTO': 'EN REPARTO',
    'NOVEDAD': 'NOVEDAD',
    'DISPONIBLE PARA RETIRO EN OFICINA': 'PENDIENTE',
};

// Firestore no admite '/', '.', '#', '$', '[', ']' en un doc ID.
function safeId(s: string): string {
    return String(s || '')
        .replace(/[\/\\.#$\[\]]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'X';
}

function norm(s: any): string {
    return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Estado (global de guía, o el de la línea como respaldo) → estado interno.
function mapEstado(raw: any): string {
    const n = norm(raw);
    if (!n) return 'GENERADA';
    if (STATUS_MAP[n]) return STATUS_MAP[n];
    // Heurística para los estados sueltos del alistamiento (50+ variantes)
    if (n.startsWith('ENTREGAD') || n.startsWith('ENTREGA ')) return 'ENTREGADO';
    if (n.startsWith('DEVUELT') || n.startsWith('DEVOLUC')) return 'DEVOLUCION';
    if (n.startsWith('ANULAD') || n.includes('SINIESTRO')) return 'CANCELADO';
    if (n.startsWith('EN REPARTO') || n.startsWith('EN PROCESAM') || n.startsWith('EN TRANSITO')) return 'EN TRANSITO';
    if (n.includes('NOVEDAD') || n.includes('INCIDENCIA') || n.includes('RECLAME')) return 'NOVEDAD';
    return n;
}

// Índice de columnas por nombre de encabezado (tolerante a mayúsculas/tildes/orden).
function headerIndex(header: any[]): (name: string) => number {
    const H = header.map(norm);
    return (name: string) => H.findIndex(h => h === norm(name));
}

// Fecha EFFI "M/D/YY" → ISO. Devuelve '' si no se puede parsear.
function parseFecha(s: any): string {
    const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return '';
    const mo = m[1].padStart(2, '0'); const d = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
}

type GuiaInfo = { estado: string; distribuidor: string; idDistribuidor: string; ingresoAdma: number; tracking: string };

// Cruza los dos archivos (arrays header:1) y devuelve ParsedRow por línea de producto.
export function parseEffiFiles(alistamientoRows: any[][], guiasRows: any[][]): ParsedRow[] {
    // --- 1) Índice de guías (guía → info) desde el .xlsx ---
    const gh = headerIndex(guiasRows[0] || []);
    const gGuia = gh('ID guía'), gEstadoGlob = gh('Estado global guía inicial'),
        gDist = gh('Nombre Distribuidor'), gIdDist = gh('ID Distribuidor'),
        gTotal = gh('Total venta proveedor'), gTrack = gh('Guía transportadora');
    const guiaMap = new Map<string, GuiaInfo>();
    for (let r = 1; r < guiasRows.length; r++) {
        const row = guiasRows[r]; if (!row) continue;
        const id = String(row[gGuia] ?? '').trim(); if (!id) continue;
        guiaMap.set(id, {
            estado: mapEstado(row[gEstadoGlob]),
            distribuidor: String(row[gDist] ?? '').trim(),
            idDistribuidor: String(row[gIdDist] ?? '').trim(),
            ingresoAdma: Number(String(row[gTotal] ?? '').toString().replace(/[^0-9.-]/g, '')) || 0,
            tracking: String(row[gTrack] ?? '').trim(),
        });
    }

    // --- 2) Líneas de producto desde el alistamiento (HTML) ---
    const ah = headerIndex(alistamientoRows[0] || []);
    const aGuia = ah('ID guía'), aRef = ah('Referencia'), aIdArt = ah('ID artículo'),
        aDesc = ah('Descripción en la venta'), aDescOrig = ah('Descripción original artículo'),
        aCant = ah('Cantidad'), aFecha = ah('Fecha de creación transacción'), aEstado = ah('Estado');

    // IMPORTANTE: el motor (importPlatformSales) NO agrupa por guía — la última fila
    // de una guía pisa a las anteriores. Por eso aquí devolvemos UNA fila por guía,
    // acumulando todos los productos/cantidades y con el ingreso ADMA completo (una vez).
    const porGuia = new Map<string, ParsedRow>();

    for (let r = 1; r < alistamientoRows.length; r++) {
        const row = alistamientoRows[r]; if (!row) continue;
        const guia = String(row[aGuia] ?? '').trim(); if (!guia) continue;
        const info = guiaMap.get(guia);

        const referencia = String(row[aRef] ?? '').trim() || String(row[aIdArt] ?? '').trim();
        const itemId = safeId(referencia);
        const descripcion = String(row[aDesc] ?? '').trim() || String(row[aDescOrig] ?? '').trim() || undefined;
        const qty = Number(String(row[aCant] ?? '').replace(/[^0-9.-]/g, '')) || 1;

        let sale = porGuia.get(guia);
        if (!sale) {
            const clientName = info?.distribuidor || undefined;
            sale = {
                guia: safeId(guia),
                fecha: parseFecha(row[aFecha]),
                // Estado: el limpio de la guía; si la guía no está, el de la línea.
                estado: info?.estado || mapEstado(row[aEstado]),
                itemIds: [],
                total: info?.ingresoAdma || 0, // ingreso ADMA por guía, una sola vez
                quantity: 0,
                itemQuantities: {},
                itemInfo: {},
                // Cliente = Distribuidor (como Venndelo; sin email → clave estable por nombre)
                clientName,
                clientEmail: clientName ? norm(clientName).toLowerCase() : undefined,
            };
            porGuia.set(guia, sale);
        }
        if (!sale.fecha) sale.fecha = parseFecha(row[aFecha]);
        if (itemId) {
            if (!sale.itemIds.includes(itemId)) sale.itemIds.push(itemId);
            sale.itemQuantities![itemId] = (sale.itemQuantities![itemId] || 0) + qty;
            sale.itemInfo![itemId] = { sku: referencia || undefined, productName: descripcion };
        }
        sale.quantity = (sale.quantity || 0) + qty;
    }
    return Array.from(porGuia.values());
}
