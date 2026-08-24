// Pre-agrega los pedidos de Dropi en cubos día × país × bodega (colección `dailyOrders`).
//
// Por qué pre-agregar: el tablero necesita ver día, semana y mes. Leer platformSales al
// vuelo funciona para 30 días (~5.700 documentos) pero no para un año: son 270.000
// documentos y más de 20 segundos. Agregado son ~5 bodegas × 365 días ≈ 1.800 documentos
// diminutos, y las tres vistas salen de agrupar esos mismos cubos.
//
// Por qué RECALCULA en vez de sumar: el estado de un pedido cambia con el tiempo (uno de
// ayer pasa a DESPACHADA hoy). Un agregado incremental se quedaría congelado con el
// estado que tenía el día que se calculó. Por eso, sin argumentos, rehace los últimos 30
// días completos en cada corrida.
//
// Uso:
//   npx tsx scripts/agregar-pedidos-diarios.ts              → recalcula los últimos 30 días
//   npx tsx scripts/agregar-pedidos-diarios.ts --dias 120   → recalcula los últimos N días
//   npx tsx scripts/agregar-pedidos-diarios.ts --backfill    → reconstruye todo el histórico
//   npx tsx scripts/agregar-pedidos-diarios.ts --estados     → solo informa: estados vistos
//                                                              y cuáles no están clasificados
//   añadir --dry-run para no escribir nada
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { yaSalioDeBodega, estadoDesconocido, normalizarEstado } from '../src/lib/estados-dropi';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const BACKFILL = args.includes('--backfill');
const SOLO_ESTADOS = args.includes('--estados');
const DIAS = (() => {
    const i = args.indexOf('--dias');
    return i >= 0 ? Number(args[i + 1]) || 30 : 30;
})();

// Solo Dropi: el tablero de país × bodega se alimenta de las cuentas de Dropi. Las otras
// plataformas (Venndelo, EFFI, HOKO) son solo Colombia y no tienen esa dimensión.
const PLATAFORMA = 'DROPI';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

type Cubo = { creados: number; salidos: number; entregados: number; unidades: number; ingreso: number };
const cuboVacio = (): Cubo => ({ creados: 0, salidos: 0, entregados: 0, unidades: 0, ingreso: 0 });

// Clave del cubo. El separador es "|" porque ni país ni bodega lo contienen; se parte en
// dos al leer (src/app/actions/pedidos-por-pais.ts).
const clave = (pais: string, bodega: string) => `${pais}|${bodega}`;

