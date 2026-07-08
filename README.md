# Enterprise Agent Platform — Admin Portal

Frontend admin portal cho hệ thống gồm 3 backend:
- **Agno Runtime** — Quản lý AgentOS, Teams, Agents, Prompts, Skills, Models, Workflows, Sessions, Memories
- **MCP Gateway** — Capabilities, Assignments, Execute
- **Knowledge Platform** — ACL Tree (Materialized Path), Assignments, Evaluate

## Tech Stack
- **Framework**: Quasar (Vue 3 Options API)
- **State**: Pinia
- **HTTP**: Axios (API clients theo đúng spec thực tế)
- **Charts**: Apache ECharts (vue-echarts)
- **Language**: JavaScript/TypeScript

## API Base Path: `/api/v1`

### Agno Runtime Endpoints
- `GET/POST/PUT/DELETE /agent-os` — AgentOS
- `GET/POST/PUT/DELETE /teams` — Teams (filter: agent_os_id)
- `GET/POST/PUT/DELETE /agents` — Agents (filter: team_id)
- `GET/POST/PUT/DELETE /prompts` — Prompts (auto-version by code)
- `GET/POST/PUT/DELETE /skills` + `/skills/assign` + `/skills/unassign`
- `GET/POST/PUT/DELETE /models` — Model Registry
- `POST /chat` — Sync chat
- `POST /chat/stream` — SSE streaming
- `GET /sessions` + `GET /sessions/{id}` — with user_id check
- `GET /runs` + `GET /runs/{id}/events` + `GET /runs/{id}/stream`
- `GET /memories` + `GET /agents/{id}/memories` + `DELETE /memories/{id}`
- `GET/POST/PUT/DELETE /workflows` + `POST /workflows/{id}/run`
- `GET /workflow-runs` + `GET /workflow-runs/{id}/steps` + `/events`
- `GET /health` + `GET /ready` + `GET /version`

### MCP Gateway Endpoints
- `GET /capabilities` — list active capabilities
- `POST /capabilities/assignments` — assign (replace) capability_codes to level
- `POST /capabilities/resolve` — intersection resolution for agent
- `POST /execute` — core execution → {success, data, executionId}

### Knowledge Platform Endpoints
- `POST /acl/evaluate` — {allowed, reason} per user+node+action
- `GET /acl/tree` — full ACL tree (Materialized Path)
- `POST /acl/nodes` + `PUT /acl/nodes/{id}` + `DELETE /acl/nodes/{id}` (cascade)
- `POST /acl/assignments` + `GET /acl/assignments`

## Setup

```bash
npm install
cp .env.example .env
# Chỉnh sửa .env cho đúng URL backend
npm run dev
```

## Error Codes
| error_code | HTTP | Mô tả |
|---|---|---|
| not_found | 404 | Tài nguyên không tồn tại |
| conflict | 409 | Trùng unique key (code, provider+model) |
| validation_failed | 422 | Dữ liệu không hợp lệ (thiếu base_url cho openai_like) |
| capability_resolution_failed | 422 | Không thể resolve năng lực cho Agent |
| mcp_gateway_error | 502 | MCP cầu nối lỗi |
| runtime_execution_failed | 500 | Lỗi LLM Runtime |
