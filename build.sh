#!/usr/bin/env bash
# Full pipeline: refresh metadata -> aggregate index.json -> encrypt index.tfl
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "=== 1/3 Fetch / refresh metadata ==="
bun fetch-metadata.ts

echo ""
echo "=== 2/3 Aggregate data/ -> index.json ==="
python3 indexer.py

echo ""
echo "=== 3/3 Encrypt index.json -> index.tfl ==="
python3 encrypt.py --zstd -k public.key -i index.json -o index.tfl

echo ""
echo "Done: index.tfl ready"
