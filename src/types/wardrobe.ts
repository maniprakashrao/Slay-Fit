export interface WardrobeItem {
  id: string;
  user_id: string;
  category: string;
  image_url: string;
  color?: string | null;
  style?: string | null;
  pattern?: string | null;
  season?: string | null;
  brand?: string | null;
  fabric?: string | null;
  occasion?: string | null;
  gender?: string | null;
  name?: string | null;
  created_at?: string;
  updated_at?: string;
}