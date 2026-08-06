// Normaliza el campo PAIS de `modificaciones` al formato canónico de la app:
// MAYÚSCULAS y sin tildes ("República Dominicana" → "REPUBLICA DOMINICANA").
//
// Por qué: la pantalla de Modificaciones guardaba el país en "Title Case" con tildes,
// mientras que CRM, Solicitudes y Ventas de Plataformas lo guardan en mayúsculas sin
// tildes. Con dos formatos conviviendo, el filtro por país de modificaciones.ts:150
// (`m.PAIS === pais`) parte los registros en dos grupos y los reportes no cuadran.
//
// Uso:
//   npx tsx scripts/normalizar-pais.ts --dry-run   → solo informa, no escribe
//   npx tsx scripts/normalizar-pais.ts             → aplica los cambios
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';
import { PAISES } from '../src/lib/paises';

const DRY = process.argv.includes('--dry-run');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

// Mismo criterio que banderaPais(): quita tildes, colapsa espacios y sube a mayúsculas.
function canonizar(valor: string): string {
    return valor
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

async function main() {
    const snap = await fs.collection('modificaciones').get();
    console.log(`Documentos en 'modificaciones': ${snap.size}\n`);

    // Inventario de valores actuales, para ver qué hay antes de tocar nada
    const inventario = new Map<string, number>();
    const cambios: Array<{ id: string; de: string; a: string }> = [];
    const desconocidos = new Map<string, number>();
    let vacios = 0;

    for (const d of snap.docs) {
        const actual = d.get('PAIS');
        if (actual === undefined || actual === null || String(actual).trim() === '') { vacios++; continue; }

        const original = String(actual);
        inventario.set(original, (inventario.get(original) || 0) + 1);

        const canonico = canonizar(original);
        if (!(PAISES as readonly string[]).includes(canonico)) {
            // País fuera del catálogo: se reporta y NO se toca, para no inventar datos.
            desconocidos.set(original, (desconocidos.get(original) || 0) + 1);
            continue;
        }
        if (canonico !== original) cambios.push({ id: d.id, de: original, a: canonico });
    }

    console.log('Valores encontrados:');
    for (const [valor, n] of [...inventario].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${n.toString().padStart(6)}  "${valor}"`);
    }
    console.log(`  ${vacios.toString().padStart(6)}  (vacío / sin país)\n`);

    if (desconocidos.size) {
        console.log('⚠️  Fuera del catálogo de países — se dejan intactos:');
        for (const [valor, n] of desconocidos) console.log(`  ${n.toString().padStart(6)}  "${valor}"`);
        console.log('');
    }

    if (!cambios.length) { console.log('✅ Nada que normalizar.'); return; }

    const resumen = new Map<string, number>();
    for (const c of cambios) {
        const k = `${c.de} → ${c.a}`;
        resumen.set(k, (resumen.get(k) || 0) + 1);
    }
    console.log(`${DRY ? 'Se normalizarían' : 'Normalizando'} ${cambios.length} documentos:`);
    for (const [k, n] of [...resumen].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(6)}  ${k}`);

    if (DRY) { console.log('\n(dry-run: no se escribió nada)'); return; }

    // Respaldo del valor anterior por documento, para poder revertir si hiciera falta
    const respaldo = `docs/backups/pais-modificaciones-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(respaldo, JSON.stringify(cambios, null, 2));
    console.log(`Respaldo escrito en ${respaldo}\n`);

    // Firestore admite 500 operaciones por lote
    for (let i = 0; i < cambios.length; i += 450) {
        const lote = fs.batch();
        for (const c of cambios.slice(i, i + 450)) {
            lote.update(fs.collection('modificaciones').doc(c.id), { PAIS: c.a });
        }
        await lote.commit();
        console.log(`  lote ${Math.floor(i / 450) + 1}: ${Math.min(450, cambios.length - i)} documentos`);
    }
    console.log('\n✅ Migración terminada.');
}

main().catch(e => { console.error(e); process.exit(1); });
