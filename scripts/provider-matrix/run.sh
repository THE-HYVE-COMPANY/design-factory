#!/bin/bash
# DF Provider Matrix — real-flow validator.
#
# Runs each scenario × each available provider via the daemon's
# /{provider}/stream endpoint, captures the SSE log, validates:
#   - tool_call / tool_result events arrive
#   - file landed on disk (≥100 bytes, valid HTML start)
#   - text has paragraph separators (\n\n)
#   - artifact tag present (for artifact-channel providers)
# Produces a markdown report — honest pass/concern/fail per check.

set -u

DAEMON="${DAEMON:-http://127.0.0.1:1421}"
PROVIDERS="${PROVIDERS:-claude codex kimi gemini opencode openrouter}"
SCENARIOS="${SCENARIOS:-S1-hello S2-gooey S3-edit}"
TIMEOUT_SECS="${TIMEOUT_SECS:-180}"
OUTDIR="${OUTDIR:-/tmp/df-matrix-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUTDIR/sse" "$OUTDIR/projects"
SCEN_DIR="$(dirname "$0")/cenarios"
REPORT="$OUTDIR/report.md"

echo "# DF Provider Matrix — $(date -Iseconds)" > "$REPORT"
echo "" >> "$REPORT"
echo "Daemon: \`$DAEMON\` · Timeout: ${TIMEOUT_SECS}s · OUTDIR: \`$OUTDIR\`" >> "$REPORT"
echo "" >> "$REPORT"

# Provider × Scenario header.
{
  printf "| Provider"
  for s in $SCENARIOS; do printf " | %s" "$s"; done
  printf " |\n"
  printf "|---"
  for s in $SCENARIOS; do printf "|---"; done
  printf "|\n"
} >> "$REPORT"

run_one() {
  local provider="$1"
  local scenario="$2"
  local prompt_file="$SCEN_DIR/${scenario}.txt"
  [ ! -f "$prompt_file" ] && { echo "MISSING_PROMPT"; return; }

  local slug="qa-${provider}-${scenario,,}"
  local project_dir="$OUTDIR/projects/$slug"
  mkdir -p "$project_dir/.df"
  printf '{"id":"qa","name":"QA %s","mode":"hifi","created_at":%s,"updated_at":%s}' "$slug" "$(date +%s%3N)" "$(date +%s%3N)" > "$project_dir/.df/meta.json"
  local primary="$project_dir/${slug}.html"

  # S3 (edit) needs a prior file. If it doesn't exist, seed with S2 output
  # from the same provider when available (so the edit has something to mutate).
  if [ "$scenario" = "S3-edit" ] && [ ! -f "$primary" ]; then
    local s2_primary="$OUTDIR/projects/qa-${provider}-s2-gooey/qa-${provider}-s2-gooey.html"
    if [ -f "$s2_primary" ]; then cp "$s2_primary" "$primary"; fi
  fi

  local prompt
  prompt=$(cat "$prompt_file")
  local sse_log="$OUTDIR/sse/${provider}-${scenario}.sse"
  local sys=""
  if [ "$scenario" != "S1-hello" ]; then
    sys="PROJECT_PATH: $project_dir
PRIMARY_FILE: $primary

When writing the file, write to PRIMARY_FILE exactly. Tool-channel providers: use Write/Edit. Artifact-channel providers: wrap the file in <artifact identifier=\"$primary\" type=\"text/html\" title=\"$scenario\">...</artifact>."
  fi

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

  # ── Validations ──
  # grep -c can emit a trailing newline + the file-prefixed match style on
  # some builds; strip newlines so the integer compare below behaves.
  local has_done has_error has_text has_tool has_result
  has_done=$(grep -c "^event: done$" "$sse_log" 2>/dev/null | tr -d '\n'); has_done=${has_done:-0}
  has_error=$(grep -c "^event: error$" "$sse_log" 2>/dev/null | tr -d '\n'); has_error=${has_error:-0}
  has_text=$(grep -c "^event: text$" "$sse_log" 2>/dev/null | tr -d '\n'); has_text=${has_text:-0}
  has_tool=$(grep -c "^event: tool_call$" "$sse_log" 2>/dev/null | tr -d '\n'); has_tool=${has_tool:-0}
  has_result=$(grep -c "^event: tool_result$" "$sse_log" 2>/dev/null | tr -d '\n'); has_result=${has_result:-0}

  # For artifact providers, fall back to client-side artifact write
  # (mirrors UI's parseArtifact path).
  case "$provider" in
    openrouter|gemini-api|anthropic|openai|ollama)
      local last
      last=$(grep "^data: " "$sse_log" | tail -1 | sed 's/^data: //')
      [ -n "$last" ] && echo "$last" | python3 -c "
