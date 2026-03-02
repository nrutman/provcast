use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::audio::decoder::{decode_file, generate_peaks};
use crate::audio::editor::EditOp;
use crate::audio::exporter::{self, ExportParams, ExportResult, SizeEstimate};
use crate::audio::processor::{self, CompressionParams, SilenceRegion};
use crate::audio::AudioEngineState;
use crate::metadata::id3::{self as id3_util, ArtInfo, Metadata};

// ── Serde types returned to the frontend ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInfo {
    /// Duration in seconds.
    pub duration: f64,
    /// Sample rate.
    pub sample_rate: u32,
    /// Number of channels.
    pub channels: u16,
    /// Format string.
    pub format: String,
    /// File name (stem).
    pub file_name: String,
    /// Full path.
    pub file_path: String,
    /// Interleaved [min, max] peak data at ~200/sec.
    pub peaks: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatedPeaks {
    /// New peak data after the edit.
    pub peaks: Vec<f32>,
    /// New duration after the edit.
    pub duration: f64,
}

// ── Audio loading ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn load_audio(
    path: String,
    state: State<'_, AudioEngineState>,
) -> Result<AudioInfo, String> {
    let (samples, sample_rate, channels, format) =
        decode_file(&path).map_err(|e| e.to_string())?;

    let total_frames = samples.len() / channels as usize;
    let duration = total_frames as f64 / sample_rate as f64;

    let peaks = generate_peaks(&samples, channels, sample_rate, 200.0);

    let file_name = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Store in engine state.
    let mut engine = state.0.lock();
    engine.source_samples = Some(samples);
    engine.sample_rate = sample_rate;
    engine.channels = channels;
    engine.format = format.clone();
    engine.file_path = Some(path.clone());
    engine.edl.clear();
    engine.playback.stop().ok();

    Ok(AudioInfo {
        duration,
        sample_rate,
        channels,
        format,
        file_name,
        file_path: path,
        peaks,
    })
}

// ── Playback ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn play_audio(
    from_position: f64,
    state: State<'_, AudioEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock();

    let rendered = engine
        .rendered_samples()
        .ok_or("No audio loaded")?;

    let sr = engine.sample_rate;
    let ch = engine.channels;

    engine
        .playback
        .play(&rendered, sr, ch, from_position)
}

#[tauri::command]
pub fn pause_audio(state: State<'_, AudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock();
    engine.playback.pause()
}

#[tauri::command]
pub fn stop_audio(state: State<'_, AudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock();
    engine.playback.stop()
}

#[tauri::command]
pub fn seek_audio(
    position: f64,
    state: State<'_, AudioEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock();

    let rendered = engine
        .rendered_samples()
        .ok_or("No audio loaded")?;

    let sr = engine.sample_rate;
    let ch = engine.channels;

    engine.playback.seek(position, &rendered, sr, ch)
}

#[tauri::command]
pub fn get_playback_position(
    state: State<'_, AudioEngineState>,
) -> Result<f64, String> {
    let engine = state.0.lock();
    Ok(engine.playback.get_position())
}

// ── Editing ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn delete_region(
    start: f64,
    end: f64,
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();
    let source = engine
        .source_samples
        .as_ref()
        .ok_or("No audio loaded")?
        .clone();

    engine.edl.add_edit(EditOp::Delete { start, end });

    let (peaks, duration) =
        engine
            .edl
            .recompute_peaks(&source, engine.channels, engine.sample_rate);

    Ok(UpdatedPeaks { peaks, duration })
}

#[tauri::command]
pub fn undo_edit(
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();
    let source = engine
        .source_samples
        .as_ref()
        .ok_or("No audio loaded")?
        .clone();

    engine.edl.undo().ok_or("Nothing to undo")?;

    let (peaks, duration) =
        engine
            .edl
            .recompute_peaks(&source, engine.channels, engine.sample_rate);

    Ok(UpdatedPeaks { peaks, duration })
}

#[tauri::command]
pub fn redo_edit(
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();
    let source = engine
        .source_samples
        .as_ref()
        .ok_or("No audio loaded")?
        .clone();

    engine.edl.redo().ok_or("Nothing to redo")?;

    let (peaks, duration) =
        engine
            .edl
            .recompute_peaks(&source, engine.channels, engine.sample_rate);

    Ok(UpdatedPeaks { peaks, duration })
}

// ── Audio Processing ────────────────────────────────────────────────────────

#[tauri::command]
pub fn apply_compression(
    params: CompressionParams,
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();

    let rendered = engine
        .rendered_samples()
        .ok_or("No audio loaded")?;

    let sr = engine.sample_rate;
    let ch = engine.channels;

    let processed =
        processor::compress(&rendered, ch, sr, &params);

    let duration = rendered.len() as f64 / (ch as f64 * sr as f64);

    // Store as a ProcessedAudio edit covering the entire file.
    engine.edl.add_edit(EditOp::ProcessedAudio {
        samples: processed,
        start: 0.0,
        end: duration,
    });

    let source = engine.source_samples.as_ref().unwrap().clone();
    let (peaks, new_duration) =
        engine.edl.recompute_peaks(&source, ch, sr);

    Ok(UpdatedPeaks {
        peaks,
        duration: new_duration,
    })
}

