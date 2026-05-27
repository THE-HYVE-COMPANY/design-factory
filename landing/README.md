# Design Factory — Landing

Landing estática servida em **factory.hyve.company/design**.

## Estrutura

- `index.html` — landing completa (single-page, ~175kb)
- `favicon.svg`
- `vercel.json` — redirects `/` → `/design` + rewrites `/design` → `/index.html`

## Deploy

Vercel project independente apontando pra esta pasta (`landing/`).
Cada push em `main` que toca `landing/**` faz deploy automático.

Deploys são **rápidos (~15s)** porque o projeto não tem build step — apenas upload estático.

Mudanças no app Design Factory (resto do repo) NÃO disparam deploy desta landing.

## Rotas

| URL | Comportamento |
|---|---|
| `/` | 301 → `/design` |
| `/design` | serve `index.html` |
| `/favicon.svg` | direto |
| outros | 404 |
