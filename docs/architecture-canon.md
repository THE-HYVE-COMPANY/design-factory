---
title: "Design Factory — Architecture Canon"
version: 1.0
status: ratified
updated: 2026-05-10
---

> Documento curto que canoniza os contratos do Design Factory. É o "constitution"
> técnico do projeto. Toda decisão arquitetural posterior deve respeitar esses
> contratos ou propor emenda explícita.

# Design Factory — Architecture Canon

**Princípio guia:** não simplificar removendo potência — simplificar declarando o núcleo.

## 0. Purpose

Este doc declara **o que o DF é** em termos arquiteturais. Não enumera features.
Não explica history. Não substitui CHANGELOG. É o **núcleo invariante**.

**Quando consultar:**
- antes de adicionar uma nova rota ao daemon
- antes de criar um novo modo de operação
- antes de aceitar um novo provider adapter
- antes de mudar a forma de persistir conversação
- antes de exportar um novo arquivo formato

**Quando atualizar:**
- decisão arquitetural fundamental mudou (raro)
- novo contrato emergiu (precisa ADR específica)
- ambiguidade detectada em produção

**Não é:**
- guia de implementação (vide `docs/architecture.md` para "como")
- API reference (vide `docs/providers.md` + endpoints listing do daemon)
- feature planning

---

## 1. Kernel

Tudo no Design Factory se reduz a 7 nouns:

- **Project** — o container de todo o trabalho local.
- **Direction** — contexto criativo que orienta decisões do agent (design system, brief, references).
- **Conversation** — uma thread de interação dentro do projeto.
- **Turn** — um ciclo usuário → agent.
- **Artifact** — um arquivo produzido ou alterado por um turn.
- **Version** — um snapshot do projeto em um ponto no tempo.
- **Preview** — renderização runtime do `primaryFile` atual.

### Relationships

Não é hierarquia linear — é um grafo simples:

```
Project owns Direction, Conversations, Artifacts and Versions.
Conversation owns Turns.
Turn may produce Artifact Mutations.
Version snapshots the Project.
Preview renders the Project primaryFile.
```

Diagrama:

```
Project
├─ Direction              (contexto que guia Turns)
├─ Conversations
│  └─ Turns
│     └─ Artifact Mutations  (linkam pra Artifact via path + turn_id)
├─ Artifacts             (arquivos do projeto)
├─ Versions              (snapshots do Project inteiro)
└─ Preview Session       (runtime puro, renderiza primaryFile)
```

### Sources of truth

| Noun | Mora em | Source of truth |
|---|---|---|
| **Project** | `projects/{slug}/` | filesystem |
| **Direction** | `projects/{slug}/project.df.json` (campo `direction`, opcional) + design-systems linkados | filesystem |
| **Conversation** | `projects/{slug}/.df/chat/{threadId}/` | filesystem (journal-as-truth) |
| **Turn** | linha do journal.ndjson + linked artifact mutations | journal |
| **Artifact** | `projects/{slug}/<primaryFile>` ou `assets/...` | filesystem |
| **Version** | `projects/{slug}/.df/versions/{vid}/` | filesystem |
| **Preview** | iframe DOM no browser, hidrato do `<primaryFile>` | runtime (não persistido) |

**Implicação:** filesystem é canonical para 6 dos 7. Preview é o único runtime puro.

---

## 2. Non-goals (declarar o que DF NÃO é)

| Non-goal | Por quê |
|---|---|
| Hosted product features (accounts, shared projects, hosted inference) | Fora do core preview; o produto foca em arquivos de projeto e providers trazidos pelo usuário. |
| Canvas vetorial (Figma-like) | A substância aqui é HTML editável. |
| MCP / ecossistema de conectores | Daemon é autônomo. |
| Multi-user collaboration real-time | Single-user app. Shared-container setups são caso especial (service mode opcional). |
| IDE generalista | Não é VS Code. Foco em design + agent. |
| Universal agent IDE | Claude Code é reference runtime. Outros providers via adapter contract. |

**Regra:** se uma feature precisa abrir mão de um non-goal, ela vira ADR
explícito. Não slide em silêncio.

---

## 3. Boundary diagram

