use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

pub static SYNC_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

pub fn start_sync() -> bool {
    SYNC_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok()
}

pub fn end_sync() {
    SYNC_IN_PROGRESS.store(false, Ordering::SeqCst);
}

pub fn is_sync_in_progress() -> bool {
    SYNC_IN_PROGRESS.load(Ordering::SeqCst)
}