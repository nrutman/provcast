# Wizard Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the Provcast UI from a flat single-view editor into a 5-step wizard (File Select, Normalization, Trimming, Metadata, Export) with the waveform persistent in the top half and wizard steps in the bottom half.

**Architecture:** Single-route app with wizard step state in Zustand. Top/bottom split layout — waveform + playback controls on top, step sidebar + step content on bottom. New Rust commands for A/B preview and export preview. All existing audio processing stays in Rust; frontend remains a thin UI layer.

**Tech Stack:** React 19, TypeScript, Zustand, wavesurfer.js v7, shadcn/ui, Tailwind CSS v4, Tauri v2 (Rust), Vitest + @testing-library/react (frontend tests), cargo test (backend tests), ESLint + Prettier (frontend linting/formatting), clippy + rustfmt (backend linting/formatting), GitHub Actions CI.

---

## Phase 0: Tooling & CI

### Task 0.1: Set up frontend linting and formatting

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (add scripts + devDeps)

**Step 1: Install ESLint and Prettier**

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

**Step 2: Create ESLint config**

Create `eslint.config.js`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "app/routeTree.gen.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettier,
);
```

**Step 3: Create Prettier config**

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Step 4: Add scripts to package.json**

Add to `"scripts"`:
```json
"lint": "eslint app/",
"lint:fix": "eslint app/ --fix",
"format": "prettier --write 'app/**/*.{ts,tsx}'",
"format:check": "prettier --check 'app/**/*.{ts,tsx}'"
```

**Step 5: Run lint and format, fix any issues**

```bash
pnpm lint:fix && pnpm format
```

**Step 6: Commit**

```bash
git add eslint.config.js .prettierrc package.json pnpm-lock.yaml app/
git commit -m "chore: add ESLint + Prettier configuration"
```

### Task 0.2: Set up frontend testing infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `app/test/setup.ts`
- Modify: `package.json` (add test devDeps)
- Modify: `tsconfig.json` (add test types)

**Step 1: Install testing dependencies**

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@tauri-apps/api": path.resolve(__dirname, "./app/test/__mocks__/@tauri-apps/api.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./app/test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
```

**Step 3: Create test setup file**

Create `app/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

**Step 4: Create Tauri API mock**

Create `app/test/__mocks__/@tauri-apps/api.ts`:
```ts
export function invoke(_cmd: string, _args?: Record<string, unknown>) {
  return Promise.resolve(null);
}

export function listen(_event: string, _handler: (event: unknown) => void) {
  return Promise.resolve(() => {});
}
```

**Step 5: Add a smoke test to verify setup**

Create `app/test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test setup", () => {
  it("works", () => {
    expect(true).toBe(true);
  });
});
```

**Step 6: Run test**

```bash
pnpm test
```

Expected: 1 test passes.

**Step 7: Commit**

```bash
git add vitest.config.ts app/test/ tsconfig.json package.json pnpm-lock.yaml
git commit -m "chore: add Vitest + Testing Library setup"
```

### Task 0.3: Set up GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always

jobs:
  frontend:
    name: Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: TypeScript compile
        run: pnpm exec tsc -b --noEmit
      - name: Lint
        run: pnpm lint
      - name: Format check
        run: pnpm format:check
      - name: Test
        run: pnpm test

  backend:
    name: Backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: api
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev
      - name: Format check
        run: cargo fmt --manifest-path api/Cargo.toml -- --check
      - name: Clippy
        run: cargo clippy --manifest-path api/Cargo.toml -- -D warnings
      - name: Test
        run: cargo test --manifest-path api/Cargo.toml
      - name: Build
        run: cargo build --manifest-path api/Cargo.toml
```

**Step 2: Verify linting and formatting passes locally**

```bash
pnpm lint && pnpm format:check
cargo fmt --manifest-path api/Cargo.toml -- --check
cargo clippy --manifest-path api/Cargo.toml -- -D warnings
```

Fix any issues that arise.

**Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for frontend + backend"
```

---

## Phase 1: Backend — New Rust Commands

### Task 1.1: Add `find_quietest_region` command

This command runs silence detection with conservative defaults and returns the single quietest region.

**Files:**
- Modify: `api/src/audio/processor.rs` — add `find_quietest_region()` function
- Modify: `api/src/commands.rs` — add Tauri command
- Modify: `api/src/lib.rs` — register command

**Step 1: Write test for find_quietest_region**

Add to `api/src/audio/processor.rs` (in a `#[cfg(test)] mod tests` block):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_quietest_region() {
        let sample_rate = 44100u32;
        let channels = 1u16;
        // 3 seconds of audio: loud, quiet, loud
        let mut samples = Vec::new();
        // 0-1s: loud sine
        for i in 0..(sample_rate as usize) {
            samples.push(0.5 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin());
        }
        // 1-2s: near silence
        for _ in 0..(sample_rate as usize) {
            samples.push(0.001);
        }
        // 2-3s: loud sine again
        for i in 0..(sample_rate as usize) {
            samples.push(0.5 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin());
        }

        let region = find_quietest_region(&samples, channels, sample_rate, 0.5);
        assert!(region.is_some());
        let r = region.unwrap();
        // The quiet region should be approximately in the 1-2s range
        assert!(r.start >= 0.5 && r.start <= 1.5);
        assert!(r.end >= 1.5 && r.end <= 2.5);
    }

    #[test]
    fn test_find_quietest_region_no_silence() {
        let sample_rate = 44100u32;
        let channels = 1u16;
        // All loud
        let samples: Vec<f32> = (0..(sample_rate as usize))
            .map(|i| 0.8 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin())
            .collect();

        let region = find_quietest_region(&samples, channels, sample_rate, 0.5);
        // Should still return something — the quietest region found, even if not "silent"
        // Or None if nothing meets a minimum threshold
        // For our use case, we always return the quietest section we can find
        assert!(region.is_some());
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cargo test --manifest-path api/Cargo.toml -- find_quietest
```
Expected: FAIL — `find_quietest_region` not found.

**Step 3: Implement find_quietest_region**

Add to `api/src/audio/processor.rs`:
```rust
/// Find the quietest region in the audio of at least `min_duration_secs` length.
/// Uses RMS analysis with a sliding window. Returns the region with the lowest
/// average RMS, or None if the audio is too short.
pub fn find_quietest_region(
    samples: &[f32],
    channels: u16,
    sample_rate: u32,
    min_duration_secs: f64,
) -> Option<SilenceRegion> {
    let ch = channels as usize;
    if ch == 0 || sample_rate == 0 {
        return None;
    }
    let total_frames = samples.len() / ch;
    let window_frames = (min_duration_secs * sample_rate as f64) as usize;
    if total_frames < window_frames || window_frames == 0 {
        return None;
    }

    // Compute per-frame RMS (mix down to mono)
    let frame_rms: Vec<f32> = (0..total_frames)
        .map(|f| {
            let start = f * ch;
            let sum: f32 = (0..ch).map(|c| {
                let s = samples[start + c];
                s * s
            }).sum();
            (sum / ch as f32).sqrt()
        })
        .collect();

    // Sliding window to find the quietest region
    let mut best_start = 0usize;
    let mut best_rms = f64::MAX;

    let mut window_sum: f64 = frame_rms[..window_frames].iter().map(|&v| v as f64).sum();
    let avg = window_sum / window_frames as f64;
    if avg < best_rms {
        best_rms = avg;
        best_start = 0;
    }

    for i in 1..=(total_frames - window_frames) {
        window_sum -= frame_rms[i - 1] as f64;
        window_sum += frame_rms[i + window_frames - 1] as f64;
        let avg = window_sum / window_frames as f64;
        if avg < best_rms {
            best_rms = avg;
            best_start = i;
        }
    }

    Some(SilenceRegion {
        start: best_start as f64 / sample_rate as f64,
        end: (best_start + window_frames) as f64 / sample_rate as f64,
    })
}
```

**Step 4: Run test to verify it passes**

```bash
cargo test --manifest-path api/Cargo.toml -- find_quietest
```
Expected: PASS

**Step 5: Add Tauri command**

Add to `api/src/commands.rs`:
```rust
#[tauri::command]
fn find_quietest_region(
    state: tauri::State<'_, AudioEngineState>,
    min_duration_secs: f64,
) -> Result<Option<processor::SilenceRegion>, String> {
    let engine = state.0.lock();
    let samples = engine.source_samples.as_ref().ok_or("No audio loaded")?;
    Ok(processor::find_quietest_region(
        samples,
        engine.channels,
        engine.sample_rate,
        min_duration_secs,
    ))
}
```

Register in `api/src/lib.rs` invoke_handler.

**Step 6: Commit**

```bash
git add api/src/
git commit -m "feat: add find_quietest_region command for noise sample auto-detection"
```

### Task 1.2: Add `preview_effect` command

Applies compression or noise reduction to a temporary buffer for A/B preview without modifying the EDL. Plays the processed audio and returns immediately.

**Files:**
- Modify: `api/src/audio/mod.rs` — add `preview_buffer` field to AudioEngine
- Modify: `api/src/commands.rs` — add `preview_effect` and `stop_preview` commands
- Modify: `api/src/lib.rs` — register commands

**Step 1: Write tests**

Add to `api/src/audio/processor.rs` tests:
```rust
#[test]
fn test_compress_does_not_panic() {
    let samples: Vec<f32> = (0..44100).map(|i| {
        0.8 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 44100.0).sin()
    }).collect();
    let params = CompressionParams {
        threshold_db: -20.0,
        ratio: 4.0,
        attack_ms: 10.0,
        release_ms: 100.0,
        makeup_gain_db: 0.0,
    };
    let result = compress(&samples, 1, 44100, &params);
    assert_eq!(result.len(), samples.len());
}
```

**Step 2: Run test**

```bash
cargo test --manifest-path api/Cargo.toml -- test_compress
```

**Step 3: Add preview_buffer to AudioEngine**

In `api/src/audio/mod.rs`, add to the `AudioEngine` struct:
```rust
pub preview_samples: Option<Vec<f32>>,
```

Initialize to `None` in `Default` and `new()`.

**Step 4: Add preview_effect command**

In `api/src/commands.rs`:
```rust
#[tauri::command]
fn preview_effect(
    state: tauri::State<'_, AudioEngineState>,
    app: tauri::AppHandle,
    effect_type: String, // "compression" or "noise_reduction"
    // Compression params (optional):
    threshold_db: Option<f32>,
    ratio: Option<f32>,
    attack_ms: Option<f32>,
    release_ms: Option<f32>,
    makeup_gain_db: Option<f32>,
    // Noise reduction params (optional):
    strength: Option<f32>,
) -> Result<(), String> {
    let mut engine = state.0.lock();
    let source = engine.source_samples.as_ref().ok_or("No audio loaded")?;
    let channels = engine.channels;
    let sample_rate = engine.sample_rate;

    // Apply current EDL first, then apply the preview effect
    let rendered = engine.edl.apply_edits(source, channels, sample_rate);

    let processed = match effect_type.as_str() {
        "compression" => {
            let params = processor::CompressionParams {
                threshold_db: threshold_db.unwrap_or(-20.0),
                ratio: ratio.unwrap_or(4.0),
                attack_ms: attack_ms.unwrap_or(10.0),
                release_ms: release_ms.unwrap_or(100.0),
                makeup_gain_db: makeup_gain_db.unwrap_or(0.0),
            };
            processor::compress(&rendered, channels, sample_rate, &params)
        }
        "noise_reduction" => {
            processor::noise_reduce(&rendered, channels, sample_rate, strength.unwrap_or(0.7))
                .map_err(|e| format!("Noise reduction failed: {e}"))?
        }
        _ => return Err(format!("Unknown effect type: {effect_type}")),
    };

    engine.preview_samples = Some(processed);
    Ok(())
}

