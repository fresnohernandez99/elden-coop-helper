// Hides the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{
    ipc::CapabilityBuilder,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    webview::PageLoadEvent,
    AppHandle, Manager, RunEvent, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_window_state::StateFlags;

const MAP: &str = "map";
const SETTINGS: &str = "settings";
const MIN_OPACITY: f64 = 0.3;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Config {
    /// Where the co-op map is served, e.g. https://my-map.vercel.app
    url: String,
    toggle_shortcut: String,
    click_through_shortcut: String,
    /// Opacity of the map page, from MIN_OPACITY to 1.
    opacity: f64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            url: String::new(),
            toggle_shortcut: "Backslash".into(),
            click_through_shortcut: "Ctrl+Shift+K".into(),
            opacity: 0.92,
        }
    }
}

struct Overlay {
    config: Mutex<Config>,
    click_through: Mutex<bool>,
    click_through_item: CheckMenuItem<Wry>,
}

// ---- config file ----

fn config_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("config.json"))
}

fn load_config(app: &AppHandle) -> Config {
    config_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app).ok_or("no config directory")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

fn parse_url(url: &str) -> Result<Url, String> {
    let url: Url = url.trim().parse().map_err(|_| "The map URL is not valid.")?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err("The map URL must start with http:// or https://.".into()),
    }
}

fn parse_shortcut(text: &str) -> Result<Shortcut, String> {
    text.parse()
        .map_err(|_| format!("\"{text}\" is not a valid shortcut. Click the field and press the keys."))
}

// ---- shortcuts ----

fn register_shortcuts(app: &AppHandle, config: &Config) -> Result<(), String> {
    let toggle = parse_shortcut(&config.toggle_shortcut)?;
    let click_through = parse_shortcut(&config.click_through_shortcut)?;
    if toggle == click_through {
        return Err("The two shortcuts must be different.".into());
    }

    let shortcuts = app.global_shortcut();
    shortcuts.unregister_all().map_err(|e| e.to_string())?;
    let taken = |text: &str| format!("{text} is already used by another app. Pick another shortcut.");
    shortcuts
        .on_shortcut(toggle, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                toggle_map(app);
            }
        })
        .map_err(|_| taken(&config.toggle_shortcut))?;
    shortcuts
        .on_shortcut(click_through, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                let on = !*app.state::<Overlay>().click_through.lock().unwrap();
                set_click_through(app, on);
            }
        })
        .map_err(|_| taken(&config.click_through_shortcut))?;
    Ok(())
}

// ---- map window ----

/// Sets the page opacity and adds a small handle to drag the frameless window.
/// Runs again after every page load because navigation drops both.
fn style_map(window: &WebviewWindow, opacity: f64) {
    let script = format!(
        r#"(() => {{
  // Separate elements instead of attributes on <html>, so React hydration ignores them.
  let style = document.getElementById('__overlay-style');
  if (!style) {{
    style = document.createElement('style');
    style.id = '__overlay-style';
    document.head.appendChild(style);
  }}
  style.textContent = 'html {{ opacity: {opacity}; }}';
  if (document.getElementById('__overlay-drag')) return;
  const bar = document.createElement('div');
  bar.id = '__overlay-drag';
  bar.title = 'Drag to move';
  bar.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);width:140px;height:12px;'
    + 'z-index:2147483647;cursor:move;background:rgba(201,167,74,.45);border-radius:0 0 8px 8px;';
  bar.addEventListener('mousedown', (e) => {{
    if (e.button === 0) window.__TAURI_INTERNALS__?.invoke('plugin:window|start_dragging', {{ label: '{MAP}' }});
  }});
  document.body.appendChild(bar);
}})();"#
    );
    let _ = window.eval(&script);
}

/// The map page is remote, so it gets no IPC access except dragging its own window.
fn allow_dragging(app: &AppHandle, url: &Url) {
    let origin = url.origin().ascii_serialization();
    let capability = CapabilityBuilder::new(format!("map-drag-{origin}"))
        .remote(format!("{origin}/*"))
        .window(MAP)
        .permission("core:window:allow-start-dragging");
    // Fails only when this origin was already added, which is fine.
    let _ = app.add_capability(capability);
}

