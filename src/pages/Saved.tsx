import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Heart, Shirt, Trash2, Calendar, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface SavedOutfit {
  id: string;
  name: string;
  description: string;
  items: {
    top: any;
    bottom: any;
    shoes?: any;
    accessories: any[];
  };
  occasion: string;
  style: string;
  ai_score: number;
  gender: string;
  created_at: string;
}

const Saved = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outfitToDelete, setOutfitToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSavedOutfits();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchSavedOutfits = async () => {
    try {
      console.log("Fetching saved outfits for user:", user?.id);
      
      const { data, error } = await (supabase as any)
        .from('saved_outfits')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching saved outfits:', error);
        throw error;
      }

      console.log("Saved outfits loaded:", data);
      setSavedOutfits(data || []);
      
    } catch (error: any) {
      console.error('Failed to load saved outfits:', error);
      toast({
        title: "Error loading saved outfits",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOutfit = async () => {
    if (!outfitToDelete) return;

    try {
      const { error } = await (supabase as any)
        .from('saved_outfits')
        .delete()
        .eq('id', outfitToDelete);

      if (error) throw error;

      toast({
        title: "Outfit deleted",
        description: "The outfit has been removed from your saved items",
      });

      setSavedOutfits(prev => prev.filter(outfit => outfit.id !== outfitToDelete));
      setDeleteDialogOpen(false);
      setOutfitToDelete(null);
    } catch (error: any) {
      console.error('Error deleting outfit:', error);
      toast({
        title: "Failed to delete outfit",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (outfitId: string) => {
    setOutfitToDelete(outfitId);
    setDeleteDialogOpen(true);
  };

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case 'Kids':
        return 'bg-orange-100 text-orange-700';
      case 'Male':
        return 'bg-blue-100 text-blue-700';
      case 'Female':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-purple-100 text-purple-700';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20 md:pb-4">
        <Navigation />
        <main className="container mx-auto px-4 pt-24">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-12"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 rounded-3xl">
                  <div className="h-48 bg-muted rounded-2xl mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-4">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Saved Outfits</h1>
        <p className="text-muted-foreground mb-12 text-lg">
          Your favorite AI-generated outfit combinations
        </p>

        {savedOutfits.length === 0 ? (
          <Card className="p-12 text-center rounded-3xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Heart className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">No saved outfits yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate outfits and save your favorites to see them here
                </p>
                <Button 
                  onClick={() => window.location.href = '/generate'}
                  className="rounded-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Outfits
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedOutfits.map((outfit) => (
              <Card key={outfit.id} className="p-6 rounded-3xl group relative hover:shadow-md transition-all">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
                  onClick={() => openDeleteDialog(outfit.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                {/* Outfit Preview */}
                <div className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl mb-4 flex items-center justify-center p-4">
                  <div className="grid grid-cols-2 gap-2 w-full h-full">
                    {/* Top */}
                    <div className="bg-background/50 rounded-lg flex flex-col items-center justify-center p-2">
                      {outfit.items.top?.image_url ? (
                        <img 
                          src={outfit.items.top.image_url} 
                          alt="Top" 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <Shirt className="w-6 h-6 text-muted-foreground mb-1" />
                      )}
                      <span className="text-xs text-muted-foreground">Top</span>
                    </div>

                    {/* Bottom */}
                    <div className="bg-background/50 rounded-lg flex flex-col items-center justify-center p-2">
                      {outfit.items.bottom?.image_url ? (
                        <img 
                          src={outfit.items.bottom.image_url} 
                          alt="Bottom" 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <Shirt className="w-6 h-6 text-muted-foreground mb-1" />
                      )}
                      <span className="text-xs text-muted-foreground">Bottom</span>
                    </div>

                    {/* Shoes */}
                    <div className="bg-background/50 rounded-lg flex flex-col items-center justify-center p-2">
                      {outfit.items.shoes?.image_url ? (
                        <img 
                          src={outfit.items.shoes.image_url} 
                          alt="Shoes" 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <Shirt className="w-6 h-6 text-muted-foreground mb-1" />
                      )}
                      <span className="text-xs text-muted-foreground">Shoes</span>
                    </div>

                    {/* Accessories */}
                    <div className="bg-background/50 rounded-lg flex flex-col items-center justify-center p-2">
                      {outfit.items.accessories?.[0]?.image_url ? (
                        <img 
                          src={outfit.items.accessories[0].image_url} 
                          alt="Accessory" 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <Shirt className="w-6 h-6 text-muted-foreground mb-1" />
                      )}
                      <span className="text-xs text-muted-foreground">Accessory</span>
                    </div>
                  </div>
                </div>

                {/* Outfit Details */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg pr-8">{outfit.name}</h3>
                    <Badge className={`rounded-full text-xs ${getGenderColor(outfit.gender)}`}>
                      {outfit.gender}
                    </Badge>
                  </div>
                  
                  {outfit.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {outfit.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(outfit.created_at).toLocaleDateString()}</span>
                      </div>
                      {outfit.ai_score && (
                        <div className={`font-semibold ${getScoreColor(outfit.ai_score)}`}>
                          AI: {outfit.ai_score}%
                        </div>
                      )}
                    </div>
                    
                    {outfit.occasion && (
                      <Badge variant="outline" className="rounded-full text-xs">
                        {outfit.occasion}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Outfit?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the saved outfit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteOutfit}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Outfit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Saved;