# PLAN — Comunidades v2: Sistema Completo (Comunidades + Retos + Dropshipping)

> **Objetivo:** Implementar el sistema completo de comunidades con sus 3 módulos: registro de líderes externos, gestión de retos, y solicitudes de dropshipping.

---

## 1. Los 3 Módulos (relacionados entre sí)

| Módulo | Descripción | Acceso Líder | Acceso Admin |
|--------|-------------|--------------|-------------|
| **Comunidades** | Registro de líderes + miembros | `/join/[codigo]` | `/admin/communities` |
| **Retos** | Desafíos para comunidades | `/leader/dashboard` | `/admin/communities/retos` |
| **Dropshipping** | Solicitud de productos | `/leader/dropshipping` | `/admin/dropshipping` |

---

## 2. Arquitectura Propuesta

### Flujo de Acceso

```
┌─────────────────────────────────────────────────────────────────┐
│                      NAV PRINCIPAL (Admin)                       │
│                                                                  │
│  /admin/communities                                              │
│  ├── Dashboard de comunidades (resumen, métricas)              │
│  ├── Crear retos para comunidades                               │
│  └── Ver rankings y comisiones                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   FLUJO PÚBLICO (Líderes)                       │
│                                                                  │
│  /join/[codigo-invitacion]  ← Enlace único por líder           │
│       ├── Validar código de invitación                          │
│       ├── Registro público (nombre, email, password)           │
│       └── Redirect a página de confirmación                     │
│                                                                  │
│  /leader/dashboard  ← Solo para líderes registrados            │
│       ├── Mi comunidad                                          │
│       ├── Mis miembros                                         │
│       └── Mis retos activos                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Rutas Completas

### Admin (dentro del sistema, requieren auth)
| Ruta | Descripción |
|------|-------------|
| `/admin/communities` | Dashboard principal - ver todas las comunidades |
| `/admin/communities/retos` | Crear y gestionar retos |
| `/admin/dropshipping` | Aprobar/rechazar solicitudes de TODAS las comunidades |

### Público (sin auth, registro externo)
| Ruta | Descripción |
|------|-------------|
| `/join/[codigo]` | Registro de NUEVO LÍDER (generado por admin) |
| `/join/member/[codigo]` | Registro de NUEVO MIEMBRO (generado por líder) |

### Líder (requiere auth, rol community_leader)
| Ruta | Descripción |
|------|-------------|
| `/leader/dashboard` | Mi comunidad, mis miembros, mis retos |
| `/leader/dropshipping` | Ver stats de solicitudes de MI comunidad |

### Miembro (requiere auth, rol community_member)
| Ruta | Descripción |
|------|-------------|
| `/member/retos` | Ver retos de MI comunidad |
| `/member/dropshipping` | Crear solicitud de producto |

---

## 4. Navegación Admin (main-nav.tsx)

```typescript
{
  label: 'Comunidades',
  roles: ['admin', 'commercial', 'plataformas'],
  children: [
    { href: '/admin/communities', label: 'Dashboard', roles: ['admin', 'commercial', 'plataformas'] },
    { href: '/admin/communities/retos', label: 'Retos', roles: ['admin', 'commercial'] },
    { href: '/admin/dropshipping', label: 'Dropshipping', roles: ['admin', 'plataformas'] },
  ]
}
```

---

## 5. Flujos Detallados

### 5.1 Registro de Miembros
El líder genera un código de invitación desde su dashboard → Lo comparte con sus miembros → Miembro se registra en `/join/member/[codigo]` → Queda asociado a esa comunidad.

### 5.2 Retos por Comunidad
Los retos están **aislados por comunidad**. Admin crea reto especificando comunidad (o todas). Cada miembro/líder solo ve retos de SU comunidad.

### 5.3 Dropshipping - Aislamiento Total
- **Líder**: Solo ve estadísticas de solicitudes de SU comunidad (cuántos members presentaron, estado). NO ve los detalles de cada solicitud.
- **Admin**: Ve TODAS las solicitudes de TODAS las comunidades.
- **Miembro**: Solo crea su propia solicitud.

### 5.4 Verificación de Retos (Dropi Integration Futura)

> **Nota:** Actualmente la verificación de cumplimiento de retos es **manual** (el admin revisa).
>
> **Futuro:** Se integrará con **Dropi** para obtener datos de ventas automáticamente:
> - Dropi API → Consultar órdenes del líder/miembros
> - Calcular cumplimiento de retos basado en ventas reales
> - Esta integración será una fase posterior

### 5.5 Permisos Resumidos
| Acción | Admin | Líder | Miembro |
|--------|-------|-------|---------|
| Ver todas las comunidades | ✅ | ❌ | ❌ |
| Ver su comunidad | ✅ | ✅ | ✅ |
| Crear retos | ✅ | ❌ | ❌ |
| Ver retos de su comunidad | ✅ | ✅ | ✅ |
| Aprobar/rechazar dropshipping | ✅ | ❌ | ❌ |
| Ver solicitudes de su comunidad | ✅ (todo) | ✅ (stats) | ❌ |
| Crear solicitud dropshipping | ✅ | ✅ | ✅ |

---

## 6. Modelo de Datos

### community_invite_codes (invitar líderes)

```typescript
interface CommunityInviteCode {
  id: string;                    // UUID
  code: string;                  // Código único (8 chars, alfanumérico)
  communityId: string;           // FK a communities
  leaderId?: string;             // FK a community_leaders (cuando se usa)
  maxUses?: number;              // Límite de usos (opcional)
  usedCount: number;             // Contador de usos
  expiresAt: Timestamp;          // Fecha de expiración
  createdAt: Timestamp;
  createdBy: string;             // Admin que lo creó
  isActive: boolean;
  type: 'leader';               // Tipo: para líder
}
```

### community_member_invites (invitar miembros)

```typescript
interface CommunityMemberInvite {
  id: string;
  code: string;                  // Código único para miembro
  communityId: string;
  leaderId: string;             // Líder que invitar
  memberId?: string;            // FK a community_members (cuando se usa)
  createdAt: Timestamp;
  expiresAt: Timestamp;
  isUsed: boolean;
  type: 'member';               // Tipo: para miembro
}
```

### community_leaders (actualización)

```typescript
interface CommunityLeader {
  // ... campos existentes
  inviteCode: string;            // Código de invitación usado
  registeredAt: Timestamp;      // Fecha de registro
  status: 'pending' | 'active' | 'suspended';
  role: 'community_leader';     // Nuevo rol
}
```

### community_members (nueva colección)

```typescript
interface CommunityMember {
  id: string;
  leaderId: string;             // FK al líder de su comunidad
  communityId: string;          // FK a su comunidad
  userId: string;               // FK al usuario (Auth)
  name: string;
  email: string;
  joinedAt: Timestamp;
  status: 'active' | 'inactive';
  role: 'community_member';     // Nuevo rol
}
```

---

## 7. Tipos de Usuario (Extensiones)

```typescript
// src/types/user.ts
type UserRole = 
  | 'admin' 
  | 'commercial' 
  | 'plataformas' 
  | 'logistics'
  | 'consulta'
  | 'community_leader'    // NUEVO
  | 'community_member';   // NUEVO
