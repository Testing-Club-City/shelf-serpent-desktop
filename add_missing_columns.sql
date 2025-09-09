-- Add missing columns to existing tables

-- Add missing columns to profiles table
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN suspended INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_online INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_seen TEXT;

-- Add missing column to system_settings table
ALTER TABLE system_settings ADD COLUMN updated_by TEXT;