import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  category_id: string;
  total_copies: number;
  available_copies: number;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface BarcodeData {
  code: string;
  format: string;
  timestamp: string;
}

export interface ScanResult {
  success: boolean;
  data?: BarcodeData;
  error?: string;
}

export interface SyncStatus {
  last_sync_seconds_ago?: number;
  is_online: boolean;
}

export class TauriAPI {
  private static instance: TauriAPI;

  private constructor() {}

  public static getInstance(): TauriAPI {
    if (!TauriAPI.instance) {
      TauriAPI.instance = new TauriAPI();
    }
    return TauriAPI.instance;
  }

  // Book operations
  async getBooks(limit?: number, offset?: number): Promise<Book[]> {
    try {
      return await invoke('get_books', { limit, offset });
    } catch (error) {
      console.error('Failed to get books:', error);
      throw error;
    }
  }

  async searchBooks(query: string): Promise<Book[]> {
    try {
      return await invoke('search_books', { query });
    } catch (error) {
      console.error('Failed to search books:', error);
      throw error;
    }
  }

  async getBookByBarcode(barcode: string): Promise<Book | null> {
    try {
      return await invoke('get_book_by_barcode', { barcode });
    } catch (error) {
      console.error('Failed to get book by barcode:', error);
      throw error;
    }
  }

  // Dashboard operations
  async getDashboardStats(): Promise<any> {
    try {
      return await invoke('get_dashboard_stats');
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      throw error;
    }
  }

  // Barcode scanning operations
  async startBarcodeScan(): Promise<void> {
    try {
      await invoke('start_barcode_scan');
    } catch (error) {
      console.error('Failed to start barcode scan:', error);
      throw error;
    }
  }

  async stopBarcodeScan(): Promise<void> {
    try {
      await invoke('stop_barcode_scan');
    } catch (error) {
      console.error('Failed to stop barcode scan:', error);
      throw error;
    }
  }

  async processBarcode(barcode: string): Promise<ScanResult> {
    try {
      return await invoke('process_barcode', { barcode });
    } catch (error) {
      console.error('Failed to process barcode:', error);
      throw error;
    }
  }

  async validateISBN(isbn: string): Promise<boolean> {
    try {
      return await invoke('validate_isbn', { isbn });
    } catch (error) {
      console.error('Failed to validate ISBN:', error);
      throw error;
    }
  }

  // Sync operations
  async forceSync(): Promise<void> {
    try {
      await invoke('force_sync');
    } catch (error) {
      console.error('Failed to force sync:', error);
      throw error;
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      return await invoke('get_sync_status');
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  // Event listeners
  onBarcodeScanned(callback: (data: BarcodeData) => void) {
    return listen('barcode_scanned', (event) => {
      callback(event.payload as BarcodeData);
    });
  }

  onBarcodeScanStarted(callback: () => void) {
    return listen('barcode_scan_started', () => {
      callback();
    });
  }

  onBarcodeScanStopped(callback: () => void) {
    return listen('barcode_scan_stopped', () => {
      callback();
    });
  }

  onBarcodeScannerReady(callback: () => void) {
    return listen('barcode_scanner_ready', () => {
      callback();
    });
  }
}

// Export singleton instance
export const api = TauriAPI.getInstance();