async function main() {
    const desde = BACKFILL ? 0 : Date.now() - DIAS * 86400000;
    const etiqueta = BACKFILL ? 'histórico completo' : `últimos ${DIAS} días`;
    console.log(`[agregar-pedidos] leyendo ${etiqueta} de platformSales (${PLATAFORMA})…`);

    const snap = await fs.collection('platformSales')
        .where('orderDate', '>=', desde)
        .select('orderDate', 'pais', 'bodega', 'estado', 'platform', 'quantity', 'total', 'esEntregado')
        .get();

    console.log(`[agregar-pedidos] ${snap.size.toLocaleString('es-CO')} ventas leídas`);

    // día → clave(país|bodega) → cubo
    const porDia = new Map<string, Map<string, Cubo>>();
    const estadosVistos = new Map<string, number>();
    const desconocidos = new Map<string, number>();
    let omitidasOtraPlataforma = 0;

    for (const d of snap.docs) {
        if (String(d.get('platform') || '').toUpperCase() !== PLATAFORMA) { omitidasOtraPlataforma++; continue; }

        const ms = Number(d.get('orderDate')) || 0;
        if (!ms) continue;
        const fecha = new Date(ms).toISOString().slice(0, 10);

        const estado = normalizarEstado(d.get('estado'));
        estadosVistos.set(estado, (estadosVistos.get(estado) || 0) + 1);
        if (estadoDesconocido(estado)) desconocidos.set(estado, (desconocidos.get(estado) || 0) + 1);
        if (SOLO_ESTADOS) continue;

        const pais = String(d.get('pais') || 'SIN PAIS').trim().toUpperCase() || 'SIN PAIS';
        const bodega = String(d.get('bodega') || 'SIN BODEGA').trim().toUpperCase() || 'SIN BODEGA';

        let dia = porDia.get(fecha);
        if (!dia) { dia = new Map(); porDia.set(fecha, dia); }
        const k = clave(pais, bodega);
        let c = dia.get(k);
        if (!c) { c = cuboVacio(); dia.set(k, c); }

        c.creados += 1;
        if (yaSalioDeBodega(estado)) c.salidos += 1;
        if (d.get('esEntregado')) c.entregados += 1;
        c.unidades += Number(d.get('quantity')) || 0;
        c.ingreso += Number(d.get('total')) || 0;
    }

    if (omitidasOtraPlataforma) {
        console.log(`[agregar-pedidos] ${omitidasOtraPlataforma} ventas de otras plataformas omitidas`);
    }

    if (SOLO_ESTADOS) {
        console.log('\nEstados encontrados:');
        [...estadosVistos.entries()].sort((a, b) => b[1] - a[1])
            .forEach(([e, n]) => console.log(`  ${String(n).padStart(7)}  ${e || '(vacío)'}${estadoDesconocido(e) ? '   ⚠️ SIN CLASIFICAR' : ''}`));
        if (desconocidos.size) {
            console.log('\n⚠️ Estados sin clasificar — hay que decidir si cuentan como despachados');
            console.log('   y añadirlos a src/lib/estados-dropi.ts:');
            [...desconocidos.keys()].forEach(e => console.log(`     '${e}',`));
        } else {
            console.log('\n✔ Todos los estados están clasificados en src/lib/estados-dropi.ts');
        }
        return;
    }

    // Avisar de estados nuevos aunque no se haya pedido el informe: si Dropi añadió uno,
    // los despachos se están subestimando en silencio.
    if (desconocidos.size) {
        console.warn(`\n⚠️ ${desconocidos.size} estado(s) sin clasificar (se cuentan como NO despachados):`);
        [...desconocidos.entries()].sort((a, b) => b[1] - a[1])
            .forEach(([e, n]) => console.warn(`     ${e} (${n})`));
        console.warn('   Revisar src/lib/estados-dropi.ts\n');
    }

    const dias = [...porDia.keys()].sort();
    console.log(`[agregar-pedidos] ${dias.length} día(s) con movimiento`);

    if (DRY) {
        console.log('[agregar-pedidos] --dry-run: no se escribe nada. Muestra de los últimos 5 días:');
        dias.slice(-5).forEach(f => {
            const cubos = porDia.get(f)!;
            const salidos = [...cubos.values()].reduce((a, c) => a + c.salidos, 0);
            const creados = [...cubos.values()].reduce((a, c) => a + c.creados, 0);
            console.log(`   ${f}  creados ${String(creados).padStart(4)}  salidos ${String(salidos).padStart(4)}  (${cubos.size} bodega/país)`);
        });
        return;
    }

    // Escritura por lotes de 400 (el límite de Firestore es 500).
    let escritos = 0;
    for (let i = 0; i < dias.length; i += 400) {
        const lote = fs.batch();
        for (const fecha of dias.slice(i, i + 400)) {
            const cubos = porDia.get(fecha)!;
            lote.set(fs.collection('dailyOrders').doc(fecha), {
                fecha,
                plataforma: PLATAFORMA,
                porPaisBodega: Object.fromEntries(cubos),
                actualizadoAt: FieldValue.serverTimestamp(),
            });
            escritos++;
        }
        await lote.commit();
        console.log(`[agregar-pedidos] ${escritos}/${dias.length} días escritos`);
    }

    console.log(`\n✔ ${escritos} día(s) agregados en dailyOrders`);
}

main().catch(e => { console.error('[agregar-pedidos] error:', e); process.exit(1); });
