"use server";

// Pedidos despachados por periodo, país y bodega.
//
// Lee la colección pre-agregada `dailyOrders` (un documento por día, con un cubo por cada
// combinación país|bodega) en vez de recorrer platformSales. Un año de ventas son 270.000
// documentos y más de 20 segundos; agregado son ~230 documentos diminutos.
// El agregado lo mantiene scripts/agregar-pedidos-diarios.ts, que corre por cron después
// del sync de Dropi y RECALCULA los últimos 30 días (los estados cambian con el tiempo).
//
// ⚠️ Qué se está contando: Dropi no entrega fecha de despacho, solo `created_at` y el
// estado actual. Así que "salidos" son los pedidos CREADOS ese día que a día de hoy ya
// salieron de bodega — no los que salieron ese día. En los días más recientes la cifra se
// queda corta a propósito, porque parte de esos pedidos todavía no ha salido. La interfaz
// lo advierte; ver docs/dashboards/pedidos-por-pais.md.
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { claveDePeriodo, etiquetaDePeriodo, type Granularidad } from '@/lib/periodos';
import { agregarPedidos, type CuboPedidos } from '@/lib/agregar-pedidos';
import { monedaDePais, sumarImporte, type Importes } from '@/lib/paises';

export type { CuboPedidos };

// Al agrupar cubos de varios países el ingreso deja de ser un número: se acumula
// por moneda. Los conteos (creados/salidos/entregados/unidades) sí se suman.
export type CuboAgregado = {
    creados: number; salidos: number; entregados: number; unidades: number;
    ingresos: Importes;
};

export type Periodo = { clave: string; etiqueta: string };

export type PedidosPorPais = {
    periodos: Periodo[];                                       // ascendente
    paises: string[];                                          // presentes tras filtrar, por volumen
    bodegas: string[];
    porPeriodoPais: Record<string, Record<string, CuboAgregado>>;
    porPeriodoBodega: Record<string, Record<string, CuboAgregado>>;
    porPaisBodega: Record<string, Record<string, CuboAgregado>>; // país → bodega → cubo
    totalPorPais: Record<string, CuboAgregado>;
    totalPorBodega: Record<string, CuboAgregado>;
    totalPorPeriodo: Record<string, CuboAgregado>;
    total: CuboAgregado;
    paisesDisponibles: string[];                               // sin filtrar, para los selectores
    bodegasDisponibles: string[];
    diasConDatos: number;
    ultimoDia: string | null;
    sinAgregado: boolean;                                      // el cron nunca corrió
};

const vacio = (): CuboAgregado => ({ creados: 0, salidos: 0, entregados: 0, unidades: 0, ingresos: {} });

// `moneda` es la del cubo de origen (la de su país), no la del destino: así un total
// que agrupa Colombia y Panamá queda como {COP: …, USD: …}.
function sumar(destino: CuboAgregado, origen: CuboPedidos, moneda: string) {
    destino.creados += origen.creados || 0;
    destino.salidos += origen.salidos || 0;
    destino.entregados += origen.entregados || 0;
    destino.unidades += origen.unidades || 0;
    sumarImporte(destino.ingresos, moneda, origen.ingreso || 0);
}

function asegurar(mapa: Record<string, CuboAgregado>, clave: string): CuboAgregado {
    return (mapa[clave] ||= vacio());
}

function asegurarAnidado(mapa: Record<string, Record<string, CuboAgregado>>, a: string, b: string): CuboAgregado {
    const nivel = (mapa[a] ||= {});
    return (nivel[b] ||= vacio());
}

