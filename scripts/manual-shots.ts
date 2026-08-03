// Puente entre Firestore y el capturador de pantallazos.
//   export <dir>              → escribe <dir>/guias.json con el contenido actual
//   upload <dir> <manifest>   → sube las PNG a Storage y guarda las URL + coordenadas
// Uso completo:
//   npx tsx scripts/manual-shots.ts export /tmp/shots
//   python3 scripts/capture-manual.py /tmp/shots /tmp/shots/manifest.json
//   npx tsx scripts/manual-shots.ts upload /tmp/shots /tmp/shots/manifest.json
import { config } from 'dotenv'; config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const BUCKET = 'studio-9748962172-82b35.firebasestorage.app';
if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    storageBucket: BUCKET,
});
const fsdb = getFirestore();

async function exportar(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    const snap = await fsdb.collection('manuales').get();
    const guias = snap.docs.map(d => ({ slug: d.id, ...(d.data() as any) }));
    fs.writeFileSync(path.join(dir, 'guias.json'), JSON.stringify(guias, null, 1));
    console.log(`✔ ${guias.length} guías exportadas a ${dir}/guias.json`);
}

async function subir(dir: string, manifestPath: string) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bucket = getStorage().bucket();
    // Agrupar por guía para escribir cada doc una sola vez
    const porGuia: Record<string, any[]> = {};
    for (const m of manifest) (porGuia[m.slug] ||= []).push(m);

    for (const [slug, items] of Object.entries(porGuia)) {
        const ref = fsdb.collection('manuales').doc(slug);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`✖ guía ${slug} no existe`); continue; }
        const guia = snap.data() as any;

        for (const it of items) {
            const local = path.join(dir, it.archivo);
            if (!fs.existsSync(local)) continue;
            const destino = `manual/${slug}/${it.archivo}`;
            await bucket.upload(local, { destination: destino, metadata: { contentType: 'image/png' } });
            await bucket.file(destino).makePublic();
            const url = `https://storage.googleapis.com/${BUCKET}/${destino}`;
            const paso = guia.secciones?.[it.seccion]?.pasos?.[it.paso];
            if (paso) {
                paso.imagenUrl = url;
                if (it.anotaciones?.length) paso.anotaciones = it.anotaciones;
            }
        }
        await ref.set({ secciones: guia.secciones, updatedAt: Date.now() }, { merge: true });
        console.log(`✔ ${slug}: ${items.length} pantallazos guardados`);
    }
}

async function main() {
    const [modo, dir, manifest] = process.argv.slice(2);
    if (modo === 'export') await exportar(dir);
    else if (modo === 'upload') await subir(dir, manifest);
    else { console.error('Uso: export <dir> | upload <dir> <manifest>'); process.exit(1); }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
