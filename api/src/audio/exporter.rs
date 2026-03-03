use mp3lame_encoder::{Builder, FlushNoGap, InterleavedPcm, MonoPcm};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;

/// Parameters controlling the MP3 export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportParams {
    /// Target bitrate in kbps (e.g. 128, 192, 320).
    pub bitrate: u32,
    /// Whether to use CBR (constant) or VBR.
    pub cbr: bool,
    /// VBR quality (0 = best, 9 = worst). Only used if cbr is false.
    pub vbr_quality: Option<u32>,
    /// Whether to normalize before export.
    pub normalize: bool,
    /// Target peak dB for normalization (e.g. -1.0).
    pub normalize_target_db: Option<f32>,
}

/// Result of an export operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    /// Path to the exported file.
    pub path: String,
    /// File size in bytes.
    pub size_bytes: u64,
    /// Duration in seconds.
    pub duration_secs: f64,
    /// Bitrate used.
    pub bitrate: u32,
}

/// Estimated export file size.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeEstimate {
    /// Estimated size in bytes.
    pub size_bytes: u64,
    /// Duration used for estimate.
    pub duration_secs: f64,
    /// Bitrate used for estimate.
    pub bitrate: u32,
}

/// Estimate the output MP3 file size.
pub fn estimate_size(duration_secs: f64, params: &ExportParams) -> SizeEstimate {
    // MP3 size ~= bitrate (kbps) * duration (s) / 8 * 1000
    let size_bytes = ((params.bitrate as f64 * 1000.0 / 8.0) * duration_secs) as u64;
    SizeEstimate {
        size_bytes,
        duration_secs,
        bitrate: params.bitrate,
    }
}

/// Map an integer bitrate (kbps) to the mp3lame_encoder::Bitrate enum.
fn map_bitrate(kbps: u32) -> mp3lame_encoder::Bitrate {
    use mp3lame_encoder::Bitrate;
    match kbps {
        0..=12 => Bitrate::Kbps8,
        13..=20 => Bitrate::Kbps16,
        21..=28 => Bitrate::Kbps24,
        29..=36 => Bitrate::Kbps32,
        37..=44 => Bitrate::Kbps40,
        45..=56 => Bitrate::Kbps48,
        57..=72 => Bitrate::Kbps64,
        73..=88 => Bitrate::Kbps80,
        89..=104 => Bitrate::Kbps96,
        105..=120 => Bitrate::Kbps112,
        121..=144 => Bitrate::Kbps128,
        145..=176 => Bitrate::Kbps160,
        177..=208 => Bitrate::Kbps192,
        209..=240 => Bitrate::Kbps224,
        241..=288 => Bitrate::Kbps256,
        _ => Bitrate::Kbps320,
    }
}

/// Map an integer VBR quality (0-9) to the mp3lame_encoder::Quality enum.
fn map_quality(q: u32) -> mp3lame_encoder::Quality {
    use mp3lame_encoder::Quality;
    match q {
        0 => Quality::Best,
        1 => Quality::SecondBest,
        2 => Quality::NearBest,
        3 => Quality::VeryNice,
        4 => Quality::Nice,
        5 => Quality::Good,
        6 => Quality::Decent,
        7 => Quality::Ok,
        8 => Quality::SecondWorst,
        9 => Quality::Worst,
        _ => Quality::Nice, // Default to 4 (nice) for unrecognized values
    }
}

