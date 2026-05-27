---
title: "Design Factory — V1 Beta Decisions"
date: 2026-05-15
status: ratified
owner: founders
---

# Design Factory — V1 Beta Decisions

> Conjunto de decisões fundadoras que orientam o release v1 beta do
> Design Factory. Cada decisão é canon — alteração exige novo registro
> aqui ou ADR específica.

## 0. Context

V1 beta é o **release open-source** do Design Factory. Não há tier pago,
não há SaaS hospedado, não há monetização vinculada. É um produto
local-first, multi-provider, CLI/headless-first, model-agnostic.

A construção do release v1 beta passou por:

- Auditoria do estado atual (chat, providers, OSS readiness, README, engine)
- Pesquisa de impacto da limitação programática do Claude (Anthropic 2026-06-15+)
- Conversa fundadora sobre posicionamento, tese, escopo e providers primários

Este documento canoniza o que ficou decidido.

---

## 1. Licença

**Decisão:** MIT.

**Por quê:**
- Curta, esperada em ferramentas JS/UI (React, Vue, Next.js, Tailwind,
  shadcn shippam MIT)
- Menos fricção pra contribuidores OSS e forks
- HYVE mantém copyright holder — dual-license comercial fica como opção
  futura sem bloqueio

**Implementação:** commit `c092146` (Apache 2.0 → MIT).

---

## 2. Tese

**Design Factory é um workspace local-first, multi-provider,
CLI/headless-first, model-agnostic pra transformar direção humana em
artefatos HTML editáveis.**

Decorrências da tese:

- **Local-first** — arquivos vivem no disco do usuário, sem sync de
  cloud, sem account system, sem inferência hospedada.
- **Multi-provider** — picker trata cada adapter como cidadão de
  primeira classe. Nenhum provider é "default invisível" do produto.
- **CLI/headless-first** — a experiência primária é spawn de CLIs que o
  usuário escolhe. APIs HTTP são caminho opcional BYOK, não a narrativa
  principal.
- **Model-agnostic** — a engine produz uma representação canônica do
  prompt. Cada adapter traduz pro formato nativo do seu provider.

---

## 3. Providers primários (5 CLIs)

**Decisão:** v1 beta consolida 5 CLI providers como **primary** —
cidadãos de primeira classe no picker, README e docs.

| Provider | Tipo | Auth | Status atual no DF |
|---|---|---|---|
| Claude Code | CLI | `claude login` | implementado (stable) |
| Codex CLI | CLI | `codex login` (OpenAI account) | implementado (beta) |
| Gemini CLI | CLI | `gemini login` (Google account) | implementado (beta) |
| Opencode | CLI | `opencode auth` (provider-agnostic) | implementado, smoke PONG verde |
| Kimi Code CLI | CLI | `kimi /login` (OAuth) ou `KIMI_API_KEY` | implementado, smoke PONG verde |

**Notas:**

- **Não posicionar Claude como centro.** Claude Code é uma das 5
  opções, não o eixo da arquitetura.
- **Não comunicar "13 providers" como promessa.** A linguagem canon é
  **"10 adapters: 5 CLIs + 4 APIs + Ollama local."** Os 4 APIs:
  Anthropic, OpenAI, Gemini API, OpenRouter.
- **APIs BYOK (Anthropic API, OpenAI API, Gemini API, OpenRouter API,
  Ollama local)** ficam como caminhos opcionais — adapters
  registrados, listados em `docs/providers.md`, mas fora da narrativa
  principal da v1.

**Grok Build:** **skipped da v1 beta** — fica pra v2. Motivo: subscription
gated por SuperGrok Heavy ($300/mês), docs oficiais 403 via fetch,
binary name ambíguo entre fontes terceiras. Decisão de v2: validar via
account do founder antes de codificar adapter, ou usar xAI API direta
como provider HTTP.

---

## 4. Direction Engine (NÃO Prompt Engine)

**Decisão:** o conceito antes referido como "Prompt Engine" é renomeado
canonicamente para **Direction Engine**.

**Definição canon:**

> Direction Engine = camada que **compila direção humana, configuração
> do projeto, formato, regras, taste, design system, referências,
> estado do workspace e provider selecionado em uma instrução
> executável por qualquer modelo/CLI.**

**Por quê o rename:**

- "Prompt" é tático e implementacional. Direction é estratégico —
  comunica intenção criativa, não engenharia de texto.
- O agente recebe direção (compilada), não um prompt cru.
- Diferencia o output user-visible (a direção que o user dá) da
  representação interna (o texto que vai pro provider).

**Doc canon:** `docs/direction-engine.md`.

---

## 5. Prompt Console — preview da direction, não terminal

**Decisão:**

- **Prompt Console NÃO vira terminal.**
- **Não implementar Terminal Mode.**
- **Não implementar PTY/WebSocket/terminal embutido agora.**
- O Prompt Console **vive no New Project modal como preview/inspector
  da direction antes de iniciar o projeto.**
