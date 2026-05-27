#!/bin/bash
# Audit completo — roda em sequência:
#   1. Regression (typecheck + build + vitest)
#   2. Provider matrix (6 × 3 = 18 turns)
#   3. UI smoke headless (playwright)
#   4. Consolida tudo em AUDIT.md
#
# Tempo esperado: 25-40min total. Saída em $AUDIT_DIR/AUDIT.md.
# Falhas em uma etapa NÃO param as outras — o report mostra tudo honesto.
# Cada etapa loga em arquivo dedicado pra debug post-mortem.

set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TS=$(date +%Y%m%d-%H%M%S)
AUDIT_DIR="${AUDIT_DIR:-/tmp/df-audit-$TS}"
mkdir -p "$AUDIT_DIR/screenshots"
export AUDIT_DIR

REPORT="$AUDIT_DIR/AUDIT.md"

echo "# DF Audit Completo — $(date -Iseconds)" > "$REPORT"
echo "" >> "$REPORT"
echo "Output dir: \`$AUDIT_DIR\`" >> "$REPORT"
echo "" >> "$REPORT"

cd "$ROOT"

# ── 1. Regression ──────────────────────────────────────────────────
echo "## 1. Regression (typecheck + build + tests)" >> "$REPORT"
echo "" >> "$REPORT"

REG_START=$(date +%s)

echo "  → typecheck..." >&2
timeout 120 npx tsc --noEmit > "$AUDIT_DIR/01-typecheck.log" 2>&1
TSC_EXIT=$?
[ $TSC_EXIT -eq 0 ] && TSC_STATUS="✓" || TSC_STATUS="✗"

echo "  → build..." >&2
timeout 180 npm run build > "$AUDIT_DIR/02-build.log" 2>&1
BUILD_EXIT=$?
[ $BUILD_EXIT -eq 0 ] && BUILD_STATUS="✓" || BUILD_STATUS="✗"

echo "  → vitest..." >&2
timeout 300 npm test > "$AUDIT_DIR/03-vitest.log" 2>&1
TEST_EXIT=$?
TEST_PASS=$(grep -oE "Tests\s+[0-9]+ passed" "$AUDIT_DIR/03-vitest.log" | grep -oE "[0-9]+" | head -1)
TEST_FAIL=$(grep -oE "Tests\s+[0-9]+ failed" "$AUDIT_DIR/03-vitest.log" | grep -oE "[0-9]+" | head -1)
TEST_PASS=${TEST_PASS:-0}
TEST_FAIL=${TEST_FAIL:-0}
[ $TEST_EXIT -eq 0 ] && TEST_STATUS="✓" || TEST_STATUS="✗"

REG_END=$(date +%s)
REG_ELAPSED=$((REG_END - REG_START))

{
  echo "| Check | Status | Detail |"
  echo "|---|---|---|"
  echo "| Typecheck (\`tsc --noEmit\`) | $TSC_STATUS | exit=$TSC_EXIT · log: \`01-typecheck.log\` |"
  echo "| Build (\`npm run build\`) | $BUILD_STATUS | exit=$BUILD_EXIT · log: \`02-build.log\` |"
  echo "| Tests (\`vitest run\`) | $TEST_STATUS | ${TEST_PASS} passed / ${TEST_FAIL} failed · log: \`03-vitest.log\` |"
  echo ""
  echo "Total regression: ${REG_ELAPSED}s"
  echo ""
} >> "$REPORT"

# Append first 40 lines of any failing log for fast triage.
for tag in "01-typecheck:Typecheck" "02-build:Build" "03-vitest:Tests"; do
  file=$(echo $tag | cut -d: -f1)
  label=$(echo $tag | cut -d: -f2)
  case "$file" in
    01-typecheck) exit_var=$TSC_EXIT;;
    02-build)     exit_var=$BUILD_EXIT;;
    03-vitest)    exit_var=$TEST_EXIT;;
  esac
  if [ "$exit_var" -ne 0 ]; then
    {
      echo "<details><summary>${label} failure — first 40 lines</summary>"
      echo ""
      echo '```'
      head -40 "$AUDIT_DIR/${file}.log"
      echo '```'
      echo "</details>"
      echo ""
    } >> "$REPORT"
  fi
done

# ── 2. Provider matrix ─────────────────────────────────────────────
echo "" >> "$REPORT"
echo "## 2. Provider matrix (6 × 3 cenários)" >> "$REPORT"
echo "" >> "$REPORT"

MX_START=$(date +%s)
echo "  → matrix runner..." >&2
SCENARIOS="S1-hello S2-gooey S3-edit" \
  PROVIDERS="claude codex kimi gemini opencode openrouter" \
  TIMEOUT_SECS=180 \
  OUTDIR="$AUDIT_DIR/matrix" \
  bash "$ROOT/scripts/provider-matrix/run.sh" > "$AUDIT_DIR/04-matrix.log" 2>&1
MX_END=$(date +%s)
MX_ELAPSED=$((MX_END - MX_START))

