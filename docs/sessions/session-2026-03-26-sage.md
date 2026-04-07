## Análisis: permiso edición en Modificaciones para rol plataformas (DAVA-94)

### Stack confirmado
- Runtime: Node.js (repo ADMA Inventario)
- Framework: Next.js 14.2.5 + React 18
- DB/Auth: Firebase Firestore + Firebase Auth

### Estructura relevante
- `src/components/modificaciones-content.tsx` — gating de acciones Crear/Editar/Eliminar por rol en frontend.
- `src/hooks/use-auth.tsx` — resolución del usuario autenticado y fallback/auto-creación de perfil.
- `src/lib/api.ts` — `findUserByEmail` con query exacta por email.
- `src/app/actions/modificaciones.ts` — operaciones CRUD sin guard explícito por rol.
- `firestore.rules` — permisos efectivos de colección `modificaciones`.
- `src/app/modificaciones/page.tsx` — página de Modificaciones (import de wrapper no usado).

### Patrones observados
- El proyecto usa validación de permisos principalmente en cliente para varias pantallas.
- La autenticación en cliente resuelve perfil desde colección `users`; si falla, crea/fallback a `commercial`.
- En Modificaciones, el control de edición es UI-only (`user.role`), sin enforcement de backend en action.

### Causa raíz (verificable)
1. En `modificaciones-content` la edición depende de:
   - Crear: `user?.role === 'plataformas' || user?.role === 'admin'`
   - Editar: `user?.role === 'plataformas' || user?.role === 'admin'`
2. En `use-auth`, cuando no encuentra perfil por email o hay error:
   - crea/fallback con rol `commercial`
3. `findUserByEmail` busca con igualdad exacta y sin normalizar (`where("email", "==", email)`).
4. Resultado: cualquier inconsistencia de email/perfil degrada al usuario a `commercial`, y la UI de Modificaciones oculta edición para ese usuario.

### Contrato esperado de permisos para Modificaciones
- Read: usuarios autenticados
- Create/Update: `admin` y `plataformas`
- Delete: `admin`

### Estado actual real
- UI respeta parcialmente ese contrato.
- Firestore rules para `modificaciones` están abiertas a cualquier autenticado para create/update/delete.
- Actions no aplican guard de rol explícito.

### Archivos a modificar (plan mínimo y seguro)
- `src/lib/api.ts`
  - Normalizar email en `findUserByEmail` y en creación de usuario.
- `src/hooks/use-auth.tsx`
  - Evitar fallback silencioso a `commercial` en inconsistencias de perfil (o al menos no degradar privilegios sin alertar).
- `src/app/actions/modificaciones.ts`
  - Guard por rol para create/update/delete.
- `firestore.rules`
  - Endurecer permisos de `modificaciones` a contrato esperado.
- `src/app/modificaciones/page.tsx`
  - Limpiar import no usado o aplicar wrapper explícito acorde al contrato.

### ⚠️ Qué NO tocar
- Lógica de reservas en `createModificacion`/`deleteModificacion` (integración con `createReservation` / `deleteReservation`) salvo lo estrictamente necesario para guards.
- Flujos de navegación global en `main-layout` y providers.

### Orden sugerido de implementación
1. **Stratum**: guards server-side + Firestore rules (cierra brecha de seguridad y contrato).
2. **Lumen**: normalización de identidad/rol en auth client + UX de error de perfil.

### Evidencia rápida de líneas
- `src/components/modificaciones-content.tsx`: checks de rol para crear/editar.
- `src/hooks/use-auth.tsx`: fallback/autocreación en `commercial`.
- `src/lib/api.ts`: query exacta por email sin normalización.
- `firestore.rules`: `modificaciones` con write para cualquier autenticado.