#[tauri::command]
fn stop_preview(state: tauri::State<'_, AudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock();
    engine.preview_samples = None;
    Ok(())
}
```

**Step 5: Update playback to support preview buffer**

Modify the `play_audio` command to accept an optional `use_preview: bool` parameter. When true and `preview_samples` is `Some`, play from the preview buffer instead of rendering from EDL.

**Step 6: Register commands in lib.rs**

Add `commands::preview_effect`, `commands::stop_preview` to the invoke_handler.

**Step 7: Commit**

```bash
git add api/src/
git commit -m "feat: add preview_effect command for A/B audio comparison"
```

### Task 1.3: Add `preview_export` command

Encodes a short section of audio to a temp MP3 file for quality preview.

**Files:**
- Modify: `api/src/commands.rs` — add `preview_export` command
- Modify: `api/src/lib.rs` — register command

**Step 1: Write test for export with small buffer**

Add to existing exporter tests or create a new test:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_small_buffer() {
        let sample_rate = 44100u32;
        let samples: Vec<f32> = (0..44100) // 1 second mono
            .map(|i| 0.5 * (2.0 * std::f32::consts::PI * 440.0 * i as f32 / sample_rate as f32).sin())
            .collect();
        let params = ExportParams {
            bitrate: 128,
            cbr: true,
            vbr_quality: None,
            normalize: false,
            normalize_target_db: None,
        };
        let tmp = std::env::temp_dir().join("provcast_test_preview.mp3");
        let result = export_mp3(&samples, 1, sample_rate, &params, tmp.to_str().unwrap(), None, |_| {});
        assert!(result.is_ok());
        let r = result.unwrap();
        assert!(r.size_bytes > 0);
        // Clean up
        let _ = std::fs::remove_file(&tmp);
    }
}
```

**Step 2: Run test**

```bash
cargo test --manifest-path api/Cargo.toml -- test_export_small
```

**Step 3: Implement preview_export command**

In `api/src/commands.rs`:
```rust
#[tauri::command]
fn preview_export(
    state: tauri::State<'_, AudioEngineState>,
    bitrate: u32,
    cbr: bool,
    vbr_quality: Option<u32>,
    sample_rate_out: u32,
    mono: bool,
    start: f64,
    end: f64,
) -> Result<String, String> {
    let engine = state.0.lock();
    let source = engine.source_samples.as_ref().ok_or("No audio loaded")?;
    let channels = engine.channels;
    let sample_rate = engine.sample_rate;

    // Render current EDL state
    let rendered = engine.edl.apply_edits(source, channels, sample_rate);
    let ch = channels as usize;

    // Extract the requested region
    let start_frame = (start * sample_rate as f64) as usize;
    let end_frame = (end * sample_rate as f64) as usize;
    let start_idx = (start_frame * ch).min(rendered.len());
    let end_idx = (end_frame * ch).min(rendered.len());
    let region_samples = &rendered[start_idx..end_idx];

    // Export to temp file
    let tmp_path = std::env::temp_dir().join("provcast_preview.mp3");
    let params = exporter::ExportParams {
        bitrate,
        cbr,
        vbr_quality,
        normalize: false,
        normalize_target_db: None,
    };

    let out_channels = if mono { 1 } else { channels };
    // If converting to mono, mix down
    let final_samples = if mono && channels > 1 {
        region_samples.chunks(ch)
            .map(|frame| frame.iter().sum::<f32>() / ch as f32)
            .collect::<Vec<_>>()
    } else {
        region_samples.to_vec()
    };

    let out_rate = if sample_rate_out != sample_rate { sample_rate_out } else { sample_rate };

    exporter::export_mp3(
        &final_samples,
        out_channels,
        out_rate,
        &params,
        tmp_path.to_str().unwrap(),
        None,
        |_| {},
    )?;

    Ok(tmp_path.to_string_lossy().to_string())
}
```

**Step 4: Register in lib.rs**

**Step 5: Commit**

```bash
git add api/src/
git commit -m "feat: add preview_export command for encoding quality preview"
```

### Task 1.4: Backend tests for existing processing functions

**Files:**
- Modify: `api/src/audio/processor.rs` — add tests module
- Modify: `api/src/audio/editor.rs` — add tests module

**Step 1: Add processor tests**

