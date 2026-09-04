// Constantes de Chatwoot que pueden usarse en el navegador (sin dependencias de servidor).
//
// Importar desde aquí en componentes de cliente: `chatwoot-cotizaciones.ts` carga
// firebase-admin y no puede entrar en el bundle del navegador (el build de App Hosting
// del 2026-09-04 falló por eso: "Can't resolve 'fs'").
export const CHATWOOT_URL = 'https://crm.admacompany.com';
export const CHATWOOT_CUENTA = 1;
// Buzón "WhatsApp Adma Company Lab Proyectos" (+57 312 8736234). El otro número de Lab
// (buzón 4, ...6235) es la línea comercial de dropshippers; las maquilas son proyectos.
export const CHATWOOT_INBOX_LAB = 5;
export const URL_BANDEJA_COTIZACIONES = 'https://inv.admacompany.com/cotizaciones';

export function urlConversacionChatwoot(conversationId: number): string {
    return `${CHATWOOT_URL}/app/accounts/${CHATWOOT_CUENTA}/conversations/${conversationId}`;
}
