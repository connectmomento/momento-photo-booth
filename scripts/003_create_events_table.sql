-- Create events table for multi-event support
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  date DATE,
  photo_limit INTEGER DEFAULT 25,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow public read access to events
CREATE POLICY "events_select_all" ON events FOR SELECT USING (true);

-- Allow public insert/update/delete for admin functionality
CREATE POLICY "events_insert_all" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_update_all" ON events FOR UPDATE USING (true);
CREATE POLICY "events_delete_all" ON events FOR DELETE USING (true);

-- Add event_id column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Add event_id column to guests table  
ALTER TABLE guests ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);

-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;