```

---

## 8. Auth y Seguridad

### Mecanismo de Auth

| Actor | Mecanismo | Notas |
|-------|-----------|-------|
| Admin ADMA | Firebase Auth + sesión | Roles: `admin` |
| Líder Comunidad | Firebase Auth (email/pass) | Rol: `community_leader` |
| Miembro Comunidad | Firebase Auth (email/pass) | Rol: `community_member` |

### Middleware (src/middleware.ts)

```typescript
// Rutas públicas que no requieren auth
export const publicRoutes = [
  '/join',
  '/join/member',
  '/login',
];

export function middleware(request: NextRequest) {
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );
  
  if (isPublicRoute) {
    return NextResponse.next(); // Skip auth
  }
  // ... resto del middleware (proteger rutas privadas)
}
```

---

## 9. Server Actions Requeridas

### Admin (src/app/actions/admin/communities.ts)

```typescript
// Generar código de invitación para líder
export async function generateLeaderInviteCode(communityId: string, maxUses?: number)

// Generar código de invitación para miembro
export async function generateMemberInviteCode(leaderId: string)

// Listar comunidades con métricas
export async function getCommunitiesDashboard()

// Crear reto para comunidad específica o todas
export async function createChallengeForCommunity(challengeData)

// Ver ranking de comunidades
export async function getCommunityRanking()

// Aprobar/rechazar solicitud dropshipping
export async function reviewDropshippingRequest(requestId: string, approved: boolean, response: string)
```

### Público (src/app/actions/public/join.ts)

```typescript
// Validar código de invitación de líder
export async function validateLeaderInviteCode(code: string)

// Validar código de invitación de miembro
export async function validateMemberInviteCode(code: string)

// Registrar líder con código
export async function registerLeaderWithInvite(formData)

