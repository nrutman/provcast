use nnnoiseless::DenoiseState;
use rubato::{FftFixedIn, Resampler};
use serde::{Deserialize, Serialize};

/// Parameters for dynamic range compression.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionParams {
    /// Threshold in dB (typically -20 to 0).
    pub threshold_db: f32,
    /// Compression ratio (e.g. 4.0 means 4:1).
    pub ratio: f32,
    /// Attack time in milliseconds.
    pub attack_ms: f32,
    /// Release time in milliseconds.
    pub release_ms: f32,
    /// Make-up gain in dB.
    pub makeup_gain_db: f32,
}

/// A detected silence region.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SilenceRegion {
    /// Start time in seconds.
    pub start: f64,
    /// End time in seconds.
    pub end: f64,
}

// ── Compression ─────────────────────────────────────────────────────────────

/// Apply dynamic range compression to interleaved samples.
pub fn compress(
    samples: &[f32],
    channels: u16,
    sample_rate: u32,
    params: &CompressionParams,
) -> Vec<f32> {
    let ch = channels as usize;
    if samples.is_empty() || ch == 0 {
        return samples.to_vec();
    }

    let threshold_lin = db_to_linear(params.threshold_db);
    let makeup_lin = db_to_linear(params.makeup_gain_db);

    // Compute time constants.
    let attack_coeff = if params.attack_ms > 0.0 {
        (-1.0_f32 / (params.attack_ms * 0.001 * sample_rate as f32)).exp()
    } else {
        0.0
    };
    let release_coeff = if params.release_ms > 0.0 {
        (-1.0_f32 / (params.release_ms * 0.001 * sample_rate as f32)).exp()
    } else {
        0.0
    };

    let total_frames = samples.len() / ch;
    let mut out = samples.to_vec();
    let mut envelope: f32 = 0.0;

    for frame in 0..total_frames {
        // Peak across channels for this frame.
        let mut peak: f32 = 0.0;
        for c in 0..ch {
            let v = samples[frame * ch + c].abs();
            if v > peak {
                peak = v;
            }
        }

        // Smooth the envelope.
        if peak > envelope {
            envelope = attack_coeff * envelope + (1.0 - attack_coeff) * peak;
        } else {
            envelope = release_coeff * envelope + (1.0 - release_coeff) * peak;
        }

        // Compute gain reduction.
        let gain = if envelope > threshold_lin {
            let over = envelope / threshold_lin;
            let compressed = threshold_lin * over.powf(1.0 / params.ratio);
            (compressed / envelope) * makeup_lin
        } else {
            makeup_lin
        };

        for c in 0..ch {
            let idx = frame * ch + c;
            out[idx] = (samples[idx] * gain).clamp(-1.0, 1.0);
        }
    }

    out
}

// ── Noise Reduction ─────────────────────────────────────────────────────────

/// Apply noise reduction using nnnoiseless (RNNoise).
///
/// nnnoiseless requires 48 kHz mono input in frames of 480 samples.
/// We resample if needed, process each channel independently, then
/// resample back.
pub fn noise_reduce(samples: &[f32], channels: u16, sample_rate: u32, strength: f32) -> Vec<f32> {
    let ch = channels as usize;
    if samples.is_empty() || ch == 0 {
        return samples.to_vec();
    }

    let strength = strength.clamp(0.0, 1.0);

    // De-interleave into per-channel vectors.
    let total_frames = samples.len() / ch;
    let mut channel_data: Vec<Vec<f32>> = (0..ch)
        .map(|c| (0..total_frames).map(|f| samples[f * ch + c]).collect())
        .collect();

    // Process each channel independently.
    for ch_samples in &mut channel_data {
        *ch_samples = denoise_mono_channel(ch_samples, sample_rate, strength);
    }

    // Re-interleave.
    let out_frames = channel_data[0].len();
    let mut out = vec![0.0f32; out_frames * ch];
    for f in 0..out_frames {
        for c in 0..ch {
            out[f * ch + c] = channel_data[c][f];
        }
    }

    out
}

