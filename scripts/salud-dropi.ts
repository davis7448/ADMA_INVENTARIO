// Estado de las cuentas Dropi. SEGURO de ejecutar: usa refrescarYGuardar(), que persiste
// el token rotado. Renovar sin guardar deja la cuenta muerta — los refresh_token de Dropi
// son de un solo uso.
import { config } from 'dotenv'; config({ path: '.env.local' });
import { listDropiAccounts, refrescarYGuardar } from '../src/lib/dropi-mcp';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});

(async () => {
    const fs = getFirestore();
    for (const c of await listDropiAccounts()) {
        // Última venta importada de esa bodega+país: detecta cuentas que renuevan bien
        // pero llevan días sin traer nada, que es como se veía LABORATORIO.
        const q = await fs.collection('platformSales')
            .where('pais', '==', c.pais || '—').where('bodega', '==', c.bodega || '—')
            .orderBy('importedAt', 'desc').limit(1).get().catch(() => null);
        const ultima = q && !q.empty ? new Date(q.docs[0].get('importedAt')).toISOString().slice(0, 16) : 'nunca';
        let estado: string;
        try {
            const t = await refrescarYGuardar(c as any);
            estado = t.access_token ? 'token OK' : 'sin access_token';
        } catch (e: any) {
            estado = 'CAÍDA: ' + (e?.message || e).toString().slice(0, 50);
        }
        console.log(`${c.id.padEnd(22)} ${String(c.pais).padEnd(9)} ${estado.padEnd(28)} última importación: ${ultima}`);
    }
    process.exit(0);
})();
