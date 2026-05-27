#!/bin/bash
# DF Provider Stress Matrix — Claude vs Codex vs Kimi
#
# Phase 1: fresh writes (S4-shader, S5-dashboard, S6-anima) × 3 providers
# Phase 2: edit chain (S7-edit-base → r1 → r2 → r3) per provider
# Phase 3: screenshot each output via headless chromium
# Phase 4: HTML report with side-by-side comparison
#
# Honest verdict: SSE event counts, file integrity, JS sintax check, render OK?

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DAEMON="${DAEMON:-http://127.0.0.1:1421}"
PROVIDERS="${PROVIDERS:-claude codex kimi}"
TIMEOUT_SECS="${TIMEOUT_SECS:-600}"
OUTDIR="${OUTDIR:-/tmp/df-stress-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUTDIR/sse" "$OUTDIR/projects" "$OUTDIR/shots"
SCEN_DIR="$(dirname "$0")/cenarios"
REPORT="$OUTDIR/report.md"
HTML_REPORT="$OUTDIR/report.html"

echo "# DF Stress Matrix — $(date -Iseconds)" > "$REPORT"
echo "" >> "$REPORT"
echo "Daemon: \`$DAEMON\` · Timeout: ${TIMEOUT_SECS}s · OUTDIR: \`$OUTDIR\`" >> "$REPORT"
echo "" >> "$REPORT"

# Returns "verdict bytes ms tool tr text art valid sep js_err"
run_one() {
  local provider="$1"
  local scenario="$2"
  local seed_file="${3:-}"  # optional: pre-seed primary with this file (for edit chain)

  local prompt_file="$SCEN_DIR/${scenario}.txt"
  [ ! -f "$prompt_file" ] && { echo "MISSING_PROMPT"; return; }

  local slug="qa-${provider}-${scenario,,}"
  local project_dir="$OUTDIR/projects/$slug"
  mkdir -p "$project_dir/.df"
  printf '{"id":"qa","name":"QA %s","mode":"hifi","created_at":%s,"updated_at":%s}' "$slug" "$(date +%s%3N)" "$(date +%s%3N)" > "$project_dir/.df/meta.json"
  local primary="$project_dir/${slug}.html"

  # Seed for edit chain: copy prior round's output to primary
  if [ -n "$seed_file" ] && [ -f "$seed_file" ]; then
    cp "$seed_file" "$primary"
  fi

  local prompt
  prompt=$(cat "$prompt_file")
  local sse_log="$OUTDIR/sse/${provider}-${scenario}.sse"

  local sys="PROJECT_PATH: $project_dir
PRIMARY_FILE: $primary

When writing the file, write to PRIMARY_FILE exactly. Tool-channel providers: use Write/Edit. Artifact-channel providers: wrap the file in <artifact identifier=\"$primary\" type=\"text/html\" title=\"$scenario\">...</artifact>."

  local body
  body=$(jq -nc --arg p "$prompt" --arg s "$sys" --arg c "$project_dir" --arg m "default" \
    '{prompt: $p, systemPrompt: $s, model: $m, cwd: $c}')

  local start=$(date +%s%3N)
  curl -sN -X POST "$DAEMON/${provider}/stream" \
    -H "Content-Type: application/json" \
    --max-time "$TIMEOUT_SECS" \
    -d "$body" \
    > "$sse_log" 2>&1
  local exit_code=$?
  local elapsed_ms=$(( $(date +%s%3N) - start ))

  # Validations
  local has_done has_error has_text has_tool has_result
  has_done=$(grep -c "^event: done$" "$sse_log" 2>/dev/null | tr -d '\n'); has_done=${has_done:-0}
  has_error=$(grep -c "^event: error$" "$sse_log" 2>/dev/null | tr -d '\n'); has_error=${has_error:-0}
  has_text=$(grep -c "^event: text$" "$sse_log" 2>/dev/null | tr -d '\n'); has_text=${has_text:-0}
  has_tool=$(grep -c "^event: tool_call$" "$sse_log" 2>/dev/null | tr -d '\n'); has_tool=${has_tool:-0}
  has_result=$(grep -c "^event: tool_result$" "$sse_log" 2>/dev/null | tr -d '\n'); has_result=${has_result:-0}

  # Artifact-channel client-side write fallback
  case "$provider" in
    openrouter|gemini-api|anthropic|openai|ollama)
      local last
      last=$(grep "^data: " "$sse_log" | tail -1 | sed 's/^data: //')
      [ -n "$last" ] && echo "$last" | PRIMARY="$primary" SCEN="$scenario" python3 -c "
