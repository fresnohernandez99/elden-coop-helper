# Elden Co-op Overlay

A small desktop app (Tauri 2) that shows the co-op map **over the game** and toggles it with a global keyboard shortcut, like the Steam overlay. Built for Windows, where Elden Ring runs.

It is not a real in-game overlay: it never touches the game process, it is just an always-on-top window. That keeps it safe with **Easy Anti-Cheat**, which bans software that injects into the game.

## Use

1. Install it (see "Build") and start it. It lives in the **tray**: from there you get show/hide, click-through, settings and quit.
2. On first start it asks for the **map URL** (where the Next.js app is served) and the shortcuts. Log in once in the map window; the session cookie is kept.
3. In Elden Ring set **Display mode → Borderless windowed**. Windows does not draw other windows over exclusive full screen.

| Default shortcut | Action |
| --- | --- |
| `Ctrl+Shift+M` | Show / hide the map. Showing it gives it the keyboard; hiding it returns to the game |
| `Ctrl+Shift+K` | Click-through: the map stays visible but clicks and keys go to the game |

- Drag the window by the gold handle at its top edge and resize it from its edges. Position and size are remembered.
- Opacity is set in Settings (30–100%).
- Shortcuts use the format `Ctrl+Shift+M`, `Alt+F1`, `Ctrl+Alt+Digit1`, etc. If another app already took one, Settings says so.
- Settings are saved in `%APPDATA%\com.eldencoop.overlay\config.json`.

## Build

The installer is built on Windows by GitHub Actions (`.github/workflows/overlay.yml`), since Tauri does not cross-compile from macOS reliably. Every push to `master` that changes `overlay/` (or the workflow) builds it and publishes it as a **pre-release** in the repo's Releases, tagged `overlay-v<version>-rc.<run number>`. The version comes from `src-tauri/tauri.conf.json`.

The installer does not need admin rights. It uses WebView2, which ships with Windows 10 and 11.

Locally (needs Node and Rust; on Windows also the [Tauri prerequisites](https://tauri.app/start/prerequisites/)):

```sh
cd overlay
npm install
npm run dev     # run it
npm run build   # Windows installer in src-tauri/target/release/bundle/nsis/
npm run icons   # regenerate icons from public/app-icons/icon-512.png
```

It also runs on macOS with `npm run dev`, handy for testing; the game is not there, though.

## How it works

- `src-tauri/src/main.rs`: the whole app. Tray menu, global shortcuts (`tauri-plugin-global-shortcut`), the map window (frameless, transparent, always on top, not in the taskbar) and the config file.
- `ui/`: the settings page, the only local page.
- The map window loads the **remote** app. After each page load the overlay injects a `<style>` with the opacity and the drag handle.
- **Permissions:** the remote page gets a single one, dragging its own window, granted at runtime for the configured origin only. The `get_config` / `save_config` commands are only allowed for the local settings window (`capabilities/settings.json`, enforced through the app manifest in `build.rs`).