#[tauri::command]
pub fn apply_noise_reduction(
    strength: f32,
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();

    let rendered = engine
        .rendered_samples()
        .ok_or("No audio loaded")?;

    let sr = engine.sample_rate;
    let ch = engine.channels;

    let processed =
        processor::noise_reduce(&rendered, ch, sr, strength);

    let duration = rendered.len() as f64 / (ch as f64 * sr as f64);

    engine.edl.add_edit(EditOp::ProcessedAudio {
        samples: processed,
        start: 0.0,
        end: duration,
    });

    let source = engine.source_samples.as_ref().unwrap().clone();
    let (peaks, new_duration) =
        engine.edl.recompute_peaks(&source, ch, sr);

    Ok(UpdatedPeaks {
        peaks,
        duration: new_duration,
    })
}

#[tauri::command]
pub fn detect_silence(
    threshold_db: f32,
    min_duration_secs: f32,
    state: State<'_, AudioEngineState>,
) -> Result<Vec<SilenceRegion>, String> {
    let engine = state.0.lock();

    let rendered = engine
        .rendered_samples()
        .ok_or("No audio loaded")?;

    let sr = engine.sample_rate;
    let ch = engine.channels;

    Ok(processor::detect_silence(
        &rendered,
        ch,
        sr,
        threshold_db,
        min_duration_secs,
    ))
}

#[tauri::command]
pub fn trim_silence(
    regions: Vec<SilenceRegion>,
    keep_duration: f32,
    state: State<'_, AudioEngineState>,
) -> Result<UpdatedPeaks, String> {
    let mut engine = state.0.lock();

    // For each silence region, keep `keep_duration` seconds of silence and
    // delete the rest. Process in reverse order so offsets remain valid.
    let mut sorted_regions = regions.clone();
    sorted_regions.sort_by(|a, b| b.start.partial_cmp(&a.start).unwrap());

    for region in &sorted_regions {
        let silence_len = region.end - region.start;
        let keep = keep_duration as f64;
        if silence_len > keep {
            // Keep half at start, half at end.
            let half_keep = keep / 2.0;
            let delete_start = region.start + half_keep;
            let delete_end = region.end - half_keep;
            if delete_end > delete_start {
                engine
                    .edl
                    .add_edit(EditOp::Delete {
                        start: delete_start,
                        end: delete_end,
                    });
            }
        }
    }

    let source = engine
        .source_samples
        .as_ref()
        .ok_or("No audio loaded")?
        .clone();
    let ch = engine.channels;
    let sr = engine.sample_rate;

    let (peaks, duration) = engine.edl.recompute_peaks(&source, ch, sr);

    Ok(UpdatedPeaks { peaks, duration })
}

// ── Metadata ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_metadata(path: String) -> Result<Metadata, String> {
    id3_util::read_tags(&path)
}

#[tauri::command]
pub fn update_metadata(
    metadata: Metadata,
    state: State<'_, AudioEngineState>,
) -> Result<(), String> {
    let engine = state.0.lock();
    let path = engine
        .file_path
        .as_ref()
        .ok_or("No file loaded")?
        .clone();

    id3_util::write_tags(&path, &metadata)
}

#[tauri::command]
pub fn set_album_art(
    image_path: String,
    state: State<'_, AudioEngineState>,
) -> Result<ArtInfo, String> {
    let engine = state.0.lock();
    let path = engine
        .file_path
        .as_ref()
        .ok_or("No file loaded")?
        .clone();

    let (art_info, _meta) =
        id3_util::set_album_art(&path, &image_path)?;

    Ok(art_info)
}

// ── Export ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn estimate_export_size(
    params: ExportParams,
    state: State<'_, AudioEngineState>,
) -> Result<SizeEstimate, String> {
    let engine = state.0.lock();
    let duration = engine.edited_duration();

    Ok(exporter::estimate_size(duration, &params))
}

#[tauri::command]
pub fn export_mp3(
    params: ExportParams,
    output_path: String,
    state: State<'_, AudioEngineState>,
    app_handle: AppHandle,
) -> Result<ExportResult, String> {
    // Extract everything we need, then drop the lock so the UI stays
    // responsive during the (potentially long) encode.
    let (rendered, sr, ch, metadata) = {
        let engine = state.0.lock();

        let rendered = engine
            .rendered_samples()
            .ok_or("No audio loaded")?;

        let sr = engine.sample_rate;
        let ch = engine.channels;

        let metadata = engine
            .file_path
            .as_ref()
            .and_then(|p| id3_util::read_tags(p).ok());

        (rendered, sr, ch, metadata)
    };

    let handle = app_handle.clone();
    let progress_cb = move |progress: f64| {
        let _ = handle.emit("export-progress", progress);
    };

    exporter::export_mp3(
        &rendered,
        ch,
        sr,
        &params,
        &output_path,
        metadata.as_ref(),
        progress_cb,
    )
}
