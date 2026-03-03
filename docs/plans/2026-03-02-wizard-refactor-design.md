# Provcast Wizard Refactor Design

## Overview

Refactor the Provcast UI from a flat single-view editor into a multi-step wizard that guides users through processing and exporting a podcast audio file. The waveform stays persistent in the top half; the bottom half hosts a step-based wizard panel.

## Design Decisions

- **Navigation:** Free navigation between steps once a file is loaded (no gating)
- **Preview:** A/B toggle for compression and noise reduction (switch between original and processed audio while playing)
- **Noise sample:** Auto-detect quiet section via silence detection, with manual override
- **Trim display:** Grayed in-place on waveform, but playback skips deleted regions
- **Export:** MP3 only for now
- **Toolbar:** Removed. All actions merged into wizard steps (file open in step 1, undo/redo in step 3, etc.)

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOP HALF — WAVEFORM                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Waveform (wavesurfer.js)                                 │  │
│  │  - Minimap, timeline, regions                             │  │
│  │  - Grayed-out deleted regions                             │  │
│  │  - Color-coded overlays per step context                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [Play/Pause] [Stop]  00:00.00 / 10:00.00   [Zoom -][Zoom +]  │
├─────────────────────────────────────────────────────────────────┤
│  BOTTOM HALF — WIZARD                                           │
│  ┌──────────┬──────────────────────────────────────────────┐    │
│  │ STEPS    │  STEP CONTENT                                │    │
│  │          │                                              │    │
│  │ 1. File  │  (varies per step)                           │    │
│  │ 2. Norm  │                                              │    │
│  │ 3. Trim  │                                              │    │
│  │ 4. Meta  │                                              │    │
│  │ 5. Export│                                              │    │
│  └──────────┴──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

- Top/bottom split (approximately 50/50)
- Playback controls and zoom in a strip between waveform and wizard
- Step sidebar: narrow, icons + short labels, always visible once a file is loaded
- Step sidebar hidden before a file is loaded

## Step 1: File Selection

Before a file is loaded, the entire bottom half shows a centered drop zone:

- Drag-and-drop or click-to-browse (Tauri file dialog)
- Supports MP3, WAV, FLAC, OGG, AIFF
- Once loaded, shows file info (name, duration, format, sample rate, channels) and "Load different file"
- Loading a file auto-advances to step 2
- Waveform area is blank until a file is loaded

## Step 2: Normalization

Two independent sub-sections: Compression and Noise Reduction. Either can be applied in any order.

### Compression

- Sane podcast defaults: threshold -20dB, ratio 4:1, attack 10ms, release 100ms, makeup gain 0dB
- All parameters adjustable via sliders
- A/B toggle: switch between original and compressed while playing
- "Apply" commits to the EDL
- Status badge shows applied/not applied; undo available if applied

### Noise Reduction

- On entering step, auto-run silence detection to find quietest region
- Highlight suggested region on waveform (distinct color, e.g. blue)
- User can accept or select a different region manually
- Strength slider (0-1)
- A/B toggle same as compression
- "Apply" commits to the EDL

### A/B Preview Backend

- New Rust command: `preview_effect(effect_type, params, region?)` applies effect to a temporary buffer and plays it without modifying the EDL
- Toggle switches playback source between original and preview buffer

## Step 3: Manual Trimming

- Select regions on waveform by click-and-drag (existing RegionsPlugin)
- "Delete Selection" and "Play Selection" buttons
- Deleted regions render as grayed-out (semi-transparent) overlays, preserving position
- Playback skips deleted regions (EDL handles this)

### Silence Detection

- Threshold slider (default -40dB) and min duration slider (default 1.0s)
- "Detect Silence" runs `detect_silence`, highlights found regions on waveform (orange)
- Results as a checklist — all checked by default, user can uncheck any to keep
- Clicking a region in the list scrolls/zooms waveform to it
- "Trim Selected" applies all checked regions as a single batch EDL operation (one undo reverts all)
- "Clear All" removes highlights without trimming

### Edit History

- Log of deletions with timestamps and durations
- Undo/Redo buttons (keyboard shortcuts still work)
- Running stats: original duration, total trimmed, final duration

## Step 4: Metadata

- Fields pre-populated from existing ID3 tags if present
- Album art: preview thumbnail, choose/remove buttons (Tauri file dialog)
- Fields: title, artist, album, genre, year, track number, comment, copyright, publisher, URL
- "Save Metadata" persists to audio store state; actual ID3 embedding at export time
- All fields optional, no validation gates

## Step 5: Encoding & Export

- Format: MP3 (only option for now)
- Mode toggle: CBR or VBR
- CBR bitrates: 24 / 32 / 48 / 64 / 96 / 128 / 160 / 192 / 256 / 320 kbps
- VBR quality: 0-9 slider
- Sample rate: 44100 Hz or 48000 Hz
- Channels: Mono or Stereo
- Estimated file size updates live as settings change (uses `estimate_export_size`)
- Duration display

### Export Preview

- Select a region on waveform, hit "Preview at these settings"
- New Rust command: `preview_export(params, start, end)` encodes a short section to a temp file
- Frontend plays the temp MP3 via HTML audio element

### Export

- "Export" opens a save dialog, runs `export_mp3`
- Progress bar with percentage and stage info (uses `export-progress` event)
- On completion: success message with file path and size

## New Backend Work Required

1. `preview_effect(effect_type, params, region?)` — apply effect to temp buffer for A/B preview
2. `preview_export(params, start, end)` — encode a section to temp file for quality preview
3. Expand CBR bitrate options to include 24, 32, 48 kbps
4. Auto-detect quiet region (run `detect_silence` with conservative params, return quietest)

## Frontend Components (New/Modified)

### New
- `wizard-layout.tsx` — top/bottom split with step sidebar
- `step-sidebar.tsx` — step navigation with icons and labels
- `file-select-step.tsx` — drop zone and file info
- `normalization-step.tsx` — compression and noise reduction controls
- `trimming-step.tsx` — manual trim and silence detection
- `metadata-step.tsx` — ID3 fields and album art (extract from existing `metadata-editor.tsx`)
- `export-step.tsx` — encoding options, preview, and export

### Modified
- `waveform-editor.tsx` — add support for grayed-out regions, color-coded overlays per step
- `audio-controls.tsx` — relocate into the waveform strip area

### Removed
- `toolbar.tsx` — functionality distributed into wizard steps
- `processing-panel.tsx` — replaced by normalization step
- `metadata-editor.tsx` — replaced by metadata step
- `album-art-editor.tsx` — folded into metadata step
- `export-dialog.tsx` — replaced by export step

## State Changes

### UI Store additions
- `currentStep: 1 | 2 | 3 | 4 | 5`
- `fileLoaded: boolean` (drives whether step sidebar is visible)
- Remove: `showProcessingPanel`, `showMetadataPanel`, `exportDialogOpen`

### Audio Store additions
- `previewMode: 'original' | 'processed' | null` (for A/B toggle)
- `detectedSilenceRegions: SilenceRegion[]` (from silence detection)
- `deletedRegions: {start, end}[]` (for waveform graying)
