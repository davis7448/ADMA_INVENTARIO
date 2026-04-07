# ACP — Agent Control Panel

Este proyecto está registrado en el ACP. **Al iniciar una sesión, leer el contexto primero.**

```bash
# 1. SIEMPRE al iniciar — leer contexto (requirements activos con sus IDs, errores)
curl -s https://agent-control-panel.vercel.app/api/agent/project \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs"

# 2. Reportar actividad (añadir requirement_id cuando se trabaja en un issue)
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/activity \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"message": "tu mensaje", "type": "info", "agent": "claude-code", "requirement_id": "<UUID_OPCIONAL>"}'

# 3. Registrar artifact producido (plan, review, código, deploy)
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/artifacts \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"requirement_id": "<UUID>", "agent": "architect", "artifact_type": "plan", "file_path": "docs/plans/FEATURE-001.md", "description": "desc opcional"}'

# 4. Reportar error
curl -s -X POST https://agent-control-panel.vercel.app/api/agent/errors \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"title": "título", "severity": "high", "description": "detalle"}'

# 5. Resolver error
curl -s -X PATCH https://agent-control-panel.vercel.app/api/agent/errors/<ID> \
  -H "Authorization: Bearer acp_itC2shbBc-0kM505QAirEigZKElVbQadeGGt0pd46rs" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

Tipos de actividad: `info` · `commit` · `deploy` · `test` · `error`
artifact_type: `plan` · `review` · `code` · `deploy`

**Cuando trabajas en un requirement específico**, pasa su UUID como `requirement_id` en activity y artifacts — esto habilita el Mission Timeline en el ACP.
