---
title: "Design Factory — Direction Engine"
version: 1.1
status: draft
updated: 2026-05-15
---

> Documento que canoniza **como** o Design Factory transforma direção
> humana e configuração do projeto em uma instrução executável por
> qualquer modelo/CLI. Suplemento ao `architecture-canon.md` — amplia o
> noun **Direction** (§1 do canon) pra incluir tudo que orienta o agent
> além do design system.

# Design Factory — Direction Engine

**Definição canon:** Direction Engine = camada que **compila direção
humana, configuração do projeto, formato, regras, taste, design system,
referências, estado do workspace e provider selecionado em uma
instrução executável por qualquer modelo/CLI.**

**Princípio guia:** uma direction compilada, vários adapters de provider.
Cada adapter traduz a estrutura canônica pro formato nativo do seu CLI
ou API.

## 0. Purpose

Este doc declara **o que entra na instrução compilada** que o DF envia
ao provider e **como o usuário customiza cada peça**. Não substitui o
canon arquitetural — amplia o noun "Direction" pra incluir tudo que
orienta o agent além do design system.

> Nota de nomenclatura: o conceito antes referido como "Prompt Engine"
> foi renomeado canonicamente pra **Direction Engine** em 2026-05-15.
> "Prompt" é tático e implementacional — Direction é estratégico,
> comunica intenção criativa, não engenharia de texto.

**Quando consultar:**
- antes de adicionar um novo bloco à direction
- antes de criar uma nova superfície de configuração (Settings, modal, etc)
- antes de mudar a ordem de composição da direction
- antes de propor um override pro usuário customizar algo embutido

**Quando atualizar:**
- novo bloco entrou na composição
- nova camada de configuração foi adicionada (ex: per-thread overrides)
- novo provider adapter foi promovido e mudou tradução

**Não é:**
- API reference da engine — vide `src/runtime/turn-pipeline.ts`
- guia de implementação de provider — vide `docs/providers.md`
- planejamento de features

---

## 1. Princípios

### 1.1. Provider-agnostic unified direction

A engine produz UMA representação canônica da direction em texto
markdown. Cada `src/providers/{id}.ts` é responsável por traduzir essa
representação pro formato esperado pela API/CLI subjacente:

- Claude Code / Codex / Gemini CLI / Opencode / Kimi → stdin do CLI ou positional arg
- Anthropic API / OpenAI / Gemini API / OpenRouter → `messages[].system`
- Ollama → `/api/generate` system field

**A engine NUNCA conhece o provider.** Adapter normaliza.

### 1.2. Composable blocks, opt-in

Cada bloco é independente. Desligar = não vai pro prompt. Não há bloco
"obrigatório" exceto **Core Instructions** (§3.1) — sem ele o agent não sabe
o que produzir.

### 1.3. User extends, doesn't replace

Toda taxonomia (Format, Rules, Taste) tem builtin como fallback. User
adiciona em cima via Settings — não substitui o builtin a menos que escolha
override explícito.

### 1.4. Persistência local

Toda configuração persiste em arquivos no disco do usuário:

| Tipo | Onde |
|---|---|
| Settings globais (theme, default provider, etc) | `~/.config/design-factory/{key}.json` |
| Custom taxonomies (rules, formats, taste profiles) | `~/.config/design-factory/taxonomy/` (planejado) ou `db.setSetting` (v0.1) |
| Project config | `projects/{slug}/project.df.json` |
| Skills | `skills/{slug}/` |
| Design systems | `design-systems/{slug}/` |

### 1.5. Stateless daemon

Daemon lê dos arquivos a cada turno. Sem cache em memória. Editar uma
config = próximo turno reflete.

### 1.6. Discoverable + previewable

UI deve permitir o usuário ver **exatamente o que vai pro prompt** antes de
enviar. Hoje isso é gap (§9.2) — meta é botão "Preview prompt" no chat
input.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  CONFIG SOURCES                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Global Settings           Custom Taxonomies             │
│  (~/.config/df/)           (db.settings · v0.1)          │
│    ↓                          ↓                          │
│    │       merged via         │                          │
│    │       cascade            │                          │
│    └───────────┬───────────────┘                         │
│                ↓                                         │
│           ┌─────────────┐                                │
│           │  Effective  │                                │
│           │  Catalog    │ ← project picks resolve here   │
│           └─────────────┘                                │
│                ↑                                         │
│         Project Config                                   │
│         (project.df.json + canonical+ picks)             │
│                ↑                                         │
│         Per-Turn Overrides                               │
│         (provider swap, attachments, inline edits)       │
│                                                          │
└─────────────────────────────────────────────────────────┘
                ↓
       ╔════════════════════════════════╗
       ║  PROMPT ENGINE                 ║
       ║  src/runtime/turn-pipeline.ts  ║
       ║  composeUserPrompt() pipeline  ║
       ╚════════════════════════════════╝
                ↓
        Unified System Prompt (markdown)
                ↓
      ┌─────────────────────────────────┐
      │  Provider Adapter                │
      │  src/providers/{id}.ts           │
      │  + apps/daemon/src/providers/    │
      └─────────────────────────────────┘
                ↓
            Provider API/CLI
                ↓
            Stream events → Turn Contract (§5 canon)