import sys, json, re
try:
    d = json.load(sys.stdin)
    text = d.get('content', '')
    # Try canonical <artifact> first; fall back to markdown fence.
    m = re.search(r'<artifact\s+identifier=\"([^\"]+)\"\s+type=\"([^\"]+)\"\s+title=\"([^\"]+)\">(.*?)</artifact>', text, re.DOTALL)
    if m:
        ident, typ, title, content = m.group(1), m.group(2), m.group(3), m.group(4).strip()
    else:
        m = re.search(r'\`\`\`(?:html?)\s*\n([\s\S]*?)\n\`\`\`', text)
        if m:
            ident, typ, title, content = '$primary', 'text/html', '$scenario', m.group(1).strip()
        else:
            sys.exit(0)
    import os
    os.makedirs(os.path.dirname('$primary'), exist_ok=True)
    with open('$primary', 'w') as f: f.write(content)
except Exception:
    pass
" 2>/dev/null
      ;;
  esac

  # Find ANY .html in the project (providers sometimes pick their own
  # filename — "index.html" / "hello.html" / the user-provided slug). The
  # validation is "did SOMETHING land?", not "did this exact path land?".
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
  local has_artifact=$(grep -c "<artifact" "$sse_log" 2>/dev/null | tr -d '\n')
  has_artifact=${has_artifact:-0}

  # Text spacing — look at the `done` content payload for paragraph
  # separators. We expect \n\n between agent_messages when the provider
  # produced multiple prose chunks.
  local text_chunks=$(grep -oE '"content":"[^"]*"' "$sse_log" | wc -l 2>/dev/null || echo 0)
  local final_content
  final_content=$(grep "^data: " "$sse_log" | tail -1 | sed 's/^data: //' | python3 -c "import sys, json; print(json.load(sys.stdin).get('content','') if sys.stdin else '')" 2>/dev/null || echo "")
  local has_paragraph_sep=$(echo "$final_content" | grep -c $'\n\n' || echo 0)

  # ── Verdict per check ──
  local v_done=$([ "$has_done" -gt 0 ] && echo "✓" || echo "✗")
  local v_no_err=$([ "$has_error" -eq 0 ] && echo "✓" || echo "✗")
  local v_tool=$([ "$has_tool" -gt 0 ] || [ "$has_artifact" -gt 0 ] && echo "✓" || echo "·")
  local v_result=$([ "$has_result" -gt 0 ] || [ "$has_artifact" -gt 0 ] && echo "✓" || echo "·")
  local v_file=$([ "$file_bytes" -ge 100 ] && [ "$valid_html" -eq 1 ] && echo "✓" || echo "✗")
  local v_spacing="·"
  if [ "$text_chunks" -gt 1 ]; then
    v_spacing=$([ "$has_paragraph_sep" -gt 0 ] && echo "✓" || echo "✗")
  fi

  # Overall: ✓ if file OK AND done. ✗ if file missing. ⚠ otherwise.
  local verdict
  if [ "$v_file" = "✓" ] && [ "$v_done" = "✓" ]; then
    verdict="✓"
  elif [ "$v_file" = "✗" ]; then
    verdict="✗"
  else
    verdict="⚠"
  fi

  echo "${verdict} ${file_bytes}b · ${elapsed_ms}ms · tool=${has_tool} tr=${has_result} text=${has_text} art=${has_artifact} valid_html=${valid_html} sep=${v_spacing}"
}

for provider in $PROVIDERS; do
  echo "" >> "$REPORT"
  printf "| **%s**" "$provider" >> "$REPORT"
  for scenario in $SCENARIOS; do
    echo "[$provider × $scenario] running…" >&2
    local_result=$(run_one "$provider" "$scenario")
    printf " | %s" "$local_result" >> "$REPORT"
  done
  printf " |\n" >> "$REPORT"
done

echo "" >> "$REPORT"
echo "## Legend" >> "$REPORT"
echo "" >> "$REPORT"
echo "- \`tool=N\`: count of \`tool_call\` events in SSE" >> "$REPORT"
echo "- \`tr=N\`: count of \`tool_result\` events" >> "$REPORT"
echo "- \`text=N\`: count of \`text\` events" >> "$REPORT"
echo "- \`art=N\`: count of \`<artifact\` mentions in SSE (artifact-channel providers)" >> "$REPORT"
echo "- \`valid_html=1\`: file starts with \`<!DOCTYPE\`/\`<html\`/\`<svg\`" >> "$REPORT"
echo "- \`sep=✓\`: paragraph separators (\`\\n\\n\`) detected between text chunks (multi-message turns only)" >> "$REPORT"
echo "" >> "$REPORT"
echo "## Artifacts" >> "$REPORT"
echo "" >> "$REPORT"
echo "- Per-turn SSE logs: \`$OUTDIR/sse/\`" >> "$REPORT"
echo "- Generated projects: \`$OUTDIR/projects/\`" >> "$REPORT"

echo ""
echo "════ DONE ════"
echo "Report: $REPORT"
echo ""
cat "$REPORT"