```
┌──────────────────────────────────────────────────────────────┐
│  apps/web  ←  React UI                                        │
│   ├─ shells/      EditorShell · ProjectsShell · SettingsShell │
│   ├─ panels/      ChatPanel · PreviewPanel · FilesPanel · ... │
│   ├─ hooks/       useProjectSession · useChatTurn · ...       │
│   └─ lib/         daemon-client · sanitizers · types          │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP + SSE + WS (loopback only)
┌────────────────────────────▼─────────────────────────────────┐
│  apps/daemon  ←  Local API (Node)                             │
│   ├─ routes/                                                   │
│   │   ├─ health.mjs   /healthz · /ping                         │
│   │   ├─ fs.mjs       /fs/list-projects · write · artifact     │
│   │   ├─ providers.mjs /<provider>/stream · /agents/list       │
│   │   ├─ config.mjs   /config/<provider>                       │
│   │   ├─ skills.mjs   /skills/*                                │
│   │   └─ terminal.mjs WS /terminal                             │
│   └─ lib/                                                      │
│       ├─ cors.mjs                                              │
│       ├─ config-dir.mjs   single getConfigDir() function       │
│       ├─ repo-root.mjs    git rev-parse + fallback             │
│       └─ path-scope.mjs   filesystem boundary enforcement      │
└──────────┬─────────────┬─────────────┬───────────┬───────────┘
           │             │             │           │
┌──────────▼──┐  ┌───────▼──────┐  ┌──▼─────────┐ │
│ Project     │  │ Provider     │  │ Artifact   │ │
│ Store       │  │ Runtime      │  │ Engine     │ │
│ (fs)        │  │ (CLI spawn)  │  │ (fs + lock)│ │
└─────────────┘  └──────────────┘  └────────────┘ │
                                                   │
                                          ┌────────▼────────┐
                                          │ Chat Journal    │
                                          │ (fs append-only)│
                                          └─────────────────┘
```

**Regras de fronteira:**

1. **Browser nunca toca filesystem direto.** Tudo via daemon HTTP.
2. **Daemon é transporte + orquestração, não cérebro.** Lógica de domínio vive
   em stores (Project Store, Chat Journal, Artifact Engine, Provider Runtime).
3. **Provider Runtime é externo ao DF.** CLIs (claude, codex, gemini) ou APIs
   (Anthropic, OpenRouter). Daemon spawna ou conecta, não emula.

### Scoped storage

**Regra canônica:** nenhuma rota aceita path arbitrário sem resolver contra
um scope permitido. Cada scope tem regras próprias de leitura/escrita.

| Scope | Root | Quem escreve | Quem lê |
|---|---|---|---|
| **ProjectScope** | `projects/{slug}/` | provider via turn + artifact engine | tudo |
| **DesignSystemScope** | `design-systems/{slug}/` | usuário (upload/ingest) | preview + chat context |
| **SkillScope** | `skills/{slug}/` | usuário + adapter de skill mutation | provider context |
| **ConfigScope** | `$DF_CONFIG_DIR/` (default `~/.config/design-factory/`) | usuário via Settings | daemon |
| **TemplateScope** | `templates/` | repo maintainer | new project bootstrap |
| **TempScope** | `<system_tmp>/df-XXXX/` (controlled, expires) | daemon transactional ops | daemon only |

**Function canonical:** `resolveScope(scope, path)` retorna absolute path ou
lança `ScopeViolation`. Substitui `assertPathInScope(target, projectsRoot)`
absoluto. Cada handler declara qual scope opera.

---

## 4. Project Contract

### 4.1. Manifest canonical

**Cada projeto tem `project.df.json` no root.** Manifest é deliberadamente leve —
só carrega o que precisa pra orientar runtime + recovery.

**Campos invariantes (obrigatórios):**

```json
{
  "schemaVersion": 1,
  "id": "project-slug",
  "name": "Project Display Name",
  "primaryFile": "index.html",
  "createdAt": "2026-05-10T18:00:00Z",
  "updatedAt": "2026-05-10T19:23:00Z"
}
```

- `schemaVersion` — inteiro, 1 em v0.1
- `id` — slug filesystem-safe, único, immutable após criação
- `name` — display string (pode ter espaços, acentos)
- `primaryFile` — caminho relativo ao project root, o arquivo que o iframe renderiza
- `createdAt` / `updatedAt` — UTC ISO-8601

**Campos opcionais (podem ser omitidos):**

