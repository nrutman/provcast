use super::decoder::generate_peaks;

/// A single edit operation that can be applied non-destructively.
#[derive(Debug, Clone)]
pub enum EditOp {
    /// Delete (remove) a time region.
    Delete { start: f64, end: f64 },
    /// Replace a time region with silence.
    Silence { start: f64, end: f64 },
    /// Replace a time region with pre-processed samples (e.g. after
    /// compression or noise reduction).
    ProcessedAudio {
        samples: Vec<f32>,
        start: f64,
        end: f64,
    },
}

/// Non-destructive edit decision list with undo / redo.
#[derive(Debug, Clone, Default)]
pub struct EditDecisionList {
    /// The committed stack of operations (applied in order).
    operations: Vec<EditOp>,
    /// Undo stack – operations that were undone.
    undo_stack: Vec<EditOp>,
    /// Redo stack – operations that were undone and can be re-applied.
    redo_stack: Vec<EditOp>,
}

impl EditDecisionList {
    pub fn new() -> Self {
        Self {
            operations: Vec::new(),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    /// Push a new edit. Clears the redo stack.
    pub fn add_edit(&mut self, op: EditOp) {
        self.operations.push(op);
        self.redo_stack.clear();
    }

    /// Undo the most recent edit. Returns the undone op (if any).
    pub fn undo(&mut self) -> Option<EditOp> {
        if let Some(op) = self.operations.pop() {
            self.redo_stack.push(op.clone());
            Some(op)
        } else {
            None
        }
    }

    /// Redo the most recently undone edit. Returns the re-applied op (if any).
    pub fn redo(&mut self) -> Option<EditOp> {
        if let Some(op) = self.redo_stack.pop() {
            self.operations.push(op.clone());
            Some(op)
        } else {
            None
        }
    }

    /// Clear the entire edit history.
    pub fn clear(&mut self) {
        self.operations.clear();
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    /// Render the final audio by applying all operations to `source`.
    ///
    /// `source` contains the original interleaved samples. Each operation is
    /// applied on top of the *previous* result so that ordering matters.
    pub fn apply_edits(&self, source: &[f32], channels: u16, sample_rate: u32) -> Vec<f32> {
        let ch = channels as usize;
        if source.is_empty() || ch == 0 || sample_rate == 0 {
            return source.to_vec();
        }

        let mut result = source.to_vec();

        for op in &self.operations {
            result = apply_single_op(&result, op, ch, sample_rate);
        }

        result
    }

    /// Compute the resulting duration after all edits are applied.
    pub fn get_edited_duration(&self, original_duration: f64) -> f64 {
        let mut duration = original_duration;
        for op in &self.operations {
            match op {
                EditOp::Delete { start, end } => {
                    let region = (end - start).min(duration - start).max(0.0);
                    duration -= region;
                }
                EditOp::Silence { .. } => {
                    // Silence does not change duration.
                }
                EditOp::ProcessedAudio {
                    samples,
                    start,
                    end,
                } => {
                    // The replacement may have a different length.
                    let original_region = end - start;
                    // We need to know channels to compute new length, but we
                    // approximate with 2 channels here – the real render path
                    // is the source of truth.
                    let new_region = samples.len() as f64 / (2.0 * 44100.0);
                    duration = duration - original_region + new_region;
                }
            }
        }
        duration.max(0.0)
    }

    /// Convenience: render edits then recompute peaks.
    pub fn recompute_peaks(
        &self,
        source: &[f32],
        channels: u16,
        sample_rate: u32,
    ) -> (Vec<f32>, f64) {
        let rendered = self.apply_edits(source, channels, sample_rate);
        let ch = channels as usize;
        let total_frames = rendered.len() / ch.max(1);
        let duration = total_frames as f64 / sample_rate as f64;
        let peaks = generate_peaks(&rendered, channels, sample_rate, 200.0);
        (peaks, duration)
    }
}

// ── internal helpers ────────────────────────────────────────────────────────

fn time_to_sample(time: f64, sample_rate: u32, channels: usize) -> usize {
    let frame = (time * sample_rate as f64) as usize;
    frame * channels
}

fn apply_single_op(samples: &[f32], op: &EditOp, channels: usize, sample_rate: u32) -> Vec<f32> {
    match op {
        EditOp::Delete { start, end } => {
            let start_idx = time_to_sample(*start, sample_rate, channels).min(samples.len());
            let end_idx = time_to_sample(*end, sample_rate, channels).min(samples.len());

            let mut out = Vec::with_capacity(samples.len() - (end_idx - start_idx));
            out.extend_from_slice(&samples[..start_idx]);
            out.extend_from_slice(&samples[end_idx..]);
            out
        }

        EditOp::Silence { start, end } => {
            let start_idx = time_to_sample(*start, sample_rate, channels).min(samples.len());
            let end_idx = time_to_sample(*end, sample_rate, channels).min(samples.len());

            let mut out = samples.to_vec();
            for s in &mut out[start_idx..end_idx] {
                *s = 0.0;
            }
            out
        }

        EditOp::ProcessedAudio {
            samples: new_samples,
            start,
            end,
        } => {
            let start_idx = time_to_sample(*start, sample_rate, channels).min(samples.len());
            let end_idx = time_to_sample(*end, sample_rate, channels).min(samples.len());

            let mut out =
                Vec::with_capacity(samples.len() - (end_idx - start_idx) + new_samples.len());
            out.extend_from_slice(&samples[..start_idx]);
            out.extend_from_slice(new_samples);
            out.extend_from_slice(&samples[end_idx..]);
            out
        }
    }
}
