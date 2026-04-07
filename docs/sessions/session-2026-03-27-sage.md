## Análisis: incidente prod rol Quotator en blanco (DAVA-111)

### Stack confirmado
- Runtime: Node.js
- Framework: Next.js 14 + React 18
- Auth/DB: Firebase Auth + Firestore

### Estructura relevante
- `src/lib/types.ts` — enum tipado de roles (`UserRole`).
- `src/components/main-nav.tsx` — visibilidad de navegación por `roles`.
- `src/components/modificaciones-content.tsx` — normalización de rol + permisos UI de Modificaciones.
- `src/app/modificaciones/page.tsx` — página sin guard de rol (importa wrapper pero no lo usa).
- `firestore.rules` (rama DAVA-94) — endurecimiento de `isRole/isRoleIn` leyendo `users/{request.auth.uid}`.
- `src/hooks/use-auth.tsx` + `src/app/actions/modificaciones.ts` — consumo de perfil por email y operaciones desde SDK cliente.

### Evidencia observada
- `quotator` no aparece en el repo (`grep -RIn "quotator" src firestore.rules` sin resultados).
- `UserRole` no contempla `quotator` (`src/lib/types.ts`).
- Menú de Modificaciones solo admite `['admin','logistics','commercial','consulta','plataformas']` (`src/components/main-nav.tsx`).
- Normalizador de rol en Modificaciones solo contempla aliases a `plataformas` y `admin` (`src/components/modificaciones-content.tsx`).
- En la rama `feature/DAVA-94-permiso-edicion-modificaciones-plataformas`, el único diff contra `main` es `firestore.rules`.

### Causa raíz (hipótesis validada)
Incidente causado por **desalineación de modelo de rol (Quotator no soportado) + gating silencioso de UI**.

Adicionalmente, la rama DAVA-94 introduce un endurecimiento de reglas por UID que puede negar permisos cuando el documento de usuario no está en `users/{auth.uid}`, mientras la app resuelve perfil por email.

### Por qué no hay error en consola
- El gating de permisos se hace mayormente por condicionales de render (`includes`/comparaciones de rol), que no arrojan excepción.
- En varios puntos hay `try/catch` con fallback silencioso de estado.
- Resultado: pantalla sin contenido útil para ese rol, sin crash explícito.

### Archivos a crear/modificar (propuesta)
- `src/lib/types.ts` — incluir `quotator` o definir mapeo oficial.
- `src/components/modificaciones-content.tsx` — normalizar `quotator` según política (p.ej., a `commercial` o `plataformas`).
- `src/components/main-nav.tsx` — incluir rol final en `roles` donde corresponda.
- `src/app/modificaciones/page.tsx` — usar `AuthProviderWrapper` con política explícita.
- `firestore.rules` + modelo `users` — alinear `users/{uid}` con la forma real de lookup del app.

### ⚠️ Qué NO tocar
- Lógica de negocio de reservas (`createReservation/deleteReservation`) en este incidente de acceso/rol.
- Flujos no relacionados del módulo comercial.

### Requiere ejecución por
- **Lumen**: sí (UI roles, navegación, guards y UX de permiso).
- **Stratum**: sí (coherencia de auth identity y Firestore rules por UID).
