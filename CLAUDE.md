# ADMA Inventario

> **Proyecto de gestión de inventario para ADMA**

---

## 1. Stack Tecnológico

| Capa | Tecnología | Notas |
|------|------------|-------|
| Frontend | Next.js 14 + React 18 | App Router |
| UI | Shadcn/UI + Tailwind | Componentes accesibles |
| Backend | Firebase (Firestore + Auth) | NoSQL real-time |
| IA | Genkit AI (Google) | Alertas de restock |
| Deploy | Firebase App Hosting | Hosting serverless |
| Testing | Vitest | Unit tests |

### Dependencias clave

```json
{
  "firebase": "^11.x",
  "genkit": "^0.x",
  "@genkit-ai/google-ai": "^0.x",
  "next": "14.x",
  "react": "18.x",
  "shadcn-ui": "latest",
  "tailwindcss": "3.x",
  "zod": "^3.x",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x"
}
```

---

## 2. Estructura del Proyecto

```
src/
├── app/                    # App Router (Next.js 14)
│   ├── actions/            # Server Actions
│   ├── api/                # API Routes
│   ├── login/              # Autenticación
│   ├── dashboard-client.tsx
│   └── [modulos]/          # Páginas del sistema
├── components/             # Componentes React
├── ai/
│   └── flows/              # Genkit AI flows
└── lib/                    # Utilidades

docs/
├── plans/                  # Plans de arquitectura
├── reviews/                # Reviews del Tech Lead
└── sessions/               # Session summaries
```

---

## 3. Módulos del Sistema

| Módulo | Descripción | Ruta |
|--------|-------------|------|
| Inventario | Productos, almacenes, categorías, modificaciones | `/products`, `/categories`, `/warehouses` |
| Logística | Órdenes, devoluciones, despachos | `/orders`, `/dispatch`, `/returns` |
| Proveedores | Gestión de proveedores y alianzas | `/suppliers`, `/alianzas` |
| Comercial | Catálogo, CRM, desafíos, tareas | `/commercial/*` |
| Admin | Usuarios, auditoría, importación Excel | `/settings`, `/audit-alerts` |
| Alertas | Restock automático con IA | `/stock-alerts`, `/restock-alerts` |

---

## 4. Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso completo: CRUD total, configuración, auditoría |
| `logistics` | Órdenes, devoluciones, despachos, inventario |
| `commercial` | Catálogo, CRM, tareas comerciales |
| `plataformas` | Gestión de plataformas de venta |

### Autenticación
- Firebase Auth (Email/Password)
- Session gestionada via cookies
- Middleware: `src/middleware.ts`

---

## 5. Convenciones de Código

### Archivos y ubicación
- Server Actions → `src/app/actions/`
- Componentes UI → `src/components/`
- API Routes → `src/app/api/`
- AI Flows → `src/ai/flows/`

### Validación y Forms
- **Zod** para schemas de validación
- **React Hook Form** para formularios
- **@hookform/resolvers** para integrar Zod

### Firebase
- **Server**: Firebase Admin SDK (servidor)
- **Cliente**: Firebase Client SDK (navegador)
- Firestore Rules en `firestore.rules`
- Storage Rules en `storage.rules`

### Nomenclatura
- Archivos: kebab-case (`add-product-form.tsx`)
- Componentes: PascalCase (`AddProductForm`)
- Funciones: camelCase
- Constantes: UPPER_SNAKE_CASE

---

## 6. Reglas del Squad

> ⚠️ **REGLA ABSOLUTA:** Sin PLANNING + REVIEW no se escribe código.

### Pipeline de Trabajo

```
ISSUE → ARCHITECT → TECH LEAD → SENIOR CODER + UX → TESTING → DEVOPS → ACP:completed
```

### ¿Qué activa el pipeline?

| Tipo de tarea | ¿Requiere pipeline? |
|---------------|---------------------|
| Feature nueva, módulo nuevo | ✅ SIEMPRE |
| Cambio significativo de arquitectura | ✅ SIEMPRE |
| Bug fix no trivial (>5 líneas) | ✅ SIEMPRE |
| Fix de una línea, typo | ❌ Puede omitirse |

### Stop Conditions

| Condición | Acción |
|-----------|--------|
| Context > 30 intercambios | Crear checkpoint, pausar |
| Error no resuelto en 3 intentos | Reportar a David |
| Requirements no claros | Preguntar antes de asumir |
| Build roto | PARAR, investigar, reportar |

