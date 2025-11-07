-- Create storage bucket for wardrobe images
INSERT INTO storage.buckets (id, name, public)
VALUES ('wardrobe-images', 'wardrobe-images', true);

-- Create wardrobe_items table
CREATE TABLE public.wardrobe_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  color TEXT,
  style TEXT,
  pattern TEXT,
  season TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own wardrobe items"
ON public.wardrobe_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wardrobe items"
ON public.wardrobe_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wardrobe items"
ON public.wardrobe_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wardrobe items"
ON public.wardrobe_items
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_wardrobe_items_updated_at
BEFORE UPDATE ON public.wardrobe_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for wardrobe images
CREATE POLICY "Wardrobe images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'wardrobe-images');

CREATE POLICY "Users can upload their own wardrobe images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'wardrobe-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own wardrobe images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'wardrobe-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own wardrobe images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'wardrobe-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);