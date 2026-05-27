# Tauri Spike — Findings (throwaway branch `spike/tauri-poc`)

**Date:** 2026-05-25 · **Author:** forge · **Status:** SPIKE (não-merge, descartável)

Objetivo: de-riscar empacotar o Design Factory como app desktop Tauri 2 (ícone,
janela própria, barra de tarefas, sem terminal), usando a CLI de IA que o
usuário já tem. NÃO é produto — é "vale seguir? quais riscos reais?".

---

## Veredicto: GO condicional — viável, com 1 risco que só o desktop real fecha

A peça mais incerta do backend foi **provada**. O risco restante é gráfico
(WebView nativa) e só valida em Windows/macOS reais — por isso a próxima etapa é
um build de CI que gera instaladores pra baixar e clicar.

---

## O que foi PROVADO no container (empírico)

| Item | Resultado |
|---|---|
| `bun --version` | 1.3.11 presente |
| `bun build apps/daemon/src/index.mjs --compile` | ✅ bundle 574 módulos → binário único |
| Tamanho do binário | **107 MB** (aceitável p/ desktop; o instalador comprime) |
| Binário roda standalone (sem Node) | ✅ `[dev-bridge] listening on :1521` |
| `GET /healthz` no binário | ✅ **200** |
| Deps nativas no daemon? | **Não** — só `adm-zip` + `ws` (puro JS). ffmpeg/etc. são binários externos spawnados via `node:child_process`, não addons → não quebram o compile |

**Conclusão:** o daemon vira um **sidecar binário** limpo. Esse era o maior
"será que dá?" do backend, e **dá**.

## O que NÃO dá pra validar aqui (e por quê)

| Item | Por quê | Como validar |
|---|---|---|
| `tauri build` / `cargo check` | Sem Rust/cargo no container; e o build Linux exige `webkit2gtk` (dep de sistema) que **não instalo** num container compartilhado | CI em runner ou máquina dev |
| **Shaders/3D + iframe sandbox renderizam na WebView nativa?** (RISCO #1) | WebView nativa difere por SO (WKWebView mac · WebView2 win · WebKitGTK linux); headless Linux não representa | **Build de CI → baixar instalador → rodar no PC real do founder** |
| Achar a CLI (claude/codex) no PATH | App GUI não herda PATH do shell (sobretudo macOS) | Implementar resolução via login-shell + testar no desktop |

---

## Esqueleto entregue nesta branch (não compilado aqui)

- `src-tauri/tauri.conf.json` — config Tauri 2: janela, `bundle.externalBin`
  (o sidecar do daemon), `productName`/identifier, alvos de instalador.
- `src-tauri/Cargo.toml` + `src-tauri/src/main.rs` — shell Rust mínimo: registra
  `tauri-plugin-single-instance` e sobe o sidecar. **Scaffold representativo —
  precisa de `cargo`/Rust pra compilar de verdade.**
- `scripts/build-daemon-bin.mjs` — o passo de compile do daemon (provado acima),
  pronto pra ser chamado antes do `tauri build`.
- `.github/workflows/tauri-spike.yml` — matriz Windows/macOS que builda os
  instaladores e sobe como artifacts. É o loop pra testar no PC real.

---

## Plano PATH-finding (gotcha real)

Apps GUI não veem o PATH do terminal. O daemon spawna `claude`/`codex` por nome
(`DF_CLAUDE_BIN` etc.). No app Tauri precisa: (1) resolver o PATH real via
login-shell (`$SHELL -lic 'command -v claude'`) no macOS/Linux; (2) no Windows
ler do registro/`where`; (3) fallback: deixar o usuário apontar o caminho na
UI. Sem isso o app abre e diz "não achei a CLI".

---

## Próximos passos (se for GO pro Tauri completo)

1. **Tornar o repo público** → CI grátis (resolve a parede de billing) + runners
   Windows/macOS pra buildar instaladores.
2. Rodar o `tauri-spike.yml` → baixar o instalador → **testar no PC real**:
   (a) os shaders/3D renderizam? (b) o app acha a CLI?
3. Se (a) e (b) passam: virar épico de produto (ícones reais, single-instance
   afinado, first-run, signing Apple $99/ano + cert Windows, auto-update).
4. Se (a) falha: avaliar fallback (ex.: forçar engine específica) ou manter o
   caminho web. **É exatamente isso que o spike existe pra descobrir barato.**

## CI build — checklist @devops + pontos de iteração prováveis

**Checklist @devops (repo público throwaway):**
1. Criar repo PÚBLICO throwaway (ex.: `the-hyve-company/df-tauri-spike`).
2. Push do conteúdo da branch `spike/tauri-poc` como `main` do repo novo.
3. Actions → rodar workflow **`tauri-spike`** (workflow_dispatch).
4. Quando verde: pegar o link do **Release** ("spike-test") com o `.msi`/`.exe` → entregar pro founder.
5. Pós-teste: deletar o repo.

**Pontos que SÓ o CI revela (provável iteração — Tauri é chato de 1ª):**
- **Ícones:** o passo `tauri icon <svg>` assume que o v2 rasteriza SVG. Se rejeitar SVG → fallback: rasterizar pra PNG 1024px antes (ImageMagick/sharp) e passar o PNG.
- **Capabilities/permissions:** as strings exatas de permissão do sidecar no shell-plugin v2 (`shell:allow-execute` + scope `binaries/df-daemon`) são sensíveis à versão — provável ajuste fino.
- **Nome do sidecar:** o `externalBin: binaries/df-daemon` + o `df-daemon-<triple>` gerado pelo script + o `sidecar("df-daemon")` no Rust precisam casar exatamente.
- **beforeBuildCommand:** roda `npm run build` (tsc+vite) + `build-daemon-bin.mjs` (bun) — confirmar que o bun está no PATH do runner (setup-bun cobre).
- Não consigo compilar Rust/Tauri no container → tudo acima é best-effort; o loop verde acontece no CI.

## Custo de seguir
- Signing p/ download liso: Apple ~US$99/ano + cert Windows (ou lançar
  não-assinado com "clique-direito → Abrir").
- Manutenção: builds por SO a cada release.
- Esforço até produto: semanas.

**Descartável:** esta branch é local-only, nunca tocou a main. `git worktree
remove` + `git branch -D spike/tauri-poc` apaga sem rastro.
