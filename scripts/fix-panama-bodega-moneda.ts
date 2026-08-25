// Corrige las 155 órdenes de PANAMÁ importadas el 25/8/2026 desde archivo:
//   - bodega: entraron como INGENIO (valor elegido en el selector) y son IMPORTACIONES,
//     que es la cuenta Dropi de la que salió el reporte. Mezcladas con INGENIO Colombia
//     no hay forma de separarlas en el desglose por bodega.
//   - moneda: se guardaron sin divisa, así que se leían como COP (el valor por defecto
//     para las 308k ventas históricas, todas colombianas). Son dólares: sin esto, los
//     945,10 USD se sumaban a los pesos y el ingreso de enero decía 65.562.199,5.
//
// La moneda se deriva del país (src/lib/paises.ts), no se escribe a mano.
//
// Uso:  tsx scripts/fix-panama-bodega-moneda.ts            (dry-run: solo cuenta)
//       tsx scripts/fix-panama-bodega-moneda.ts --apply    (escribe)
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAt, startAfter, writeBatch, doc } from '@/lib/fs';
import { monedaDePais } from '@/lib/paises';
import * as fsn from 'fs';

const APPLY = process.argv.includes('--apply');
const PAIS = 'PANAMA';
const BODEGA_DESTINO = 'IMPORTACIONES';
const BACKUP = '/opt/workspaces/ADMA_INVENTARIO/logs/fix-panama-backup.json';

type Afectado = { id: string; bodegaPrevia?: string; monedaPrevia?: string };

async function recolectar(): Promise<Afectado[]> {
    const afectados: Afectado[] = [];
    let last: any = null;
    while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), startAt('DROPI_'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        let fuera = false;
        for (const d of snap.docs) {
            if (!d.id.startsWith('DROPI_')) { fuera = true; break; }
            const s: any = d.data();
            const pais = String(s.pais || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
            if (pais !== PAIS) continue;
            // Solo se toca lo que de verdad está mal: si ya quedó corregido, se salta.
            if (s.bodega === BODEGA_DESTINO && s.moneda === monedaDePais(PAIS)) continue;
            afectados.push({ id: d.id, bodegaPrevia: s.bodega, monedaPrevia: s.moneda });
        }
        if (fuera) break;
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 5000) break;
    }
    return afectados;
}

async function main() {
    const moneda = monedaDePais(PAIS);
    console.log(`Buscando ventas DROPI de ${PAIS}…`);
    const afectados = await recolectar();

    const porBodega = new Map<string, number>();
    for (const a of afectados) porBodega.set(a.bodegaPrevia || '(sin bodega)', (porBodega.get(a.bodegaPrevia || '(sin bodega)') || 0) + 1);
    console.log(`\n${afectados.length} órdenes a corregir → bodega "${BODEGA_DESTINO}", moneda "${moneda}"`);
    console.log('Bodega actual:');
    for (const [k, v] of porBodega) console.log(`   ${k}: ${v}`);

    if (afectados.length === 0) { console.log('\nNada que hacer.'); process.exit(0); }

    if (!APPLY) {
        console.log('\nDRY-RUN. Nada se escribió. Relanza con --apply para aplicar.');
        process.exit(0);
    }

    fsn.writeFileSync(BACKUP, JSON.stringify(afectados, null, 2));
    console.log(`\nBackup del estado previo en ${BACKUP}`);

    let escritos = 0;
    for (let i = 0; i < afectados.length; i += 400) {
        const batch = writeBatch(db);
        for (const a of afectados.slice(i, i + 400)) {
            batch.set(doc(db, 'platformSales', a.id), { bodega: BODEGA_DESTINO, moneda }, { merge: true });
            escritos++;
        }
        await batch.commit();
        console.log(`  ${escritos}/${afectados.length}`);
    }
    console.log(`\n✔ ${escritos} órdenes corregidas.`);
    console.log('Falta re-agregar los meses:  tsx scripts/reaggregate.ts');
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
