-- Add event_date column if it doesn't exist (the 'date' column might have schema cache issues)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE;
