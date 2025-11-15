import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ message: 'OK' });
    }

    if (req.method === 'GET') {
      const { data: outfits, error } = await supabase
        .from('outfits')
        .select('*');
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(outfits);
    }

    if (req.method === 'POST') {
      const { outfit_data, user_id } = req.body;
      
      const { data, error } = await supabase
        .from('outfits')
        .insert([{ outfit_data, user_id }])
        .select();
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Outfits API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}