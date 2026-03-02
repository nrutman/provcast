use rodio::{buffer::SamplesBuffer, OutputStream, OutputStreamHandle, Sink};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Holds all state needed to play, pause, seek, and track position.
pub struct PlaybackState {
    /// The rodio output stream – must be kept alive for audio to play.
    _stream: Option<OutputStream>,
    /// Handle used to create sinks.
    stream_handle: Option<OutputStreamHandle>,
    /// The active sink (controls play/pause/stop/volume).
    sink: Option<Sink>,
    /// Whether playback is currently active.
    is_playing: Arc<AtomicBool>,
    /// The sample-accurate start offset (in seconds) that was requested
    /// when play() was last called.
    start_offset_secs: f64,
    /// Instant at which playback was last started / resumed.
    play_started_at: Option<Instant>,
    /// Accumulated played time (seconds) before the latest resume.
    accumulated_secs: f64,
    /// Shared position for background thread emission (seconds * 1000 stored as u64).
    shared_position_ms: Arc<AtomicU64>,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            _stream: None,
            stream_handle: None,
            sink: None,
            is_playing: Arc::new(AtomicBool::new(false)),
            start_offset_secs: 0.0,
            play_started_at: None,
            accumulated_secs: 0.0,
            shared_position_ms: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl PlaybackState {
    // ── helpers ──────────────────────────────────────────────────────────

    fn ensure_stream(&mut self) -> Result<(), String> {
        if self.stream_handle.is_none() {
            let (stream, handle) = OutputStream::try_default()
                .map_err(|e| format!("Failed to open audio output: {e}"))?;
            self._stream = Some(stream);
            self.stream_handle = Some(handle);
        }
        Ok(())
    }

    /// Current playback position in seconds, accounting for pause time.
    fn current_position(&self) -> f64 {
        let elapsed = match self.play_started_at {
            Some(started) => started.elapsed().as_secs_f64(),
            None => 0.0,
        };
        self.start_offset_secs + self.accumulated_secs + elapsed
    }

    // ── public API ──────────────────────────────────────────────────────

    /// Start playback from `from_position` seconds.
    ///
    /// `samples` must be the **rendered** (post-edit) interleaved f32 samples.
    pub fn play(
        &mut self,
        samples: &[f32],
        sample_rate: u32,
        channels: u16,
        from_position: f64,
    ) -> Result<(), String> {
        // Stop any previous playback.
        self.stop_internal();
        self.ensure_stream()?;

        let handle = self
            .stream_handle
            .as_ref()
            .ok_or("No output stream")?;

        let sink = Sink::try_new(handle)
            .map_err(|e| format!("Failed to create sink: {e}"))?;

        // Compute the sample offset.
        let frame_offset =
            (from_position * sample_rate as f64) as usize * channels as usize;
        let frame_offset = frame_offset.min(samples.len());

        let slice = &samples[frame_offset..];
        let buf = SamplesBuffer::new(channels, sample_rate, slice.to_vec());
        sink.append(buf);

        self.sink = Some(sink);
        self.start_offset_secs = from_position;
        self.accumulated_secs = 0.0;
        self.play_started_at = Some(Instant::now());
        self.is_playing.store(true, Ordering::SeqCst);
        self.update_shared_position();

        Ok(())
    }

    /// Pause playback.
    pub fn pause(&mut self) -> Result<(), String> {
        if let Some(ref sink) = self.sink {
            sink.pause();
            // Freeze accumulated time.
            if let Some(started) = self.play_started_at.take() {
                self.accumulated_secs += started.elapsed().as_secs_f64();
            }
            self.is_playing.store(false, Ordering::SeqCst);
            self.update_shared_position();
        }
        Ok(())
    }

    /// Resume after pause.
    pub fn resume(&mut self) -> Result<(), String> {
        if let Some(ref sink) = self.sink {
            sink.play();
            self.play_started_at = Some(Instant::now());
            self.is_playing.store(true, Ordering::SeqCst);
            self.update_shared_position();
        }
        Ok(())
    }

    /// Stop playback entirely and release the sink.
    pub fn stop(&mut self) -> Result<(), String> {
        self.stop_internal();
        Ok(())
    }

    /// Seek to an absolute position.
    /// Requires re-buffering, so the caller must supply the rendered samples.
    pub fn seek(
        &mut self,
        position: f64,
        samples: &[f32],
        sample_rate: u32,
        channels: u16,
    ) -> Result<(), String> {
        let was_playing = self.is_playing.load(Ordering::SeqCst);
        self.stop_internal();

        if was_playing {
            self.play(samples, sample_rate, channels, position)?;
        } else {
            // Just update the position without playing.
            self.start_offset_secs = position;
            self.accumulated_secs = 0.0;
            self.play_started_at = None;
            self.update_shared_position();
        }
        Ok(())
    }

    /// Get the current playback position in seconds.
    pub fn get_position(&self) -> f64 {
        self.current_position()
    }

    /// Check whether audio is currently playing.
    pub fn is_playing(&self) -> bool {
        // Also check if the sink has finished.
        if let Some(ref sink) = self.sink {
            if sink.empty() {
                return false;
            }
        }
        self.is_playing.load(Ordering::SeqCst)
    }

    /// Return an arc to the shared position (for background emission).
    pub fn shared_position(&self) -> Arc<AtomicU64> {
        Arc::clone(&self.shared_position_ms)
    }

    /// Return an arc to the is_playing flag.
    pub fn playing_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.is_playing)
    }

    // ── internals ───────────────────────────────────────────────────────

    fn stop_internal(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        self.is_playing.store(false, Ordering::SeqCst);
        if let Some(started) = self.play_started_at.take() {
            self.accumulated_secs += started.elapsed().as_secs_f64();
        }
        self.update_shared_position();
    }

    fn update_shared_position(&self) {
        let ms = (self.current_position() * 1000.0) as u64;
        self.shared_position_ms.store(ms, Ordering::SeqCst);
    }
}
