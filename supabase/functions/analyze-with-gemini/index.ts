// supabase/functions/analyze-with-gemini/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Read the Gemini API key in a runtime-agnostic way (supports Deno and Node).
const GEMINI_API_KEY =
  ((globalThis as any).Deno?.env?.get?.('GOOGLE_GEMINI_API_KEY')) ??
  ((globalThis as any).process?.env?.GOOGLE_GEMINI_API_KEY) ??
  '';

// Using the latest Gemini 2.0 Flash model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_url } = await req.json();

    if (!image_url) {
      throw new Error('Image URL is required');
    }

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    console.log('Fetching image from URL:', image_url);
    
    // Fetch the image
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = btoa(
      new Uint8Array(imageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const prompt = `
    Analyze this clothing image thoroughly and provide detailed attributes in JSON format. Be very specific and accurate.

    CLOTHING ANALYSIS:
    1. CATEGORY: Identify the exact type (shirt/t-shirt, pants/jeans, dress, shoes/sneakers, jacket/coat, accessories)
    2. COLOR: Primary and secondary colors with specific names (Navy Blue, Crimson Red, Olive Green, etc.)
    3. STYLE: Fashion style (casual, formal, sporty, elegant, business, streetwear, vintage, bohemian)
    4. PATTERN: Surface pattern (solid, striped, floral, checkered/plaid, printed, graphic, embroidered, textured)
    5. SEASON: Appropriate seasons (spring, summer, fall, winter, all-season)
    6. FABRIC: Material composition (cotton, denim, silk, wool, polyester, linen, leather, knit, chiffon)
    7. OCCASION: Suitable occasions (casual, formal, business, party, wedding, sports, beach, everyday)
    8. BRAND: If visible, identify brand; otherwise "Unknown"
    9. SIZE: Estimate size based on proportions (XS, S, M, L, XL, XXL) or "Unknown"

    IMPORTANT INSTRUCTIONS:
    - Provide confidence scores (0-100) for each attribute
    - Calculate overall confidence based on image clarity and visibility
    - Be very specific with color names and fabric types
    - If uncertain, provide lower confidence scores
    - Return ONLY valid JSON, no additional text

    OUTFIT SUGGESTIONS:
    Provide 3 practical outfit combinations that would work well with this item.

    RESPONSE FORMAT:
    {
      "success": true,
      "attributes": {
        "category": {"value": "shirt", "confidence": 85},
        "color": {"value": "Navy Blue", "confidence": 90},
        "style": {"value": "casual", "confidence": 80},
        "pattern": {"value": "solid", "confidence": 85},
        "season": {"value": "all-season", "confidence": 75},
        "fabric": {"value": "cotton", "confidence": 70},
        "occasion": {"value": "casual", "confidence": 85},
        "brand": {"value": "Unknown", "confidence": 10},
        "size": {"value": "M", "confidence": 50}
      },
      "overall_confidence": 78,
      "outfit_suggestions": [
        "Pair with light wash jeans and white sneakers for a casual look",
        "Wear with chino pants and loafers for a smart-casual outfit",
        "Layer under a blazer with dress pants for business casual"
      ]
    }

    Analyze the image carefully and provide the most accurate assessment possible.
    `;

    console.log('Calling Gemini 2.0 Flash API...');
    
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: imageResponse.headers.get('content-type') || 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent results
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract the text response from Gemini
    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Parse the JSON response from Gemini
    let analysisResult;
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed Gemini response');
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      throw new Error('Failed to parse AI response');
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-with-gemini:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        fallback_used: true
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});