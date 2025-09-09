use std::process::Command;

fn main() {
    println!("🧪 Testing Categories Sync Fix...");
    
    // First, run the diagnostic
    println!("\n1. Running diagnostic...");
    let diagnostic_output = Command::new("cargo")
        .args(&["run", "--bin", "tauri-app", "--", "diagnose_categories_conflicts"])
        .current_dir("/home/deniskariuki/shelf-serpent-desktop/src-tauri")
        .output()
        .expect("Failed to run diagnostic");
    
    println!("Diagnostic stdout: {}", String::from_utf8_lossy(&diagnostic_output.stdout));
    println!("Diagnostic stderr: {}", String::from_utf8_lossy(&diagnostic_output.stderr));
    
    // Then, run the cleanup
    println!("\n2. Running cleanup...");
    let cleanup_output = Command::new("cargo")
        .args(&["run", "--bin", "tauri-app", "--", "cleanup_duplicate_categories"])
        .current_dir("/home/deniskariuki/shelf-serpent-desktop/src-tauri")
        .output()
        .expect("Failed to run cleanup");
    
    println!("Cleanup stdout: {}", String::from_utf8_lossy(&cleanup_output.stdout));
    println!("Cleanup stderr: {}", String::from_utf8_lossy(&cleanup_output.stderr));
    
    // Finally, run the fixed sync
    println!("\n3. Running fixed sync...");
    let sync_output = Command::new("cargo")
        .args(&["run", "--bin", "tauri-app", "--", "sync_categories_fixed"])
        .current_dir("/home/deniskariuki/shelf-serpent-desktop/src-tauri")
        .output()
        .expect("Failed to run sync");
    
    println!("Sync stdout: {}", String::from_utf8_lossy(&sync_output.stdout));
    println!("Sync stderr: {}", String::from_utf8_lossy(&sync_output.stderr));
    
    println!("\n🎉 Test completed!");
}
