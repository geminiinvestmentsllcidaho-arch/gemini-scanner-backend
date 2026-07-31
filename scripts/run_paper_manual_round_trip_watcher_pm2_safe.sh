#!/usr/bin/env bash
set -euo pipefail
unset NODE_CHANNEL_FD NODE_UNIQUE_ID
exec /usr/bin/node ./scripts/watch_paper_manual_round_trip_evidence.mjs "$@"
