// Puente entre las cotizaciones de maquila y Chatwoot (crm.admacompany.com).
//
// Pedido del 2026-09-04: que la cotización no viaje solo a ClickUp sino también al
// WhatsApp del laboratorio, para que comercial la vea donde atiende a los clientes y
// pueda responder por ahí. Cómo se hace sin gastar plantillas de Meta ni escribirle al
// cliente sin que él haya escrito:
//
//  1. Al recibir la cotización, el servidor busca o crea el CONTACTO del cliente en el
//     buzón de WhatsApp de Lab Proyectos, abre (o reutiliza) su CONVERSACIÓN y deja una
//     NOTA PRIVADA con el resumen y el enlace a la bandeja. Los agentes del buzón la ven
//     como cualquier conversación; el cliente no recibe nada todavía.
//  2. La confirmación del formulario le da al cliente un enlace wa.me al mismo número con
//     su referencia. Cuando escribe, su mensaje cae en esa misma conversación (Chatwoot
//     empareja por teléfono) y abre la ventana de 24 h: comercial ya puede contestar.
//  3. Cuando la cotización se sincroniza con ClickUp, se añade otra nota con la tarea.
//
// Solo código de servidor: el token vive en CHATWOOT_API_TOKEN (Secret Manager). Sin
// token, o sin teléfono del cliente, se omite sin romper el alta: el aviso por correo
// y ClickUp siguen su curso.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { CATEGORIAS, MODALIDADES, ROLES_FABRICACION, RUTAS_FORMULACION } from '@/lib/cotizador-catalogo';

export const CHATWOOT_URL = 'https://crm.admacompany.com';
export const CHATWOOT_CUENTA = 1;
// Buzón "WhatsApp Adma Company Lab Proyectos" (+57 312 8736234). El otro número de Lab
// (buzón 4, ...6235) es la línea comercial de dropshippers; las maquilas son proyectos.
export const CHATWOOT_INBOX_LAB = 5;
export const URL_BANDEJA_COTIZACIONES = 'https://inv.admacompany.com/cotizaciones';

export function urlConversacionChatwoot(conversationId: number): string {
    return `${CHATWOOT_URL}/app/accounts/${CHATWOOT_CUENTA}/conversations/${conversationId}`;
}

function token(): string | null {
    return process.env.CHATWOOT_API_TOKEN || null;
}

