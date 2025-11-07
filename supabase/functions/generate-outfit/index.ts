import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wardrobeItems } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context about available wardrobe items
    const wardrobeContext = wardrobeItems && wardrobeItems.length > 0
      ? `Available wardrobe items:\n${wardrobeItems.map((item: any) => 
          `- ${item.type}: ${item.name} (${item.color})`
        ).join('\n')}`
      : 'User has not uploaded any wardrobe items yet.';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert fashion stylist AI. Create outfit recommendations based on the user's wardrobe items. 
            
Return a JSON object with this structure:
{
  "occasion": "string - the occasion for this outfit",
  "top": { "name": "string - item name", "description": "string - why this works" },
  "bottom": { "name": "string - item name", "description": "string - why this works" },
  "shoes": { "name": "string - item name", "description": "string - why this works" },
  "styleNotes": "string - overall styling advice for this outfit"
}

If the user has wardrobe items, use them. If not, suggest generic classic pieces that would work well together.`
          },
          {
            role: 'user',
            content: `${wardrobeContext}\n\nCreate a stylish outfit recommendation. If I don't have items yet, suggest what I should get.`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse the JSON response from AI
    let outfit;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/\{[\s\S]*\}/);
      outfit = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Failed to parse AI response');
    }

    return new Response(
      JSON.stringify({ outfit }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-outfit function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
