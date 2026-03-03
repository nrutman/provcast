use id3::{Tag, TagLike, Version};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Podcast / audio metadata.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Metadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub track_number: Option<u32>,
    /// Base64-encoded album art (JPEG or PNG).
    pub album_art_base64: Option<String>,
    /// MIME type of the album art (e.g. "image/jpeg").
    pub album_art_mime: Option<String>,
    /// Width of album art in pixels (if known).
    pub album_art_width: Option<u32>,
    /// Height of album art in pixels (if known).
    pub album_art_height: Option<u32>,
}

/// Info returned after setting album art.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtInfo {
    pub mime: String,
    pub size_bytes: u64,
    pub base64: String,
}

/// Read ID3 tags from a file. Works best on MP3 files; for other formats
/// we return an empty metadata struct rather than an error.
pub fn read_tags(path: &str) -> Result<Metadata, String> {
    let tag = match Tag::read_from_path(path) {
        Ok(tag) => tag,
        Err(_) => {
            // Not an error – file may simply have no tags (e.g. WAV).
            return Ok(Metadata::default());
        }
    };

    let mut meta = Metadata {
        title: tag.title().map(|s| s.to_string()),
        artist: tag.artist().map(|s| s.to_string()),
        album: tag.album().map(|s| s.to_string()),
        year: tag.year(),
        genre: tag.genre_parsed().map(|s| s.to_string()),
        comment: tag.comments().next().map(|c| c.text.clone()),
        track_number: tag.track(),
        ..Default::default()
    };

    // Extract album art.
    if let Some(pic) = tag.pictures().next() {
        meta.album_art_base64 = Some(base64_encode(&pic.data));
        meta.album_art_mime = Some(pic.mime_type.clone());
    }

    Ok(meta)
}

/// Write ID3 tags to a file (MP3).
pub fn write_tags(path: &str, metadata: &Metadata) -> Result<(), String> {
    let mut tag = Tag::read_from_path(path).unwrap_or_else(|_| Tag::new());

    if let Some(ref title) = metadata.title {
        tag.set_title(title.clone());
    }
    if let Some(ref artist) = metadata.artist {
        tag.set_artist(artist.clone());
    }
    if let Some(ref album) = metadata.album {
        tag.set_album(album.clone());
    }
    if let Some(year) = metadata.year {
        tag.set_year(year);
    }
    if let Some(ref genre) = metadata.genre {
        tag.set_genre(genre.clone());
    }
    if let Some(ref comment) = metadata.comment {
        // Remove existing comments then add the new one.
        let existing: Vec<_> = tag.comments().cloned().collect();
        for _ in existing {
            tag.remove("COMM");
        }
        tag.add_frame(id3::frame::Comment {
            lang: "eng".to_string(),
            description: String::new(),
            text: comment.clone(),
        });
    }
    if let Some(track) = metadata.track_number {
        tag.set_track(track);
    }

    // Album art is handled separately via set_album_art().

    tag.write_to_path(path, Version::Id3v24)
        .map_err(|e| format!("Failed to write ID3 tags: {e}"))?;

    Ok(())
}

/// Set album art on the current project's metadata from an image file path.
/// Returns info about the art that was set.
pub fn set_album_art(path: &str, image_path: &str) -> Result<(ArtInfo, Metadata), String> {
    let image_data = fs::read(image_path).map_err(|e| format!("Failed to read image: {e}"))?;

    let mime = guess_image_mime(image_path);
    let size_bytes = image_data.len() as u64;
    let b64 = base64_encode(&image_data);

    // Write the picture into the ID3 tag of the audio file, if it is MP3.
    if path.to_lowercase().ends_with(".mp3") {
        let mut tag = Tag::read_from_path(path).unwrap_or_else(|_| Tag::new());
        tag.add_frame(id3::frame::Picture {
            mime_type: mime.clone(),
            picture_type: id3::frame::PictureType::CoverFront,
            description: "Cover".to_string(),
            data: image_data.clone(),
        });
        tag.write_to_path(path, Version::Id3v24)
            .map_err(|e| format!("Failed to write album art: {e}"))?;
    }

    let art_info = ArtInfo {
        mime: mime.clone(),
        size_bytes,
        base64: b64.clone(),
    };

    let mut meta = read_tags(path).unwrap_or_default();
    meta.album_art_base64 = Some(b64);
    meta.album_art_mime = Some(mime);

    Ok((art_info, meta))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn guess_image_mime(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

/// Simple base64 encoding (no external crate dependency).
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut result = String::with_capacity(data.len().div_ceil(3) * 4);
    let chunks = data.chunks(3);

    for chunk in chunks {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}
