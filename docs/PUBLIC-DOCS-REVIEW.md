# Public docs review register

This private register marks which documentation files ship in the
public cut and which stay private. It is not copied to the public repo.

Status meanings:

- **approved** — reviewed for public tone, current behavior, no private
  planning residue, no direct contact email, no unapproved HYVE claims.
- **private** — intentionally excluded from the public cut.
- **legal/standard** — public repo standard file. Keep factual and
  channel-based, no personal contact details.

## Ships Public

| Path | Status | Notes |
| --- | --- | --- |
| `README.md` | approved | Product overview, setup, providers, architecture, contribution links. No security/roadmap section. |
| `README.en.md` | approved | English mirror of README. |
| `AGENTS.md` | approved | Universal agent contract entry point. |
| `GEMINI.md` | approved | Gemini CLI adapter for the agent contract. |
| `docs/README.md` | approved | Docs hub and future GitHub Pages entry point. |
| `docs/index.md` | approved | GitHub Pages-friendly docs entry point. |
| `docs/quickstart.md` | approved | Install, provider setup, first project. |
| `docs/providers.md` | approved | Provider matrix and setup. |
| `docs/troubleshooting.md` | approved | Runtime/provider troubleshooting. |
| `docs/agent-contract.md` | approved | Required by `AGENTS.md` and `GEMINI.md`; not part of product docs navigation. |
| `docs/i18n-baseline.txt` | approved | Baseline for repo audit tooling. |
| `docs/readme/assets/**` | approved | README/docs image assets. |
| `CONTRIBUTING.md` | legal/standard | Contributor guide. |
| `CODE_OF_CONDUCT.md` | legal/standard | No direct email contact. |
| `SECURITY.md` | legal/standard | GitHub Security Advisories only. |
| `GOVERNANCE.md` | legal/standard | Governance and trademark boundary. |
| `CHANGELOG.md` | approved | Public preview changelog only. |
| `LICENSE` | legal/standard | Apache-2.0. |
| `NOTICE` | legal/standard | Trademark boundary. |

## Stays Private

| Path | Status | Reason |
| --- | --- | --- |
| `docs/OPEN-SOURCE-CHECKLIST.md` | private | Launch plan and internal state tracking. |
| `docs/PUBLIC-CUT-MANIFEST.md` | private | Copy spec for the private repo. |
| `docs/PUBLIC-DOCS-REVIEW.md` | private | This register. |
| `docs/decisions/**` | private | Internal decision records and historical rationale. |
| `docs/architecture.md` | private | Held back until the public architecture surface is intentionally edited. |
| `docs/architecture-canon.md` | private | Internal technical canon for now. |
| `docs/direction-engine.md` | private | Internal system model for now. |
| `docs/migration-skills.md` | private | Internal migration detail for now. |
| `docs/FEATURE-COVERAGE.md` | private | Internal coverage/status matrix for now. |
| `docs/SMOKE-RUNBOOK.md` | private | Internal verification runbook for now. |
| `docs/project-files.md` | private | Held back from launch docs to keep public surface small. |
| `docs/design-systems.md` | private | Held back from launch docs to keep public surface small. |
| `docs/skills.md` | private | Held back from launch docs to keep public surface small. |
| `ROADMAP.md` | private | Planning promises should not ship until explicitly approved. |
| `PUBLIC_RELEASE_MANIFEST.md` | private | Superseded staging-era manifest. |

## Public Editorial Gate

Before cutting the public repo, run:

```bash
node _internal/scripts/public-cut-dry-run.mjs
node _internal/scripts/public-docs-audit.mjs <public-cut-dir>
```

The audit fails on public documentation containing:

- private cut/checklist/decision references;
- `founder` wording;
- direct email addresses or `mailto:`;
- `TODO`, `TBD`, `placeholder`, or `BANNER SLOT`;
- `roadmap` promises;
- `/workspace` paths;
- unapproved public docs not listed above.