```

---

## 3. Blocos da Direction

A composição final é a concatenação ordenada destes blocos. Ordem importa:
core instructions primeiro pro provider entender o role, depois contexto,
depois calibração, depois output contract, depois user message.

### 3.1. Core Instructions (`generate`)

**O que é:** o system prompt base que diz ao agent o que ele é (DF agent),
o que produzir (HTML standalone), em que linguagem (a do user), com que
disciplina (surgical edits, 1-3 linhas de chat).

**Fonte:** `src/runtime/builtin-prompts.ts` cascade →
`db.getSetting("builtin_prompt:generate")` ou hardcoded fallback em
`prompt-invoker.ts`.

**Sub-keys editáveis em Settings → Built-in prompts:**
- `generate` — primeira geração do projeto
- `refine` — turnos subsequentes (follow-up edits)
- `tweaks` — geração do panel de CSS variables (`/tweaks`)

**Customização user:** Settings → Advanced → Built-in prompts. Edita, salva,
próximo turno usa o override.

### 3.2. Project Context

**O que é:** orientação operacional pro agent — onde escrever, qual arquivo
mexer, qual é a thread atual.

**Fonte:** injetado pela pipeline em `composeUserPrompt`. Contém:
- `PROJECT_PATH` — absolute path do project root
- `PRIMARY_FILE` — caminho do arquivo principal (do `project.df.json`)
- Resumo da thread (últimos N turnos, se relevante)
- Estado do arquivo atual (se continuando edição)

**Customização user:** indireto via `project.df.json` (manifest do projeto)
e via histórico de chat (limpo, exportado, retomado).

### 3.3. Direction — Design System

**O que é:** o design system canônico que orienta tokens, componentes,
padrões visuais.

**Fonte:**
- `projects/{slug}/project.df.json` campo `direction.designSystem` → slug
- Arquivo lido de `design-systems/{slug}/DESIGN.md` (formato Google
  `design.md`)

**Customização user:**
- Tab DS — upload, GitHub URL, ou gerar a partir de uma folder
- Override per-project via NewProject modal

**Opt-in:** projeto sem `direction.designSystem` não recebe esse bloco.

### 3.4. Direction — Brief

**O que é:** contexto criativo da intenção do projeto — quem é o público, o
que comunica, qual o tom.

**Fonte:** `project.df.json` campo `direction.brief` (string ou referência a
arquivo).

**Customização user:** NewProject modal aceita brief inicial, editor permite
revisar a qualquer momento.

**Opt-in:** projeto sem brief não recebe esse bloco.

### 3.5. Project Setup (canonical-plus)

**O que é:** três sub-blocos derivados das picks do usuário no NewProject:
**Format**, **Constraints** (rules), **Taste calibration** (6 dials).

**Fonte:** `src/runtime/canonical-plus-prompt.ts` → `buildCanonicalPlusBlock()`.

#### 3.5.1. Format

**Esquema de seleção:** `{ categoryId: string, itemId: string } | null`

**Catálogo:** `src/data/format-taxonomy.ts`
- Categorias: Video, Interface, Document, etc
- Items: cada um com `label`, `descriptor`, `prompt` (editável)

**Customização user:**
- Settings → Formats → editar prompt de qualquer item builtin (cascade
  override)
- Adicionar items custom (planejado)

**Output bloco:** `### Format · {label}\n{prompt}`

#### 3.5.2. Rules

**Esquema de seleção:** `string[]` — array de rule IDs

**Catálogo:** `src/data/rules-taxonomy.ts`
- Flat list (não nested) — categories computed at runtime do campo
  `category` em cada rule
- ~30 builtin rules em v0.1

**Customização user:**
- Settings → Padrões — adicionar rules custom (id + title + category +
  description)
- Builtins não deletáveis, editáveis

**Output bloco:** `### Constraints\n- **{title}** — {description}` por
rule selecionada.

#### 3.5.3. Taste Calibration

