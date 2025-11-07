import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Loader2, 
  Shirt, 
  Palette, 
  Calendar,
  Zap,
  TrendingUp,
  Shield,
  Baby,
  ShirtIcon,
  RotateCw,
  Heart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/**
 * Inline simplified wardrobe utilities to avoid missing-module compile errors.
 * These implementations are intentionally permissive and lightweight so the page
 * can compile and the Generate logic continues to work as before.
 */

type MaybeString = string | undefined | null;

const categoryMatches = (value: MaybeString, patterns: string[]) => {
  const v = (value || "").toLowerCase();
  return patterns.some(p => v.includes(p));
};

const getFilteredWardrobeItems = (items: any[], selectedGender: string) => {
  if (!items || items.length === 0) return [];
  const gender = selectedGender || "All";

  if (gender === "All" || gender === "Unisex") {
    return items;
  }

  if (gender === "Kids") {
    return items.filter(i => {
      const g = (i.gender || "").toLowerCase();
      return g === "kids" || /kid|child|toddler|baby/i.test(i.category || i.name || "");
    });
  }

  // For Male/Female: prefer explicit matches but allow unspecified items
  return items.filter(i => {
    const g = (i.gender || "").toLowerCase();
    if (!g) return true; // include unspecified
    return g === gender.toLowerCase();
  });
};

const categorizeItems = (items: any[]) => {
  const tops = items.filter(i => categoryMatches(i.category, ['top','shirt','blouse','t-shirt','tshirt','sweater','hoodie','cardigan','jacket','coat']));
  const bottoms = items.filter(i => categoryMatches(i.category, ['pant','pants','jeans','trouser','short','skirt','legging']));
  const shoes = items.filter(i => categoryMatches(i.category, ['shoe','sneaker','boot','heel','loafer','oxford','sandals','trainer']));
  const accessories = items.filter(i => categoryMatches(i.category, ['accessory','bag','purse','scarf','belt','hat','cap','watch','necklace','earring','bracelet'])) 
                      // anything not already in tops/bottoms/shoes
                      .concat(items.filter(i => {
                        const c = (i.category || "").toLowerCase();
                        return !categoryMatches(c, ['top','shirt','pant','pants','jeans','trouser','short','skirt','shoe','sneaker','boot','heel','bag','purse','accessory']);
                      }).slice(0, 12))
                      .slice(0, 12);

  return { tops, bottoms, shoes, accessories };
};

const getWardrobeStats = (items: any[], selectedGender: string) => {
  const filtered = getFilteredWardrobeItems(items || [], selectedGender);
  const { tops, bottoms, shoes, accessories } = categorizeItems(filtered);
  const total = filtered.length;
  return {
    tops: tops.length,
    bottoms: bottoms.length,
    shoes: shoes.length,
    accessories: accessories.length,
    total
  };
};

