pub mod audio;
pub mod commands;
pub mod metadata;

use audio::AudioEngineState;
use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn set_macos_dock_icon() {
    use cocoa::appkit::{NSApp, NSApplication, NSImage};
    use cocoa::base::nil;
    use cocoa::foundation::NSData;
    use objc::runtime::Object;

    unsafe {
        let icon_bytes = include_bytes!("../icons/128x128@2x.png");
        let data = NSData::dataWithBytes_length_(
            nil,
            icon_bytes.as_ptr() as *const std::ffi::c_void,
            icon_bytes.len() as u64,
        );
        let nsimage: *mut Object = NSImage::initWithData_(NSImage::alloc(nil), data);
        let app = NSApp();
        app.setApplicationIconImage_(nsimage);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AudioEngineState::new())
        .invoke_handler(tauri::generate_handler![
            commands::load_audio,
            commands::play_audio,
            commands::pause_audio,
            commands::stop_audio,
            commands::seek_audio,
            commands::get_playback_position,
            commands::delete_region,
            commands::undo_edit,
            commands::redo_edit,
            commands::apply_compression,
            commands::apply_noise_reduction,
            commands::detect_silence,
            commands::trim_silence,
            commands::read_metadata,
            commands::update_metadata,
            commands::set_album_art,
            commands::estimate_export_size,
            commands::export_mp3,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            set_macos_dock_icon();

            // Spawn a background thread that emits playback position updates
            // to the frontend at ~30 Hz. We clone the AppHandle (which is
            // cheap) and retrieve managed state from it inside the thread.
            let handle = app.handle().clone();

            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(33));

                    let state = handle.state::<AudioEngineState>();
                    let engine = state.0.lock();
                    if engine.playback.is_playing() {
                        let position = engine.playback.get_position();
                        drop(engine); // Release lock before emitting.
                        let _ = handle.emit("playback-position", position);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
