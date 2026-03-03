#!/bin/bash
set -e

echo "=== Frontend ==="
echo "--- TypeScript compile ---"
pnpm exec tsc -b --noEmit
echo "--- Lint ---"
pnpm lint
echo "--- Format check ---"
pnpm format:check
echo "--- Tests ---"
pnpm test

echo ""
echo "=== Backend ==="
echo "--- Format check ---"
cargo fmt --manifest-path api/Cargo.toml -- --check
echo "--- Clippy ---"
cargo clippy --manifest-path api/Cargo.toml -- -D warnings
echo "--- Tests ---"
cargo test --manifest-path api/Cargo.toml
echo "--- Build ---"
cargo build --manifest-path api/Cargo.toml

echo ""
echo "=== All checks passed ==="