/// Export interleaved f32 samples to an MP3 file.
///
/// `progress_callback` is called with a value in 0.0..=1.0.
pub fn export_mp3<F>(
    samples: &[f32],
    channels: u16,
    sample_rate: u32,
    params: &ExportParams,
    output_path: &str,
    metadata: Option<&super::super::metadata::id3::Metadata>,
    mut progress_callback: F,
) -> Result<ExportResult, String>
where
    F: FnMut(f64),
{
    let ch = channels as usize;
    if samples.is_empty() || ch == 0 {
        return Err("No audio data to export".into());
    }

    // Optionally normalize.
    let samples = if params.normalize {
        let target_db = params.normalize_target_db.unwrap_or(-1.0);
        normalize(samples, target_db)
    } else {
        samples.to_vec()
    };

    // Convert f32 [-1,1] to i16.
    let pcm_i16: Vec<i16> = samples
        .iter()
        .map(|&s| {
            let clamped = s.clamp(-1.0, 1.0);
            (clamped * i16::MAX as f32) as i16
        })
        .collect();

    // Build the LAME encoder.
    let mut builder = Builder::new().ok_or("Failed to create LAME encoder")?;
    builder
        .set_num_channels(channels as u8)
        .map_err(|e| format!("set_num_channels: {e:?}"))?;
    builder
        .set_sample_rate(sample_rate)
        .map_err(|e| format!("set_sample_rate: {e:?}"))?;

    if params.cbr {
        builder
            .set_brate(map_bitrate(params.bitrate))
            .map_err(|e| format!("set_brate: {e:?}"))?;
    } else {
        let quality = params.vbr_quality.unwrap_or(4);
        builder
            .set_quality(map_quality(quality))
            .map_err(|e| format!("set_quality: {e:?}"))?;
    }

    let mut encoder = builder
        .build()
        .map_err(|e| format!("build encoder: {e:?}"))?;

    // Encode in chunks.
    let total_frames = pcm_i16.len() / ch;
    let chunk_frames = 1152; // standard MP3 frame size
    let mut mp3_data: Vec<u8> = Vec::new();
    let mut frames_done: usize = 0;

    // Worst case buffer per chunk: 1.25 * num_samples + 7200
    let max_mp3_buf = mp3lame_encoder::max_required_buffer_size(chunk_frames * ch);

    while frames_done < total_frames {
        let end_frame = (frames_done + chunk_frames).min(total_frames);
        let start_idx = frames_done * ch;
        let end_idx = end_frame * ch;
        let chunk = &pcm_i16[start_idx..end_idx];

        // Reserve capacity so spare_capacity_mut() (used by encode_to_vec) has room.
        mp3_data.reserve(max_mp3_buf);

        if ch == 1 {
            let input = MonoPcm(chunk);
            encoder
                .encode_to_vec(input, &mut mp3_data)
                .map_err(|e| format!("encode: {e:?}"))?;
        } else {
            let input = InterleavedPcm(chunk);
            encoder
                .encode_to_vec(input, &mut mp3_data)
                .map_err(|e| format!("encode: {e:?}"))?;
        }

        frames_done = end_frame;
        let progress = frames_done as f64 / total_frames as f64;
        progress_callback(progress.min(0.99)); // Reserve 1% for flush + write
    }

    // Flush the encoder.
    mp3_data.reserve(max_mp3_buf);
    encoder
        .flush_to_vec::<FlushNoGap>(&mut mp3_data)
        .map_err(|e| format!("flush: {e:?}"))?;

    // Write to disk.
    let mut file = File::create(output_path).map_err(|e| format!("create output file: {e}"))?;
    file.write_all(&mp3_data)
        .map_err(|e| format!("write mp3 data: {e}"))?;

    // Apply ID3 tags if we have metadata.
    if let Some(meta) = metadata {
        if let Err(e) = super::super::metadata::id3::write_tags(output_path, meta) {
            eprintln!("Warning: could not write ID3 tags: {e}");
        }
    }

    let size_bytes = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(mp3_data.len() as u64);

    let duration_secs = total_frames as f64 / sample_rate as f64;

    progress_callback(1.0);

    Ok(ExportResult {
        path: output_path.to_string(),
        size_bytes,
        duration_secs,
        bitrate: params.bitrate,
    })
}

/// Peak-normalize samples so the loudest peak hits `target_db`.
fn normalize(samples: &[f32], target_db: f32) -> Vec<f32> {
    let peak = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);

    if peak < 1e-10 {
        return samples.to_vec();
    }

    let target_lin = 10.0_f32.powf(target_db / 20.0);
    let gain = target_lin / peak;

    samples
        .iter()
        .map(|&s| (s * gain).clamp(-1.0, 1.0))
        .collect()
}