### Warm Start (siempre antes de trabajar)

1. Lee el último `docs/sessions/session-*.md`
2. Revisa `git status`
3. Identifica branch y última commit
4. Confirma el estado antes de continuar

---

## 7. UX/UI Guidelines

### Colores (del blueprint)

| Propósito | Color |
|-----------|-------|
| Primary | `#4285F4` (Blue vívido) |
| Background | `#F5F5F5` (Gray claro) |
| Accent | `#FFC107` (Yellow) |

### Tipografía

| Elemento | Fuente |
|----------|--------|
| Headlines | Poppins |
| Body | Inter |

### Principios de Diseño

- **Mobile-first** con design system
- **Jerarquía visual clara**: usuario sabe qué hacer en <5 segundos
- **Feedback de estado**: loading, error, success — siempre visibles
- **Consistencia**: patrón establecido > soluciones creativas
- **Accesibilidad**: ARIA, contraste, keyboard navigation

### Componentes Base

- Shadcn/UI components
- Tailwind CSS para estilos
- Radix UI para primitives

---

## 8. Agent Control Panel (ACP)

### Configuración

```bash
PROJECT_ID=adma-inventario
AUTH_TOKEN=acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs
BASE_URL=https://agent-control-panel.vercel.app/api/agent
```

### Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/project` | Obtener contexto (requirements activos) |
| POST | `/activity` | Reportar actividad |
| POST | `/artifacts` | Registrar artifact |
| POST | `/errors` | Reportar error |
| PATCH | `/errors/{id}` | Resolver error |

### Tipos de Actividad

| Tipo | Cuándo usarlo |
|------|---------------|
| `info` | Actualización general |
| `commit` | Nueva commit realizada |
| `deploy` | Deploy completado |
| `test` | Tests ejecutados |
| `error` | Error encontrado |

### Estados de Requerimiento

| Estado | Cuándo |
|--------|--------|
| `pending` | Issue creado |
| `architect_review` | Plan en revisión |
| `approved` | Plan aprobado |
| `rejected` | Plan rechazado |
| `changes` | Aprobado con cambios |
| `implementation` | En implementación |
| `testing` | En testing |
| `completed` | Deploy completado |

### Ejemplos de Comandos

```bash
# 1. Obtener contexto del proyecto
curl -s https://agent-control-panel.vercel.app/api/agent/project \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs"

# 2. Reportar actividad
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/activity \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"message": "...", "type": "info", "agent": "claude-code", "requirement_id": "<UUID>"}'

# 3. Registrar artifact
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/artifacts \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"requirement_id": "<UUID>", "agent": "architect", "artifact_type": "plan", "file_path": "docs/plans/FEATURE-001.md"}'

# 4. Reportar error
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/errors \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "severity": "high", "description": "..."}'
```

---

## 9. Skills del Proyecto

| Skill | Cuándo usarla |
|-------|---------------|
| `nextjs-14` | Rutas, Server Actions, layouts, middleware |
| `firebase` | Firestore, Auth, Storage, Cloud Functions |
| `genkit` | AI flows, prompts, model config |
| `shadcn-ui` | Componentes, Tailwind |
| `vitest` | Unit tests |

---

## 10. Nomenclatura de Archivos

| Tipo | Formato |
|------|---------|
| Plans | `docs/plans/FEATURE-XXX.md` |
| Reviews | `docs/reviews/FEATURE-XXX-review.md` |
| Sessions | `docs/sessions/session-{DATE}-{AGENT}.md` |
| Branches | `feature/XXX-nombre-corto` |

---

## 11. Gestión de Conocimiento

Los agentes acumulan conocimiento en `~/.kilocode/knowledge/`.

### Protocolo

1. **Busca primero** en `~/.kilocode/knowledge/[tecnologia].md`
2. **Si existe** → úsalo como fuente primaria
3. **Si no existe** → consulta Context7 → crea o actualiza
4. **Después de resolver** → documéntalo

---

## 12. Protocolo de Emergencia

Si el build rompe:

1. **PARAR LA LÍNEA**
2. Investigar logs
3. Reportar error al ACP (severity: high)
4. Fix o rollback
5. Documentar en `docs/sessions/postmortem-{date}.md`
6. **No continuar hasta build verde**

---