**Esquema de seleção:** `Partial<{ density, motion, contrast, interactions,
surface, originality: number }>` — 6 dials, valores 0..100

**Catálogo:** `DEFAULT_DIAL_LANGUAGE` em `canonical-plus-prompt.ts` —
estrings low/high pra cada dial.

**Filtragem:** apenas dials fora da zona neutra (≤30 ou ≥70) entram no
prompt. 30-70 = "sem opinião forte".

**Customização user:**
- Settings → Taste — overrides low/high text por dial
  (`db.setting("tasteDial:{key}:low" | ":high")`)
- (planejado) Saved profiles — salvar conjuntos de dials reutilizáveis

**Output bloco:** `### Taste calibration\n- {phrase}` por dial fora da
neutral zone.

### 3.6. Skills

**O que é:** patterns aprovados, anti-patterns, refs visuais expandidos
inline no prompt.

**Fonte:** `skills/{slug}/` registry. Cada skill tem body em markdown que
expande no prompt **antes** do provider receber — provider-agnostic.

**Customização user:**
- Settings → Skills — folder input pra registrar skills externos
- Skills custom em `skills/{slug}/` (workspace) ou path apontado

**Opt-in por projeto:** quais skills ativam por projeto (planejado — hoje
todos ativos por padrão).

### 3.7. Output Contract

**O que é:** o contrato de como o agent deve materializar o arquivo.

**Fonte:** `src/runtime/output-contract.ts` → `buildArtifactContractBlock()`.

**Bifurca por provider capability:**

| `fileWrite` capability | Tipo de provider | Bloco emitido |
|---|---|---|
| `"tool"` | Claude Code, Codex, Opencode, Kimi | **vazio** — provider usa tool calls Write/Edit nativos |
| `"artifact"` | Gemini CLI, Anthropic API, OpenAI API, Gemini API, OpenRouter API, Ollama | bloco "OUTPUT CONTRACT — NON-NEGOTIABLE" pinando o agent a emitir `<artifact identifier="..." type="..." title="...">...</artifact>` no fim do turno |

**Customização user:** nenhuma direta. É determinado pela capability
declarada do provider (`src/providers/types.ts`).

### 3.8. User Message

**O que é:** o que o usuário digitou no chat input pra este turno.

**Fonte:** chat input do EditorScreen + attachments.

**Customização user:** óbvio — é o texto. Attachments podem incluir imagens
(se provider suporta multimodal) ou file references.

---

## 4. Camadas de Configuração

Mapa de TUDO que o usuário pode customizar. Organizado pela frequência
de mudança.

### 4.1. Camada 1 — Settings globais (raros, persistidos forever)

Vivem em `~/.config/design-factory/` (arquivos JSON) ou `db.setting()`
(SQLite local).

| Setting | O que controla | Onde editar |
|---|---|---|
| Default provider | Qual provider abre por padrão em novos projetos | Settings → Providers |
| Default model | Qual model dentro do provider | Settings → Providers |
| Auth method | CLI cached vs BYOK API key | Settings → Providers (per-provider) |
| BYOK tokens | API keys pra providers que usam HTTP | Settings → Providers → "Add key" |
| UI language | pt-BR, EN, … | Settings → Appearance |
| Theme | light / dark | Settings → Appearance |
| Theme tokens | Override de qualquer token CSS do DF | Settings → Appearance → Tokens |
| Stream timeout | Quanto esperar antes de abortar turn | Settings → Advanced |
| Strict sandbox | Iframe sandbox mode | Settings → Advanced (URL param ou flag) |

### 4.2. Camada 2 — Custom Taxonomies (extensões, vivem entre projetos)

Persistem em `db.setting` (v0.1) — vão pra `~/.config/df/taxonomy/`
(planejado) quando o catálogo virar arquivo.