Add comprehensive tests for `compress`, `detect_silence`, and `noise_reduce` to `api/src/audio/processor.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn sine_wave(freq: f32, duration_secs: f32, sample_rate: u32) -> Vec<f32> {
        (0..((duration_secs * sample_rate as f32) as usize))
            .map(|i| 0.5 * (2.0 * std::f32::consts::PI * freq * i as f32 / sample_rate as f32).sin())
            .collect()
    }

    #[test]
    fn test_compress_reduces_dynamic_range() {
        let samples = sine_wave(440.0, 1.0, 44100);
        let params = CompressionParams {
            threshold_db: -20.0,
            ratio: 4.0,
            attack_ms: 10.0,
            release_ms: 100.0,
            makeup_gain_db: 0.0,
        };
        let result = compress(&samples, 1, 44100, &params);
        assert_eq!(result.len(), samples.len());
        // Peak should be lower after compression (no makeup gain)
        let original_peak: f32 = samples.iter().map(|s| s.abs()).fold(0.0, f32::max);
        let compressed_peak: f32 = result.iter().map(|s| s.abs()).fold(0.0, f32::max);
        assert!(compressed_peak <= original_peak);
    }

    #[test]
    fn test_detect_silence_finds_gaps() {
        let mut samples = sine_wave(440.0, 1.0, 44100);
        // Insert 0.5s of silence
        samples.extend(vec![0.0f32; 22050]);
        samples.extend(sine_wave(440.0, 1.0, 44100));

        let regions = detect_silence(&samples, 1, 44100, -40.0, 0.3);
        assert!(!regions.is_empty());
        // The silence should be around the 1.0-1.5s mark
        assert!(regions[0].start >= 0.9 && regions[0].start <= 1.1);
    }

    #[test]
    fn test_detect_silence_empty_audio() {
        let regions = detect_silence(&[], 1, 44100, -40.0, 0.3);
        assert!(regions.is_empty());
    }
}
```

**Step 2: Add editor tests**

Add tests to `api/src/audio/editor.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edl_delete_region() {
        let edl = EditDecisionList::new();
        // ... test delete reduces duration
    }

    #[test]
    fn test_edl_undo_redo() {
        let mut edl = EditDecisionList::new();
        edl.add_edit(EditOp::Delete { start: 1.0, end: 2.0 });
        assert!(edl.undo().is_some());
        assert!(edl.redo().is_some());
    }

    #[test]
    fn test_edl_apply_delete() {
        let mut edl = EditDecisionList::new();
        // 1 second of samples at 4 samples/sec, 1 channel = 4 samples
        let source = vec![0.1, 0.2, 0.3, 0.4];
        edl.add_edit(EditOp::Delete { start: 0.25, end: 0.5 });
        let result = edl.apply_edits(&source, 1, 4);
        // Should have deleted 1 sample (frame at index 1)
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_edl_apply_silence() {
        let mut edl = EditDecisionList::new();
        let source = vec![0.5, 0.5, 0.5, 0.5];
        edl.add_edit(EditOp::Silence { start: 0.25, end: 0.5 });
        let result = edl.apply_edits(&source, 1, 4);
        assert_eq!(result.len(), 4); // Same length
        assert_eq!(result[1], 0.0); // Silenced
    }
}
```

**Step 3: Run all backend tests**

```bash
cargo test --manifest-path api/Cargo.toml
```
Expected: All pass.

**Step 4: Commit**

```bash
git add api/src/
git commit -m "test: add tests for processor and editor modules"
```

---

## Phase 2: Frontend — State & Hooks

### Task 2.1: Update UI store for wizard state

**Files:**
- Modify: `app/stores/ui-store.ts`
- Create: `app/stores/__tests__/ui-store.test.ts`

**Step 1: Write test**

Create `app/stores/__tests__/ui-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

describe("UI Store", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState());
  });

  it("initializes with step 1 and no file loaded", () => {
    const state = useUIStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.fileLoaded).toBe(false);
  });

  it("setCurrentStep changes the step", () => {
    useUIStore.getState().setCurrentStep(3);
    expect(useUIStore.getState().currentStep).toBe(3);
  });

  it("setFileLoaded updates fileLoaded", () => {
    useUIStore.getState().setFileLoaded(true);
    expect(useUIStore.getState().fileLoaded).toBe(true);
  });

  it("zoom controls work", () => {
    const initial = useUIStore.getState().zoom;
    useUIStore.getState().zoomIn();
    expect(useUIStore.getState().zoom).toBeGreaterThan(initial);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- ui-store
```

**Step 3: Rewrite ui-store.ts**

Replace `app/stores/ui-store.ts` with:
```ts
import { create } from "zustand";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface UIState {
  currentStep: WizardStep;
  fileLoaded: boolean;
  zoom: number;
  setCurrentStep: (step: WizardStep) => void;
  setFileLoaded: (loaded: boolean) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  currentStep: 1,
  fileLoaded: false,
  zoom: 1,
  setCurrentStep: (step) => set({ currentStep: step }),
  setFileLoaded: (loaded) => set({ fileLoaded: loaded }),
  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(500, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(500, s.zoom * 1.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(1, s.zoom / 1.25) })),
}));
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- ui-store
```

**Step 5: Commit**

```bash
git add app/stores/
git commit -m "refactor: update UI store for wizard step state"
```

### Task 2.2: Update Audio store

**Files:**
- Modify: `app/stores/audio-store.ts`
- Create: `app/stores/__tests__/audio-store.test.ts`

**Step 1: Write test**

Create `app/stores/__tests__/audio-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "../audio-store";

describe("Audio Store", () => {
  beforeEach(() => {
    useAudioStore.setState(useAudioStore.getInitialState());
  });

  it("initializes with no file", () => {
    const state = useAudioStore.getState();
    expect(state.filePath).toBeNull();
    expect(state.previewMode).toBeNull();
    expect(state.detectedSilenceRegions).toEqual([]);
  });

  it("setPreviewMode toggles A/B", () => {
    useAudioStore.getState().setPreviewMode("processed");
    expect(useAudioStore.getState().previewMode).toBe("processed");
    useAudioStore.getState().setPreviewMode(null);
    expect(useAudioStore.getState().previewMode).toBeNull();
  });

  it("setDetectedSilenceRegions stores regions", () => {
    const regions = [{ start: 1.0, end: 2.0 }];
    useAudioStore.getState().setDetectedSilenceRegions(regions);
    expect(useAudioStore.getState().detectedSilenceRegions).toEqual(regions);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- audio-store
```