```json
{
  "mode": "prototype",
  "direction": {
    "designSystem": "my-brand",
    "brief": "..."
  }
}
```

- `mode` — string livre por enquanto. Semântica formal entra quando virar real,
  não antes. Evitar valores que sugerem garantias falsas (ex: `"production"` —
  sugere "pronto pra produção", o DF não promete isso).
- `direction.designSystem` — slug de design-system linkado em `design-systems/`
- `direction.brief` — string ou referência a arquivo de contexto

### 4.2. Layout obrigatório

```
projects/{slug}/
├── project.df.json     ← manifest
├── {primaryFile}.html  ← o arquivo principal (ou index.html)
├── assets/             ← imagens, fonts, etc
└── .df/                ← state interno, não user-facing
    ├── chat/           ← conversations
    │   └── {threadId}/
    │       ├── journal.ndjson   ← append-only events (Fase 2)
    │       ├── latest.json      ← derived snapshot (Fase 2)
    │       └── index.json       ← integrity (Fase 2)
    │   OU (Fase 1, current):
    │   └── {threadId}.jsonl     ← flat journal
    ├── versions/
    │   └── {vid}/
    │       ├── meta.json
    │       └── files/
    ├── backups/
    │   └── ... (rolling 10, atomic write)
    └── state/
        └── ... (provider session ids and other derived state)
```

### 4.3. Filesystem-first

- **Filesystem is canonical.**
- **Any cache, index, registry, or SQLite-like acceleration is derived and
  disposable. Deleting it must never delete user work.**
- **`git init` em `projects/{slug}/` é encorajado** — usuário pode versionar
  externamente sem que DF perca controle.
- **`projects/{slug}/` é movível.** Renomear o dir = renomear o projeto
  (mantém `id` interno pra recovery).

### 4.4. Fallback / migration

- Projetos pre-manifest: daemon resolve `primaryFile` por convenção:
  1. `{slug}.html`
  2. `index.html`
  3. primeiro `.html` encontrado
- Ao detectar projeto sem manifest, daemon escreve `project.df.json` automaticamente
  no primeiro write subsequente (lazy migration).

### 4.5. Resolução de path

Daemon resolve `projectsRoot` via `git rev-parse --path-format=absolute --git-common-dir`
(fallback `process.cwd()`). Vide `apps/daemon/src/index.mjs:173-178`. Esse é o
contrato — não há env var `DF_PROJECTS_DIR` no v0.1.

---

## 5. Turn Contract

### 5.1. Lifecycle

```
1. user sends prompt
   ↓
2. journal: append { type: "user_message", role: "user", text, ts }
   ↓
3. daemon spawns provider runtime
   ↓
4. provider emits stream events
   ↓
5. for each event:
   ├─ daemon parses (provider-specific)
   ├─ daemon emits SSE to browser
   └─ journal: append { type: "<event>", ... }
   ↓
6. provider writes artifact via tool call
   ├─ daemon validates path (assertPathInScope)
   ├─ daemon writes atomically (with backup rolling 10)
   ├─ daemon emits SSE "artifact_written" with turn_id link
   └─ journal: append { type: "artifact_written", path, turn_id }
   ↓
7. provider ends turn (done | error | timeout)
   ↓
8. journal: append { type: "turn_end", status, durationMs, tokens, costUsd }
   ↓
9. latest.json snapshot regenerated (derived view)
```

### 5.2. Invariantes (a lei)

- **Journal é append-only.** Não há "delete event" ou "edit event".
- **Turn começa ANTES do provider rodar.** Suite `chat-journal-gate.test.ts:108`:
  "persist turn BEFORE provider stream". Se daemon crashar entre início e
  `turn_end`, recovery exibe estado inconsistente honestamente (status=interrupted).
- **Todo artifact mutation linka com `turn_id`.** Bidireccional: event
  `artifact_written` carrega `turn_id`, Version `meta.json` guarda `turn_id`.
- **Turn termina com status explícito.** `"done"` | `"error"` | `"timeout"` |
  `"interrupted"`. Sem ambiguidade silenciosa.
- **Snapshot derivado, nunca fonte primária.** `latest.json` (Fase 2) é
  reconstrutível 100% a partir do journal. Apagar não perde dado.
- **Provider switch mid-thread é registrado.** UI renderiza separador inline.

### 5.3. Event types canonical

