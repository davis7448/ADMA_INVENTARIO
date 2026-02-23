# Postmortem - Error 500 Comunidades v2 en Producción

**Fecha:** 2026-02-23  
**severity:** High  
**Estado:** Resuelto

---

## Resumen

La página `/communities` y `/admin/communities` devolvían error 500 en producción (Firebase App Hosting) después del deploy de Comunidades v2.

## Causa Raíz

El Firebase Admin SDK no se inicializaba en producción porque:
1. Las variables de entorno `FIREBASE_PRIVATE_KEY` y `FIREBASE_SERVICE_ACCOUNT_KEY` no estaban configuradas en Firebase App Hosting
2. El código buscaba credenciales en:
   - Variable de entorno `FIREBASE_PRIVATE_KEY`
   - Secreto `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Google Secret Manager

Ninguna de estas opciones estaba disponible.

## Solución

Agregado fallback en [`src/lib/firebase-admin.ts`](src/lib/firebase-admin.ts) que lee el archivo de credenciales local (`studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json`) que ya está en el repo.

## Lessons Learned

1. **Credenciales en repo:** El archivo de credenciales está en el repo (no es ideal para producción)
2. **Firebase App Hosting:** No configura automáticamente las variables de entorno
3. **Fallback robusto:** Siempre agregar fallback para archivos locales durante desarrollo

## Recomendaciones

1. **Corto plazo:** Usar el fix actual (archivo local en repo)
2. **Largo plazo:** Configurar Google Secret Manager y vincular a Firebase App Hosting
