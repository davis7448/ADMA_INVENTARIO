// Estado de las cuentas Dropi SIN tocar los tokens.
//
// La versión anterior renovaba el token para "comprobar que servía". Como los
// refresh_token de Dropi son de un solo uso, eso dejaba muertas las cuentas sanas: pasó
// de verdad y hubo que reconectar las cuatro. Ver docs/integraciones/dropi-mcp.md §1.2.
//
// La señal fiable no es el token, es el DATO: cuándo importó por última vez esa cuenta.
//
// Uso: npx tsx scripts/salud-dropi.ts
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HORAS_ALERTA = 48;

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

async function main() {
    const cuentas = await fs.collection('dropiAccounts').get();
    const ahora = Date.now();
    let alertas = 0;

    for (const d of cuentas.docs) {
        const c = d.data();
        // Última venta importada de esa bodega+país. Se recorre en memoria para no
        // depender de un índice compuesto.
        const ventas = await fs.collection('platformSales')
            .where('pais', '==', c.pais || '—')
            .select('importedAt', 'bodega').get();
        let ultima = 0;
        ventas.forEach(v => {
            if (v.get('bodega') !== (c.bodega || '—')) return;
            const t = Number(v.get('importedAt')) || 0;
            if (t > ultima) ultima = t;
        });

        const horas = ultima ? Math.round((ahora - ultima) / 3600000) : null;
        const alerta = horas === null || horas > HORAS_ALERTA;
        if (alerta) alertas++;
        console.log(
            `${alerta ? '⚠️ ' : '   '}${d.id.padEnd(22)} ${String(c.pais).padEnd(9)} ${String(c.bodega).padEnd(13)}` +
            ` última importación: ${horas === null ? 'NUNCA' : `hace ${horas} h`}` +
            ` · token guardado hace ${c.updatedAt ? Math.round((ahora - c.updatedAt) / 3600000) + ' h' : '—'}`
        );
    }

    if (alertas) {
        console.log(`\n⚠️  ${alertas} cuenta(s) sin importar en más de ${HORAS_ALERTA} h.`);
        console.log('   Ver docs/integraciones/dropi-mcp.md §6 antes de tocar nada.');
        process.exit(1);   // salida distinta de 0: sirve para alertar desde el cron
    }
    console.log('\n✔ Todas las cuentas importaron en las últimas ' + HORAS_ALERTA + ' h.');
}

main().catch(e => { console.error(e); process.exit(1); });