A lista completa de tipos de evento vive em `docs/chat-journal-contract.md`
(criado em PR pós-canon). Canon mantém só a lei acima. Mudanças em events
não precisam atualizar canon — só o chat-journal-contract.md.

### 5.4. Recovery

- Daemon offline: frontend mantém turns pendentes em IndexedDB local (`pending_turns`).
- Daemon volta: frontend POST `/chat/recover` com lista de pending turns.
- Daemon dedup via `turn_id`. Já gravados ignorados, faltantes appendados.
- Suite gate cobre 4 cenários: reload mid-stream, daemon offline + voltar,
  wrong origin, project switch isolation.

---

## 6. Artifact Contract

### 6.1. Write operations

```
POST /fs/write/artifact
  body: {
    identifier: "projects/{slug}/path/to/file.ext",
    content: "<string>",
    turn_id: "<uuid>" | null
  }
  response: {
    finalPath: "/abs/path/to/file.ext",
    bytes: N,
    registryKey: "...",
    backupId: "..."  // se rolling backup criado
  }
```

### 6.2. Invariantes de escrita

1. **Scoped resolution.** Todo write passa por `resolveScope("ProjectScope", path)`.
   Outros endpoints (skills, design-systems, config) usam seus scopes próprios.
   Bloqueia `..`, symlinks fora do scope, paths absolutos não-prefixados.
2. **Atomic.** Write via `writeFile` em tmp + `rename`. Sem half-write visível.
3. **Lock per finalPath.** Concurrent writes ao mesmo file são serialized.
4. **Backup rolling 10.** Cada write cria `<file>.bak-{ts}` em `.df/backups/`,
   mantém os 10 mais recentes.
5. **Registry sync.** `<slug>.df/registry.json` cacha metadata pra rebuild rápido.
   É derivado e disposable (vide §4.3 "no DB" nuance).
6. **Turn link.** Se `turn_id` provided, gravado em registry + journal.

### 6.3. Validation

- HTML output: opcional `npm run validate` (HTML5 strict, basic a11y).
- Path: rejected se contém `..`, null bytes, ou viola scope resolution.
- Bytes: rejected above the configured artifact size limit.

### 6.4. Versions

```
POST /projects/{slug}/versions
  body: { reason: "string", turn_id: "<uuid>" }
  response: { vid: "v-{ts}-{hash}", path: "/abs/.df/versions/{vid}" }
```

- Versions são snapshots completos do projeto em ponto no tempo.
- Não há diff incremental — full copy.
- Cleanup manual ou via cron-like config.

---

## 7. Provider Contract

### 7.1. Adapter interface (Node)

Cada provider em `apps/daemon/src/providers/<id>.mjs` exporta:

```js
export default {
  id: "claude",
  label: "Claude Code",
  description: "...",
  tier: "stable" | "beta" | "experimental",
  capabilities: {
    stream: true,
    write: true,           // can write files via tool call
    resume: true,          // supports session continuation
    multimodal: false,
    tools: ["Edit", "Write", "Read", "Bash", ...]
  },
  detect: async () => ({ available: boolean, version: string, resolved: string }),
  stream: async (req, res) => {
    // spawn CLI or API, parse output, emit SSE events per Turn Contract §5.2
  },
  once: async (req, res) => {
    // non-streaming variant
  }
};
```

### 7.2. Capabilities canonical

| Capability | Significado |
|---|---|
| `stream` | suporta streaming (SSE) |
| `write` | pode escrever arquivos via tool |
| `resume` | suporta session continuation via session_id |
| `multimodal` | aceita imagem/anexo |
| `tools` | array de tool names suportados |

### 7.3. Tiers

| Tier | Garantia |
|---|---|
| **stable** | Matriz capabilities exercitada ponta-a-ponta, smoke test em CI |
| **beta** | Stream/once validado, algumas capabilities declaradas mas não testadas em escala |
| **experimental** | Adapter compila + emite eventos do contrato, NÃO verificado contra target ao vivo |

**Regra de promoção:** experimental → beta requer smoke test passing. beta → stable
requer integration test + 30 dias sem regression report.

### 7.4. Auth

- **CLI providers (Claude, Codex, Gemini, etc):** auth mora onde a CLI coloca
  (`~/.claude/`, `~/.codex/`, etc). Daemon NÃO toca esses paths — só spawna
  o CLI e propaga `HOME` env.