if [ -f "$AUDIT_DIR/matrix/report.md" ]; then
  # Append matrix report inline.
  echo "" >> "$REPORT"
  tail -n +2 "$AUDIT_DIR/matrix/report.md" >> "$REPORT"
  echo "" >> "$REPORT"
  echo "Total matrix: ${MX_ELAPSED}s · log: \`04-matrix.log\`" >> "$REPORT"
else
  echo "**MATRIX FAILED** — see \`04-matrix.log\`" >> "$REPORT"
fi

# ── 3. UI smoke ────────────────────────────────────────────────────
echo "" >> "$REPORT"
echo "## 3. UI smoke (playwright headless)" >> "$REPORT"
echo "" >> "$REPORT"

UI_START=$(date +%s)

# Make sure vite is up. The audit assumes the user left vite running.
VITE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1420/ --max-time 5)
if [ "$VITE_HEALTH" != "200" ]; then
  echo "  → vite not responding ($VITE_HEALTH), trying to start..." >&2
  (cd "$ROOT" && nohup npx vite --port 1420 > /tmp/df-vite-audit.log 2>&1 &) || true
  sleep 8
fi

echo "  → playwright smoke..." >&2
DF_APP_URL="http://localhost:1420" node "$ROOT/scripts/audit-full/ui-smoke.mjs" > "$AUDIT_DIR/05-ui-smoke.log" 2>&1
UI_EXIT=$?
UI_END=$(date +%s)
UI_ELAPSED=$((UI_END - UI_START))

if [ -f "$AUDIT_DIR/ui-smoke.json" ]; then
  PASSED=$(python3 -c "import json; d=json.load(open('$AUDIT_DIR/ui-smoke.json')); print(d['passed'])" 2>/dev/null || echo "?")
  TOTAL=$(python3 -c "import json; d=json.load(open('$AUDIT_DIR/ui-smoke.json')); print(d['total'])" 2>/dev/null || echo "?")
  {
    echo "**Result:** $PASSED / $TOTAL passed · ${UI_ELAPSED}s"
    echo ""
    echo "| Check | Status | Detail |"
    echo "|---|---|---|"
    python3 -c "
import json
d = json.load(open('$AUDIT_DIR/ui-smoke.json'))
for c in d['checks']:
    print(f\"| {c['name']} | {'✓' if c['ok'] else '✗'} | {c.get('detail', '')[:100]} |\")
" 2>/dev/null
    echo ""
    if [ -n "$(python3 -c "import json; d=json.load(open('$AUDIT_DIR/ui-smoke.json')); print('y' if d.get('consoleErrors') else '')" 2>/dev/null)" ]; then
      echo "**Console errors observed:**"
      echo '```'
      python3 -c "
import json
d = json.load(open('$AUDIT_DIR/ui-smoke.json'))
for e in d.get('consoleErrors', [])[:10]:
    print(e)
" 2>/dev/null
      echo '```'
      echo ""
    fi
  } >> "$REPORT"
  # Reference screenshots.
  echo "Screenshots:" >> "$REPORT"
  shopt -s nullglob
  for f in "$AUDIT_DIR"/screenshots/*.png; do
    [ -f "$f" ] && echo "- \`screenshots/$(basename "$f")\`" >> "$REPORT"
  done
  shopt -u nullglob
else
  echo "**UI SMOKE FAILED to write report** — see \`05-ui-smoke.log\`" >> "$REPORT"
  echo '```' >> "$REPORT"
  tail -30 "$AUDIT_DIR/05-ui-smoke.log" >> "$REPORT"
  echo '```' >> "$REPORT"
fi

# ── Summary header ─────────────────────────────────────────────────
TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_END - REG_START))

{
  echo ""
  echo "---"
  echo ""
  echo "## TL;DR"
  echo ""
  echo "Total audit: ${TOTAL_ELAPSED}s"
  echo ""
  echo "| Stage | Status |"
  echo "|---|---|"
  echo "| Regression | $TSC_STATUS typecheck · $BUILD_STATUS build · $TEST_STATUS tests |"
  if [ -f "$AUDIT_DIR/matrix/report.md" ]; then
    MX_OK=$(grep -c "^| \*\*" "$AUDIT_DIR/matrix/report.md" || echo 0)
    MX_FAILED=$(grep -oE "✗ 0b" "$AUDIT_DIR/matrix/report.md" | wc -l || echo 0)
    echo "| Provider matrix | $((MX_OK - MX_FAILED))/${MX_OK} provider rows OK |"
  fi
  if [ -f "$AUDIT_DIR/ui-smoke.json" ]; then
    echo "| UI smoke | $PASSED/$TOTAL checks passed |"
  fi
  echo ""
  echo "Open \`$REPORT\` for the full breakdown."
} >> "$REPORT"

echo ""
echo "════ AUDIT DONE ════"
echo "Report: $REPORT"
echo "Total: ${TOTAL_ELAPSED}s"
