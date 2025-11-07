export interface WardrobeItem {
  id: string;
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
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const getFilteredWardrobeItems = (items: WardrobeItem[], activeGender: string) => {
  if (!Array.isArray(items)) return [];
  
  if (activeGender === "All") return items;
  if (activeGender === "Unknown") return items.filter(item => !item.gender);
  if (activeGender === "Unisex") return items.filter(item => item.gender?.toLowerCase() === "unisex");
  if (activeGender === "Kids") return items.filter(item => item.gender?.toLowerCase() === "kids");
  
  return items.filter(item => item.gender?.toLowerCase() === activeGender.toLowerCase());
};

export const categorizeItems = (items: WardrobeItem[]) => {
  const tops: WardrobeItem[] = [];
  const bottoms: WardrobeItem[] = [];
  const shoes: WardrobeItem[] = [];
  const accessories: WardrobeItem[] = [];

  items.forEach(item => {
    const category = item.category?.toLowerCase() || '';
    
    if (category.includes('top') || category.includes('shirt') || category.includes('blouse')) {
      tops.push(item);
    } else if (category.includes('pant') || category.includes('skirt') || category.includes('shorts')) {
      bottoms.push(item);
    } else if (category.includes('shoe') || category.includes('boots') || category.includes('sneaker')) {
      shoes.push(item);
    } else {
      accessories.push(item);
    }
  });

  return { tops, bottoms, shoes, accessories };
};

export const getWardrobeStats = (items: WardrobeItem[], gender: string) => {
  const filteredItems = getFilteredWardrobeItems(items, gender);
  const { tops, bottoms, shoes, accessories } = categorizeItems(filteredItems);

  return {
    total: filteredItems.length,
    tops: tops.length,
    bottoms: bottoms.length,
    shoes: shoes.length,
    accessories: accessories.length
  };
};