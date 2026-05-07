#!/usr/bin/env bash
# Record a 30s clip from every demo/* concept worktree using record-concept.mjs.
#
# Assumes:
#   - Each demo/<name> branch has a worktree at .claude/worktrees/agent-*/
#     with a working node_modules (vite, playwright).
#   - Port 5173 is free (script waits between runs for it to release).
#
# Concept-specific recipes:
#   - heat-shimmer (subtle ±7% brightness): deeper zoom + longer hold.
#   - hover-driven effects (ripple, scatter, whisper, constellations,
#     thread-lines, breathing-text): HOVER_SWEEP=1 to retrigger.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKTREES_DIR="$REPO/.claude/worktrees"
RECORDER="$SCRIPT_DIR/record-concept.mjs"

# Format: <worktree-suffix>:<output-name>:<extra env vars>
# The extra env field is passed verbatim to `env`.
CONCEPTS=(
    "agent-a89ba747:torah-rain:"
    "agent-a4b508f6:heat-shimmer:PHASE1_MS=3000 ZOOM_TICKS=24 PHASE3_MS=20000"
    "agent-a5db4894:manuscript-watermarks:"
    "agent-a8477d1d:breathing-text:HOVER_SWEEP=1"
    "agent-abd92801:word-clouds:"
    "agent-a169c835:gematria-constellations:HOVER_SWEEP=1"
    "agent-a668fd1f:scatter-hover:HOVER_SWEEP=1"
    "agent-a8e243ad:verse-whisper:HOVER_SWEEP=1"
    "agent-a9c47786:thread-lines:HOVER_SWEEP=1"
    "agent-a37243aa:ripple-words:HOVER_SWEEP=1"
)

wait_for_port_free() {
    local tries=0
    while lsof -i :5173 -sTCP:LISTEN -t >/dev/null 2>&1; do
        ((tries++))
        if ((tries > 15)); then
            echo "  port 5173 still busy after 15s — bailing"
            return 1
        fi
        sleep 1
    done
}

wait_for_http() {
    for _ in {1..30}; do
        if [[ "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/)" == "200" ]]; then
            return 0
        fi
        sleep 1
    done
    return 1
}

for entry in "${CONCEPTS[@]}"; do
    IFS=':' read -r dir name extra_env <<< "$entry"
    wt="$WORKTREES_DIR/$dir"

    echo ""
    echo "===== $name ($dir) ====="
    [[ -n "$extra_env" ]] && echo "  env: $extra_env"

    if [[ ! -x "$wt/node_modules/.bin/vite" ]]; then
        echo "  SKIP: $wt has no vite in node_modules"
        continue
    fi

    wait_for_port_free || continue

    pushd "$wt" >/dev/null
    node ./node_modules/.bin/vite > "/tmp/vite-$name.log" 2>&1 &
    VITE_PID=$!
    popd >/dev/null

    if ! wait_for_http; then
        echo "  FAIL: vite never returned 200"
        tail -20 "/tmp/vite-$name.log"
        kill "$VITE_PID" 2>/dev/null
        continue
    fi

    if env $extra_env node "$RECORDER" "$name"; then
        echo "  ✓ recorded $name"
    else
        echo "  ✗ recorder failed for $name"
    fi

    kill "$VITE_PID" 2>/dev/null
    sleep 1
done

echo ""
echo "===== summary ====="
ls -lh "$REPO/.claude/videos/"*.webm 2>/dev/null