fn open_map(app: &AppHandle, url: &str) -> Result<(), String> {
    let url = parse_url(url)?;
    allow_dragging(app, &url);
    if let Some(window) = app.get_webview_window(MAP) {
        window.navigate(url).map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, MAP, WebviewUrl::External(url))
        .title("Elden Co-op Map")
        .inner_size(1100.0, 750.0)
        .min_inner_size(480.0, 360.0)
        .center()
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let opacity = window.state::<Overlay>().config.lock().unwrap().opacity;
                style_map(&window, opacity);
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn toggle_map(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAP) else {
        // Closed with Alt+F4, or never configured.
        let url = app.state::<Overlay>().config.lock().unwrap().url.clone();
        if url.is_empty() || open_map(app, &url).is_err() {
            show_settings(app);
        }
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        // In click-through mode the game keeps the keyboard.
        if !*app.state::<Overlay>().click_through.lock().unwrap() {
            let _ = window.set_focus();
        }
    }
}

fn set_click_through(app: &AppHandle, on: bool) {
    let state = app.state::<Overlay>();
    *state.click_through.lock().unwrap() = on;
    let _ = state.click_through_item.set_checked(on);
    if let Some(window) = app.get_webview_window(MAP) {
        let _ = window.set_ignore_cursor_events(on);
    }
}

// ---- settings window ----

fn show_settings(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    // A registered global shortcut never reaches the page, so recording one in
    // Settings needs them off while it is open.
    let _ = app.global_shortcut().unregister_all();
    let Ok(window) = WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("index.html".into()))
        .title("Elden Co-op Overlay")
        .inner_size(460.0, 600.0)
        .resizable(false)
        .maximizable(false)
        .center()
        .always_on_top(true)
        .build()
    else {
        return;
    };
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            let config = handle.state::<Overlay>().config.lock().unwrap().clone();
            let _ = register_shortcuts(&handle, &config);
        }
    });
}

#[tauri::command]
fn get_config(state: State<Overlay>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(app: AppHandle, state: State<Overlay>, mut config: Config) -> Result<(), String> {
    config.url = parse_url(&config.url)?.to_string();
    config.toggle_shortcut = config.toggle_shortcut.trim().to_string();
    config.click_through_shortcut = config.click_through_shortcut.trim().to_string();
    config.opacity = config.opacity.clamp(MIN_OPACITY, 1.0);

    let previous = state.config.lock().unwrap().clone();
    if let Err(error) = register_shortcuts(&app, &config) {
        // Settings stays open, so keep them off; closing it registers the saved ones.
        let _ = app.global_shortcut().unregister_all();
        return Err(error);
    }
    write_config(&app, &config)?;
    *state.config.lock().unwrap() = config.clone();

    match app.get_webview_window(MAP) {
        Some(window) if previous.url == config.url => style_map(&window, config.opacity),
        _ => open_map(&app, &config.url)?,
    }
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.close();
    }
    Ok(())
}

// ---- app ----

fn main() {
    tauri::Builder::default()
        // Launching it again shows the map instead of starting a second copy.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window(MAP) {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                show_settings(app);
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // The map window comes back where it was left, at the same size.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&[SETTINGS])
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_config, save_config])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            let toggle = MenuItem::with_id(app, "toggle", "Show / hide map", true, None::<&str>)?;
            let click_through =
                CheckMenuItem::with_id(app, "click-through", "Click-through", true, false, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&toggle, &click_through, &PredefinedMenuItem::separator(app)?, &settings, &quit],
            )?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("bundle icon"))
                .tooltip("Elden Co-op Overlay")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "toggle" => toggle_map(app),
                    "click-through" => {
                        let on = !*app.state::<Overlay>().click_through.lock().unwrap();
                        set_click_through(app, on);
                    }
                    "settings" => show_settings(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let config = load_config(&handle);
            app.manage(Overlay {
                config: Mutex::new(config.clone()),
                click_through: Mutex::new(false),
                click_through_item: click_through,
            });

            let ready = register_shortcuts(&handle, &config).is_ok()
                && !config.url.is_empty()
                && open_map(&handle, &config.url).is_ok();
            if !ready {
                show_settings(&handle);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to start the overlay")
        .run(|_, event| {
            // Keep running in the tray when every window is closed; only "Quit" exits.
            if let RunEvent::ExitRequested { api, code: None, .. } = event {
                api.prevent_exit();
            }
        });
}