interface WardrobeItem {
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

interface Event {
  id: string;
  title: string;
  date: string;
  occasion: string;
  description: string;
  dress_code: string;
}

interface GeneratedOutfit {
  top: WardrobeItem;
  bottom: WardrobeItem;
  shoes?: WardrobeItem;
  accessories: WardrobeItem[];
  occasion: string;
  styleNotes: string;
  aiScore: number;
  isAIGenerated: boolean;
  gender: string;
  generationId: string;
}

const Generate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [selectedGender, setSelectedGender] = useState("All");
  const [todaysEvents, setTodaysEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [loadingWardrobe, setLoadingWardrobe] = useState(true);
  const [previousOutfits, setPreviousOutfits] = useState<Set<string>>(new Set());
  const [savingOutfit, setSavingOutfit] = useState(false);

  const manualEvents: Event[] = [
    {
      id: 'casual',
      title: 'Casual Day',
      date: new Date().toISOString().split('T')[0],
      occasion: 'casual',
      description: 'Everyday casual outfit',
      dress_code: 'Casual'
    },
    {
      id: 'work',
      title: 'Work/Office',
      date: new Date().toISOString().split('T')[0],
      occasion: 'formal',
      description: 'Professional work attire',
      dress_code: 'Business Casual'
    },
    {
      id: 'date',
      title: 'Date Night',
      date: new Date().toISOString().split('T')[0],
      occasion: 'smart casual',
      description: 'Evening out or special occasion',
      dress_code: 'Smart Casual'
    },
    {
      id: 'sports',
      title: 'Sports/Activity',
      date: new Date().toISOString().split('T')[0],
      occasion: 'sporty',
      description: 'Physical activity or workout',
      dress_code: 'Athletic'
    }
  ];

  useEffect(() => {
    if (user) {
      console.log("User detected, loading wardrobe items...", user.id);
      loadWardrobeItems();
      loadUserGenderPreference();
      loadTodaysEvents();
    } else {
      console.log("No user detected");
      setLoadingWardrobe(false);
    }
  }, [user]);

  const loadTodaysEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // supabase typings may not include 'events' in the generated Database type,
      // cast to any to avoid excessive type instantiation and allow runtime query.
      const res: any = await (supabase as any)
        .from('events')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false });
      const { data, error } = res;

      if (error) {
        console.log('No events found for today:', error);
        setSelectedEvent(manualEvents[0]);
        return;
      }
      
      console.log('Loaded events:', data);
      setTodaysEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEvent(data[0]);
      } else {
        setSelectedEvent(manualEvents[0]);
      }
    } catch (error) {
      console.error('Error loading today\'s events:', error);
      setSelectedEvent(manualEvents[0]);
    }
  };

  const loadUserGenderPreference = async () => {
    try {
      const savedPreference = localStorage.getItem('user_gender_preference');
      if (savedPreference) {
        setSelectedGender(savedPreference);
      }
    } catch (error) {
      console.error('Error loading gender preference:', error);
    }
  };

  const saveGenderPreference = async (gender: string) => {
    localStorage.setItem('user_gender_preference', gender);
  };

  const loadWardrobeItems = async () => {
    try {
      console.log("Starting to load wardrobe items for user:", user?.id);
      setLoadingWardrobe(true);
      
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading wardrobe:', error);
        throw error;
      }

      console.log("Wardrobe items loaded:", data?.length);
      const items = (data as WardrobeItem[]) || [];
      setWardrobeItems(items);
      
      // Log gender distribution for debugging
      const genderCount: Record<string, number> = {};
      items.forEach(item => {
        const gender = item.gender || 'Unspecified';
        genderCount[gender] = (genderCount[gender] || 0) + 1;
      });
      console.log("Gender distribution:", genderCount);
      
    } catch (error: any) {
      console.error('Error loading wardrobe:', error);
      toast({
        title: "Error loading wardrobe",
        description: error.message || "Could not load your wardrobe items",
        variant: "destructive",
      });
    } finally {
      setLoadingWardrobe(false);
    }
  };

  // Use shared utility functions for consistent filtering and stats
  const getFilteredItems = () => {
    return getFilteredWardrobeItems(wardrobeItems, selectedGender);
  };

  const getStats = () => {
    return getWardrobeStats(wardrobeItems, selectedGender);
  };

  const handleGenderChange = (gender: string) => {
    console.log("Gender changed to:", gender);
    setSelectedGender(gender);
    saveGenderPreference(gender);
    setOutfit(null);
    setAiAnalysis("");
    setPreviousOutfits(new Set());
  };

  const getGenderSpecificRecommendations = (gender: string) => {
    const recommendations = {
      Male: {
        preferredCategories: ['shirt', 'pants', 'jacket', 'shoes', 't-shirt', 'jeans', 'sweater', 'blazer', 'trousers', 'shorts'],
        styleEmphasis: ['formal', 'casual', 'sporty', 'business', 'smart', 'classic'],
        colorPreferences: ['black', 'navy', 'gray', 'white', 'blue', 'brown', 'olive', 'charcoal', 'burgundy'],
        avoidCategories: ['dress', 'skirt', 'heels', 'purse', 'lingerie'],
        fitPreferences: ['slim', 'regular', 'tailored'],
        accessoryTypes: ['watch', 'belt', 'tie', 'wallet']
      },
      Female: {
        preferredCategories: ['dress', 'top', 'skirt', 'shoes', 'accessories', 'blouse', 'heels', 'purse', 'handbag', 'jumpsuit', 'leggings', 'cardigan'],
        styleEmphasis: ['elegant', 'casual', 'trendy', 'feminine', 'chic', 'bohemian', 'romantic'],
        colorPreferences: ['pink', 'purple', 'red', 'pastel', 'floral', 'print', 'rose', 'lavender', 'coral', 'mauve'],
        avoidCategories: ['mens suit', 'tie', 'boxers', 'mens watch'],
        fitPreferences: ['fitted', 'flowy', 'wrap', 'bodycon'],
        accessoryTypes: ['necklace', 'earrings', 'bracelet', 'handbag', 'scarf']
      },
      Kids: {
        preferredCategories: [
          't-shirt', 'pants', 'dress', 'shoes', 'sweater', 'jacket', 'shorts', 
          'kids', 'child', 'children', 'toddler', 'baby', 'boy', 'girl',
          'hoodie', 'jeans', 'leggings', 'skirt', 'blouse', 'shirt', 'onesie',
          'romper', 'overall', 'pajama', 'playwear', 'sneakers', 'rainboots'
        ],
        styleEmphasis: ['playful', 'comfortable', 'colorful', 'durable', 'fun', 'casual', 'practical'],
        colorPreferences: ['bright', 'primary', 'rainbow', 'cartoon', 'fun print', 'colorful', 'red', 'blue', 'yellow', 'green', 'pink', 'purple', 'orange'],
        avoidCategories: ['formal suit', 'high heels', 'business attire', 'tie', 'blazer', 'cocktail dress'],
        fitPreferences: ['comfortable', 'roomy', 'easy wear'],
        accessoryTypes: ['backpack', 'hair clip', 'fun socks', 'sun hat']
      },
      Unisex: {
        preferredCategories: ['shirt', 'pants', 'jacket', 'shoes', 'hoodie', 'jeans', 'sweatshirt', 'sneakers'],
        styleEmphasis: ['casual', 'sporty', 'minimal', 'comfortable', 'urban'],
        colorPreferences: ['neutral', 'black', 'white', 'gray', 'blue', 'green', 'beige'],
        avoidCategories: [],
        fitPreferences: ['regular', 'comfortable'],
        accessoryTypes: ['beanie', 'backpack', 'sunglasses']
      }
    };
    
    return recommendations[gender as keyof typeof recommendations] || recommendations.Unisex;
  };

  const analyzeColorHarmony = (top: WardrobeItem, bottom: WardrobeItem, shoes?: WardrobeItem) => {
    const genderRecs = getGenderSpecificRecommendations(selectedGender);
    
    const colorGroups = {
      neutrals: ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown', 'cream', 'charcoal'],
      warm: ['red', 'orange', 'yellow', 'pink', 'burgundy', 'coral', 'gold', 'peach', 'rose', 'rust'],
      cool: ['blue', 'green', 'purple', 'teal', 'turquoise', 'silver', 'lavender', 'mint', 'sky'],
      earth: ['brown', 'olive', 'tan', 'khaki', 'cream', 'taupe', 'camel', 'sand'],
      pastel: ['pastel', 'light pink', 'baby blue', 'lavender', 'mint', 'peach', 'cream'],
      kids: ['bright', 'neon', 'rainbow', 'multicolor', 'primary', 'pastel', 'colorful']
    };

    const topColor = top?.color?.toLowerCase() || '';
    const bottomColor = bottom?.color?.toLowerCase() || '';
    const shoesColor = shoes?.color?.toLowerCase() || '';

    let score = 0;
    const notes: string[] = [];

    // Gender-specific color scoring
    if (genderRecs.colorPreferences.some(color => topColor.includes(color))) {
      score += 2;
      notes.push(`🎨 Perfect ${selectedGender}-appropriate top color`);
    }
    
    if (genderRecs.colorPreferences.some(color => bottomColor.includes(color))) {
      score += 2;
      notes.push(`🎨 Perfect ${selectedGender}-appropriate bottom color`);
    }

    // Special handling for Kids
    if (selectedGender === 'Kids') {
      if (colorGroups.kids.some(color => topColor.includes(color) || bottomColor.includes(color))) {
        score += 3;
        notes.push("🌈 Excellent kid-friendly colors");
      }
    }

    // Special handling for Female
    if (selectedGender === 'Female') {
      if (colorGroups.pastel.some(color => topColor.includes(color) || bottomColor.includes(color))) {
        score += 2;
        notes.push("💕 Beautiful feminine pastel tones");
      }
    }

    const isHarmonious = (color1: string, color2: string) => {
      for (const group of Object.values(colorGroups)) {
        if (group.some(color => color1.includes(color)) && group.some(color => color2.includes(color))) {
          return true;
        }
      }
      return false;
    };

    // Neutral base scoring
    if (colorGroups.neutrals.some(color => topColor.includes(color)) || 
        colorGroups.neutrals.some(color => bottomColor.includes(color))) {
      score += 2;
      notes.push("⚪ Versatile neutral foundation");
    }

    // Color harmony between top and bottom
    if (isHarmonious(topColor, bottomColor)) {
      score += 3;
      notes.push("🎨 Perfect color harmony");
    }

    // Shoes coordination
    if (shoesColor && (isHarmonious(shoesColor, topColor) || isHarmonious(shoesColor, bottomColor))) {
      score += 2;
      notes.push("👟 Shoes perfectly complement the outfit");
    }

    return { score: Math.min(score, 15), notes };
  };

  const analyzeStyleCompatibility = (top: WardrobeItem, bottom: WardrobeItem, shoes?: WardrobeItem) => {
    const genderRecs = getGenderSpecificRecommendations(selectedGender);
    
    const styles = {
      casual: ['casual', 'everyday', 'comfort', 'relaxed', 'street', 'basic'],
      formal: ['formal', 'business', 'professional', 'office', 'elegant', 'sophisticated'],
      sporty: ['sport', 'athletic', 'active', 'gym', 'workout', 'training'],
      trendy: ['trendy', 'fashion', 'modern', 'contemporary', 'chic'],
      vintage: ['vintage', 'retro', 'classic', 'traditional', 'heritage'],
      playful: ['playful', 'fun', 'colorful', 'whimsical', 'cartoon'],
      feminine: ['feminine', 'delicate', 'romantic', 'flowy', 'chic'],
      masculine: ['masculine', 'sharp', 'structured', 'tailored']
    };

    const topStyle = top?.style?.toLowerCase() || 'casual';
    const bottomStyle = bottom?.style?.toLowerCase() || 'casual';
    const shoesStyle = shoes?.style?.toLowerCase() || 'casual';

    let score = 0;
    const notes: string[] = [];

    // Gender-specific style scoring
    if (genderRecs.styleEmphasis.some(style => topStyle.includes(style))) {
      score += 2;
      notes.push(`👔 Perfect ${selectedGender}-style top`);
    }
    
    if (genderRecs.styleEmphasis.some(style => bottomStyle.includes(style))) {
      score += 2;
      notes.push(`👖 Perfect ${selectedGender}-style bottom`);
    }

    // Special handling for Kids
    if (selectedGender === 'Kids') {
      if (styles.playful.some(style => topStyle.includes(style) || bottomStyle.includes(style))) {
        score += 3;
        notes.push("🎮 Excellent playful, kid-appropriate styling");
      }
    }

    // Special handling for Female
    if (selectedGender === 'Female') {
      if (styles.feminine.some(style => topStyle.includes(style) || bottomStyle.includes(style))) {
        score += 3;
        notes.push("💃 Beautiful feminine styling");
      }
    }

    const styleCount: Record<string, number> = {};
    [topStyle, bottomStyle, shoesStyle].forEach(style => {
      Object.entries(styles).forEach(([category, keywords]) => {
        if (keywords.some(keyword => style.includes(keyword))) {
          styleCount[category] = (styleCount[category] || 0) + 1;
        }
      });
    });

    const dominantStyle = Object.keys(styleCount).reduce((a, b) => 
      (styleCount[a] || 0) > (styleCount[b] || 0) ? a : b, 'casual'
    );

    const isStyleConsistent = (style1: string, style2: string) => {
      for (const [category, keywords] of Object.entries(styles)) {
        const hasStyle1 = keywords.some(keyword => style1.includes(keyword));
        const hasStyle2 = keywords.some(keyword => style2.includes(keyword));
        if (hasStyle1 && hasStyle2) return true;
      }
      return false;
    };

    // Style consistency
    if (isStyleConsistent(topStyle, bottomStyle)) {
      score += 3;
      notes.push(`✨ Coherent ${dominantStyle} style throughout`);
    }

    if (shoes && isStyleConsistent(shoesStyle, dominantStyle)) {
      score += 2;
      notes.push("👞 Perfect matching shoe style");
    }

    // Event-based scoring
    if (selectedEvent) {
      const eventStyle = selectedEvent.occasion?.toLowerCase() || 'casual';
      if (dominantStyle === eventStyle) {
        score += 3;
        notes.push(`🎯 Perfect match for ${selectedEvent.occasion} event`);
      }
    }

    return { score: Math.min(score, 15), notes, dominantStyle };
  };

  const generateOutfitId = (top: WardrobeItem, bottom: WardrobeItem, shoes?: WardrobeItem) => {
    return `${top.id}-${bottom.id}-${shoes?.id || 'no-shoes'}`;
  };

  const saveOutfit = async (outfitToSave: GeneratedOutfit) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to save outfits",
        variant: "destructive",
      });
      return;
    }

    setSavingOutfit(true);

    try {
      const outfitData = {
        user_id: user.id,
        name: `${selectedGender} Outfit - ${new Date().toLocaleDateString()}`,
        description: outfitToSave.styleNotes,
        items: {
          top: outfitToSave.top,
          bottom: outfitToSave.bottom,
          shoes: outfitToSave.shoes,
          accessories: outfitToSave.accessories
        },
        occasion: outfitToSave.occasion,
        style: outfitToSave.styleNotes.split(' ').slice(0, 3).join(' '),
        ai_score: outfitToSave.aiScore,
        gender: selectedGender
      };

      console.log('Saving outfit data:', outfitData);

      // Cast to `any` because `saved_outfits` is not present in the generated Supabase types.
      // This keeps the runtime query intact while avoiding TypeScript overload errors.
      const { data, error } = await (supabase as any)
        .from('saved_outfits')
        .insert([outfitData] as any)
        .select();

      if (error) {
        // If table doesn't exist, create it first
        if (error.code === '42P01') {
          toast({
            title: "Setting up saved outfits...",
            description: "Please try saving again",
          });
          console.log('Saved outfits table does not exist yet');
          return;
        }
        throw error;
      }

      toast({
        title: "Outfit saved! 💫",
        description: "Your outfit has been saved to your collection",
      });

      console.log('Outfit saved successfully:', data);

    } catch (error: any) {
      console.error('Error saving outfit:', error);
      toast({
        title: "Failed to save outfit",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSavingOutfit(false);
    }
  };

  const generateAIOutfit = () => {
    const filteredItems = getFilteredItems();
    console.log(`Generating ${selectedGender} outfit with ${filteredItems.length} items`);
    
    const { tops, bottoms, shoes, accessories } = categorizeItems(filteredItems);
    
    if (tops.length === 0 || bottoms.length === 0) {
      console.log("Not enough items to generate outfit");
      return null;
    }

    const genderRecs = getGenderSpecificRecommendations(selectedGender);
    let bestOutfit: { top: WardrobeItem; bottom: WardrobeItem; shoes?: WardrobeItem; accessories: WardrobeItem[] } | null = null;
    let bestScore = -Infinity;

    const testCombinations = Math.min(100, tops.length * bottoms.length * Math.max(shoes.length, 1));

    for (let i = 0; i < testCombinations; i++) {
      const top = tops[Math.floor(Math.random() * tops.length)];
      const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
      const shoe = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : undefined;
      
      const outfitId = generateOutfitId(top, bottom, shoe);
      if (previousOutfits.has(outfitId)) {
        continue;
      }

      // Avoid gender-inappropriate categories
      if (genderRecs.avoidCategories.some(avoidCat => 
        top.category?.toLowerCase().includes(avoidCat) || 
        bottom.category?.toLowerCase().includes(avoidCat)
      )) {
        continue;
      }

      const colorAnalysis = analyzeColorHarmony(top, bottom, shoe);
      const styleAnalysis = analyzeStyleCompatibility(top, bottom, shoe);
      
      let score = colorAnalysis.score + styleAnalysis.score;
      
      // Category preference scoring
      if (genderRecs.preferredCategories.some(cat => top.category?.toLowerCase().includes(cat))) {
        score += 3;
      }
      if (genderRecs.preferredCategories.some(cat => bottom.category?.toLowerCase().includes(cat))) {
        score += 3;
      }
      if (shoe && genderRecs.preferredCategories.some(cat => shoe.category?.toLowerCase().includes(cat))) {
        score += 2;
      }

      // Gender-specific scoring
      if (selectedGender === 'Kids') {
        if (top.gender === 'Kids') score += 3;
        if (bottom.gender === 'Kids') score += 3;
        if (shoe && shoe.gender === 'Kids') score += 2;
      } else if (selectedGender === 'Female') {
        if (top.gender === 'Female') score += 2;
        if (bottom.gender === 'Female') score += 2;
        if (shoe && shoe.gender === 'Female') score += 1;
      } else if (selectedGender === 'Male') {
        if (top.gender === 'Male') score += 2;
        if (bottom.gender === 'Male') score += 2;
        if (shoe && shoe.gender === 'Male') score += 1;
      }

      // Random variation to ensure diversity
      score += Math.random() * 3;

      if (score > bestScore) {
        bestScore = score;
        bestOutfit = { top, bottom, shoes: shoe, accessories: [] };
      }

      setGenerationProgress(Math.round((i + 1) / testCombinations * 100));
    }

    if (!bestOutfit && previousOutfits.size > 0) {
      console.log("No new combinations found, clearing previous outfits history");
      setPreviousOutfits(new Set());
      return generateAIOutfit();
    }

    if (bestOutfit && accessories.length > 0) {
      const compatibleAccessories = accessories
        .filter(accessory => 
          !genderRecs.avoidCategories.some(avoidCat => 
            accessory.category?.toLowerCase().includes(avoidCat)
          )
        )
        .slice(0, 2);
      bestOutfit.accessories = compatibleAccessories;
    }

    return bestOutfit;
  };

  const handleGenerate = async () => {
    console.log("Generate button clicked for gender:", selectedGender);
    const filteredItems = getFilteredItems();
    const stats = getStats();
    
    if (filteredItems.length === 0) {
      toast({
        title: "No matching items",
        description: `No ${selectedGender.toLowerCase()} wardrobe items found.`,
        variant: "destructive",
      });
      return;
    }

    if (stats.tops === 0 || stats.bottoms === 0) {
      toast({
        title: "Not enough items",
        description: `Need at least one top and bottom to generate ${selectedGender.toLowerCase()} outfits.`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);
    setOutfit(null);
    setAiAnalysis("");
    
    setTimeout(() => {
      const aiOutfit = generateAIOutfit();
      
      if (!aiOutfit) {
        toast({
          title: "No new combinations",
          description: `Tried all possible ${selectedGender} outfit combinations.`,
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const outfitId = generateOutfitId(aiOutfit.top, aiOutfit.bottom, aiOutfit.shoes);
      setPreviousOutfits(prev => new Set([...prev, outfitId]));

      const colorAnalysis = analyzeColorHarmony(aiOutfit.top, aiOutfit.bottom, aiOutfit.shoes);
      const styleAnalysis = analyzeStyleCompatibility(aiOutfit.top, aiOutfit.bottom, aiOutfit.shoes);

      const totalScore = colorAnalysis.score + styleAnalysis.score;
      const maxScore = 30;
      const percentage = Math.round((totalScore / maxScore) * 100);

      const genderRecs = getGenderSpecificRecommendations(selectedGender);
      
      const analysis = `🎯 ${selectedGender} Outfit Analysis: Scored ${percentage}% 

👔 GENDER-SPECIFIC STYLING:
• Expertly tailored for ${selectedGender} fashion preferences
• ${genderRecs.preferredCategories.length} recommended categories considered
• ${selectedGender === 'Kids' ? 'Playful and comfortable' : 'Style-appropriate'} selections

${colorAnalysis.notes.join('\n')}
${styleAnalysis.notes.join('\n')}

${selectedEvent ? `✨ Customized for "${selectedEvent.title}" (${selectedEvent.occasion})` : '🌟 Perfect for everyday wear'}

${selectedGender === 'Kids' ? '🧒 Kid-friendly outfit focusing on comfort, fun and practicality!' : 
 selectedGender === 'Female' ? '💫 Sophisticated feminine styling with elegant touches' :
 selectedGender === 'Male' ? '🎩 Sharp masculine styling with classic appeal' :
 '💫 Versatile styling for your preferred look'}`;

      setAiAnalysis(analysis);

      const generatedOutfit: GeneratedOutfit = {
        top: aiOutfit.top,
        bottom: aiOutfit.bottom,
        shoes: aiOutfit.shoes,
        accessories: aiOutfit.accessories,
        occasion: selectedEvent?.title || 'Everyday',
        styleNotes: generateStyleNotes(aiOutfit, colorAnalysis, styleAnalysis),
        aiScore: percentage,
        isAIGenerated: true,
        gender: selectedGender,
        generationId: Date.now().toString()
      };
      
      setOutfit(generatedOutfit);
      setGenerating(false);
      setGenerationProgress(100);
      
      toast({
        title: `🎉 New ${selectedGender} Outfit Generated!`,
        description: `AI created a fresh ${styleAnalysis.dominantStyle} look with ${percentage}% match`,
      });
    }, 1500);
  };

  const generateStyleNotes = (outfit: any, colorAnalysis: any, styleAnalysis: any) => {
    const genderRecs = getGenderSpecificRecommendations(selectedGender);
    const notes: string[] = [];
    
    notes.push(`Fresh ${selectedGender} styling: ${outfit.top.color} ${outfit.top.name} with ${outfit.bottom.color} ${outfit.bottom.category}`);
    
    if (outfit.shoes) {
      notes.push(`Completed with ${selectedGender.toLowerCase()}-appropriate ${outfit.shoes.color} ${outfit.shoes.category}`);
    }
    
    if (outfit.accessories.length > 0) {
      notes.push(`Enhanced with ${outfit.accessories.length} ${selectedGender.toLowerCase()}-style accessories`);
    }
    
    if (selectedGender === 'Kids') {
      notes.push(`This playful ${styleAnalysis.dominantStyle} ensemble is perfect for active kids with comfortable and durable materials`);
    } else if (selectedGender === 'Female') {
      notes.push(`This elegant ${styleAnalysis.dominantStyle} look showcases feminine sophistication with beautiful color coordination`);
    } else if (selectedGender === 'Male') {
      notes.push(`This sharp ${styleAnalysis.dominantStyle} outfit demonstrates classic masculine styling with excellent fit`);
    } else {
      notes.push(`This unique ${styleAnalysis.dominantStyle} ensemble showcases excellent fashion sense`);
    }
    
    if (selectedEvent) {
      notes.push(`Perfectly suited for ${selectedEvent.occasion} event`);
    }
    
    return notes.join('. ');
  };

  const handleRefreshWardrobe = () => {
    console.log("Refreshing wardrobe...");
    loadWardrobeItems();
    setPreviousOutfits(new Set());
    setOutfit(null);
    setAiAnalysis("");
    toast({
      title: "Refreshing wardrobe",
      description: "Loading your latest items and clearing outfit history...",
    });
  };

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'Kids':
        return <Baby className="w-5 h-5" />;
      case 'Male':
        return <ShirtIcon className="w-5 h-5" />;
      case 'Female':
        return <Heart className="w-5 h-5" />;
      default:
        return <Shirt className="w-5 h-5" />;
    }
  };

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case 'Kids':
        return 'from-orange-400 to-pink-400';
      case 'Male':
        return 'from-blue-500 to-cyan-500';
      case 'Female':
        return 'from-pink-500 to-rose-500';
      default:
        return 'from-purple-500 to-indigo-500';
    }
  };

  const getAllEvents = () => {
    return [...todaysEvents, ...manualEvents];
  };

  // Use shared utility for stats
  const stats = getStats();

  return (
    <div className="min-h-screen pb-20 md:pb-4 bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AI Outfit Generator
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get fresh outfit suggestions every time - no repeats!
            </p>
          </div>

          {/* Gender Selection */}
          <Card className="p-6 mb-8 rounded-3xl bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <Shirt className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Style Preference</h3>
                  <p className="text-sm text-blue-700">
                    Choose your preferred styling for AI outfit generation
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 min-w-[200px]">
                <Label className="text-blue-900">Select Outfit Style</Label>
                <Select value={selectedGender} onValueChange={handleGenderChange}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Choose styling" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Styles</SelectItem>
                    <SelectItem value="Male">Male Fashion</SelectItem>
                    <SelectItem value="Female">Female Fashion</SelectItem>
                    <SelectItem value="Kids">Kids Fashion</SelectItem>
                    <SelectItem value="Unisex">Unisex Style</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Event Selection */}
          <Card className="p-6 mb-8 rounded-3xl bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-2xl">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-900">Select Occasion</h3>
                  <p className="text-sm text-green-700">
                    Choose an event or occasion for outfit inspiration
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-select" className="text-green-900">Select Event</Label>
                <Select 
                  value={selectedEvent?.id || "casual"} 
                  onValueChange={(value) => {
                    const allEvents = getAllEvents();
                    const event = allEvents.find(e => e.id === value) || manualEvents[0];
                    setSelectedEvent(event);
                  }}
                >
                  <SelectTrigger className="w-full md:w-64 bg-white">
                    <SelectValue placeholder="Choose an occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {todaysEvents.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-green-600">Today's Events</div>
                        {todaysEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title} • {event.occasion}
                          </SelectItem>
                        ))}
                        <div className="border-t my-1" />
                      </>
                    )}
                    <div className="px-2 py-1 text-xs font-semibold text-green-600">Occasion Types</div>
                    {manualEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedEvent && (
              <div className="mt-4 p-4 bg-white rounded-2xl border border-green-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900">{selectedEvent.title}</h4>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 rounded-full">
                    {selectedEvent.occasion}
                  </Badge>
                </div>
                {selectedEvent.dress_code && (
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Dress Code:</span> {selectedEvent.dress_code}
                  </p>
                )}
                {selectedEvent.description && (
                  <p className="text-sm text-green-600 mt-1">
                    {selectedEvent.description}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Wardrobe Stats */}
          <Card className="p-6 rounded-3xl shadow-sm mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-2xl">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedGender} Wardrobe Stats</h3>
                  <p className="text-sm text-muted-foreground">
                    Your available {selectedGender.toLowerCase()} items • {previousOutfits.size} previous suggestions
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefreshWardrobe}
                  className="ml-auto"
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              {loadingWardrobe ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-2xl">
                    <div className="text-2xl font-bold text-primary">{stats.tops}</div>
                    <div className="text-sm text-muted-foreground">Tops</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-2xl">
                    <div className="text-2xl font-bold text-primary">{stats.bottoms}</div>
                    <div className="text-sm text-muted-foreground">Bottoms</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-2xl">
                    <div className="text-2xl font-bold text-primary">{stats.shoes}</div>
                    <div className="text-sm text-muted-foreground">Shoes</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-2xl">
                    <div className="text-2xl font-bold text-primary">{stats.accessories}</div>
                    <div className="text-sm text-muted-foreground">Accessories</div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Generation Section */}
          <Card className="p-8 rounded-3xl text-center shadow-sm mb-8">
            {loadingWardrobe ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>Loading your wardrobe...</p>
              </div>
            ) : !outfit && !generating && (
              <div className="flex flex-col items-center gap-6">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${getGenderColor(selectedGender)} flex items-center justify-center shadow-lg`}>
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{selectedGender} AI-Powered Styling</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    {stats.total > 0 
                      ? `AI will create a fresh ${selectedGender.toLowerCase()} outfit from your ${stats.total} items`
                      : `Add ${selectedGender.toLowerCase()} clothing items to enable AI styling recommendations`
                    }
                  </p>
                </div>
                
                <Button 
                  size="lg" 
                  className={`rounded-full px-8 bg-gradient-to-r ${getGenderColor(selectedGender)} hover:opacity-90 text-white shadow-lg transition-all hover:scale-105`}
                  onClick={handleGenerate}
                  disabled={stats.total === 0 || stats.tops === 0 || stats.bottoms === 0}
                >
                  <Zap className="w-5 h-5 mr-2" />
                  {stats.total > 0 ? `Generate New ${selectedGender} Outfit` : "Add Items First"}
                </Button>

                {stats.total === 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/upload'}
                    className="rounded-full"
                  >
                    Go to Upload
                  </Button>
                )}
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center gap-6">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${getGenderColor(selectedGender)} flex items-center justify-center shadow-lg`}>
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Creating Fresh {selectedGender} Outfit</h3>
                  <p className="text-muted-foreground">
                    Analyzing {stats.total} {selectedGender.toLowerCase()} items for new combinations
                  </p>
                </div>
                <div className="w-full max-w-md space-y-2">
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {generationProgress}% complete
                  </p>
                </div>
              </div>
            )}

            {outfit && !generating && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Outfit Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">Fresh {selectedGender} Outfit</h2>
                    <p className="text-muted-foreground">{outfit.occasion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 to-blue-100 text-green-700 rounded-full text-sm font-medium">
                      <Shield className="w-4 h-4" />
                      AI Score: {outfit.aiScore}%
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      New Suggestion
                    </Badge>
                  </div>
                </div>

                {/* AI Analysis */}
                <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-left">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 rounded-2xl mt-1">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-3">Fresh {selectedGender} Fashion Analysis</h4>
                      <p className="text-blue-800 whitespace-pre-line text-sm leading-relaxed">
                        {aiAnalysis}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Outfit Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {(['top', 'bottom', 'shoes', 'accessories'] as const).map((type) => {
                    const item = type === 'accessories' ? outfit.accessories[0] : (outfit as any)[type] as WardrobeItem | undefined;
                    return (
                      <Card key={type} className="p-4 rounded-2xl text-center group hover:shadow-md transition-all">
                        <div className="aspect-square bg-muted rounded-xl mb-3 overflow-hidden">
                          {item?.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.category} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              {getGenderIcon(selectedGender)}
                            </div>
                          )}
                        </div>
                        <p className="font-medium capitalize">{type}</p>
                        <p className="text-sm text-muted-foreground">
                          {item ? `${item.color ?? ''} • ${item.category ?? ''}` : 'Not selected'}
                        </p>
                      </Card>
                    );
                  })}
                </div>

                {/* Style Notes */}
                <Card className="p-6 bg-muted/50 rounded-2xl">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    Fresh {selectedGender} Style Notes
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {outfit.styleNotes}
                  </p>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    className="flex-1 rounded-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    onClick={handleGenerate}
                  >
                    <RotateCw className="w-5 h-5 mr-2" />
                    Generate Another Outfit
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-full"
                    onClick={() => saveOutfit(outfit)}
                    disabled={savingOutfit}
                  >
                    <Heart className={`w-5 h-5 mr-2 ${savingOutfit ? 'animate-pulse' : ''}`} />
                    {savingOutfit ? "Saving..." : "Save This Outfit"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Generate;