use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DecoderError {
    #[error("Failed to open file: {0}")]
    FileOpen(String),
    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),
    #[error("No audio tracks found")]
    NoAudioTrack,
    #[error("Decoder error: {0}")]
    Decode(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Detect the format string from a file extension.
fn detect_format(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "wav" => "wav".to_string(),
        "mp3" => "mp3".to_string(),
        "flac" => "flac".to_string(),
        "ogg" | "oga" => "ogg".to_string(),
        "aiff" | "aif" => "aiff".to_string(),
        other => other.to_string(),
    }
}

/// Decode an audio file into interleaved f32 samples.
///
/// Returns (samples, sample_rate, channels, format_string).
pub fn decode_file(path: &str) -> Result<(Vec<f32>, u32, u16, String), DecoderError> {
    let file = File::open(path).map_err(|e| DecoderError::FileOpen(e.to_string()))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions {
        enable_gapless: true,
        ..Default::default()
    };
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| DecoderError::UnsupportedFormat(e.to_string()))?;

    let mut format_reader = probed.format;

    let track = format_reader
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or(DecoderError::NoAudioTrack)?;

    let track_id = track.id;
    let codec_params = track.codec_params.clone();

    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| DecoderError::Decode("Unknown sample rate".into()))?;

    let channels = codec_params
        .channels
        .map(|ch| ch.count() as u16)
        .unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &decoder_opts)
        .map_err(|e| DecoderError::Decode(e.to_string()))?;

    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format_reader.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(symphonia::core::errors::Error::ResetRequired) => {
                // Some formats need a reset; just stop decoding.
                break;
            }
            Err(e) => return Err(DecoderError::Decode(e.to_string())),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(buf) => buf,
            Err(symphonia::core::errors::Error::DecodeError(_)) => {
                // Skip corrupt frames.
                continue;
            }
            Err(e) => return Err(DecoderError::Decode(e.to_string())),
        };

        let spec = *decoded.spec();
        let num_frames = decoded.frames();

        let mut sample_buf = SampleBuffer::<f32>::new(num_frames as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        all_samples.extend_from_slice(sample_buf.samples());
    }

    let format_str = detect_format(path);

    Ok((all_samples, sample_rate, channels, format_str))
}

/// Generate waveform peak data for visualisation.
///
/// Produces interleaved [min, max] pairs at the requested `peaks_per_second` rate.
/// For stereo files the peaks are computed from a mono-mix so that the frontend
/// receives a single waveform.
pub fn generate_peaks(
    samples: &[f32],
    channels: u16,
    sample_rate: u32,
    peaks_per_second: f32,
) -> Vec<f32> {
    if samples.is_empty() || sample_rate == 0 {
        return Vec::new();
    }

    let ch = channels as usize;
    let total_frames = samples.len() / ch;
    let duration_secs = total_frames as f64 / sample_rate as f64;
    let num_peaks = (duration_secs * peaks_per_second as f64).ceil() as usize;

    if num_peaks == 0 {
        return Vec::new();
    }

    let frames_per_peak = total_frames as f64 / num_peaks as f64;
    let mut peaks = Vec::with_capacity(num_peaks * 2);

    for i in 0..num_peaks {
        let start_frame = (i as f64 * frames_per_peak) as usize;
        let end_frame = (((i + 1) as f64 * frames_per_peak) as usize).min(total_frames);

        let mut min_val: f32 = 0.0;
        let mut max_val: f32 = 0.0;

        for frame in start_frame..end_frame {
            // Mix down to mono for the peak display.
            let mut mono: f32 = 0.0;
            for c in 0..ch {
                let idx = frame * ch + c;
                if idx < samples.len() {
                    mono += samples[idx];
                }
            }
            mono /= ch as f32;

            if mono < min_val {
                min_val = mono;
            }
            if mono > max_val {
                max_val = mono;
            }
        }

        peaks.push(min_val);
        peaks.push(max_val);
    }

    peaks
}