**Step 3: Add new fields to audio-store.ts**

Add to `AudioState` interface:
```ts
previewMode: "original" | "processed" | null;
detectedSilenceRegions: { start: number; end: number }[];
compressionApplied: boolean;
noiseReductionApplied: boolean;
```

Add actions:
```ts
setPreviewMode: (mode: "original" | "processed" | null) => void;
setDetectedSilenceRegions: (regions: { start: number; end: number }[]) => void;
setCompressionApplied: (applied: boolean) => void;
setNoiseReductionApplied: (applied: boolean) => void;
```

Add defaults and implementations in the store creator.

**Step 4: Run test**

```bash
pnpm test -- audio-store
```

**Step 5: Commit**

```bash
git add app/stores/
git commit -m "feat: add preview mode and silence regions to audio store"
```

### Task 2.3: Add new Tauri hook wrappers

**Files:**
- Modify: `app/hooks/use-tauri-audio.ts`
- Create: `app/hooks/__tests__/use-tauri-audio.test.ts`

**Step 1: Write test for new functions**

Create `app/hooks/__tests__/use-tauri-audio.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { findQuietestRegion, previewEffect, stopPreview, previewExport } from "../use-tauri-audio";

// The mock is handled by the vitest alias in vitest.config.ts

describe("Tauri Audio Hooks - new commands", () => {
  it("findQuietestRegion is a function", () => {
    expect(typeof findQuietestRegion).toBe("function");
  });

  it("previewEffect is a function", () => {
    expect(typeof previewEffect).toBe("function");
  });

  it("stopPreview is a function", () => {
    expect(typeof stopPreview).toBe("function");
  });

  it("previewExport is a function", () => {
    expect(typeof previewExport).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- use-tauri-audio
```

**Step 3: Add wrapper functions**

Add to `app/hooks/use-tauri-audio.ts`:
```ts
export async function findQuietestRegion(minDurationSecs: number): Promise<SilenceRegion | null> {
  return invoke("find_quietest_region", { minDurationSecs });
}

export async function previewEffect(
  effectType: "compression" | "noise_reduction",
  params: {
    thresholdDb?: number;
    ratio?: number;
    attackMs?: number;
    releaseMs?: number;
    makeupGainDb?: number;
    strength?: number;
  },
): Promise<void> {
  return invoke("preview_effect", {
    effectType,
    ...params,
  });
}

export async function stopPreview(): Promise<void> {
  return invoke("stop_preview");
}

export async function previewExport(params: {
  bitrate: number;
  cbr: boolean;
  vbrQuality?: number;
  sampleRateOut: number;
  mono: boolean;
  start: number;
  end: number;
}): Promise<string> {
  return invoke("preview_export", params);
}
```

**Step 4: Run test**

```bash
pnpm test -- use-tauri-audio
```

**Step 5: Commit**

```bash
git add app/hooks/
git commit -m "feat: add Tauri hook wrappers for preview and quietest region commands"
```

---

## Phase 3: Frontend — Layout Shell

### Task 3.1: Create wizard layout and step sidebar

**Files:**
- Create: `app/components/wizard/wizard-layout.tsx`
- Create: `app/components/wizard/step-sidebar.tsx`
- Create: `app/components/wizard/__tests__/wizard-layout.test.tsx`
- Create: `app/components/wizard/__tests__/step-sidebar.test.tsx`

**Step 1: Write tests**

`app/components/wizard/__tests__/step-sidebar.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepSidebar } from "../step-sidebar";

describe("StepSidebar", () => {
  it("renders all 5 step labels", () => {
    render(<StepSidebar currentStep={1} onStepClick={() => {}} />);
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByText("Normalize")).toBeInTheDocument();
    expect(screen.getByText("Trim")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("highlights the current step", () => {
    render(<StepSidebar currentStep={3} onStepClick={() => {}} />);
    const trimStep = screen.getByText("Trim").closest("button");
    expect(trimStep).toHaveAttribute("data-active", "true");
  });

  it("calls onStepClick when a step is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StepSidebar currentStep={1} onStepClick={onClick} />);
    await user.click(screen.getByText("Export"));
    expect(onClick).toHaveBeenCalledWith(5);
  });
});
```

`app/components/wizard/__tests__/wizard-layout.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardLayout } from "../wizard-layout";

describe("WizardLayout", () => {
  it("renders waveform area and wizard area", () => {
    render(
      <WizardLayout
        waveform={<div data-testid="waveform">Waveform</div>}
        controls={<div data-testid="controls">Controls</div>}
      >
        <div data-testid="step-content">Step Content</div>
      </WizardLayout>,
    );
    expect(screen.getByTestId("waveform")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByTestId("step-content")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test -- wizard
```

**Step 3: Implement StepSidebar**

Create `app/components/wizard/step-sidebar.tsx`:
```tsx
import { type WizardStep } from "@/stores/ui-store";
import { FileAudio, SlidersHorizontal, Scissors, Tag, Download } from "lucide-react";

const steps = [
  { step: 1 as WizardStep, label: "File", icon: FileAudio },
  { step: 2 as WizardStep, label: "Normalize", icon: SlidersHorizontal },
  { step: 3 as WizardStep, label: "Trim", icon: Scissors },
  { step: 4 as WizardStep, label: "Metadata", icon: Tag },
  { step: 5 as WizardStep, label: "Export", icon: Download },
];

interface StepSidebarProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export function StepSidebar({ currentStep, onStepClick }: StepSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 w-20 border-r p-2">
      {steps.map(({ step, label, icon: Icon }) => (
        <button
          key={step}
          data-active={currentStep === step}
          onClick={() => onStepClick(step)}
          className="flex flex-col items-center gap-1 rounded-md p-2 text-xs
            data-[active=true]:bg-accent data-[active=true]:text-accent-foreground
            hover:bg-muted transition-colors"
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
```

