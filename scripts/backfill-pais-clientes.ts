// Asigna COLOMBIA a las fichas de cliente que no tienen país.
//
// Por qué: desde que el CRM distingue una ficha de otra por país (un mismo negocio puede
// operar en varios mercados con un comercial distinto en cada uno), una ficha sin país
// queda en un limbo: no se puede afirmar que sea de otro mercado, así que toda
// coincidencia con ella se trata como "posible duplicado".
//
// Solo toca las que están vacías; las que ya tienen país se dejan intactas.
//
// Uso:
//   npx tsx scripts/backfill-pais-clientes.ts --dry-run   → solo informa
//   npx tsx scripts/backfill-pais-clientes.ts             → aplica
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const PAIS = 'COLOMBIA';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

async function main() {
    const snap = await fs.collection('clients').get();
    const sinPais: Array<{ id: string; nombre: string; comercial: string }> = [];
    const conPais = new Map<string, number>();

    for (const d of snap.docs) {
        const pais = String(d.get('country') || '').trim();
        if (pais) { conPais.set(pais, (conPais.get(pais) || 0) + 1); continue; }
        sinPais.push({
            id: d.id,
            nombre: String(d.get('name') || ''),
            comercial: String(d.get('assigned_commercial_name') || '—'),
        });
    }

    console.log(`Clientes: ${snap.size}`);
    console.log('Ya tienen país:');
    for (const [p, n] of [...conPais].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${p}`);
    console.log(`\nSin país: ${sinPais.length} → se les pondrá ${PAIS}\n`);

    if (!sinPais.length) { console.log('✅ Nada que hacer.'); return; }

    // Cuántas son de cada comercial, para que el cambio no sea a ciegas
    const porComercial = new Map<string, number>();
    for (const c of sinPais) porComercial.set(c.comercial, (porComercial.get(c.comercial) || 0) + 1);
    console.log('Reparto por comercial:');
    for (const [c, n] of [...porComercial].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`);

    if (DRY) {
        console.log('\nEjemplos:');
        for (const c of sinPais.slice(0, 8)) console.log(`  ${c.nombre.padEnd(34)} (${c.comercial})`);
        console.log('\n(dry-run: no se escribió nada)');
        return;
    }

    const respaldo = `docs/backups/pais-clientes-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(respaldo, JSON.stringify(sinPais, null, 2));
    console.log(`\nRespaldo escrito en ${respaldo}`);

    for (let i = 0; i < sinPais.length; i += 450) {
        const lote = fs.batch();
        for (const c of sinPais.slice(i, i + 450)) {
            lote.update(fs.collection('clients').doc(c.id), { country: PAIS });
        }
        await lote.commit();
        console.log(`  lote ${Math.floor(i / 450) + 1}: ${Math.min(450, sinPais.length - i)} clientes`);
    }
    console.log('\n✅ Listo.');
}

main().catch(e => { console.error(e); process.exit(1); });
