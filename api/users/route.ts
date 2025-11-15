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

    // GET - Get user profile
    if (req.method === 'GET') {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user_id)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(user);
    }

    // POST - Create or update user profile
    if (req.method === 'POST') {
      const { id, email, full_name, style_preferences, sizes } = req.body;

      if (!id || !email) {
        return res.status(400).json({ error: 'ID and email are required' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .upsert({
          id,
          email,
          full_name,
          style_preferences,
          sizes,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(user);
    }

    // PUT - Update user profile
    if (req.method === 'PUT') {
      const { user_id, updates } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user_id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(user);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}