import sys, json, re, os
try:
    d = json.load(sys.stdin)
    text = d.get('content', '')
    m = re.search(r'<artifact\s+identifier=\"([^\"]+)\"\s+type=\"([^\"]+)\"\s+title=\"([^\"]+)\">(.*?)</artifact>', text, re.DOTALL)
    if m:
        content = m.group(4).strip()
    else:
        m = re.search(r'\`\`\`(?:html?)\s*\n([\s\S]*?)\n\`\`\`', text)
        content = m.group(1).strip() if m else None
    if content:
        with open(os.environ['PRIMARY'], 'w') as f: f.write(content)
except Exception:
    pass
" 2>/dev/null
      ;;
  esac

  # Find any HTML
  local found_html=""
  while IFS= read -r f; do
    [ -z "$found_html" ] && found_html="$f"
  done < <(find "$project_dir" -maxdepth 2 -name "*.html" -size +99c 2>/dev/null)

  local file_bytes=0
  local valid_html=0
  if [ -n "$found_html" ] && [ -f "$found_html" ]; then
    file_bytes=$(wc -c < "$found_html")
    head -c 100 "$found_html" | grep -qiE "^(\s|﻿)*<!doctype|^(\s|﻿)*<html|^(\s|﻿)*<svg" && valid_html=1
  fi

  local has_artifact=$(grep -c "<artifact" "$sse_log" 2>/dev/null | tr -d '\n'); has_artifact=${has_artifact:-0}

  # Sintax check: try to parse the JS via node (extract <script> tags)
  local js_err="ok"
  if [ -n "$found_html" ] && [ -f "$found_html" ] && [ "$valid_html" = "1" ]; then
    js_err=$(python3 -c "
import re, sys
try:
    html = open('$found_html').read()
    scripts = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', html, re.IGNORECASE)
    js = '\n'.join(scripts)
    if not js.strip():
        print('no-js')
    else:
        # Quick balance check: parens, brackets, braces
        depth_p = depth_b = depth_c = 0
        in_str = None
        in_comment = None
        i = 0
        while i < len(js):
            c = js[i]
            nxt = js[i+1] if i+1 < len(js) else ''
            if in_comment == 'line':
                if c == '\n': in_comment = None
            elif in_comment == 'block':
                if c == '*' and nxt == '/': in_comment = None; i += 1
            elif in_str:
                if c == '\\\\': i += 1
                elif c == in_str: in_str = None
            else:
                if c == '/' and nxt == '/': in_comment = 'line'; i += 1
                elif c == '/' and nxt == '*': in_comment = 'block'; i += 1
                elif c in ('\"', \"'\", '\`'): in_str = c
                elif c == '(': depth_p += 1
                elif c == ')': depth_p -= 1
                elif c == '[': depth_b += 1
                elif c == ']': depth_b -= 1
                elif c == '{': depth_c += 1
                elif c == '}': depth_c -= 1
            i += 1
        problems = []
        if depth_p != 0: problems.append(f'p={depth_p}')
        if depth_b != 0: problems.append(f'b={depth_b}')
        if depth_c != 0: problems.append(f'c={depth_c}')
        print(','.join(problems) if problems else 'ok')
except Exception as e:
    print(f'parse-err:{e}')
" 2>/dev/null || echo "py-fail")
  fi

  # Verdict
  local verdict
  if [ "$valid_html" = "1" ] && [ "$has_done" -gt 0 ] && [ "$js_err" = "ok" ]; then
    verdict="✓"
  elif [ "$valid_html" = "1" ] && [ "$has_done" -gt 0 ]; then
    verdict="⚠"
  elif [ "$valid_html" = "1" ]; then
    verdict="⚠"
  else
    verdict="✗"
  fi

  # Output: tab-separated for easier parsing later
  echo "${verdict}|${file_bytes}|${elapsed_ms}|${has_tool}|${has_result}|${has_text}|${has_artifact}|${valid_html}|${js_err}|${found_html}"
}

# ───────────────────────────────────────────────────────────────
# Phase 1: Fresh writes (S4-shader, S5-dashboard, S6-anima)
# ───────────────────────────────────────────────────────────────
echo "## Phase 1: Stress (fresh writes)" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Provider | S4-shader | S5-dashboard | S6-anima |" >> "$REPORT"
echo "|---|---|---|---|" >> "$REPORT"

declare -A PHASE1_HTML
for provider in $PROVIDERS; do
  row="| **$provider**"
  for scenario in S4-shader S5-dashboard S6-anima; do
    echo "[$provider × $scenario] running…" >&2
    r=$(run_one "$provider" "$scenario")
    verdict=$(echo "$r" | cut -d'|' -f1)
    bytes=$(echo "$r" | cut -d'|' -f2)
    ms=$(echo "$r" | cut -d'|' -f3)
    tool=$(echo "$r" | cut -d'|' -f4)
    tr=$(echo "$r" | cut -d'|' -f5)
    text_cnt=$(echo "$r" | cut -d'|' -f6)
    art=$(echo "$r" | cut -d'|' -f7)
    valid=$(echo "$r" | cut -d'|' -f8)
    js=$(echo "$r" | cut -d'|' -f9)
    html=$(echo "$r" | cut -d'|' -f10)
    PHASE1_HTML["${provider}_${scenario}"]="$html"
    cell="${verdict} ${bytes}b · ${ms}ms · t=${tool}/${tr} txt=${text_cnt} art=${art} js=${js}"
    row="$row | $cell"
  done
  echo "$row |" >> "$REPORT"
done
echo "" >> "$REPORT"

# ───────────────────────────────────────────────────────────────
# Phase 2: Edit chain (S7-base → r1 → r2 → r3)
# ───────────────────────────────────────────────────────────────
echo "## Phase 2: Edit chain (S7-edit-base → r1 → r2 → r3)" >> "$REPORT"
echo "" >> "$REPORT"
echo "| Provider | Base | R1 | R2 | R3 |" >> "$REPORT"
echo "|---|---|---|---|---|" >> "$REPORT"

declare -A PHASE2_HTML
for provider in $PROVIDERS; do
  row="| **$provider**"
  prev_html=""
  for round in S7-edit-base S7-edit-r1 S7-edit-r2 S7-edit-r3; do
    echo "[$provider × $round] running…" >&2
    r=$(run_one "$provider" "$round" "$prev_html")
    verdict=$(echo "$r" | cut -d'|' -f1)
    bytes=$(echo "$r" | cut -d'|' -f2)
    ms=$(echo "$r" | cut -d'|' -f3)
    tool=$(echo "$r" | cut -d'|' -f4)
    tr=$(echo "$r" | cut -d'|' -f5)
    text_cnt=$(echo "$r" | cut -d'|' -f6)
    art=$(echo "$r" | cut -d'|' -f7)
    valid=$(echo "$r" | cut -d'|' -f8)
    js=$(echo "$r" | cut -d'|' -f9)
    html=$(echo "$r" | cut -d'|' -f10)
    PHASE2_HTML["${provider}_${round}"]="$html"
    [ -n "$html" ] && prev_html="$html"
    cell="${verdict} ${bytes}b · ${ms}ms · t=${tool}/${tr} txt=${text_cnt} js=${js}"
    row="$row | $cell"
  done
  echo "$row |" >> "$REPORT"
done
echo "" >> "$REPORT"

# ───────────────────────────────────────────────────────────────
# Phase 3: Screenshot capture
# ───────────────────────────────────────────────────────────────
echo "## Phase 3: Screenshot capture" >> "$REPORT"
echo "" >> "$REPORT"

if command -v node >/dev/null 2>&1; then
  cat > "$OUTDIR/shoot.mjs" <<'NODESCRIPT'
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUTDIR = process.env.OUTDIR;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

const files = process.argv.slice(2).filter(Boolean);
console.log(`shooting ${files.length} files…`);

const results = [];
for (const file of files) {
  if (!file || !existsSync(file)) {
    results.push({ file, ok: false, error: "missing" });
    continue;
  }
  const stem = path.basename(file, ".html");
  const png = path.join(OUTDIR, "shots", `${stem}.png`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  try {
    const url = "file://" + path.resolve(file);
    await page.goto(url, { waitUntil: "networkidle", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: png, fullPage: false });
    results.push({ file, ok: true, png, errors });
  } catch (e) {
    results.push({ file, ok: false, error: e.message, errors });
  } finally {
    await page.close();
  }
}
await browser.close();
await writeFile(path.join(OUTDIR, "shots-result.json"), JSON.stringify(results, null, 2));
console.log("done");
NODESCRIPT

  # Collect all html paths
  HTML_FILES=$(find "$OUTDIR/projects" -maxdepth 3 -name "*.html" -size +99c 2>/dev/null | sort)
  HTML_COUNT=$(echo "$HTML_FILES" | wc -l)
  echo "Capturing $HTML_COUNT screenshots…" >&2

  if [ -d "$REPO_ROOT/node_modules/playwright" ]; then
    cd "$REPO_ROOT" && OUTDIR="$OUTDIR" node "$OUTDIR/shoot.mjs" $HTML_FILES 2>&1 | tail -20 >> "$REPORT"
  else
    echo "playwright not installed — skipping screenshots" >> "$REPORT"
  fi
else
  echo "node not available — skipping screenshots" >> "$REPORT"
fi

# ───────────────────────────────────────────────────────────────
# Phase 4: HTML report with side-by-side
# ───────────────────────────────────────────────────────────────
cat > "$HTML_REPORT" <<HTMLREPORT
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>DF Stress Matrix — $(date -Iseconds)</title>
<style>
  :root {
    --bg: #14110F;
    --surface: #1F1B17;
    --text: #F5EFE8;
    --muted: #8a8378;
    --border: rgba(255,255,255,0.08);
    --orange: #FF5524;
    --sage: #A8C09A;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    margin: 0;
    padding: 32px;
  }
  h1, h2, h3 { font-weight: 500; margin: 24px 0 12px; }
  h1 { font-size: 22px; margin-top: 0; }
  h2 { font-size: 16px; color: var(--orange); }
  h3 { font-size: 14px; }
  .meta { color: var(--muted); font-size: 12px; margin-bottom: 24px; }
  .grid {
    display: grid;
    grid-template-columns: 100px repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 32px;
    align-items: start;
  }
  .grid > .label { color: var(--muted); font-size: 11px; font-weight: 500; padding-top: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  .cell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .cell .shot {
    width: 100%;
    aspect-ratio: 16/10;
    object-fit: cover;
    object-position: top left;
    background: #000;
    display: block;
  }
  .cell .shot.missing {
    background: linear-gradient(45deg, rgba(255,85,36,0.1) 25%, transparent 25%, transparent 75%, rgba(255,85,36,0.1) 75%) 0 0 / 16px 16px;
    aspect-ratio: 16/10;
    color: var(--orange);
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell .meta-row {
    padding: 8px 10px;
    font-size: 10px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--border);
    font-family: ui-monospace, monospace;
  }
  .verdict { font-weight: 600; }
  .verdict.pass { color: var(--sage); }
  .verdict.warn { color: #DDB554; }
  .verdict.fail { color: var(--orange); }
  .header-row {
    display: grid;
    grid-template-columns: 100px repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 8px;
    align-items: center;
  }
  .provider-name {
    font-size: 14px;
    text-align: center;
    padding: 8px;
    background: var(--surface);
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }
  .open-link {
    color: var(--orange);
    text-decoration: none;
    font-size: 10px;
  }
  .open-link:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>DF Stress Matrix</h1>
<div class="meta">$(date -Iseconds) · Daemon: $DAEMON · Timeout: ${TIMEOUT_SECS}s</div>

<h2>Phase 1: Fresh writes</h2>

<div class="header-row">
  <div></div>
HTMLREPORT

for provider in $PROVIDERS; do
  echo "  <div class=\"provider-name\">$provider</div>" >> "$HTML_REPORT"
done
echo "</div>" >> "$HTML_REPORT"

for scenario in S4-shader S5-dashboard S6-anima; do
  echo "<div class=\"grid\">" >> "$HTML_REPORT"
  echo "  <div class=\"label\">$scenario</div>" >> "$HTML_REPORT"
  for provider in $PROVIDERS; do
    html_path="${PHASE1_HTML[${provider}_${scenario}]:-}"
    shot_path=""
    if [ -n "$html_path" ]; then
      stem=$(basename "$html_path" .html)
      candidate="$OUTDIR/shots/${stem}.png"
      [ -f "$candidate" ] && shot_path="shots/${stem}.png"
    fi

    bytes=0
    [ -n "$html_path" ] && [ -f "$html_path" ] && bytes=$(wc -c < "$html_path")
    rel_html=""
    [ -n "$html_path" ] && rel_html="${html_path#$OUTDIR/}"

    echo "  <div class=\"cell\">" >> "$HTML_REPORT"
    if [ -n "$shot_path" ]; then
      echo "    <img class=\"shot\" src=\"$shot_path\" loading=\"lazy\" />" >> "$HTML_REPORT"
    else
      echo "    <div class=\"shot missing\">no screenshot</div>" >> "$HTML_REPORT"
    fi
    echo "    <div class=\"meta-row\"><span>${bytes}b</span><a class=\"open-link\" href=\"$rel_html\" target=\"_blank\">open</a></div>" >> "$HTML_REPORT"
    echo "  </div>" >> "$HTML_REPORT"
  done
  echo "</div>" >> "$HTML_REPORT"
done

echo "<h2>Phase 2: Edit chain</h2>" >> "$HTML_REPORT"

for round in S7-edit-base S7-edit-r1 S7-edit-r2 S7-edit-r3; do
  echo "<div class=\"grid\">" >> "$HTML_REPORT"
  echo "  <div class=\"label\">$round</div>" >> "$HTML_REPORT"
  for provider in $PROVIDERS; do
    html_path="${PHASE2_HTML[${provider}_${round}]:-}"
    shot_path=""
    if [ -n "$html_path" ]; then
      stem=$(basename "$html_path" .html)
      candidate="$OUTDIR/shots/${stem}.png"
      [ -f "$candidate" ] && shot_path="shots/${stem}.png"
    fi
    bytes=0
    [ -n "$html_path" ] && [ -f "$html_path" ] && bytes=$(wc -c < "$html_path")
    rel_html=""
    [ -n "$html_path" ] && rel_html="${html_path#$OUTDIR/}"

    echo "  <div class=\"cell\">" >> "$HTML_REPORT"
    if [ -n "$shot_path" ]; then
      echo "    <img class=\"shot\" src=\"$shot_path\" loading=\"lazy\" />" >> "$HTML_REPORT"
    else
      echo "    <div class=\"shot missing\">no screenshot</div>" >> "$HTML_REPORT"
    fi
    echo "    <div class=\"meta-row\"><span>${bytes}b</span><a class=\"open-link\" href=\"$rel_html\" target=\"_blank\">open</a></div>" >> "$HTML_REPORT"
    echo "  </div>" >> "$HTML_REPORT"
  done
  echo "</div>" >> "$HTML_REPORT"
done

echo "</body></html>" >> "$HTML_REPORT"

echo "" >> "$REPORT"
echo "════ DONE ════"
echo "MD Report:   $REPORT"
echo "HTML Report: $HTML_REPORT"
echo ""