**Step 4: Implement WizardLayout**

Create `app/components/wizard/wizard-layout.tsx`:
```tsx
import { type ReactNode } from "react";

interface WizardLayoutProps {
  waveform: ReactNode;
  controls: ReactNode;
  children: ReactNode;
}

export function WizardLayout({ waveform, controls, children }: WizardLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* Top half: waveform */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">{waveform}</div>
        <div className="shrink-0">{controls}</div>
      </div>
      {/* Bottom half: wizard */}
      <div className="flex-1 min-h-0 border-t">{children}</div>
    </div>
  );
}
```

**Step 5: Run tests**

```bash
pnpm test -- wizard
```

**Step 6: Commit**

```bash
git add app/components/wizard/
git commit -m "feat: add wizard layout shell and step sidebar"
```

### Task 3.2: Update root route and index to use wizard layout

**Files:**
- Modify: `app/routes/__root.tsx` — remove Toolbar, use simple Outlet
- Modify: `app/routes/index.tsx` — replace flat layout with WizardLayout

**Step 1: Update __root.tsx**

Remove Toolbar import and rendering. Root layout becomes just `<Outlet />`.

**Step 2: Rewrite index.tsx**

Replace the current EditorView with the wizard-based layout:
```tsx
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { StepSidebar } from "@/components/wizard/step-sidebar";
import { WaveformEditor } from "@/components/waveform-editor";
import { AudioControls } from "@/components/audio-controls";
import { FileSelectStep } from "@/components/steps/file-select-step";
import { NormalizationStep } from "@/components/steps/normalization-step";
import { TrimmingStep } from "@/components/steps/trimming-step";
import { MetadataStep } from "@/components/steps/metadata-step";
import { ExportStep } from "@/components/steps/export-step";
import { useUIStore } from "@/stores/ui-store";
import { useAudioStore } from "@/stores/audio-store";

function EditorView() {
  const currentStep = useUIStore((s) => s.currentStep);
  const setCurrentStep = useUIStore((s) => s.setCurrentStep);
  const fileLoaded = useUIStore((s) => s.fileLoaded);

  const StepContent = () => {
    switch (currentStep) {
      case 1: return <FileSelectStep />;
      case 2: return <NormalizationStep />;
      case 3: return <TrimmingStep />;
      case 4: return <MetadataStep />;
      case 5: return <ExportStep />;
    }
  };

  return (
    <WizardLayout
      waveform={fileLoaded ? <WaveformEditor /> : <div />}
      controls={fileLoaded ? <AudioControls /> : <div />}
    >
      {fileLoaded ? (
        <div className="flex h-full">
          <StepSidebar currentStep={currentStep} onStepClick={setCurrentStep} />
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <StepContent />
          </div>
        </div>
      ) : (
        <FileSelectStep />
      )}
    </WizardLayout>
  );
}
```

**Step 3: Run `pnpm exec tsc -b --noEmit`** to check types compile (step components don't exist yet — create empty stubs first).

**Step 4: Commit**

```bash
git add app/routes/ app/components/
git commit -m "refactor: replace flat layout with wizard-based layout"
```

---

## Phase 4: Step Components

### Task 4.1: File Select step

**Files:**
- Create: `app/components/steps/file-select-step.tsx`
- Create: `app/components/steps/__tests__/file-select-step.test.tsx`

**Step 1: Write test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileSelectStep } from "../file-select-step";

describe("FileSelectStep", () => {
  it("shows drop zone when no file loaded", () => {
    render(<FileSelectStep />);
    expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument();
  });

  it("shows supported formats", () => {
    render(<FileSelectStep />);
    expect(screen.getByText(/mp3.*wav.*flac.*ogg.*aiff/i)).toBeInTheDocument();
  });
});
```

**Step 2: Implement**

The component shows a centered drop zone with click-to-browse using the Tauri file dialog. When a file is loaded, it shows file info and a "Load different file" button. On successful load, it calls `useUIStore.getState().setFileLoaded(true)` and `setCurrentStep(2)`.

Port the file-open logic from the existing `toolbar.tsx` (lines 32-52).

**Step 3: Run tests, commit**

```bash
pnpm test -- file-select
git add app/components/steps/
git commit -m "feat: add file selection step component"
```

### Task 4.2: Normalization step

**Files:**
- Create: `app/components/steps/normalization-step.tsx`
- Create: `app/components/steps/__tests__/normalization-step.test.tsx`

**Step 1: Write test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NormalizationStep } from "../normalization-step";

describe("NormalizationStep", () => {
  it("renders compression section", () => {
    render(<NormalizationStep />);
    expect(screen.getByText(/compression/i)).toBeInTheDocument();
  });

  it("renders noise reduction section", () => {
    render(<NormalizationStep />);
    expect(screen.getByText(/noise reduction/i)).toBeInTheDocument();
  });

  it("shows default compression values", () => {
    render(<NormalizationStep />);
    // Should show default threshold, ratio, etc.
    expect(screen.getByText(/-20/)).toBeInTheDocument(); // threshold
    expect(screen.getByText(/4:1/)).toBeInTheDocument(); // ratio
  });

  it("shows A/B toggle buttons", () => {
    render(<NormalizationStep />);
    const toggles = screen.getAllByText(/original|processed/i);
    expect(toggles.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Implement**

Two card sections (Compression, Noise Reduction), each with:
- Parameter sliders (port from existing `processing-panel.tsx` lines 87-194)
- A/B toggle button group that calls `previewEffect()` / `stopPreview()`
- Apply button that calls `applyCompression()` / `applyNoiseReduction()`
- Status badge (applied/not applied)

For noise reduction: on mount, call `findQuietestRegion(0.5)` and highlight the result on the waveform. Show the region info and "Use this region" / "Select manually" buttons.

**Step 3: Run tests, commit**

```bash
pnpm test -- normalization
git add app/components/steps/
git commit -m "feat: add normalization step with A/B preview"
```

### Task 4.3: Trimming step

**Files:**
- Create: `app/components/steps/trimming-step.tsx`
- Create: `app/components/steps/__tests__/trimming-step.test.tsx`

**Step 1: Write test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrimmingStep } from "../trimming-step";

describe("TrimmingStep", () => {
  it("renders delete and play selection buttons", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/delete selection/i)).toBeInTheDocument();
    expect(screen.getByText(/play selection/i)).toBeInTheDocument();
  });

  it("renders silence detection section", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/silence detection/i)).toBeInTheDocument();
    expect(screen.getByText(/detect silence/i)).toBeInTheDocument();
  });

  it("renders undo/redo buttons", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/undo/i)).toBeInTheDocument();
    expect(screen.getByText(/redo/i)).toBeInTheDocument();
  });

  it("shows duration stats", () => {
    render(<TrimmingStep />);
    expect(screen.getByText(/original/i)).toBeInTheDocument();
    expect(screen.getByText(/final/i)).toBeInTheDocument();
  });
});
```

