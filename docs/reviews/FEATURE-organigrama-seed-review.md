# REVIEW — FEATURE: Seed de Usuarios + Asignación de Área

> **Tech Lead:** Jarvin  
> **Fecha:** 2026-02-23  
> **Plan:** `docs/plans/FEATURE-organigrama-seed.md`

---

## Veredicto: ✅ **APROBADO**

El plan está bien estructurado y sigue la arquitectura del proyecto. Se pueden proceder con la implementación.

---

## Hallazgos

### ✅ Arquitectura
- Usa el stack correcto: Next.js 14 + Firebase + Shadcn/UI
- Schema de datos correcto para `areas` y `user_positions`
- Flujo de datos claro

### ✅ Tipos
- TypeScript interfaces bien definidas
- Tipos estrictos sin uso de `any`

### ⚠️ Seguridad - Observaciones

| Item | Estado | Notas |
|------|--------|-------|
| Password generation | ⚠️ Mejorar | El patrón `ADMA2026!{primeraLetraNombre}` es predecible. Usar random string. |
| Firestore Rules | ✅ OK | Las reglas propuestas son correctas |
| Validación de emails | ✅ OK | Manejo implícito por Firebase Auth |

### ⚠️ Testing - Observaciones

| Item | Estado | Notas |
|------|--------|-------|
| Unit tests | ✅ Planificado | Vitest |
| Integration | ⚠️ Verificar | Firebase Emulator debe estar configurado |
| E2E | ✅ Planificado | Playwright |

---

## Sugerencias de Implementación

### 1. Password más seguro
```typescript
// En lugar de:
const password = `ADMA2026!${name[0]}`;

// Usar:
import { randomUUID } from 'crypto';
const password = `ADMA2026!${randomUUID().slice(0, 8)}`;
```

### 2. Optimizar `getUnassignedUsers()`
**NO usar** `listUsers()` de Firebase Admin (rate limit: 1000 usuarios/día).

**USAR** en su lugar:
```typescript
// Obtener todos los usuarios de Firestore 'users' collection
// Comparar con 'user_positions' collection
// Retornar usuarios sin posición
```

### 3. Agregar validación de usuarios pendientes
Antes del seed, verificar estado de cada usuario:
- ¿Existe en Auth? → Obtener UID
- ¿Existe en Firestore users? → Usar perfil existente
- ¿Tiene posición en organigrama? → Omitir

---

## Checklist de Implementación

- [ ] Seed script con manejo de errores robusto
- [ ] Función para generar passwords seguros
- [ ] Función `getUnassignedUsers` usando Firestore (no Auth listUsers)
- [ ] Componente UI para lista de usuarios sin área
- [ ] Modal de asignación con validación de formulario
- [ ] Tests unitarios para funciones utilitarias
- [ ] Tests de integración con Firebase Emulator

---

## Effort Estimado

| Tarea | Estimado | Notas |
|-------|----------|-------|
| Seed script | 2h | +30min para manejo de errores |
| Server Actions | 1h | |
| UI - Lista sin asignar | 2h | |
| UI - Modal asignación | 2h | |
| Testing | 2h | |
| **Total** | **~9h** | |

---

## Recomendación Final

**APROBADO** ✅

Proceder con la implementación. Las sugerencias de seguridad y optimización son opcionales pero recomendadas para mejorar la robustez del feature.
