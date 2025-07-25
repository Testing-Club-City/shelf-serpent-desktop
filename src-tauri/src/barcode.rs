use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarcodeData {
    pub code: String,
    pub format: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub data: Option<BarcodeData>,
    pub error: Option<String>,
}

pub struct BarcodeScanner {
    app_handle: AppHandle,
    is_scanning: Arc<Mutex<bool>>,
}

impl BarcodeScanner {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            is_scanning: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start_scan(&self) -> Result<()> {
        let mut scanning = self.is_scanning.lock().await;
        if *scanning {
            return Ok(()); // Already scanning
        }
        *scanning = true;

        // In a real implementation, this would interface with camera/barcode scanner hardware
        // For now, we'll simulate barcode scanning and provide a UI for manual input
        self.app_handle.emit("barcode_scan_started", ()).unwrap();
        
        // Start a background task to listen for barcode input
        let app_handle = self.app_handle.clone();
        let is_scanning = Arc::clone(&self.is_scanning);
        
        tokio::spawn(async move {
            // Simulate waiting for barcode input
            // In a real implementation, this would interface with hardware
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            
            // Emit that we're ready for barcode input
            app_handle.emit("barcode_scanner_ready", ()).unwrap();
        });

        Ok(())
    }

    pub async fn stop_scan(&self) -> Result<()> {
        let mut scanning = self.is_scanning.lock().await;
        *scanning = false;
        
        self.app_handle.emit("barcode_scan_stopped", ()).unwrap();
        Ok(())
    }

    pub async fn process_barcode(&self, barcode: String) -> Result<ScanResult> {
        let scanning = self.is_scanning.lock().await;
        if !*scanning {
            return Ok(ScanResult {
                success: false,
                data: None,
                error: Some("Scanner is not active".to_string()),
            });
        }

        // Validate barcode format
        if barcode.trim().is_empty() {
            return Ok(ScanResult {
                success: false,
                data: None,
                error: Some("Empty barcode".to_string()),
            });
        }

        let barcode_data = BarcodeData {
            code: barcode.trim().to_string(),
            format: self.detect_barcode_format(&barcode),
            timestamp: chrono::Utc::now(),
        };

        // Emit the barcode data to the frontend
        self.app_handle.emit("barcode_scanned", &barcode_data).unwrap();

        Ok(ScanResult {
            success: true,
            data: Some(barcode_data),
            error: None,
        })
    }

    fn detect_barcode_format(&self, barcode: &str) -> String {
        let barcode = barcode.trim();
        
        // ISBN detection
        if barcode.len() == 10 || barcode.len() == 13 {
            if barcode.chars().all(|c| c.is_ascii_digit() || c == '-' || c == 'X') {
                return if barcode.len() == 13 { "ISBN-13".to_string() } else { "ISBN-10".to_string() };
            }
        }

        // UPC/EAN detection
        if barcode.len() == 12 && barcode.chars().all(|c| c.is_ascii_digit()) {
            return "UPC-A".to_string();
        }
        
        if barcode.len() == 13 && barcode.chars().all(|c| c.is_ascii_digit()) {
            return "EAN-13".to_string();
        }

        // Code 128 or custom format
        if barcode.len() >= 4 && barcode.len() <= 20 {
            return "Code128".to_string();
        }

        "Unknown".to_string()
    }

    pub async fn is_scanning(&self) -> bool {
        *self.is_scanning.lock().await
    }

    // Utility function to validate ISBN
    pub fn validate_isbn(&self, isbn: &str) -> bool {
        let digits: String = isbn.chars().filter(|c| c.is_ascii_digit() || *c == 'X').collect();
        
        match digits.len() {
            10 => self.validate_isbn10(&digits),
            13 => self.validate_isbn13(&digits),
            _ => false,
        }
    }

    fn validate_isbn10(&self, isbn: &str) -> bool {
        if isbn.len() != 10 {
            return false;
        }

        let mut sum = 0;
        for (i, ch) in isbn.chars().enumerate() {
            if i == 9 && ch == 'X' {
                sum += 10 * (10 - i);
            } else if let Some(digit) = ch.to_digit(10) {
                sum += digit as usize * (10 - i);
            } else {
                return false;
            }
        }

        sum % 11 == 0
    }

    fn validate_isbn13(&self, isbn: &str) -> bool {
        if isbn.len() != 13 {
            return false;
        }

        let mut sum = 0;
        for (i, ch) in isbn.chars().enumerate() {
            if let Some(digit) = ch.to_digit(10) {
                let multiplier = if i % 2 == 0 { 1 } else { 3 };
                sum += digit as usize * multiplier;
            } else {
                return false;
            }
        }

        sum % 10 == 0
    }

    // Function to handle keyboard input for barcode scanning
    pub async fn handle_keyboard_input(&self, input: String) -> Result<()> {
        if self.is_scanning().await {
            // Process the keyboard input as a barcode
            let result = self.process_barcode(input).await?;
            
            if result.success {
                // Auto-stop scanning after successful scan
                self.stop_scan().await?;
            }
        }
        
        Ok(())
    }
}
