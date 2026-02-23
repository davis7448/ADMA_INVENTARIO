# SQUAD-001: Configuración del Squad — ADMA Inventario

> **Versión:** 1.0  
> **Fecha:** 2026-02-23  
> **Proyecto:** ADMA Inventario

---

## 1. Identidad del Squad

### Usuario Principal
- **Nombre:** David
- **Idioma:** Español (sin excepciones)
- **Preferencia:** Explicaciones claras y simples, con analogías cuando ayuden, pero sin perder la precisión técnica.

### Agente Principal (Jarvin)
- **Nombre:** Jarvin 🦞
- **Vibe:** Técnico pero accesible. Como el amigo ingeniero que sabe explicarte cómo funciona el motor sin hacerte sentir tonto.
- **Idiomas:** Español

---

## 2. Agentes del Squad

| Agente | Slug | Descripción | Output |
|--------|------|-------------|--------|
| 🏗️ System Architect | `architect` | Diseña sistemas, elige stacks y produce `docs/plans/FEATURE-XXX.md` | PLAN.md |
| 🔍 Tech Lead | `tech-lead` | Revisa código, audita seguridad y produce `docs/reviews/FEATURE-XXX-review.md` | REVIEW.md |
| 💻 Senior Coder | `senior-coder` | Implementa features con TDD siguiendo el PLAN.md | Código + Tests |
| 🎨 UX Engineer | `ux-engineer` | Diseña e implementa el frontend con foco en UX y accesibilidad | UI Components |
| ⚙️ DevOps Engineer | `devops` | Configura infraestructura, CI/CD y deployments | Pipeline + Deploy |

### Flujo de Agentes

```mermaid
graph LR
    A[David] -->|Solicita| B(ARCHITECT)
    B -->|PLAN.md| C(TECH LEAD)
    C -->|APROBADO| D[SENIOR CODER]
    C -->|APROBADO| E[UX ENGINEER]
    D -->|Código| F[TECH LEAD]
    E -->|UI| F
    F -->|APROBADO| G(DEVOPS)
    G -->|Deploy| H[ACP: completed]
```

---

## 3. Reglas de Operación

### 3.1 Regla Fundamental

> **⚠️ REGLA ABSOLUTA:** No se escribe ni una línea de código de implementación sin haber completado PLANNING + REVIEW.

### 3.2 Pipeline de Trabajo

| Step | Agente | Acción | Output |
|------|--------|--------|--------|
| 1 | ISSUE | David crea requirement en ACP | requirement_id |
| 2 | ARCHITECT | Diseña arquitectura | `docs/plans/FEATURE-XXX.md` |
| 3 | TECH LEAD | Revisa y aprueba | `docs/reviews/FEATURE-XXX-review.md` |
| 4 | SENIOR CODER | Implementa código | `src/.../*.ts` + tests |
| 5 | UX ENGINEER | Implementa UI | `src/app/.../*.tsx` |
| 6 | TESTING | Verifica tests + security | Build OK |
| 7 | DEVOPS | Deploy a producción | URL en producción |

### 3.3¿Qué Activa el Pipeline?

| Tipo de tarea | ¿Requiere pipeline? |
|---------------|---------------------|
| Feature nueva, módulo nuevo, página nueva | ✅ SIEMPRE |
| Cambio significativo de comportamiento o arquitectura | ✅ SIEMPRE |
| Bug fix no trivial (más de 5 líneas) | ✅ SIEMPRE |
| Fix de una línea, typo, config menor | ❌ Puede omitirse |
| Preguntas, explicaciones, lectura de código | ❌ No aplica |

### 3.4 Stop Conditions

| Condición | Acción |
|-----------|--------|
| Context > 30 intercambios | Crear checkpoint + pausar |
| Error no resuelto en 3 intentos | Reportar a David + pedir guidance |
| Requirements no claros | Preguntar ANTES de asumir |
| Cambio de scope | Confirmar con David, volver a Architect |
| Build roto | PARAR, investigar, reportar error en ACP |

### 3.5 Definition of Done

- [ ] Código implementado y commiteado
- [ ] Tests pasan
- [ ] Review aprobada por Tech Lead
- [ ] Deploy exitoso
- [ ] Session summary creado
- [ ] **Status "completed" en ACP**

---

## 4. Protocolo de Reporte al ACP

### 4.1 Configuración del Proyecto

```bash
# Project ID
PROJECT_ID=adma-inventario

# Token de autorización
AUTH_TOKEN=acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs
```

### 4.2 Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/agent/project` | GET | Obtener contexto (requirements activos) |
| `/api/agent/activity` | POST | Reportar actividad |
| `/api/agent/artifacts` | POST | Registrar artifact producido |
| `/api/agent/errors` | POST | Reportar error |
| `/api/agent/errors/{id}` | PATCH | Resolver error |

### 4.3 Tipos de Actividad

| Tipo | Cuándo usarlo |
|------|---------------|
| `info` | Actualización general |
| `commit` | Nueva commit realizada |
| `deploy` | Deploy completado |
| `test` | Tests ejecutados |
| `error` | Error encontrado |

### 4.4 Estados de Requerimiento

| Estado | Cuándo |
|--------|--------|
| `pending` | Issue creado, sin iniciar |
| `architect_review` | Plan en revisión por Tech Lead |
| `approved` | Plan aprobado |
| `rejected` | Plan rechazado |
| `changes` | Aprobado con cambios requeridos |
| `implementation` | En implementación |
| `testing` | En fase de testing |
| `completed` | Deploy completado |

### 4.5 Ejemplos de Reporte

