#!/usr/bin/env bash
# cc-rig hook: memory-precompact — reminder before context compaction
# Event: PreCompact
set -euo pipefail

echo "Context is about to be compacted."
echo "Save key decisions and patterns to memory/ files."

exit 0
