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

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create a simple interleaved sample buffer of `n` frames for
    /// `channels` channels where each sample value equals its frame index
    /// (cast to f32).
    fn ramp_samples(frames: usize, channels: u16) -> Vec<f32> {
        let ch = channels as usize;
        let mut out = Vec::with_capacity(frames * ch);
        for f in 0..frames {
            for _ in 0..ch {
                out.push(f as f32);
            }
        }
        out
    }

    // ── EDL lifecycle tests ─────────────────────────────────────────────

    #[test]
    fn test_edl_new_is_empty() {
        let edl = EditDecisionList::new();
        let source: Vec<f32> = vec![1.0, 2.0, 3.0, 4.0];
        // Applying an empty EDL should return the source unchanged.
        let result = edl.apply_edits(&source, 1, 44100);
        assert_eq!(result, source);
    }

    #[test]
    fn test_edl_add_edit() {
        let mut edl = EditDecisionList::new();
        edl.add_edit(EditOp::Silence {
            start: 0.0,
            end: 1.0,
        });

        // 4 frames of mono audio => 1 second at sr=4
        let sample_rate = 4u32;
        let source = vec![1.0f32, 2.0, 3.0, 4.0];
        let result = edl.apply_edits(&source, 1, sample_rate);

        // All samples should be zeroed (silence from 0-1s covers everything).
        assert_eq!(result, vec![0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn test_edl_undo() {
        let mut edl = EditDecisionList::new();
        edl.add_edit(EditOp::Silence {
            start: 0.0,
            end: 1.0,
        });
        let undone = edl.undo();
        assert!(undone.is_some());

        // After undo, applying edits should return original.
        let source = vec![1.0f32, 2.0, 3.0, 4.0];
        let result = edl.apply_edits(&source, 1, 4);
        assert_eq!(result, source);
    }

    #[test]
    fn test_edl_redo() {
        let mut edl = EditDecisionList::new();
        edl.add_edit(EditOp::Silence {
            start: 0.0,
            end: 1.0,
        });
        edl.undo();
        let redone = edl.redo();
        assert!(redone.is_some());

        // After redo, the silence should be re-applied.
        let source = vec![1.0f32, 2.0, 3.0, 4.0];
        let result = edl.apply_edits(&source, 1, 4);
        assert_eq!(result, vec![0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn test_edl_undo_clears_on_new_edit() {
        let mut edl = EditDecisionList::new();
        edl.add_edit(EditOp::Silence {
            start: 0.0,
            end: 0.5,
        });
        edl.undo();

        // Adding a new edit should clear the redo stack.
        edl.add_edit(EditOp::Delete {
            start: 0.0,
            end: 0.25,
        });

        // Redo should now return None.
        let redone = edl.redo();
        assert!(
            redone.is_none(),
            "redo stack should be cleared after new edit"
        );
    }

    // ── apply_edits operation tests ─────────────────────────────────────

    #[test]
    fn test_apply_delete() {
        let mut edl = EditDecisionList::new();
        let sample_rate = 4u32;
        // 8 frames mono => 2 seconds at sr=4
        let source = ramp_samples(8, 1);
        // [0, 1, 2, 3, 4, 5, 6, 7]

        // Delete from 0.5s to 1.0s => frames 2..4 deleted
        edl.add_edit(EditOp::Delete {
            start: 0.5,
            end: 1.0,
        });

        let result = edl.apply_edits(&source, 1, sample_rate);
        // Expected: [0, 1, 4, 5, 6, 7]
        assert_eq!(result, vec![0.0, 1.0, 4.0, 5.0, 6.0, 7.0]);
    }

    #[test]
    fn test_apply_silence() {
        let mut edl = EditDecisionList::new();
        let sample_rate = 4u32;
        let source = ramp_samples(8, 1);
        // [0, 1, 2, 3, 4, 5, 6, 7]

        // Silence from 0.5s to 1.0s => frames 2..4 zeroed
        edl.add_edit(EditOp::Silence {
            start: 0.5,
            end: 1.0,
        });

        let result = edl.apply_edits(&source, 1, sample_rate);
        // Length should be preserved.
        assert_eq!(result.len(), source.len());
        // Expected: [0, 1, 0, 0, 4, 5, 6, 7]
        assert_eq!(result, vec![0.0, 1.0, 0.0, 0.0, 4.0, 5.0, 6.0, 7.0]);
    }

    #[test]
    fn test_apply_processed_audio() {
        let mut edl = EditDecisionList::new();
        let sample_rate = 4u32;
        let source = ramp_samples(8, 1);
        // [0, 1, 2, 3, 4, 5, 6, 7]

        // Replace frames 2..4 (0.5s-1.0s) with [99, 88, 77]
        edl.add_edit(EditOp::ProcessedAudio {
            samples: vec![99.0, 88.0, 77.0],
            start: 0.5,
            end: 1.0,
        });

        let result = edl.apply_edits(&source, 1, sample_rate);
        // Expected: [0, 1, 99, 88, 77, 4, 5, 6, 7]
        assert_eq!(result, vec![0.0, 1.0, 99.0, 88.0, 77.0, 4.0, 5.0, 6.0, 7.0]);
    }

    #[test]
    fn test_get_edited_duration_after_delete() {
        let mut edl = EditDecisionList::new();
        let original_duration = 10.0; // 10 seconds

        // Delete a 2-second region.
        edl.add_edit(EditOp::Delete {
            start: 3.0,
            end: 5.0,
        });

        let new_duration = edl.get_edited_duration(original_duration);
        assert!(
            (new_duration - 8.0).abs() < 1e-9,
            "expected ~8.0s after deleting 2s, got {}",
            new_duration
        );
    }
}
