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
import nodemailer from 'nodemailer';

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
    const detalle: string[] = [];

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
        if (alerta) {
            alertas++;
            detalle.push(`${d.id} (${c.pais}/${c.bodega}) — última importación: ${horas === null ? 'nunca' : `hace ${horas} h`}`);
        }
        console.log(
            `${alerta ? '⚠️ ' : '   '}${d.id.padEnd(22)} ${String(c.pais).padEnd(9)} ${String(c.bodega).padEnd(13)}` +
            ` última importación: ${horas === null ? 'NUNCA' : `hace ${horas} h`}` +
            ` · token guardado hace ${c.updatedAt ? Math.round((ahora - c.updatedAt) / 3600000) + ' h' : '—'}`
        );
    }

    if (alertas) {
        console.log(`\n⚠️  ${alertas} cuenta(s) sin importar en más de ${HORAS_ALERTA} h.`);
        console.log('   Ver docs/integraciones/dropi-mcp.md §6 antes de tocar nada.');
        // Un aviso que solo vive en el log del servidor no avisa a nadie: se manda por
        // correo a los mismos destinatarios que configura el admin para las cotizaciones.
        await avisarPorCorreo(detalle);
        process.exit(1);
    }
    console.log('\n✔ Todas las cuentas importaron en las últimas ' + HORAS_ALERTA + ' h.');
}

async function avisarPorCorreo(lineas: string[]) {
    const cfg = await fs.collection('settings').doc('cotizadorNotificacion').get();
    const destinatarios: string[] = cfg.exists ? (cfg.get('destinatarios') || []) : [];
    if (!destinatarios.length) { console.log('   (sin destinatarios configurados: no se envía correo)'); return; }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) { console.log('   (faltan credenciales de correo)'); return; }
    try {
        await nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        }).sendMail({
            from: `"ADMA Inventario" <${process.env.GMAIL_USER}>`,
            to: destinatarios.join(', '),
            subject: `Dropi: ${lineas.length} cuenta(s) sin importar datos`,
            html: `<h3>Cuentas de Dropi sin importar en más de ${HORAS_ALERTA} horas</h3>
                   <ul>${lineas.map(l => `<li>${l}</li>`).join('')}</ul>
                   <p>Antes de tocar nada, ver <code>docs/integraciones/dropi-mcp.md</code> §6.
                   No renovar tokens para "comprobar": los deja inservibles.</p>`,
        });
        console.log(`   aviso enviado a ${destinatarios.length} destinatario(s)`);
    } catch (e) {
        console.error('   no se pudo enviar el aviso:', e instanceof Error ? e.message : e);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
