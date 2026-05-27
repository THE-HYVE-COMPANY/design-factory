// SPIKE scaffold — Tauri 2 shell for Design Factory.
// Picks a FREE bridge port (never collides with whatever holds 1421), spawns the
// daemon sidecar on it, and injects that port into the WebView before app JS
// runs (window.__DF_BRIDGE_PORT__) so the frontend talks to the right port.
// The sidecar's output goes to ~/design-factory-daemon.log for diagnosis; a
// sidecar failure never panics — the window still opens and the log explains.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{OpenOptions, write as fs_write};
use std::io::Write;
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

fn log_path() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    std::path::Path::new(&home).join("design-factory-daemon.log")
}

fn dlog(msg: &str) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path()) {
        let _ = writeln!(f, "[{}] {}", ts, msg);
    }
}

// A free TCP port the OS hands us; the listener is dropped immediately so the
// daemon can bind it a moment later. Falls back to 1421 if the probe fails.
fn pick_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(1421)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _ = fs_write(log_path(), "=== Design Factory daemon log ===\n");
            let port = pick_free_port();
            dlog(&format!("chosen bridge port: {}", port));

            // Create the window with the port injected BEFORE any app JS runs,
            // so claude-bridge.ts reads window.__DF_BRIDGE_PORT__ synchronously.
            let init = format!("window.__DF_BRIDGE_PORT__ = {};", port);
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Design Factory")
                .inner_size(1280.0, 832.0)
                .min_inner_size(880.0, 600.0)
                .initialization_script(&init)
                .build()?;
            // BUG-3 (2026-05-25 Windows audit): the unconditional open_devtools()
            // here opened the inspector in release builds for every user. Gate it
            // to debug builds only (run `cargo build` without --release to see it).
            #[cfg(debug_assertions)]
            win.open_devtools();

            // Spawn the bundled daemon sidecar on the chosen port.
            dlog("setup: resolving daemon sidecar 'df-daemon'");
            match app.shell().sidecar("df-daemon") {
                Ok(cmd) => match cmd.env("DF_BRIDGE_PORT", port.to_string()).spawn() {
                    Ok((mut rx, _child)) => {
                        dlog("sidecar spawned ok — waiting for output");
                        tauri::async_runtime::spawn(async move {
                            while let Some(ev) = rx.recv().await {
                                match ev {
                                    CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                                        dlog(&format!(
                                            "[daemon] {}",
                                            String::from_utf8_lossy(&line).trim_end()
                                        ));
                                    }
                                    other => dlog(&format!("[daemon] {:?}", other)),
                                }
                            }
                            dlog("[daemon] output stream ended");
                        });
                    }
                    Err(e) => dlog(&format!("FAILED to spawn sidecar: {}", e)),
                },
                Err(e) => dlog(&format!(
                    "FAILED to resolve sidecar 'df-daemon' (bundling/name?): {}",
                    e
                )),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Design Factory");
}