export async function getPedidosPorPais(opciones: {
    dias: number;
    granularidad: Granularidad;
    pais?: string;
    bodega?: string;
}): Promise<PedidosPorPais> {
    const { dias, granularidad, pais, bodega } = opciones;

    const base: PedidosPorPais = {
        periodos: [], paises: [], bodegas: [],
        porPeriodoPais: {}, porPeriodoBodega: {}, porPaisBodega: {},
        totalPorPais: {}, totalPorBodega: {}, totalPorPeriodo: {},
        total: vacio(), paisesDisponibles: [], bodegasDisponibles: [],
        diasConDatos: 0, ultimoDia: null, sinAgregado: false,
    };

    try {
        const fs = getFirestore(await getApp());

        const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
        const snap = await fs.collection('dailyOrders')
            .where('fecha', '>=', desde)
            .orderBy('fecha')
            .get();

        if (snap.empty) {
            // Distinguir "no hay movimiento en el periodo" de "el agregado nunca se generó":
            // lo segundo es un fallo del cron y la interfaz debe decirlo, no mostrar ceros.
            const alguno = await fs.collection('dailyOrders').limit(1).get();
            return { ...base, sinAgregado: alguno.empty };
        }

        const res: PedidosPorPais = {
            ...base,
            porPeriodoPais: {}, porPeriodoBodega: {}, porPaisBodega: {},
            totalPorPais: {}, totalPorBodega: {}, totalPorPeriodo: {}, total: vacio(),
        };

        const paisesTodos = new Set<string>();
        const bodegasTodas = new Set<string>();
        const periodos = new Map<string, string>(); // clave → etiqueta
        let ultimo: string | null = null;

        for (const doc of snap.docs) {
            const fecha = String(doc.get('fecha') || doc.id);
            const cubos = (doc.get('porPaisBodega') || {}) as Record<string, CuboPedidos>;
            ultimo = fecha;

            const clavePeriodo = claveDePeriodo(fecha, granularidad);

            for (const [k, cubo] of Object.entries(cubos)) {
                const sep = k.indexOf('|');
                const paisDoc = sep >= 0 ? k.slice(0, sep) : k;
                const bodegaDoc = sep >= 0 ? k.slice(sep + 1) : 'SIN BODEGA';

                // Los valores disponibles se recogen ANTES de filtrar, para que el selector
                // siga ofreciendo todas las opciones del periodo.
                paisesTodos.add(paisDoc);
                bodegasTodas.add(bodegaDoc);
                if (pais && pais !== 'todos' && paisDoc !== pais) continue;
                if (bodega && bodega !== 'todas' && bodegaDoc !== bodega) continue;

                periodos.set(clavePeriodo, etiquetaDePeriodo(clavePeriodo, granularidad));

                const moneda = monedaDePais(paisDoc);
                sumar(asegurarAnidado(res.porPeriodoPais, clavePeriodo, paisDoc), cubo, moneda);
                sumar(asegurarAnidado(res.porPeriodoBodega, clavePeriodo, bodegaDoc), cubo, moneda);
                sumar(asegurarAnidado(res.porPaisBodega, paisDoc, bodegaDoc), cubo, moneda);
                sumar(asegurar(res.totalPorPais, paisDoc), cubo, moneda);
                sumar(asegurar(res.totalPorBodega, bodegaDoc), cubo, moneda);
                sumar(asegurar(res.totalPorPeriodo, clavePeriodo), cubo, moneda);
                sumar(res.total, cubo, moneda);
            }
        }

        res.periodos = [...periodos.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([clave, etiqueta]) => ({ clave, etiqueta }));
        res.paises = Object.keys(res.totalPorPais).sort((a, b) => res.totalPorPais[b].salidos - res.totalPorPais[a].salidos);
        res.bodegas = Object.keys(res.totalPorBodega).sort((a, b) => res.totalPorBodega[b].salidos - res.totalPorBodega[a].salidos);
        res.paisesDisponibles = [...paisesTodos].sort();
        res.bodegasDisponibles = [...bodegasTodas].sort();
        res.diasConDatos = snap.size;
        res.ultimoDia = ultimo;
        return res;
    } catch (error) {
        console.error('[pedidos-por-pais] error:', error);
        return base;
    }
}

// Recalcula el agregado bajo demanda, desde el botón «Actualizar» del tablero.
//
// Hace falta porque el cron solo corre una vez al día: cuando alguien sube el archivo de
// pedidos de un país en Ventas Plataformas, el tablero no lo reflejaría hasta la mañana
// siguiente. Y para los países cuyo MCP no funciona, ese archivo es la única vía de
// entrada (ver docs/integraciones/dropi-mcp.md §7).
//
// La ventana se acota a 400 días: recalcular más sería leer cientos de miles de documentos
// dentro de una petición web. Para reconstruir todo el histórico está el script con
// --backfill.
export async function recalcularPedidos(dias: number): Promise<{ ok: boolean; mensaje: string }> {
    const ventana = Math.min(Math.max(Math.round(dias) || 30, 1), 400);
    try {
        const fs = getFirestore(await getApp());
        const r = await agregarPedidos({ fs, desdeMs: Date.now() - ventana * 86400000 });

        const nuevos = Object.keys(r.estadosDesconocidos);
        const aviso = nuevos.length
            ? ` · ⚠️ ${nuevos.length} estado(s) de Dropi sin clasificar: ${nuevos.slice(0, 3).join(', ')}`
            : '';
        return {
            ok: true,
            mensaje: `${r.diasEscritos} día(s) recalculados sobre ${r.ventasLeidas.toLocaleString('es-CO')} ventas${aviso}`,
        };
    } catch (error) {
        console.error('[pedidos-por-pais] recalcular falló:', error);
        return { ok: false, mensaje: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
