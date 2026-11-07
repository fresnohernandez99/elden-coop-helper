fn main() {
    // Listing the app commands makes them go through capabilities, so only the
    // local settings window can call them (never the remote map page).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["get_config", "save_config"]),
    ))
    .expect("failed to run tauri-build");
}
