#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting minimal Tauri test...");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            println!("✅ Tauri setup completed");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}