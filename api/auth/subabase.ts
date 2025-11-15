import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // Use ANON key for auth
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { code } = req.query;

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(String(code));
      if (error) {
        console.error('Auth error:', error);
        return res.redirect('/auth/error');
      }
    }

    // Successful redirect
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Auth callback error:', error);
    return res.redirect('/auth/error');
  }
}