// Sincroniza las cuentas Dropi vía MCP: trae órdenes (últimos N días) e importa con
// el motor (plataforma DROPI, atribución por cupo). Corre LOCAL (sin límite HTTP).
// Optimización: get_order (rate-limited) solo para ENTREGADAS nuevas; las ya
// importadas se saltean. Uso: npx tsx scripts/dropi-sync.ts [días]
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, startAt, startAfter, limit } from 'firebase/firestore';
import { listDropiAccounts, fetchDropiOrders } from '@/lib/dropi-mcp';
import { importPlatformSales } from '@/lib/platform-sales';

// Guías DROPI ya entregadas con items (docId = DROPI_<guia>) — para no re-consultarlas.
// Recorre por __name__ desde 'DROPI_' y corta al salir del prefijo (sin índice compuesto).
async function loadDeliveredGuias(): Promise<Set<string>> {
    const set = new Set<string>();
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
            if (x.esEntregado && (x.itemIds?.length || 0) > 0 && x.guia) set.add(x.guia);
        }
        if (snap.size < 5000) break;
        last = snap.docs[snap.docs.length - 1];
    }
    return set;
}

async function main() {
    const days = Number(process.argv[2]) || 15;
    const accounts = await listDropiAccounts();
    console.log(`Cuentas Dropi: ${accounts.length} · ventana ${days} días`);
    const skipGuias = await loadDeliveredGuias();
    console.log(`Guías entregadas ya importadas (se saltean): ${skipGuias.size}\n`);

    for (const acc of accounts) {
        if (!acc.refreshToken) { console.log(`- ${acc.label}: sin token, se omite`); continue; }
        console.log(`== ${acc.label} [${acc.bodega || '?'}/${acc.pais || '?'}] ==`);
        const t0 = Date.now();
        const rows = await fetchDropiOrders(acc as any, days, { skipGuias }, m => process.stdout.write('\r' + m + '          '));
        console.log(`\n${rows.length} órdenes a importar en ${((Date.now() - t0) / 1000).toFixed(0)}s. Importando…`);
        const r = await importPlatformSales('DROPI', rows, 45, { bodega: acc.bodega, pais: acc.pais });
        console.log('  →', JSON.stringify({ nuevas: r.nuevas, actualizadas: r.actualizadas, entregadas: r.entregadas, atribuidas: r.atribuidas, publicas: r.publicas, sobreCupo: r.sobreCupo }), '\n');
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