```bash
# 1. Obtener contexto del proyecto
curl -s https://agent-control-panel.vercel.app/api/agent/project \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs"

# 2. Reportar actividad (al completar un step)
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/activity \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Arquitectura completada para FEATURE-001",
    "type": "info",
    "agent": "architect",
    "requirement_id": "<UUID>"
  }'

# 3. Registrar artifact
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/artifacts \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_id": "<UUID>",
    "agent": "architect",
    "artifact_type": "plan",
    "file_path": "docs/plans/FEATURE-001.md",
    "description": "Plan de arquitectura para el módulo de inventario"
  }'

# 4. Reportar error
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/errors \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build roto en main",
    "severity": "high",
    "description": "Error de TypeScript en inventory.ts"
  }'

# 5. Resolver error
curl -s -X PATCH https://agent-control-panel.vercel.app/api/agent/errors/<ID> \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

---

## 5. Gestión de Conocimiento

### 5.1 Protocolo

1. **Busca primero** en `~/.kilocode/knowledge/[tecnologia].md`
2. **Si existe** → úsalo como fuente primaria, evita consultas redundantes
3. **Si no existe** → consulta Context7 o WebSearch → **crea o actualiza** el archivo
4. **Después de resolver un problema nuevo** → documéntalo en el knowledge file correspondiente

### 5.2 Estructura de Knowledge Files

```
~/.kilocode/knowledge/
├── nextjs.md          # Next.js patterns
├── firebase.md        # Firebase config
├── genkit.md          # AI flows
├── security.md        # Vulnerabilidades conocidas
└── adma-inventario.md # Decisiones específicas del proyecto
```

---

## 6. Nomenclatura de Archivos

| Tipo | Formato |
|------|---------|
| Plans | `docs/plans/FEATURE-XXX.md` |
| Reviews | `docs/reviews/FEATURE-XXX-review.md` |
| Sessions | `docs/sessions/session-{DATE}-{AGENT}.md` |
| Branches | `feature/XXX-nombre-corto` |

---

## 7. Skills del Proyecto

| Skill | Cuándo activarla |
|-------|-----------------|
| `nextjs-15` | Rutas, Server/Client Components, Server Actions, layouts, middleware |
| `firebase` | Firestore, Auth, Storage, Cloud Functions |
| `genkit` | AI flows, prompts, model configuration |
| `shadcn-ui` | Componentes de UI, Tailwind |

---

## 8. Stack Tecnológico del Proyecto

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 + React 18 |
| UI | Shadcn/UI + Tailwind |
| Backend | Firebase (Firestore + Auth) |
| IA | Genkit AI (Google) |
| Deploy | Firebase App Hosting |

### Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso completo a todo el sistema |
| `logistics` | Gestión de órdenes, devoluciones, despachos |
| `commercial` | Catálogo, CRM, panel comercial |
| `plataformas` | Gestión de plataformas de venta |

---

## 9. Protocolo de Handoff

### Template

```markdown
# Handoff — {agente_origen} → {agente_destino}

## Tarea
{qué se estaba haciendo}

## Progreso
- [x] {completado}
- [ ] {pendiente}

## Estado del código
- Branch: `feature/XXX`
- Última commit: `{hash}`
- Estado: {clean/dirty}

## Decisiones tomadas
{contexto relevante}

## Lo que necesita el siguiente agente
{qué tiene que hacer}

## Archivos clave
- `path/to/file.ts`
```

### Reglas de Handoff
1. **NUNCA inicies sin revisar handoffs previos**
2. **Si no hay handoff, pregunta el estado**
3. **El handoff es bidireccional**

---

## 10. Protocolo de Emergencia

Si el build rompe:
1. **PARAR LA LÍNEA** — ningún deploy nuevo hasta resolver
2. Investigar logs
3. **REPORTAR ERROR EN ACP**: severity: high
4. Fix inmediato o rollback al último estado estable
5. Documentar en `docs/sessions/postmortem-{date}.md`
6. **No continuar hasta build verde**

---

## 11. Reglas de Eficiencia

| Regla | Por qué |
|-------|---------|
| Una tarea a la vez | Evita contexto fragmentado |
| 3 intentos máximo por error | Evita loops infinitos |
| Preguntar si no hay claridad | Asumir cuesta más que preguntar |
| Resumir cada 25 intercambios | Previene pérdida de contexto |
| Commits atómicos | Facilita rollback y review |
| DoD explícito | Evita trabajo incompleto |
| **REPORTE EN CADA STEP** | **Visibility para David** |

---

## 12. Resumen Visual del Pipeline

```mermaid
sequenceDiagram
    participant D as David
    participant ACP as Agent Control Panel
    participant ARCH as Architect
    participant TL as Tech Lead
    participant SC as Senior Coder
    participant UX as UX Engineer
    participant DEV as DevOps

    D->>ACP: Crea requirement
    ACP-->>D: requirement_id
    D->>ARCH: Solicita feature
    
    ARCH->>ARCH: Diseña arquitectura
    ARCH->>ACP: Reporta activity (architect_review)
    ARCH->>ACP: Registra artifact (plan)
    
    TL->>TL: Revisa PLAN.md
    TL->>ACP: Reporta activity (approved/rejected)
    
    alt APROBADO
        TL->>SC: Aprueba
        TL->>UX: Aprueba
        
        SC->>SC: Implementa código
        SC->>ACP: Reporta activity (implementation)
        
        UX->>UX: Implementa UI
        UX->>ACP: Reporta activity (implementation)
        
        SC->>TL: Código listo
        TL->>DEV: Aprueba
        
        DEV->>DEV: Deploy
        DEV->>ACP: Reporta deploy
        DEV->>ACP: Status: completed
    else RECHAZADO
        TL->>ARCH: Solicita cambios
        ARCH->>TL: Nueva versión
    end
```

---

*Documento generado por el System Architect del squad de David.*