| Customização | O que estende | Onde editar |
|---|---|---|
| Custom Formats | Adiciona items além dos builtins | Settings → Formats (#136) |
| Custom Rules | Adiciona rules além dos builtins | Settings → Padrões |
| Taste dial overrides | Substitui low/high strings dos dials | Settings → Taste |
| Saved taste profiles | Conjuntos de dials reutilizáveis | (planejado) |
| Built-in prompt overrides | Substitui `generate`/`refine`/`tweaks` | Settings → Built-in prompts |
| Custom skills | Patterns/refs próprios | Settings → Skills |
| Custom design systems | DS importado ou criado pelo usuário | Tab DS |

### 4.3. Camada 3 — Project Config (antes de iniciar projeto)

Persistem em `projects/{slug}/project.df.json` + scoped state.

| Config | Esquema | Onde editar |
|---|---|---|
| Project name + slug | `id`, `name` | NewProject modal |
| Primary file | `primaryFile` | NewProject modal (auto-fill) |
| Format pick | `direction.format` (canonicalPlus) | NewProject modal |
| Rules pick | `direction.rules` (canonicalPlus) | NewProject modal |
| Taste pick | `direction.taste` (canonicalPlus) | NewProject modal |
| Design system | `direction.designSystem` | NewProject modal |
| Brief | `direction.brief` | NewProject modal |
| Canvas preset | `canvasPreset` | NewProject modal |
| Provider override | `direction.provider` | NewProject modal (opcional) |

### 4.4. Camada 4 — Per-Turn (durante o chat)

Não persistem como config — viram parte do journal do turn.

| Override | Como | Persistência |
|---|---|---|
| Provider/model swap | ModelRocker (#140) | gravado no event do turn |
| Attachments | Upload no chat input | gravado no event |
| Inline edit | Click + edit em elemento (#130) | vira artifact mutation |
| Tweaks panel | `/tweaks` + sliders | gera CSS var injection |
| System prompt append | planejado, per-turn additional context | pending |

---

## 5. Resolução: Picks → Blocos

A pipeline resolve picks contra catálogos no momento de compor o prompt.
Hoje em `composeUserPrompt` (`turn-pipeline.ts`).

```
1. Carrega project.df.json (NewProject picks)
2. Resolve catálogos efetivos (builtin + user overrides):
   - getEffectiveFormatTaxonomy()
   - getEffectiveRules()
   - getBuiltinPrompt("generate", fallback)
3. Constrói blocos na ordem:
   ├─ Core Instructions (3.1)        ← getBuiltinPrompt
   ├─ Project Context (3.2)          ← project.df.json + thread summary
   ├─ Direction · Design System (3.3) ← project.df.json.direction.designSystem
   ├─ Direction · Brief (3.4)        ← project.df.json.direction.brief
   ├─ Project Setup (3.5)            ← buildCanonicalPlusBlock(picks)
   ├─ Skills (3.6)                   ← skills/ registry
   ├─ Output Contract (3.7)          ← buildArtifactContractBlock(provider)
   └─ User Message (3.8)             ← chat input
4. Concatena com newline duplo entre blocos
5. Entrega ao provider adapter
```

Blocos vazios são omitidos. Ordem é canônica — adapter não reordena.

---

## 6. Provider Adapter Contract (resumo)

Detalhes completos em `docs/providers.md` e §7 do canon. Aqui só o
relevante pra engine:

### 6.1. Adapter traduz o prompt unificado

- **CLI providers (Claude Code, Codex, Gemini CLI, opencode, Cursor,
  Copilot):** prompt unificado vai como stdin do CLI ou arg do flag. Tool
  calls (Write/Edit) são nativos.
- **API providers (Anthropic, OpenAI, Gemini API, OpenRouter, Qwen,
  ):** prompt unificado vai como `system` no array `messages`. User
  message vai como `user`. Artifact wrap é via `<artifact>` block.
- **Local server (Ollama):** prompt vai como `system` em `/api/generate`.

### 6.2. Capability declara como provider materializa

```ts
// src/providers/types.ts
fileWrite: "tool" | "artifact"
```

- `"tool"` → engine NÃO emite output-contract block. Provider usa tool
  calls nativos.
- `"artifact"` → engine emite output-contract block. Runtime parser extrai
  e escreve via `/fs/write/artifact`.

### 6.3. Spool grande pra evitar `E2BIG`

PR #127 instalou spool: prompt > 100KB vai pra arquivo temp + reference no
spawn, em vez de passar como arg/stdin gigante. Aplicado a CLI providers
quando o prompt exceede platform limits.

---

## 7. Multi-modelo dentro do mesmo provider

Cada provider expõe seu catálogo de models em `src/providers/model-lists.ts`:

- **Static catalogs:** Claude (opus/sonnet/haiku), Codex (gpt-5/4.1/o3),
  Gemini CLI (2.5-pro/2.5-flash/1.5-pro/1.5-flash), Anthropic API
  (opus-4.7/sonnet-4.6/haiku-4.5)
- **Live probes:** Ollama (pulled models), OpenRouter (200+ catalog)

User pick persistido em `localStorage` por provider
(`df:last-model:{provider}`). Próximo turno reusa.

Engine não sabe qual model — adapter passa pro provider.

---

## 8. Princípios de extensão

Antes de adicionar bloco ou nova customização, perguntar:

1. **É opt-in?** Bloco que SEMPRE entra = obrigatório. Hoje só Core
   Instructions é obrigatório.
2. **Tem fallback builtin?** Custom taxonomy precisa estender, não
   substituir, builtin.
3. **Persiste localmente?** Não envia config pra servidor remoto.
4. **Override discoverable?** Setting precisa estar em Settings UI, não só
   em db.setting raw.
5. **Reverte limpo?** Resetar override = volta pro builtin sem perda.
6. **Funciona com todos os 13 providers?** Bloco que só faz sentido em 1
   provider não pertence à engine — pertence ao adapter.

Se sim a tudo: implementar. Se não: documentar emenda neste doc + canon
antes.

---

## 9. Apêndice — Mapping v0.1 atual

| Componente | Estado v0.1 | Gap |
|---|---|---|
| §3.1 Core Instructions (`generate`) | implementado, editável via Settings | nenhum |
| §3.1 Core Instructions (`refine`, `tweaks`) | implementado, editável | nenhum |
| §3.2 Project Context | implementado, hardcoded structure | Falta thread summarization adaptive |
| §3.3 Design System | implementado (DS markdown) | nenhum |
| §3.4 Brief | esquema existe (`project.df.json`) | UI no NewProject incompleta |
| §3.5.1 Format | implementado completo | Custom items pendentes |
| §3.5.2 Rules | implementado completo | nenhum |
| §3.5.3 Taste | implementado completo | Saved profiles pendentes |
| §3.6 Skills | registry existe, expansion inline | Per-project activation pendente |
| §3.7 Output Contract | implementado, bifurca tool/artifact | nenhum |
| §3.8 User Message | implementado | nenhum |
| §4.4 Per-turn provider swap | implementado (ModelRocker #140) | nenhum |
| §4.4 Attachments | parcial | Multimodal flag por provider |
| §6.3 Prompt spool | implementado (#127) | nenhum |

### 9.1. Gaps conhecidos

1. **Preview do prompt completo:** botão "Preview prompt" no chat input
   antes de Send — não existe. Usuário não vê o que vai pro provider.
2. **Custom Format items:** Settings → Formats permite editar item builtin,
   não adicionar item novo.
3. **Saved Taste profiles:** dial config não salva — user re-calibra a
   cada projeto.
4. **Per-project skill activation:** todas skills ativam por padrão.
   NewProject não tem toggle "quais skills neste projeto".
5. **Thread summarization adaptive:** thread longo cresce o Project
   Context indefinidamente — falta resumir histórico além de N turns.

### 9.2. Decisão pendente — block emit em provider de baixa capacidade

Alguns providers experimentais (Opencode, Kimi) podem não
honrar OUTPUT-CONTRACT corretamente. Política atual: emitir mesmo assim,
gate visual no provider tier. Política alternativa proposta: gate por
capability `respectsOutputContract: true | false`. Decidir antes de
promover qualquer experimental → beta.

---

## Apêndice — Documentos relacionados

- **`architecture-canon.md`** — contratos canônicos. Direction noun (§1)
  cobre design system + brief mas não os blocos de Format/Rules/Taste —
  este doc estende.
- **`providers.md`** — capability matrix por provider + auth + file-write
  channel.
- **`agent-contract.md`** — contrato universal pro agent (output rules,
  surgical edits, language contract). Diferente da engine — o agent
  contract é sobre comportamento do agent dentro do turn; a engine é
  sobre o prompt que descreve o role.
- **`releasing.md`** — tier promotion policy.

---

## Apêndice — Prompt Console (preview da direction)

O **Prompt Console** é a superfície de UI que mostra ao usuário a
direction compilada antes de iniciar um projeto.

**Decisão canon (2026-05-15):**

- **NÃO é terminal embutido.** Sem PTY, sem WebSocket terminal, sem
  shell exec na UI do DF.
- **Vive no New Project modal** como preview/inspector da direction
  compilada — user vê EXATAMENTE o que vai pro provider antes de
  clicar "Iniciar projeto".
- **Dentro do projeto**, fica reduzido a **um botão "Prompt"** que
  reabre o Prompt Console pra consultar a direction package que
  originou o projeto.

**Por quê não terminal:** quebraria o controle da engine (user
digitaria prompts crus em vez do compilado), quebra a UX polida do
chat, e não esquiva limites de billing programático de provider —
billing detecta pelo padrão de uso, não pela UI.

**Discoverability:** é a resposta canônica ao princípio §1.6
(Discoverable + previewable). User não precisa adivinhar o que vai
pro provider — vê antes de mandar.

---

*Direction Engine v1.1 — 2026-05-15*
*Uma direction compilada, vários adapters. User customiza tudo. Builtins são fallback, nunca jaula.*