- **BYOK API providers (Anthropic, OpenRouter, etc):** token em
  `<DF_CONFIG_DIR>/<provider>.json` chmod 600. Env var override
  (`ANTHROPIC_API_KEY`, etc) tem prioridade.
- **`auth_required` event:** quando provider stream falha com auth error,
  daemon emite `auth_required` SSE → frontend redirect user pra Settings ou
  CLI login hint.

### 7.5. Promoção de tier

Promoção experimental → beta → stable é decisão de **release policy**, não de
canon arquitetural. Canon define apenas a estrutura do adapter contract acima.
Política de promoção, freeze de providers e Claude-first discipline vivem em
`docs/releasing.md` ou release notes específicas.

---

## 8. Preview Contract

### 8.1. Lifecycle

```
1. user opens project
   ↓
2. daemon serves <primaryFile> via /projects/{slug}/preview/...
   ↓
3. iframe loads it, runs scripts (sandbox: permissive default)
   ↓
4. daemon detects file change (write from turn)
   ↓
5. daemon emits SSE "artifact_written"
   ↓
6. frontend decides: PATCH or RELOAD
   ├─ if patch-able (text edit, CSS var, etc): DOM patch in place
   └─ else: reload iframe
   ↓
7. preview state preserved across patches (scroll, form, animation)
```

### 8.2. Patch policy

- **Default:** patch in place quando possível. README:107: "Canvas que não pisca".
- **Fallback:** reload iframe quando patch impossível (estrutura DOM mudou
  fundamentalmente, ou novo script tag adicionado).
- **Reload trigger force:** user ação explícita (refresh button) ou file
  externamente modificado (não-tool write).

### 8.3. Sandbox model

```
Default sandbox: permissive
   <iframe sandbox="allow-scripts allow-same-origin">

Why permissive default:
  1. Inline text edit needs same-origin DOM access
  2. Comment mode needs click handler bound to iframe DOM
  3. In-place patch needs DOM mutation API
  4. Animated scene bridge needs postMessage + same-origin

Strict sandbox: opt-in
   ?strictSandbox=1   OR   DF_STRICT_SANDBOX=1
   <iframe sandbox="allow-scripts">

Strict disables:
  - Inline edit
  - Comment mode
  - In-place patch
  - Animated bridge

Document this clearly. Don't promise "secure sandboxed execution" by default.
```

### 8.4. Inspector

- Comment mode: click on element → posicional pinpoint + text annotation.
- Comments persist em `.df/state/comments/{threadId}.json` (vinculado a thread).
- Inspector NÃO acessa cross-origin (mesmo em sandbox permissive — same-origin
  é local file, não rede externa).

---

## 9. Runtime modes

DF suporta 3 modos. Cada modo declara como os contratos acima se materializam.

### 9.1. Dev mode

```
npm run dev:web   →   node scripts/dev-web.mjs
                      ├─ spawn daemon  → :1421
                      ├─ wait /healthz 200
                      └─ spawn vite    → :1420 (HMR)

Browser: localhost:1420 (vite serves) → fetch :1421/* (daemon API)
Config dir: ~/.config/design-factory/   (XDG)
HMR: enabled
Bind: 127.0.0.1
```

**Quando usar:** desenvolvendo o DF, contribuindo open-source.

### 9.2. Start mode (single-user local, built UI)

```
npm run build    →    creates dist/
npm run start    →    daemon serves dist/ + API in one port :1421

Browser: localhost:1421 (everything)
Config dir: ~/.config/design-factory/
HMR: disabled
Bind: 127.0.0.1
```

**Quando usar:** usuário final que clonou o repo e quer usar o produto sem
overhead de Vite HMR.

Nome `start` em vez de `preview` porque `vite preview` no ecossistema Vite
significa outra coisa (preview do build sem daemon). Para evitar colisão
semântica, DF usa `start`.

### 9.3. Supervised mode (production-like, qualquer supervisor externo)

```
external supervisor → spawn `node apps/daemon/src/index.mjs`
                      with DF_SERVE_STATIC=1 + dist/ built

Browser: depends on supervisor exposing port (loopback, tunnel, reverse proxy)
Config dir: configurable via DF_CONFIG_DIR
HMR: disabled
Bind: configurable via DF_BIND_HOST (default 127.0.0.1)
Auto-restart: supervisor's responsibility
```