**Step 2: Implement**

Three sections:
1. **Manual trim** — Delete Selection + Play Selection buttons. Uses `selectedRegion` from audio store and calls `deleteRegion()`.
2. **Silence detection** — Threshold slider (-60 to -20 dB, default -40), Min Duration slider (0.1 to 3.0s, default 1.0s), Detect Silence button. Results as a checklist with checkboxes. Click to scroll waveform. "Trim Selected" and "Clear All" buttons.
3. **Edit history + undo/redo** — List of operations, Undo/Redo buttons, duration stats.

Port silence detection logic from existing `processing-panel.tsx` (lines 199-267).

**Step 3: Run tests, commit**

```bash
pnpm test -- trimming
git add app/components/steps/
git commit -m "feat: add trimming step with silence detection"
```

### Task 4.4: Metadata step

**Files:**
- Create: `app/components/steps/metadata-step.tsx`
- Create: `app/components/steps/__tests__/metadata-step.test.tsx`

**Step 1: Write test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetadataStep } from "../metadata-step";

describe("MetadataStep", () => {
  it("renders all metadata fields", () => {
    render(<MetadataStep />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/album/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/genre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
  });

  it("renders album art section", () => {
    render(<MetadataStep />);
    expect(screen.getByText(/album art/i)).toBeInTheDocument();
    expect(screen.getByText(/choose image/i)).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<MetadataStep />);
    expect(screen.getByText(/save metadata/i)).toBeInTheDocument();
  });
});
```

**Step 2: Implement**

Port directly from existing `metadata-editor.tsx` and `album-art-editor.tsx`. Consolidate into a single component. Album art at the top with preview + choose/remove. Input fields for all ID3 fields. Save button calls `updateMetadata()`.

**Step 3: Run tests, commit**

```bash
pnpm test -- metadata
git add app/components/steps/
git commit -m "feat: add metadata step component"
```

### Task 4.5: Export step

**Files:**
- Create: `app/components/steps/export-step.tsx`
- Create: `app/components/steps/__tests__/export-step.test.tsx`

**Step 1: Write test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportStep } from "../export-step";

describe("ExportStep", () => {
  it("renders format display", () => {
    render(<ExportStep />);
    expect(screen.getByText(/mp3/i)).toBeInTheDocument();
  });

  it("renders CBR/VBR toggle", () => {
    render(<ExportStep />);
    expect(screen.getByText(/cbr/i)).toBeInTheDocument();
    expect(screen.getByText(/vbr/i)).toBeInTheDocument();
  });

  it("renders bitrate options", () => {
    render(<ExportStep />);
    // Default CBR mode should show bitrate selector
    expect(screen.getByText(/128/)).toBeInTheDocument();
  });

  it("renders sample rate and channel options", () => {
    render(<ExportStep />);
    expect(screen.getByText(/44100/)).toBeInTheDocument();
    expect(screen.getByText(/mono/i)).toBeInTheDocument();
  });

  it("renders estimated file size", () => {
    render(<ExportStep />);
    expect(screen.getByText(/estimated/i)).toBeInTheDocument();
  });

  it("renders export button", () => {
    render(<ExportStep />);
    expect(screen.getByText(/^export$/i)).toBeInTheDocument();
  });

  it("renders preview button", () => {
    render(<ExportStep />);
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
  });
});
```

**Step 2: Implement**

Port from existing `export-dialog.tsx`. Key changes:
- Not a dialog — inline step content
- CBR bitrate options expanded: 24, 32, 48, 64, 96, 128, 160, 192, 256, 320 kbps
- Add "Preview at these settings" button that calls `previewExport()` and plays the result
- Size estimate updates on any param change via `estimateExportSize()`
- Export button opens save dialog, shows progress bar with `export-progress` event listener

**Step 3: Run tests, commit**

```bash
pnpm test -- export-step
git add app/components/steps/
git commit -m "feat: add export step with preview and extended bitrates"
```

---

## Phase 5: Waveform Enhancements

### Task 5.1: Add grayed-out deleted regions to waveform

**Files:**
- Modify: `app/components/waveform-editor.tsx`

