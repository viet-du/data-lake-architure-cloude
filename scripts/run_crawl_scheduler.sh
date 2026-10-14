#!/usr/bin/env bash
# ============================================================================
# scripts/run_crawl_scheduler.sh
# ----------------------------------------------------------------------------
# Foreground runner for the multi-source crawl scheduler.
#
# Modes:
#   --daemon    Run in background, write PID to /tmp/crawl_scheduler.pid
#   --once NAME Run a single job once and exit (useful for testing/manual)
#   --list      List configured jobs and exit
#
# Usage:
#   bash scripts/run_crawl_scheduler.sh              # Foreground (default schedule)
#   bash scripts/run_crawl_scheduler.sh --daemon     # Background, persisted
#   bash scripts/run_crawl_scheduler.sh --once tiki-smartphone
#   bash scripts/run_crawl_scheduler.sh --list
#   bash scripts/run_crawl_scheduler.sh --stop       # Stop daemon
# ============================================================================

set -euo pipefail

MODE="daemon"
JOB_NAME=""
PID_FILE="/tmp/crawl_scheduler.pid"
LOG_FILE="/tmp/crawl_scheduler.log"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --daemon)  MODE="daemon"; shift ;;
        --once)    MODE="once"; JOB_NAME="$2"; shift 2 ;;
        --list)    MODE="list"; shift ;;
        --stop)    MODE="stop"; shift ;;
        --log)     LOG_FILE="$2"; shift 2 ;;
        -h|--help)
            head -25 "$0"
            exit 0
            ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

# Resolve Python interpreter
if [[ -d .venv ]]; then
    PY=".venv/bin/python"
else
    PY="python3"
fi

# Verify deps
if ! $PY -c "from lakehouse.sources.scheduler import CrawlScheduler" 2>/dev/null; then
    echo "❌ lakehouse package not importable. Did you run 'make install'?" >&2
    exit 1
fi

# Verify Kafka reachable (best-effort, don't fail if it can't connect)
KAFKA_OK=1
if command -v docker >/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^lake-kafka$'; then
    if ! docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list 2>/dev/null | head -1 | grep -q "."; then
        echo "⚠ Kafka may be initializing (no topics yet). Continuing anyway..." >&2
    fi
fi

case "$MODE" in
    daemon)
        # Stop existing daemon if any
        if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "⚠ Existing scheduler running (PID $(cat "$PID_FILE")). Stopping first..."
            kill "$(cat "$PID_FILE")" 2>/dev/null || true
            sleep 2
        fi
        echo "Starting crawl scheduler in background. Logs: $LOG_FILE"
        nohup $PY -m lakehouse.sources.scheduler > "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        echo "✅ Started. PID: $(cat "$PID_FILE")"
        sleep 2
        echo "--- first 20 log lines ---"
        head -20 "$LOG_FILE" || true
        echo "--- tail live ---"
        echo "  tail -f $LOG_FILE"
        echo "  bash scripts/run_crawl_scheduler.sh --stop"
        ;;

    once)
        if [[ -z "$JOB_NAME" ]]; then
            echo "❌ --once requires a job name. Use --list to see options." >&2
            exit 2
        fi
        echo "Running job '$JOB_NAME' once..."
        $PY -c "
from lakehouse.sources.scheduler import build_default_scheduler
sched = build_default_scheduler()
count = sched.run_once('$JOB_NAME')
print(f'✅ Job $JOB_NAME produced {count} items')
"
        ;;

    list)
        $PY -c "
from lakehouse.sources.scheduler import build_default_scheduler
import json
sched = build_default_scheduler()
for j in sched.list_jobs():
    print(f\"  • {j['name']:30s} every {j['run_every_s']:6d}s  (kwargs={j['kwargs']})\")
"
        ;;

    stop)
        if [[ ! -f "$PID_FILE" ]]; then
            echo "No PID file at $PID_FILE — nothing to stop."
            exit 0
        fi
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping scheduler (PID $PID)..."
            kill "$PID"
            sleep 2
            if kill -0 "$PID" 2>/dev/null; then
                echo "Process still alive, sending SIGKILL"
                kill -9 "$PID" || true
            fi
            rm -f "$PID_FILE"
            echo "✅ Stopped"
        else
            echo "PID $PID not running. Cleaning up."
            rm -f "$PID_FILE"
        fi
        ;;
esac
