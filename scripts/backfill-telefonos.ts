// Rellena phone_key / additional_phone_keys en los clientes ya existentes.
//
// Firestore no sabe buscar por sufijo, así que la clave de comparación del teléfono
// (ver src/lib/telefono.ts) tiene que estar guardada en el documento para poder
// consultarla con `==`. Sin este backfill, checkClientExists no encontraría a ningún
// cliente anterior al cambio.
//
// El campo `phone` original NO se toca: se sigue mostrando tal como lo escribió el
// comercial. Esto solo agrega campos derivados.
//
// Uso:
//   npx tsx scripts/backfill-telefonos.ts --dry-run   → solo informa
//   npx tsx scripts/backfill-telefonos.ts             → aplica
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';
import { claveTelefono, clavesTelefono } from '../src/lib/telefono';

const DRY = process.argv.includes('--dry-run');

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
    console.log(`Clientes: ${snap.size}\n`);

    const cambios: Array<{ id: string; nombre: string; phone: string; phone_key: string; additional_phone_keys: string[] }> = [];
    let sinTelefono = 0;
    let yaCorrectos = 0;

    for (const d of snap.docs) {
        const phone = String(d.get('phone') || '');
        const adicionales: string[] = d.get('additional_phones') || [];
        const clave = claveTelefono(phone);
        const clavesAdic = clavesTelefono(adicionales);

        if (!clave && !clavesAdic.length) { sinTelefono++; continue; }

        const actual = d.get('phone_key');
        const actualAdic: string[] = d.get('additional_phone_keys') || [];
        const igual = actual === clave
            && actualAdic.length === clavesAdic.length
            && clavesAdic.every(k => actualAdic.includes(k));
        if (igual) { yaCorrectos++; continue; }

        cambios.push({ id: d.id, nombre: String(d.get('name') || ''), phone, phone_key: clave, additional_phone_keys: clavesAdic });
    }

    console.log(`Ya tenían la clave correcta: ${yaCorrectos}`);
    console.log(`Sin teléfono utilizable:     ${sinTelefono}`);
    console.log(`Por actualizar:              ${cambios.length}\n`);

    // Colisiones: dos clientes distintos con la misma clave son duplicados potenciales.
    // Se informan porque a partir de ahora el registro los va a detectar como tales.
    const porClave = new Map<string, string[]>();
    for (const d of snap.docs) {
        const k = claveTelefono(String(d.get('phone') || ''));
        if (!k) continue;
        porClave.set(k, [...(porClave.get(k) || []), String(d.get('name') || d.id)]);
    }
    const colisiones = [...porClave].filter(([, v]) => v.length > 1);
    if (colisiones.length) {
        console.log(`Clientes que comparten teléfono (${colisiones.length} grupos):`);
        for (const [k, nombres] of colisiones) console.log(`  ${k} → ${nombres.join(' | ')}`);
        console.log('');
    }

    if (!cambios.length) { console.log('✅ Nada que hacer.'); return; }
    if (DRY) {
        console.log('Ejemplos:');
        for (const c of cambios.slice(0, 8)) console.log(`  ${c.nombre.padEnd(28)} "${c.phone}" → ${c.phone_key}`);
        console.log('\n(dry-run: no se escribió nada)');
        return;
    }

    const respaldo = `docs/backups/telefonos-clientes-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(respaldo, JSON.stringify(cambios, null, 2));
    console.log(`Respaldo escrito en ${respaldo}\n`);

    for (let i = 0; i < cambios.length; i += 450) {
        const lote = fs.batch();
        for (const c of cambios.slice(i, i + 450)) {
            lote.update(fs.collection('clients').doc(c.id), {
                phone_key: c.phone_key,
                additional_phone_keys: c.additional_phone_keys,
            });
        }
        await lote.commit();
        console.log(`  lote ${Math.floor(i / 450) + 1}: ${Math.min(450, cambios.length - i)} clientes`);
    }
    console.log('\n✅ Backfill terminado.');
}

main().catch(e => { console.error(e); process.exit(1); });
