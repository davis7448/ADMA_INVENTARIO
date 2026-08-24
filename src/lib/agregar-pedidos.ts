// Construye el agregado día × país × bodega que alimenta el tablero de pedidos.
//
// Vive aquí, y no dentro del script, porque lo usan dos sitios: el cron nocturno
// (scripts/agregar-pedidos-diarios.ts) y el botón «Actualizar» del tablero
// (src/app/actions/pedidos-por-pais.ts). Si cada uno tuviera su copia, acabarían
// contando distinto.
//
// Ver docs/dashboards/pedidos-por-pais.md para qué significa cada cifra.
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { yaSalioDeBodega, estadoDesconocido, normalizarEstado } from './estados-dropi';

// Solo Dropi: el tablero de país × bodega se alimenta de las cuentas de Dropi, ya entren
// por el sync automático (Colombia) o por archivo subido a mano (el resto de países,
// mientras el MCP de Dropi no acepte sus tokens — ver docs/integraciones/dropi-mcp.md §7).
export const PLATAFORMA_AGREGADA = 'DROPI';

export type CuboPedidos = { creados: number; salidos: number; entregados: number; unidades: number; ingreso: number };
export const cuboVacio = (): CuboPedidos => ({ creados: 0, salidos: 0, entregados: 0, unidades: 0, ingreso: 0 });

export type ResultadoAgregado = {
    ventasLeidas: number;
    diasEscritos: number;
    omitidasOtraPlataforma: number;
    estadosDesconocidos: Record<string, number>;
};

// El separador es "|" porque ni país ni bodega lo contienen; se parte en dos al leer.
export const claveCubo = (pais: string, bodega: string) => `${pais}|${bodega}`;

export async function agregarPedidos(opciones: {
    fs: Firestore;
    desdeMs: number;                 // 0 = todo el histórico
    onProgress?: (msg: string) => void;
}): Promise<ResultadoAgregado> {
    const { fs, desdeMs, onProgress } = opciones;

    const snap = await fs.collection('platformSales')
        .where('orderDate', '>=', desdeMs)
        .select('orderDate', 'pais', 'bodega', 'estado', 'platform', 'quantity', 'total', 'esEntregado')
        .get();
    onProgress?.(`${snap.size.toLocaleString('es-CO')} ventas leídas`);

    const porDia = new Map<string, Map<string, CuboPedidos>>();
    const desconocidos: Record<string, number> = {};
    let omitidasOtraPlataforma = 0;

    for (const d of snap.docs) {
        if (String(d.get('platform') || '').toUpperCase() !== PLATAFORMA_AGREGADA) { omitidasOtraPlataforma++; continue; }

        const ms = Number(d.get('orderDate')) || 0;
        if (!ms) continue;
        const fecha = new Date(ms).toISOString().slice(0, 10);

        const estado = normalizarEstado(d.get('estado'));
        if (estadoDesconocido(estado)) desconocidos[estado] = (desconocidos[estado] || 0) + 1;

        const pais = String(d.get('pais') || 'SIN PAIS').trim().toUpperCase() || 'SIN PAIS';
        const bodega = String(d.get('bodega') || 'SIN BODEGA').trim().toUpperCase() || 'SIN BODEGA';

        let dia = porDia.get(fecha);
        if (!dia) { dia = new Map(); porDia.set(fecha, dia); }
        const k = claveCubo(pais, bodega);
        let c = dia.get(k);
        if (!c) { c = cuboVacio(); dia.set(k, c); }

        c.creados += 1;
        if (yaSalioDeBodega(estado)) c.salidos += 1;
        if (d.get('esEntregado')) c.entregados += 1;
        c.unidades += Number(d.get('quantity')) || 0;
        c.ingreso += Number(d.get('total')) || 0;
    }

    const dias = [...porDia.keys()].sort();
    let escritos = 0;
    for (let i = 0; i < dias.length; i += 400) { // el límite de Firestore es 500
        const lote = fs.batch();
        for (const fecha of dias.slice(i, i + 400)) {
            lote.set(fs.collection('dailyOrders').doc(fecha), {
                fecha,
                plataforma: PLATAFORMA_AGREGADA,
                porPaisBodega: Object.fromEntries(porDia.get(fecha)!),
                actualizadoAt: FieldValue.serverTimestamp(),
            });
            escritos++;
        }
        await lote.commit();
        onProgress?.(`${escritos}/${dias.length} días escritos`);
    }

    return { ventasLeidas: snap.size, diasEscritos: escritos, omitidasOtraPlataforma, estadosDesconocidos: desconocidos };
}
