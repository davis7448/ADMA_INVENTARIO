// Actualiza SOLO el estado de las ventas Dropi ya existentes, usando list_orders
// (barato: 100 por página) sin llamar get_order (que exige 1 petición por orden y
// es inviable en cuentas de alto volumen como LABORATORIO, ~60k órdenes/mes).
//
// No crea ventas nuevas ni toca productos/costos: eso sigue llegando por el Excel.
// Sirve para que los meses se vayan cerrando solos.
//
// Uso: npx tsx scripts/dropi-estados.ts [días] [etiquetaCuenta]
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, startAt, startAfter, limit, writeBatch, doc } from '@/lib/fs';
import { listDropiAccounts, fetchDropiOrders } from '@/lib/dropi-mcp';
import { importPlatformSales, esEstadoFinal } from '@/lib/platform-sales';

async function main() {
    const dias = Number(process.argv[2]) || 20;
    const filtro = process.argv[3];
    const cuentas = (await listDropiAccounts()).filter(a => a.refreshToken && (!filtro || a.label.includes(filtro)));
    console.log(`Cuentas: ${cuentas.map(c => c.label).join(', ')} · ventana ${dias} días`);

    // Estado actual de las ventas DROPI (para saber cuáles ya existen y cuáles cambian)
    const actual = new Map<string, string>();
    let last: any = undefined;
    outer: while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), startAt('DROPI_'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        for (const d of snap.docs) {
            if (!d.id.startsWith('DROPI_')) break outer;
            actual.set(d.id, (d.data() as any).estado || '');
        }
        if (snap.size < 5000) break;
        last = snap.docs[snap.docs.length - 1];
    }
    console.log(`Ventas DROPI conocidas: ${actual.size}`);

    let cambios = 0;
    for (const acc of cuentas) {
        const t0 = Date.now();
        // soloEstados: no se llama get_order
        const rows = await fetchDropiOrders(acc as any, dias, { soloEstados: true }, m => process.stdout.write('\r  ' + m + '        '));
        console.log(`\n${acc.label}: ${rows.length} órdenes leídas en ${((Date.now() - t0) / 1000).toFixed(0)}s`);

        let batch = writeBatch(db), n = 0;
        for (const row of rows) {
            const id = `DROPI_${row.guia}`;
            const previo = actual.get(id);
            if (previo === undefined) continue;          // no existe: la crea el Excel
            if (previo === row.estado) continue;          // sin cambio
            batch.update(doc(db, 'platformSales', id), {
                estado: row.estado,
                esFinal: esEstadoFinal(row.estado),
                esEntregado: row.estado === 'ENTREGADO',
            });
            cambios++;
            if (++n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
        }
        if (n > 0) await batch.commit();
        console.log(`  → ${cambios} estados actualizados`);
    }

    if (cambios > 0) {
        console.log('Recalculando resúmenes de DROPI…');
        await importPlatformSales('DROPI', [], 45, {});
    }
    console.log('✔ listo');
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
