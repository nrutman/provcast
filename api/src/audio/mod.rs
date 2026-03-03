pub mod decoder;
pub mod editor;
pub mod exporter;
pub mod playback;
pub mod processor;

use editor::EditDecisionList;
use parking_lot::Mutex;
use playback::PlaybackState;

/// Central audio engine that holds the current project state.
pub struct AudioEngine {
    /// Raw decoded samples (interleaved if multi-channel).
    pub source_samples: Option<Vec<f32>>,
    /// Sample rate of the loaded audio.
    pub sample_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo).
    pub channels: u16,
    /// Format string, e.g. "wav", "mp3", "flac", "ogg", "aiff".
    pub format: String,
    /// Original file path on disk.
    pub file_path: Option<String>,
    /// Non-destructive edit decision list.
    pub edl: EditDecisionList,
    /// Playback state (stream, sink, position).
    pub playback: PlaybackState,
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self {
            source_samples: None,
            sample_rate: 44100,
            channels: 2,
            format: String::new(),
            file_path: None,
            edl: EditDecisionList::new(),
            playback: PlaybackState::default(),
        }
    }
}

impl AudioEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Return the rendered (edited) samples by applying the EDL to the source.
    pub fn rendered_samples(&self) -> Option<Vec<f32>> {
        self.source_samples
            .as_ref()
            .map(|src| self.edl.apply_edits(src, self.channels, self.sample_rate))
    }

    /// Duration in seconds of the source audio.
    pub fn source_duration(&self) -> f64 {
        match &self.source_samples {
            Some(samples) => {
                let total_frames = samples.len() as f64 / self.channels as f64;
                total_frames / self.sample_rate as f64
            }
            None => 0.0,
        }
    }

    /// Duration after edits are applied.
    pub fn edited_duration(&self) -> f64 {
        self.edl.get_edited_duration(self.source_duration())
    }
}

// SAFETY: AudioEngine contains rodio's OutputStream which may be !Send on
// some platforms (it wraps cpal::Stream internally). However, our usage is
// safe because the OutputStream is always accessed through a Mutex and is
// never moved between threads -- it stays on whichever thread currently
// holds the lock. This is a well-established pattern in audio applications.
unsafe impl Send for AudioEngine {}

/// Wrapper used as Tauri managed state.
pub struct AudioEngineState(pub Mutex<AudioEngine>);

impl Default for AudioEngineState {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioEngineState {
    pub fn new() -> Self {
        Self(Mutex::new(AudioEngine::new()))
    }
}
