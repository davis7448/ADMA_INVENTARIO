// Sincroniza las cuentas Dropi vía MCP e importa al motor (plataforma DROPI,
// atribución por cupo). Corre LOCAL (sin límite HTTP). Uso: npx tsx scripts/dropi-sync.ts [díasMin]
//
// Estrategia (cerrar meses): la ventana se calcula DINÁMICAMENTE para cubrir la
// orden ABIERTA más vieja. Así list_orders (barato) refresca el estado de todas las
// abiertas y get_order (caro/rate-limited) se llama SOLO para las recién entregadas
// (las ya entregadas se saltean). Cuando una orden pasa a estado final (entregado,
// devolución, cancelado), el mes avanza hacia cerrarse.
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, startAt, startAfter, limit } from '@/lib/fs';
import { listDropiAccounts, fetchDropiOrders } from '@/lib/dropi-mcp';
import { importPlatformSales } from '@/lib/platform-sales';

const DAY = 86400000;

// Un solo recorrido de las ventas DROPI (docId = DROPI_*): junta las guías ya
// entregadas con items (para saltearlas) y la fecha de la orden ABIERTA más antigua.
async function loadDropiState(): Promise<{ skipGuias: Set<string>; minOpenMs: number }> {
    const skipGuias = new Set<string>();
    let minOpenMs = Infinity;
    let last: any = undefined;
    outer: while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), startAt('DROPI_'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        for (const d of snap.docs) {
            if (!d.id.startsWith('DROPI_')) break outer;
            const x = d.data() as any;
            if (x.esEntregado && (x.itemIds?.length || 0) > 0 && x.guia) skipGuias.add(x.guia);
            if (!x.esFinal && x.orderDate) minOpenMs = Math.min(minOpenMs, x.orderDate);
        }
        if (snap.size < 5000) break;
        last = snap.docs[snap.docs.length - 1];
    }
    return { skipGuias, minOpenMs };
}

async function main() {
    const minDays = Number(process.argv[2]) || 5; // ventana mínima (órdenes nuevas)
    const MAX_DAYS = 95; // tope (list_orders parte en chunks de 85 días; cubre ~3 meses de seguimiento)
    const accounts = await listDropiAccounts();
    console.log(`Cuentas Dropi: ${accounts.length}`);

    const { skipGuias, minOpenMs } = await loadDropiState();
    // Ventana = cubrir la orden abierta más vieja (para cerrar sus meses), acotada.
    const dinamico = Number.isFinite(minOpenMs) ? Math.ceil((Date.now() - minOpenMs) / DAY) + 2 : minDays;
    const days = Math.min(MAX_DAYS, Math.max(minDays, dinamico));
    console.log(`Guías entregadas ya importadas: ${skipGuias.size} · orden abierta más vieja: ${Number.isFinite(minOpenMs) ? new Date(minOpenMs).toISOString().slice(0, 10) : '(ninguna)'} → ventana ${days} días\n`);

    // Cada cuenta va en su propio try: antes, un fallo en una abortaba la corrida entera y
    // las siguientes no llegaban a sincronizarse nunca. Pasó de verdad — el 401 de
    // IMPORTACIONES PANAMA dejó sin importar Guatemala, los tres de Ecuador y México, y
    // desde fuera parecía que esos países "no tenían ventas".
    const fallos: Array<{ cuenta: string; error: string }> = [];
    const hechas: string[] = [];

    for (const acc of accounts) {
        if (!acc.refreshToken) { console.log(`- ${acc.label}: sin token, se omite`); continue; }
        const mode = (acc as any).syncMode;
        if (mode === 'off') { console.log(`- ${acc.label}: modo 'off'. Se omite.`); continue; }
        // Cuentas de alto volumen (ej. LABORATORIO ~60k órdenes/mes) usan una ventana
        // más corta: recorrer 95 días serían miles de páginas de list_orders.
        const tope = Number((acc as any).maxDias) || MAX_DAYS;
        const diasCuenta = Math.min(days, tope);
        console.log(`== ${acc.label} [${acc.bodega || '?'}/${acc.pais || '?'}] · ventana ${diasCuenta}d ==`);
        try {
            const t0 = Date.now();
            const rows = await fetchDropiOrders(acc as any, diasCuenta, { skipGuias }, m => process.stdout.write('\r' + m + '          '));
            console.log(`\n${rows.length} órdenes a importar en ${((Date.now() - t0) / 1000).toFixed(0)}s. Importando…`);
            const r = await importPlatformSales('DROPI', rows, 45, { bodega: acc.bodega, pais: acc.pais });
            console.log('  →', JSON.stringify({ nuevas: r.nuevas, actualizadas: r.actualizadas, entregadas: r.entregadas, atribuidas: r.atribuidas, publicas: r.publicas, sobreCupo: r.sobreCupo, mesesAbiertos: r.mesesAbiertos }), '\n');
            hechas.push(acc.label);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`\n  ✘ ${acc.label} falló: ${msg}`);
            console.error('    Se continúa con las demás cuentas.\n');
            fallos.push({ cuenta: acc.label, error: msg });
        }
    }

    console.log('=== RESUMEN ===');
    console.log(`  sincronizadas: ${hechas.length}${hechas.length ? ' → ' + hechas.join(', ') : ''}`);
    if (fallos.length) {
        console.log(`  con fallo: ${fallos.length}`);
        fallos.forEach(f => console.log(`    ✘ ${f.cuenta}: ${f.error}`));
    }
    // Salida distinta de 0 si alguna falló, para que el fallo sea visible en el cron.
    process.exit(fallos.length ? 1 : 0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
