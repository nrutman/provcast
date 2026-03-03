# Provcast — Project Conventions

## Overview
Provcast is a desktop audio editor for podcast publishing, built with Tauri v2 (Rust backend) + React (TypeScript frontend).

## Architecture
- **All audio processing happens in Rust** — the React frontend handles visualization and UI only
- Audio data never crosses the IPC boundary — only metadata, peak data, and file paths are exchanged
- Non-destructive editing via an Edit Decision List (EDL) in Rust

## Directory Structure
- `app/` — React frontend (routes, components, stores, hooks)
- `api/` — Tauri Rust backend (audio engine, metadata, commands)
- `api/src/commands.rs` — All `#[tauri::command]` functions
- `api/src/audio/` — Audio decoding, playback, editing, processing, export
- `api/src/metadata/` — ID3 tag reading/writing

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 7, TanStack Router, Zustand + zundo, shadcn/ui, Tailwind CSS v4, wavesurfer.js v7
- **Icons:** Lucide React + Material Symbols (`react-material-symbols`) — use either library as appropriate
- **Backend:** Rust, symphonia (decoding), rodio/cpal (playback), nnnoiseless (noise reduction), mp3lame-encoder (export), id3 (metadata)
- **Package manager:** pnpm

## Commands
- `pnpm dev` — Start Vite dev server only
- `pnpm tauri dev` — Start full Tauri app (frontend + Rust backend)
- `pnpm build` — Build frontend
- `pnpm tauri build` — Build production app bundle
- `pnpm test` — Run frontend tests (Vitest)
- `cargo test --manifest-path api/Cargo.toml` — Run Rust tests

## Conventions
- Use `@/` path alias for imports from `app/`
- shadcn/ui components live in `app/components/ui/`
- State management via Zustand stores in `app/stores/`
- Tauri command wrappers in `app/hooks/tauri/` grouped by domain
- Rust error handling: return `Result<T, String>` from commands
- Use `parking_lot::Mutex` for Rust state synchronization
- See `CONTRIBUTING.md` for full style guide, code ordering rules, and testing standards

## Testing
- Every time tests are added or updated, evaluate: (1) missing high-value cases, (2) simplification opportunities, (3) low-value cases to remove
- Test behavior, not implementation details — click buttons, verify outcomes
- See the "Testing" section in `CONTRIBUTING.md` for the full checklist