// Registrar miembro con código
export async function registerMemberWithInvite(formData)
```

### Líder (src/app/actions/leader/dashboard.ts)

```typescript
// Dashboard del líder
export async function getLeaderDashboard(leaderId)

// Mis miembros
export async function getLeaderMembers(leaderId)

// Mis retos activos
export async function getLeaderChallenges(leaderId)

// Stats de dropshipping de mi comunidad
export async function getCommunityDropshippingStats(leaderId)

// Generar código para invitar miembros
export async function createMemberInvite(leaderId)
```

---

## 10. UI/UX

### Admin: /admin/communities

- **Tabs:**
  - Resumen (métricas generales)
  - Comunidades (lista con búsqueda)
  - Retos (crear y listar)
- **Acciones:**
  - Generar invite code para líder
  - Crear reto
  - Ver detalles

### Público: /join/[codigo]

- **Diseño:** Minimalista, focused en conversión
- **Pasos:**
  1. Validar código → Si es válido, mostrar formulario
  2. Registro → Nombre, email, password
  3. Confirmación → "Tu cuenta está creada"

### Líder: /leader/dashboard

- **Diseño:** Similar al commercial dashboard
- **Secciones:**
  - Mi comunidad
  - Miembros (y generar códigos de invitación)
  - Retos activos

---

## 11. Firestore Rules

```javascript
// ===== COLECCIONES PÚBLICAS =====
// Solo lectura de campos específicos (no datos sensibles)

// Códigos de invitación de líderes
match(/community_invite_codes/{codeId}) {
  // Público: solo leer código, estado y expiración
  allow read: if resource.data.type == 'leader' 
    && resource.data.isActive == true
    && resource.data.expiresAt > request.time;
  // Solo admins pueden escribir
  allow write: if request.auth != null 
    && request.auth.token.role in ['admin', 'commercial'];
}

// Códigos de invitación de miembros
match(/community_member_invites/{inviteId}) {
  allow read: if resource.data.type == 'member'
    && resource.data.isUsed == false
    && resource.data.expiresAt > request.time;
  allow write: if request.auth != null
    && request.auth.token.role == 'community_leader';
}

// Líderes: solo su propia data
match(/community_leaders/{leaderId}) {
  allow read: if request.auth != null && 
    (request.auth.uid == leaderId || request.auth.token.role in ['admin', 'commercial']);
  allow write: if request.auth != null 
    && request.auth.token.role in ['admin', 'commercial'];
}

// Miembros: solo su propia data
match(/community_members/{memberId}) {
  allow read: if request.auth != null &&
    (request.auth.uid == resource.data.userId || 
     request.auth.token.role in ['admin', 'commercial', 'community_leader']);
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null 
    && request.auth.token.role in ['admin', 'community_leader'];
}

// Retos: aislamiento por comunidad
match(/challenges/{challengeId}) {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.auth.token.role in ['admin', 'commercial'];
  allow update, delete: if request.auth != null 
    && request.auth.token.role in ['admin', 'commercial'];
}

// Solicitudes dropshipping
match(/dropshipping_requests/{requestId}) {
  // Admin ve todo
  allow read: if request.auth != null 
    && request.auth.token.role in ['admin', 'plataformas'];
  // Líder ve stats de su comunidad (no detalles)
  allow read: if request.auth != null 
    && request.auth.token.role == 'community_leader'
    && resource.data.leaderId == request.auth.uid;
  // Miembro crea su propia solicitud
  allow create: if request.auth != null;
  // Solo admin approves/rejects
  allow update: if request.auth != null 
    && request.auth.token.role in ['admin', 'plataformas'];
}
```

---

## 12. Testing

| Nivel | Herramienta | Cobertura |
|-------|-------------|-----------|
| Unit | Vitest | Schemas de validación |
| Integration | Vitest | Server Actions |
| E2E | — | Registro público, generación de códigos |

---

## 13. Timeline Estimado

| Fase | Descripción |
|------|-------------|
| 1 | Server Actions (admin + público + líder) |
| 2 | UI Admin Dashboard |
| 3 | UI Público (/join/[codigo]) |
| 4 | UI Líder Dashboard |
| 5 | Menú de navegación |
| 6 | Firestore Rules actualizadas |
| 7 | Tests |

---

## 14. Notas Adicionales

- **URLs bonitas:** Usar código de 8 caracteres para que sea shareable
- **Expiración:** Por defecto 30 días, configurable
- **Dropi Integration:** Futura fase - actualmente verificación manual de retos
- **Rate limiting:** Considerar para registro público

---

*Plan creado: 2026-02-23*
*Última actualización: 2026-02-23 (corrigido según Tech Lead review)*
