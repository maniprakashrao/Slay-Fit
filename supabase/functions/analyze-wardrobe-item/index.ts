// supabase/functions/analyze-wardrobe-item/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_url } = await req.json();
    
    if (!image_url) {
      throw new Error('Image URL is required');
    }

    console.log('Analyzing clothing image with Gemini 2.0 Flash...');
    const analysisResult = await analyzeClothingWithGemini2(image_url);
    
    return new Response(
      JSON.stringify({
        success: true,
        attributes: analysisResult,
        model_used: "gemini-2.0-flash" // Using the latest model
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in analyze-wardrobe-item:', error);
    
    const message = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        attributes: null,
        model_used: "gemini-2.0-flash"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function analyzeClothingWithGemini2(imageUrl: string) {
  function getEnv(key: string): string | undefined {
    const deno = (globalThis as any).Deno;
    if (deno?.env?.get) return deno.env.get(key);
    const g = (globalThis as any);
    if (typeof g.process !== 'undefined' && g.process?.env) return g.process.env[key];
    return undefined;
  }

  const geminiApiKey = getEnv('GEMINI_API_KEY');
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const imageBase64 = await urlToBase64(imageUrl);

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `You are a professional fashion stylist. Analyze this clothing item and return ONLY a JSON object with these attributes:

REQUIRED ATTRIBUTES:
- category: shirt, t-shirt, pants, jeans, dress, skirt, shoes, sneakers, boots, jacket, coat, sweater, hoodie, shorts, blouse, accessories, bag, jewelry, watch, glasses, hat
- color: black, white, blue, red, green, yellow, pink, purple, brown, gray, orange, beige, navy, maroon, teal, multi-color
- style: casual, formal, sporty, elegant, business, vintage, bohemian, streetwear, athletic, romantic, minimalist
- pattern: solid, striped, floral, checkered, plaid, printed, graphic, animal-print, polka-dot, abstract, geometric
- season: spring, summer, fall, winter, all-season
- fabric: cotton, silk, denim, wool, polyester, linen, leather, synthetic, knit, chiffon, velvet, satin
- occasion: casual, formal, business, party, sports, beach, wedding, everyday, work, dinner

OPTIONAL ATTRIBUTES:
- brand: if recognizable, else null
- size: XS, S, M, L, XL, XXL, or null if not visible

IMPORTANT: 
- Return ONLY valid JSON, no other text
- Be accurate and specific about fashion details
- If unsure about any attribute, use null
- Category is required

Example response format:
{
  "category": "dress",
  "color": "red", 
  "style": "elegant",
  "pattern": "floral",
  "season": "summer",
  "brand": null,
  "fabric": "silk",
  "occasion": "wedding",
  "size": "M"
}`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
      topP: 0.8,
      topK: 40,
    }
  };

  // Using Gemini 2.0 Flash - the latest model
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gemini 2.0 Flash API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('Invalid Gemini 2.0 Flash response:', data);
    throw new Error('Invalid response format from Gemini 2.0 Flash API');
  }

  const analysisText = data.candidates[0].content.parts[0].text;
  console.log('Gemini 2.0 Flash raw analysis:', analysisText);
  
  // Extract JSON from response
  const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain valid JSON. Response: ' + analysisText);
  }

  try {
    const attributes = JSON.parse(jsonMatch[0]);
    
    // Validate required category
    const validCategories = ['shirt', 't-shirt', 'pants', 'jeans', 'dress', 'skirt', 'shoes', 'sneakers', 'boots', 'jacket', 'coat', 'sweater', 'hoodie', 'shorts', 'blouse', 'accessories', 'bag', 'jewelry', 'watch', 'glasses', 'hat'];
    
    if (!attributes.category || !validCategories.includes(attributes.category.toLowerCase())) {
      throw new Error('AI failed to detect valid clothing category');
    }
    
    return {
      category: attributes.category.toLowerCase(),
      color: attributes.color?.toLowerCase() || null,
      style: attributes.style?.toLowerCase() || null,
      pattern: attributes.pattern?.toLowerCase() || null,
      season: attributes.season?.toLowerCase() || null,
      brand: attributes.brand || null,
      fabric: attributes.fabric?.toLowerCase() || null,
      occasion: attributes.occasion?.toLowerCase() || null,
      size: attributes.size || null,
    };
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    throw new Error('Failed to parse AI response as valid JSON');
  }
}

async function urlToBase64(imageUrl: string): Promise<string> {
  try {
    console.log('Fetching image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to process image for AI analysis');
  }
}