**Step 1: Implement grayed-out regions**

Use wavesurfer.js RegionsPlugin to render deleted regions as semi-transparent gray overlays. When the EDL has delete operations, compute their time ranges and add non-interactive regions with a gray color + low opacity.

Add a new prop or store subscription: read `deletedRegions` from the audio store. On each change, clear old gray regions and re-add them.

The waveform already uses RegionsPlugin for selection — add a second set of regions with a different color and `drag: false, resize: false` to prevent interaction.

**Step 2: Test manually** — load a file, delete a region in the trimming step, verify the waveform shows it grayed out.

**Step 3: Commit**

```bash
git add app/components/waveform-editor.tsx
git commit -m "feat: show deleted regions as grayed-out overlays on waveform"
```

### Task 5.2: Add context-specific waveform overlays

**Files:**
- Modify: `app/components/waveform-editor.tsx`

**Step 1: Implement step-aware overlays**

- When on step 2 (Normalization) and a noise sample region is selected: show it in blue
- When on step 3 (Trimming) and silence detection results exist: show them in orange
- Clear context overlays when switching steps

Subscribe to `useUIStore` `currentStep` and relevant audio store fields.

**Step 2: Commit**

```bash
git add app/components/waveform-editor.tsx
git commit -m "feat: add context-specific waveform overlays per wizard step"
```

---

## Phase 6: Keyboard Shortcuts & Cleanup

### Task 6.1: Update keyboard shortcuts

**Files:**
- Modify: `app/hooks/use-keyboard-shortcuts.ts`

**Step 1: Update shortcuts**

- Remove Ctrl+O (file open is in step 1 now)
- Remove Ctrl+E (export is in step 5 now)
- Keep Space (play/pause), Escape (stop), Delete (delete region), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+=/- (zoom)
- Move `useKeyboardShortcuts()` call from toolbar to the wizard layout or root route

**Step 2: Commit**

```bash
git add app/hooks/use-keyboard-shortcuts.ts
git commit -m "refactor: simplify keyboard shortcuts for wizard layout"
```

### Task 6.2: Remove old components

**Files:**
- Delete: `app/components/toolbar.tsx`
- Delete: `app/components/processing-panel.tsx`
- Delete: `app/components/metadata-editor.tsx`
- Delete: `app/components/album-art-editor.tsx`
- Delete: `app/components/export-dialog.tsx`

**Step 1: Remove files and any remaining imports**

Search for imports of these components and remove them. Verify no references remain.

**Step 2: Run TypeScript check and tests**

```bash
pnpm exec tsc -b --noEmit && pnpm test
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old flat-layout components replaced by wizard steps"
```

---

## Phase 7: Integration Testing

### Task 7.1: Frontend integration tests

**Files:**
- Create: `app/test/integration/wizard-flow.test.tsx`

**Step 1: Write integration test**

Test the wizard flow end-to-end (with mocked Tauri commands):
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Import the main app or EditorView component

describe("Wizard Flow", () => {
  it("shows file drop zone on initial load", () => {
    // Render the app
    // Assert drop zone is visible
  });

  it("navigates between steps after file load", async () => {
    // Mock a file being loaded
    // Click each step in sidebar
    // Assert correct content renders
  });

  it("step sidebar is hidden before file load", () => {
    // Render without file
    // Assert sidebar is not visible
  });
});
```

**Step 2: Run tests**

```bash
pnpm test
```

**Step 3: Commit**

```bash
git add app/test/
git commit -m "test: add wizard flow integration tests"
```

### Task 7.2: Run full CI checks locally

**Step 1: Run all checks**

```bash
# Frontend
pnpm exec tsc -b --noEmit
pnpm lint
pnpm format:check
pnpm test

# Backend
cargo fmt --manifest-path api/Cargo.toml -- --check
cargo clippy --manifest-path api/Cargo.toml -- -D warnings
cargo test --manifest-path api/Cargo.toml
cargo build --manifest-path api/Cargo.toml
```

**Step 2: Fix any issues**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: ensure all CI checks pass"
```

---

## Summary of All Tasks

| Phase | Task | Description |
|-------|------|-------------|
| 0.1 | ESLint + Prettier | Frontend linting/formatting setup |
| 0.2 | Vitest + Testing Library | Frontend testing infrastructure |
| 0.3 | GitHub Actions CI | CI workflow for both frontend + backend |
| 1.1 | find_quietest_region | Rust command for noise sample auto-detection |
| 1.2 | preview_effect | Rust command for A/B audio preview |
| 1.3 | preview_export | Rust command for export quality preview |
| 1.4 | Backend tests | Tests for processor and editor modules |
| 2.1 | UI store update | Wizard step state |
| 2.2 | Audio store update | Preview mode, silence regions |
| 2.3 | New hook wrappers | Frontend wrappers for new Rust commands |
| 3.1 | Wizard layout + sidebar | Layout shell components |
| 3.2 | Route update | Swap flat layout for wizard |
| 4.1 | File Select step | Drop zone + file info |
| 4.2 | Normalization step | Compression + noise reduction with A/B |
| 4.3 | Trimming step | Manual trim + silence detection |
| 4.4 | Metadata step | ID3 fields + album art |
| 4.5 | Export step | Encoding options + preview + export |
| 5.1 | Grayed-out regions | Waveform deleted region overlays |
| 5.2 | Context overlays | Step-specific waveform highlights |
| 6.1 | Keyboard shortcuts | Update for wizard layout |
| 6.2 | Remove old components | Clean up replaced components |
| 7.1 | Integration tests | Wizard flow end-to-end tests |
| 7.2 | Full CI verification | Run all checks locally |
