// Envía los avisos de cotizaciones nuevas que quedaron en la cola `quoteOutbox`.
//
// Por qué una cola y no un envío directo al crear: si el correo falla, la cotización ya
// está guardada y el aviso no debe perderse. Aquí se reintenta y, tras varios intentos,
// se marca como fallido en vez de reintentar para siempre.
//
// Destinatarios: settings/cotizadorNotificacion → { destinatarios: string[] }. Vive en
// Firestore para poder cambiarlos sin desplegar.
//
// Uso: npx tsx scripts/procesar-cotizaciones.ts
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const MAX_INTENTOS = 5;

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

const html = (r: any, referencia: string) => `
  <h2>Nueva cotización de maquila</h2>
  <p><strong>${referencia}</strong></p>
  <table cellpadding="6" style="border-collapse:collapse">
    <tr><td>Cliente</td><td><strong>${r.nombre}</strong>${r.empresa ? ` · ${r.empresa}` : ''}</td></tr>
    <tr><td>Contacto</td><td>${r.email}${r.telefono ? ` · ${r.telefono}` : ''}</td></tr>
    <tr><td>Ciudad</td><td>${r.ciudad}</td></tr>
    <tr><td>Producto</td><td>${r.categoria} · ${(r.formas || []).join(', ')}</td></tr>
    <tr><td>Presentación</td><td>${r.presentacion}</td></tr>
    <tr><td>Cantidad</td><td>${Number(r.cantidad || 0).toLocaleString('es-CO')} unidades</td></tr>
  </table>
  <p>Gestiónala en la bandeja de <em>Cotizaciones</em>.</p>`;

async function main() {
    const cfg = await fs.collection('settings').doc('cotizadorNotificacion').get();
    const destinatarios: string[] = cfg.exists ? (cfg.get('destinatarios') || []) : [];
    if (!destinatarios.length) {
        console.log('Sin destinatarios configurados en settings/cotizadorNotificacion. Nada que enviar.');
        return;
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error('Faltan GMAIL_USER / GMAIL_APP_PASSWORD.');
        process.exit(1);
    }

    const pendientes = await fs.collection('quoteOutbox').where('estado', '==', 'pendiente').limit(50).get();
    if (pendientes.empty) { console.log('Sin avisos pendientes.'); return; }

    const transporte = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    for (const doc of pendientes.docs) {
        const v = doc.data();
        try {
            await transporte.sendMail({
                from: `"ADMA Cotizador" <${process.env.GMAIL_USER}>`,
                to: destinatarios.join(', '),
                subject: `Nueva cotización ${v.referencia} · ${v.resumen?.nombre || ''}`,
                html: html(v.resumen || {}, v.referencia),
            });
            await doc.ref.update({ estado: 'enviado', enviadoAt: Timestamp.now() });
            console.log(`✔ ${v.referencia} avisado a ${destinatarios.length} destinatario(s)`);
        } catch (e) {
            const intentos = (v.intentos || 0) + 1;
            const agotado = intentos >= MAX_INTENTOS;
            await doc.ref.update({
                intentos,
                estado: agotado ? 'fallido' : 'pendiente',
                ultimoError: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300),
            });
            console.error(`✗ ${v.referencia} intento ${intentos}${agotado ? ' — se marca fallido' : ''}: ${e instanceof Error ? e.message : e}`);
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
