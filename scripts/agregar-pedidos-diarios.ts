// Recalcula el agregado día × país × bodega (colección `dailyOrders`) que alimenta la
// pestaña "Por país y bodega" de /movimiento-diario.
//
// La lógica vive en src/lib/agregar-pedidos.ts, compartida con el botón «Actualizar» del
// tablero: si cada uno tuviera su copia acabarían contando distinto.
//
// Por qué RECALCULA en vez de sumar: el estado de un pedido cambia con el tiempo (uno de
// ayer pasa a DESPACHADA hoy). Un agregado incremental se quedaría congelado con el estado
// que tenía el día que se calculó. Por eso rehace la ventana completa en cada corrida.
//
// Uso:
//   npx tsx scripts/agregar-pedidos-diarios.ts              → últimos 30 días
//   npx tsx scripts/agregar-pedidos-diarios.ts --dias 120   → últimos N días
//   npx tsx scripts/agregar-pedidos-diarios.ts --backfill    → todo el histórico
//   npx tsx scripts/agregar-pedidos-diarios.ts --estados     → informe de estados vistos
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { agregarPedidos, PLATAFORMA_AGREGADA } from '../src/lib/agregar-pedidos';
import { estadoDesconocido, normalizarEstado } from '../src/lib/estados-dropi';

const args = process.argv.slice(2);
const BACKFILL = args.includes('--backfill');
const SOLO_ESTADOS = args.includes('--estados');
const DIAS = (() => { const i = args.indexOf('--dias'); return i >= 0 ? Number(args[i + 1]) || 30 : 30; })();

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();
const desdeMs = BACKFILL ? 0 : Date.now() - DIAS * 86400000;

async function informeEstados() {
    const snap = await fs.collection('platformSales')
        .where('orderDate', '>=', desdeMs).select('estado', 'platform').get();
    const vistos = new Map<string, number>();
    for (const d of snap.docs) {
        if (String(d.get('platform') || '').toUpperCase() !== PLATAFORMA_AGREGADA) continue;
        const e = normalizarEstado(d.get('estado'));
        vistos.set(e, (vistos.get(e) || 0) + 1);
    }
    console.log(`\n${snap.size.toLocaleString('es-CO')} ventas leídas. Estados encontrados:`);
    const sinClasificar: string[] = [];
    [...vistos.entries()].sort((a, b) => b[1] - a[1]).forEach(([e, n]) => {
        const nuevo = estadoDesconocido(e);
        if (nuevo) sinClasificar.push(e);
        console.log(`  ${String(n).padStart(7)}  ${e || '(vacío)'}${nuevo ? '   ⚠️ SIN CLASIFICAR' : ''}`);
    });
    if (sinClasificar.length) {
        console.log('\n⚠️ Hay que decidir si estos salieron de bodega y añadirlos a src/lib/estados-dropi.ts:');
        sinClasificar.forEach(e => console.log(`     '${e}',`));
        console.log('\n   Después de tocar ese archivo, correr --backfill.');
    } else {
        console.log('\n✔ Todos los estados están clasificados.');
    }
}

async function main() {
    if (SOLO_ESTADOS) return informeEstados();

    console.log(`[agregar-pedidos] ${BACKFILL ? 'histórico completo' : `últimos ${DIAS} días`}…`);
    const r = await agregarPedidos({ fs, desdeMs, onProgress: m => console.log(`[agregar-pedidos] ${m}`) });

    if (r.omitidasOtraPlataforma) console.log(`[agregar-pedidos] ${r.omitidasOtraPlataforma} ventas de otras plataformas omitidas`);

    // Un estado nuevo se cuenta como NO despachado, así que el error siempre es por
    // defecto — nunca infla. Pero hay que enterarse.
    const nuevos = Object.entries(r.estadosDesconocidos);
    if (nuevos.length) {
        console.warn(`\n⚠️ ${nuevos.length} estado(s) sin clasificar (se cuentan como NO despachados):`);
        nuevos.sort((a, b) => b[1] - a[1]).forEach(([e, n]) => console.warn(`     ${e} (${n})`));
        console.warn('   Revisar src/lib/estados-dropi.ts y correr --backfill.\n');
    }
    console.log(`\n✔ ${r.diasEscritos} día(s) agregados en dailyOrders`);
}

main().catch(e => { console.error('[agregar-pedidos] error:', e); process.exit(1); });