fn denoise_mono_channel(mono: &[f32], sample_rate: u32, strength: f32) -> Vec<f32> {
    const TARGET_SR: u32 = 48000;
    const FRAME_SIZE: usize = DenoiseState::FRAME_SIZE; // 480

    // Resample to 48 kHz if needed.
    let (resampled, need_resample_back) = if sample_rate != TARGET_SR {
        (resample_mono(mono, sample_rate, TARGET_SR), true)
    } else {
        (mono.to_vec(), false)
    };

    // nnnoiseless expects samples in 16-bit PCM range [-32768.0, 32767.0].
    const PCM_SCALE: f32 = 32767.0;
    let scaled: Vec<f32> = resampled.iter().map(|&s| s * PCM_SCALE).collect();

    // Process with nnnoiseless.
    let mut state = DenoiseState::new();
    let mut output = Vec::with_capacity(resampled.len());
    let mut frame_buf = [0.0f32; FRAME_SIZE];

    let num_full_frames = scaled.len() / FRAME_SIZE;
    let remainder = scaled.len() % FRAME_SIZE;

    for i in 0..num_full_frames {
        frame_buf.copy_from_slice(&scaled[i * FRAME_SIZE..(i + 1) * FRAME_SIZE]);
        let mut out_frame = [0.0f32; FRAME_SIZE];
        state.process_frame(&mut out_frame, &frame_buf);

        // Blend original and denoised according to strength, then scale back.
        for (j, sample) in out_frame.iter().enumerate() {
            let orig = scaled[i * FRAME_SIZE + j];
            let blended = orig * (1.0 - strength) + sample * strength;
            output.push(blended / PCM_SCALE);
        }
    }

    // Handle the last partial frame (pad with zeros).
    if remainder > 0 {
        frame_buf = [0.0f32; FRAME_SIZE];
        let start = num_full_frames * FRAME_SIZE;
        frame_buf[..remainder].copy_from_slice(&scaled[start..]);
        let mut out_frame = [0.0f32; FRAME_SIZE];
        state.process_frame(&mut out_frame, &frame_buf);

        for j in 0..remainder {
            let orig = scaled[start + j];
            let blended = orig * (1.0 - strength) + out_frame[j] * strength;
            output.push(blended / PCM_SCALE);
        }
    }

    // Resample back if we changed the sample rate.
    if need_resample_back {
        resample_mono(&output, TARGET_SR, sample_rate)
    } else {
        output
    }
}

fn resample_mono(input: &[f32], from_sr: u32, to_sr: u32) -> Vec<f32> {
    if from_sr == to_sr || input.is_empty() {
        return input.to_vec();
    }

    // rubato FftFixedIn expects a chunk size. We pick a reasonable one.
    let chunk_size = 1024usize;
    let mut resampler = FftFixedIn::<f32>::new(
        from_sr as usize,
        to_sr as usize,
        chunk_size,
        2, // sub-chunks
        1, // 1 channel
    )
    .expect("Failed to create resampler");

    let mut output: Vec<f32> = Vec::new();

    let mut pos = 0;
    while pos < input.len() {
        let end = (pos + chunk_size).min(input.len());
        let mut chunk = input[pos..end].to_vec();

        // Pad the last chunk if needed.
        if chunk.len() < chunk_size {
            chunk.resize(chunk_size, 0.0);
        }

        let waves_in = vec![chunk];
        match resampler.process(&waves_in, None) {
            Ok(waves_out) => {
                if let Some(ch) = waves_out.first() {
                    output.extend_from_slice(ch);
                }
            }
            Err(_) => break,
        }

        pos += chunk_size;
    }

    // Trim to the expected length.
    let expected_len = (input.len() as f64 * to_sr as f64 / from_sr as f64).round() as usize;
    output.truncate(expected_len);

    output
}

// ── Silence Detection ───────────────────────────────────────────────────────

/// Detect contiguous regions of silence.
///
/// A frame is considered silent when the RMS of its channels is below the
/// given `threshold_db`. Regions shorter than `min_duration_secs` are ignored.
pub fn detect_silence(
    samples: &[f32],
    channels: u16,
    sample_rate: u32,
    threshold_db: f32,
    min_duration_secs: f32,
) -> Vec<SilenceRegion> {
    let ch = channels as usize;
    if samples.is_empty() || ch == 0 || sample_rate == 0 {
        return Vec::new();
    }

    let threshold_lin = db_to_linear(threshold_db);
    let total_frames = samples.len() / ch;
    let min_frames = (min_duration_secs * sample_rate as f32) as usize;

    let mut regions: Vec<SilenceRegion> = Vec::new();
    let mut silence_start: Option<usize> = None;

    // Use a small analysis window for smoothing (e.g. 512 frames).
    let window_size = 512usize.min(total_frames);
    let hop = window_size / 2;

    let mut frame = 0;
    while frame < total_frames {
        let end = (frame + window_size).min(total_frames);

        // RMS of the window.
        let mut sum_sq: f64 = 0.0;
        let count = end - frame;
        for f in frame..end {
            let mut mono: f32 = 0.0;
            for c in 0..ch {
                mono += samples[f * ch + c];
            }
            mono /= ch as f32;
            sum_sq += (mono as f64) * (mono as f64);
        }
        let rms = (sum_sq / count as f64).sqrt() as f32;

        let is_silent = rms < threshold_lin;

        if is_silent {
            if silence_start.is_none() {
                silence_start = Some(frame);
            }
        } else if let Some(start) = silence_start.take() {
            let duration_frames = frame - start;
            if duration_frames >= min_frames {
                regions.push(SilenceRegion {
                    start: start as f64 / sample_rate as f64,
                    end: frame as f64 / sample_rate as f64,
                });
            }
        }

        frame += hop;
    }

    // Close any trailing silence region.
    if let Some(start) = silence_start {
        let duration_frames = total_frames - start;
        if duration_frames >= min_frames {
            regions.push(SilenceRegion {
                start: start as f64 / sample_rate as f64,
                end: total_frames as f64 / sample_rate as f64,
            });
        }
    }

    regions
}

// ── Utility ─────────────────────────────────────────────────────────────────

fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}