async function cwFetch(path: string, init?: RequestInit): Promise<any> {
    const response = await fetch(`${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_CUENTA}${path}`, {
        ...init,
        headers: { 'api-access-token': token() || '', 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Chatwoot API ${response.status} en ${path}: ${body.slice(0, 300)}`);
    }
    return response.json();
}

// El formulario acepta el teléfono como lo escriba el cliente ("300 123 4567",
// "+57 300…", "57300…"). WhatsApp necesita E.164; los celulares colombianos son diez
// dígitos empezando por 3. Lo que no encaje en nada se devuelve como llegó, con "+".
export function telefonoE164(valor?: string | null): string | null {
    const digitos = (valor || '').replace(/\D/g, '');
    if (!digitos) return null;
    if (digitos.length === 10 && digitos.startsWith('3')) return `+57${digitos}`;
    if (digitos.length === 12 && digitos.startsWith('57')) return `+${digitos}`;
    if (digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`;
    return null;
}

const nombreDe = (lista: readonly { id: string; nombre: string }[], id?: string) => lista.find(x => x.id === id)?.nombre || id || '—';

// Nota privada para los agentes: lo que necesitan para llamar o contestar sin abrir la
// bandeja, y el enlace para cuando sí la abran.
export function notaCotizacion(q: any, referencia: string): string {
    const rol = nombreDe(ROLES_FABRICACION, q.rolFabricacion);
    const modalidad = nombreDe(MODALIDADES, q.modalidad);
    const ruta = nombreDe(RUTAS_FORMULACION, q.rutaFormulacion);
    return [
        `📋 **Cotización de maquila ${referencia}** · capturada en el cotizador de ADMA Laboratorio`,
        `**Cliente:** ${q.nombre}${q.empresa ? ` · ${q.empresa}` : ''}${q.marca ? ` · marca ${q.marca}` : ''} · ${q.email}${q.telefono ? ` · ${q.telefono}` : ''} · ${q.ciudad}${q.pais ? ` (${q.pais})` : ''}`,
        `**Producto:** ${nombreDe(CATEGORIAS, q.categoria)} · ${(q.formas || []).join(', ')} · ${q.presentacion} · ${Number(q.cantidad || 0).toLocaleString('es-CO')} unidades`,
        `**Fabricación:** ${rol} · ${modalidad} · fórmula: ${ruta}${q.estudiosEstabilidad === 'no_tengo' ? ' · sin estudios de estabilidad (costo adicional)' : ''}`,
        q.tieneRegistro ? `**NSO:** ${q.nsoNumero || '—'} · ${q.nsoVigente ? 'vigente' : 'no vigente'}` : null,
        q.mensaje ? `**Mensaje:** ${q.mensaje}` : null,
        '',
        `Ficha completa y estado: ${URL_BANDEJA_COTIZACIONES}`,
        'Flujo: comercial revisa → aprueba si pasa a pruebas o a cotización real → responde por aquí cuando el cliente escriba (su enlace de WhatsApp trae la referencia).',
    ].filter(l => l !== null).join('\n');
}

async function buscarContacto(telefono: string, email: string): Promise<number | null> {
    const digitos = telefono.replace(/\D/g, '');
    const porTel = await cwFetch(`/contacts/search?q=${encodeURIComponent(digitos)}`);
    const conTel = (porTel.payload || []).find((c: any) => (c.phone_number || '').replace(/\D/g, '') === digitos);
    if (conTel) return conTel.id;
    // El correo es único en Chatwoot: si ya existe con otro teléfono, crearlo fallaría.
    const porEmail = await cwFetch(`/contacts/search?q=${encodeURIComponent(email)}`);
    const conEmail = (porEmail.payload || []).find((c: any) => (c.email || '').toLowerCase() === email.toLowerCase());
    return conEmail ? conEmail.id : null;
}

async function conversacionAbierta(contactoId: number): Promise<number | null> {
    const data = await cwFetch(`/contacts/${contactoId}/conversations`);
    const delBuzon = (data.payload || []).filter((c: any) => c.inbox_id === CHATWOOT_INBOX_LAB);
    // Se prefiere una abierta para no despertar una resuelta de otro tema.
    const abierta = delBuzon.find((c: any) => c.status === 'open') || delBuzon[0];
    return abierta ? abierta.id : null;
}

export type ResultadoChatwoot = { conversationId?: number; contactId?: number; omitida?: string };

export async function registrarCotizacionEnChatwoot(cotizacionId: string, q: any, referencia: string): Promise<ResultadoChatwoot> {
    if (!token()) return { omitida: 'CHATWOOT_API_TOKEN no está configurado' };
    const telefono = telefonoE164(q.telefono);
    if (!telefono) return { omitida: 'el cliente no dejó teléfono' };

    let contactId = await buscarContacto(telefono, q.email);
    if (!contactId) {
        const creado = await cwFetch('/contacts', {
            method: 'POST',
            body: JSON.stringify({
                inbox_id: CHATWOOT_INBOX_LAB, name: q.nombre, phone_number: telefono, email: q.email,
                custom_attributes: { cotizacion_maquila: referencia },
            }),
        });
        contactId = creado.payload?.contact?.id ?? creado.id;
    } else {
        await cwFetch(`/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify({ custom_attributes: { cotizacion_maquila: referencia } }) })
            .catch(e => console.error('[cotizaciones/chatwoot] no se pudo anotar la referencia en el contacto:', e));
    }

    let conversationId = await conversacionAbierta(contactId!);
    if (!conversationId) {
        const conv = await cwFetch('/conversations', {
            method: 'POST',
            body: JSON.stringify({ inbox_id: CHATWOOT_INBOX_LAB, contact_id: contactId, status: 'open' }),
        });
        conversationId = conv.id;
    }

    await cwFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: notaCotizacion(q, referencia), message_type: 'outgoing', private: true }),
    });

    const fs = getFirestore(await getApp());
    await fs.collection('quoteRequests').doc(cotizacionId).update({
        chatwootConversationId: conversationId, chatwootContactId: contactId, updatedAt: Timestamp.now(),
    });
    return { conversationId: conversationId!, contactId: contactId! };
}

// Nota adicional en la misma conversación (por ejemplo, la tarea de ClickUp ya creada).
export async function anotarEnChatwoot(conversationId: number, texto: string): Promise<void> {
    if (!token()) return;
    await cwFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: texto, message_type: 'outgoing', private: true }),
    });
}