- **Dentro do projeto:** apenas um botão **"Prompt"** pra consultar
  o prompt/direction package que originou o projeto.

**Por quê:**

- Terminal embutido quebra a UX que está sendo construída (chat polido +
  preview ao vivo).
- Terminal embutido quebra o controle da Direction Engine — user
  digitaria prompts crus em vez do compilado.
- Browser não tem PTY nativo — exigiria node-pty no daemon + WebSocket
  tunelado, complexidade alta sem ganho proporcional.
- Resposta ao limite programático da Anthropic é outra (vide §7) —
  não terminal mode.

---

## 6. Experiência principal da v1

```
New Project Modal (with Direction preview)
       ↓
Direction Engine compiles
       ↓
Provider/CLI selected → headless execution
       ↓
chat + preview + files
```

A jornada é uma só. Não há "modo avançado", "modo expert", "raw
mode". A complexidade vive na configuração; a execução é uniforme.

---

## 7. Anthropic (Jun 2026) — info técnica, não narrativa

**Decisão:** o anúncio da Anthropic 2026-05-14 (split do pool de tokens
programáticos a partir de 2026-06-15) é **info técnica relevante**, mas
**não é narrativa central da v1 beta**.

**Como tratamos:**

- **README EN + pt-BR:** sem callout dedicado. A Anthropic é uma das 5
  primary, não merece destaque em prejuízo das outras.
- **`docs/providers.md`:** mantém info factual em "Notes — Anthropic
  programmatic limits (June 2026)" como side-note acessível, sem alarme.
- **`docs/decisions/design-factory-v1-beta-decisions.md` (este doc):**
  registra a decisão de não construir narrativa em cima.

**Por quê:**

- DF é provider-agnostic. Construir narrativa em cima de uma decisão
  comercial de um provider é violar a tese.
- O hedge multi-provider já é a resposta arquitetural — basta
  comunicar a arquitetura, não a "ameaça".
- Heavy users podem migrar pra Anthropic API direta (BYOK), Codex,
  Gemini, OpenCode, Kimi, ou local Ollama. Fica registrado em
  `docs/providers.md` sem virar headline.

---

## 8. Auditorias requeridas contra esta decisão

Os seguintes artefatos devem ser auditados e atualizados pra refletir
as decisões acima:

| # | Artefato | Estado |
|---|---|---|
| 1 | `README.md` | tem callout Anthropic + "13 providers" — **diluir e reframe** |
| 2 | `README.pt-BR.md` | mesmo | mesmo |
| 3 | `PUBLIC_RELEASE_MANIFEST.md` | reframed → "10 providers: 5 CLIs + 4 APIs + Ollama"; pre-trim refs cleaned 2026-05-15. |
| 4 | `docs/providers.md` | tem callout Anthropic com destaque — **mover pra Notes neutral** |
| 5 | `src/providers/registry.ts` | trimmed to 10 providers (5 CLIs + 4 APIs + Ollama). Cursor/Copilot/Qwen/DeepSeek removed 2026-05-15. |
| 6 | `src/providers/types.ts` (`ProviderId` union) | falta `"kimi"` — **adicionar** |
| 7 | Provider picker (`AgentPicker`) | aligned with the 10-adapter roster; dropdown shows only `available:true` entries. |
| 8 | New Project modal | falta Prompt Console como preview — **adicionar** |
| 9 | Direction Engine implementation (`canonical-plus-prompt.ts`) | já cobre Format/Rules/Taste — **complementar com Project Context + Skills explícitos no doc** |
| 10 | Chat UX | botão "Prompt" pra consultar direction package — **adicionar** |

Cada item gera task própria. Decision doc é o canon — implementação
segue.

---

## 9. Anti-decisões (o que NÃO fazer)

- ❌ Não construir narrativa em cima do limite Anthropic Jun 2026.
- ❌ Não posicionar Claude como centro do produto.
- ❌ Não implementar Terminal Mode / PTY / WebSocket terminal embutido.
- ❌ Não comunicar "13 providers" como promessa central da v1.
- ❌ Não vender DF como "frontend pra Claude Code".
- ❌ Não esconder o multi-provider — é o coração da tese.
- ❌ Não bloquear v1 beta esperando Grok Build estabilizar.

---

## 10. Cross-refs

- `docs/architecture-canon.md` — contratos canônicos do DF
- `docs/direction-engine.md` — engine canon (este renamed de
  prompt-engine.md)
- `docs/providers.md` — capability matrix + auth + Notes Anthropic
- `PUBLIC_RELEASE_MANIFEST.md` — include/exclude do release público
- `README.md` / `README.pt-BR.md` — narrativa primária

---

*V1 Beta Decisions v1.0 — 2026-05-15*
*Local-first, multi-provider, CLI/headless-first, model-agnostic.*