**Quando usar:** quando uma instância buildada do DF precisa ficar viva via
supervisor externo. Supervisor pode ser:

- PM2 (Node ecosystem)
- systemd (Linux service)
- launchd (macOS service)
- Docker (containerized)
- tmux/screen (manual session keep-alive)
- Windows Service

Canon não prescreve qual supervisor. Cada deployment decide o seu.

**Recipes específicas (não fazem parte do canon):**
- Self-hosted maintainer: systemd unit (a documentar conforme demanda)
- Shared workspace / container: supervisord ou PM2 + tunnel — exemplo interno mantido fora do repo público.

### 9.4. Modo NÃO suportado

- **Multi-user concurrent writes ao mesmo project.** Supervised mode é
  single-active-user mesmo com login compartilhado.
- **Tauri desktop standalone.** Scaffolding existe em código histórico mas
  v0.1 não ships com binary Tauri.
- **Web hospedado em cloud.** O preview público roda como app + daemon
  para uso individual; hospedagem multi-usuário não é parte do core.

---

## 10. Princípios de extensão

Antes de adicionar feature, code, ou rota — perguntar:

1. **Cabe em algum dos 7 nouns?** Se não, talvez não pertença ao DF.
2. **Respeita os 5 contratos?** Project / Turn / Artifact / Provider / Preview.
3. **Move-se entre fronteiras corretas?** Browser ↔ Daemon ↔ Stores ↔ Runtime.
4. **Vai vazar pra outro modo?** Dev / Build / Service devem permanecer separáveis.
5. **Quebra um non-goal?** Se sim, vira ADR explícito antes de mergear.

Se sim a tudo: implementar.
Se não a qualquer: documentar emenda no canon antes de prosseguir.

---

## Apêndice — Mapping para v0.1 atual

| Contrato | Estado v0.1 | Gap |
|---|---|---|
| Project Contract — manifest | flat fallback (Fase 1 sem `project.df.json`) | Fase 2: introduzir manifest opt-in |
| Scoped storage | path-scope absoluto pra projects, ad-hoc pra outros | Refactor: `resolveScope()` único, scopes declarados |
| Turn Contract — journal | `.df/chat/{threadId}.jsonl` flat | Fase 2: journal.ndjson + latest.json + index.json |
| Artifact Contract — atomic write | implementado (`artifact-writer.mjs`) | OK |
| Artifact Contract — versions | implementado (basic) | Cleanup policy pending |
| Provider Contract — adapters | 17 arquivos em `providers/` | OK estrutura, falta capability validation per tier |
| Provider Contract — tiers | declarado em README | falta gate de promoção automatizado (release policy) |
| Preview Contract — patch | implementado (`canvas patches DOM in place`) | OK |
| Preview Contract — sandbox | permissive default + `?strictSandbox=1` | falta UI pill visível |

---

## Apêndice — Supervised mode recipes

Canon define o **contrato** do supervised mode (§9.3). Recipes específicas
(qual supervisor, qual config dir, qual auth pattern) vivem fora do canon —
elas podem evoluir sem emendar o contrato.

Padrões esperados de uma recipe documentada:

1. **Supervisor escolhido** (PM2 / systemd / launchd / Docker / etc) e por quê.
2. **Build artifact** localização e como é mantido fresh.
3. **Config dir** caminho e permissions model.
4. **Bind** interface + porta exposed.
5. **Access pattern** (loopback direct, SSH tunnel, reverse proxy, etc).
6. **Auto-restart policy** (supervisor-native ou manual).
7. **Logs path** e rotation.
8. **Health monitoring** (poll `/healthz` cadence + alert thresholds).

Recipes podem viver em `docs/recipes/<supervisor>.md` ou ser referenced por
deployments externos. Não há recipe canônica única; cada operador escolhe
seu trilho.

---

## Apêndice — Documentos relacionados

- **`docs/architecture.md`** — implementação "como" (Fase 1 atual), separado
  deste canon que descreve "o que".
- **`docs/releasing.md`** — política de versionamento, tier promotion, provider
  freeze windows. Fora do escopo arquitetural.
- **`docs/chat-journal-contract.md`** — lista canônica de event types do Turn
  Contract (§5). A criar.

---

*Architecture Canon v1.0 — 2026-05-10*
*Fronteiras são mais importantes que features.*
