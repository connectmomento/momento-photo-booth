-- Create photos table for storing event photos
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create guests table for tracking event guests
CREATE TABLE IF NOT EXISTS public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE public.photos 
ADD CONSTRAINT fk_photos_guest 
FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (event dashboard)
CREATE POLICY "photos_public_select" ON public.photos FOR SELECT USING (true);
CREATE POLICY "photos_public_insert" ON public.photos FOR INSERT WITH CHECK (true);

CREATE POLICY "guests_public_select" ON public.guests FOR SELECT USING (true);
CREATE POLICY "guests_public_insert" ON public.guests FOR INSERT WITH CHECK (true);

-- Enable realtime for the photos table
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
