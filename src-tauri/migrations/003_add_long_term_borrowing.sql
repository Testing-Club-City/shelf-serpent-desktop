-- Migration: Add long-term borrowing support
-- This migration adds columns to the borrowings table to support long-term borrowing

-- Add new columns to borrowings table
ALTER TABLE borrowings ADD COLUMN borrowing_type TEXT DEFAULT 'short_term' CHECK (borrowing_type IN ('short_term', 'long_term'));
ALTER TABLE borrowings ADD COLUMN long_term_period TEXT CHECK (long_term_period IN ('3_terms', '1_year', '4_years'));
ALTER TABLE borrowings ADD COLUMN short_term_period TEXT CHECK (short_term_period IN ('1_week', '2_weeks', '3_weeks'));
ALTER TABLE borrowings ADD COLUMN is_long_term BOOLEAN DEFAULT FALSE;

-- Create index for better performance on borrowing type queries
CREATE INDEX IF NOT EXISTS idx_borrowings_type ON borrowings(borrowing_type);
CREATE INDEX IF NOT EXISTS idx_borrowings_long_term ON borrowings(is_long_term);

-- Update existing records to have short_term as default
UPDATE borrowings SET borrowing_type = 'short_term', is_long_term = FALSE WHERE borrowing_type IS NULL;