import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Loader2, Shirt, Star, Heart, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    preferred_style: "",
    favorite_colors: "",
    avatar_url: "",
    gender_preference: "All",
  });
  const [wardrobeStats, setWardrobeStats] = useState({
    totalItems: 0,
    totalOutfits: 0,
    savedItems: 0
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [needsGoogleSync, setNeedsGoogleSync] = useState(false);

  useEffect(() => {
    if (user) {
      checkGoogleProvider();
      initializeProfile();
      loadWardrobeStats();
    }
  }, [user]);

  const checkGoogleProvider = () => {
    try {
      const isGoogle = user?.app_metadata?.provider === 'google' || 
                      user?.identities?.some((identity: any) => identity?.provider === 'google');
      console.log("Is Google user:", isGoogle);
      setIsGoogleUser(!!isGoogle);
    } catch (error) {
      console.error("Error checking Google provider:", error);
      setIsGoogleUser(false);
    }
  };

  const getGoogleProfileData = () => {
    if (!user) return null;

    try {
      const googleName = user.user_metadata?.full_name || 
                        user.user_metadata?.name ||
                        user.identities?.[0]?.identity_data?.full_name ||
                        "";

      const googleAvatar = user.user_metadata?.avatar_url || 
                          user.user_metadata?.picture ||
                          user.identities?.[0]?.identity_data?.avatar_url ||
                          "";

      const googleEmail = user.email || "";

      console.log("Google data:", { googleName, hasAvatar: !!googleAvatar, googleEmail });

      return {
        name: googleName,
        avatar: googleAvatar,
        email: googleEmail
      };
    } catch (error) {
      console.error("Error extracting Google profile data:", error);
      return null;
    }
  };

  const initializeProfile = async () => {
    if (!user) return;

    try {
      setProfileError(null);
      console.log("Initializing profile for user:", user.id);
      
      // Try to load from database
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Database error:", error);
        // If table doesn't exist or other error, create profile
        await createProfileInDatabase();
        return;
      }

      if (data) {
        console.log("Profile loaded from database:", data);
        const googleData = getGoogleProfileData();
        
        const profileData = {
          full_name: data.full_name || googleData?.name || user.email?.split('@')[0] || "User",
          email: data.email || googleData?.email || user.email || "",
          preferred_style: data.preferred_style || "",
          favorite_colors: data.favorite_colors || "",
          avatar_url: data.avatar_url || googleData?.avatar || "",
          gender_preference: (data as any).gender_preference || "All",
        };
        
        setProfile(profileData);

        // Check if we need to sync Google data
        if (isGoogleUser && googleData) {
          const needsSync = !data.full_name && googleData.name || 
                           !data.avatar_url && googleData.avatar;
          setNeedsGoogleSync(needsSync);
          
          if (needsSync) {
            console.log("Auto-syncing Google data...");
            await syncGoogleProfile(true); // Silent sync
          }
        }
      } else {
        // No profile found, create one
        console.log("No profile found, creating new one...");
        await createProfileInDatabase();
      }

    } catch (error: any) {
      console.error("Error initializing profile:", error);
      // Fallback to basic user data
      const googleData = getGoogleProfileData();
      setProfile({
        full_name: googleData?.name || user.email?.split('@')[0] || "User",
        email: googleData?.email || user.email || "",
        preferred_style: "",
        favorite_colors: "",
        avatar_url: googleData?.avatar || "",
        gender_preference: "All",
      });
      setProfileError("Using basic profile data");
    }
  };

  const createProfileInDatabase = async () => {
    if (!user) return;

    try {
      const googleData = getGoogleProfileData();
      
      const profileData = {
        user_id: user.id,
        full_name: googleData?.name || user.email?.split('@')[0] || "User",
        email: googleData?.email || user.email || "",
        avatar_url: googleData?.avatar || "",
        preferred_style: "",
        favorite_colors: "",
        gender_preference: "All",
      };

      console.log("Creating profile:", profileData);

      const { data, error } = await supabase
        .from("profiles")
        .insert(profileData as any)
        .select()
        .single();

      if (error) {
        console.error("Profile creation error:", error);
        throw error;
      }

      setProfile({
        full_name: data.full_name,
        email: data.email,
        preferred_style: data.preferred_style || "",
        favorite_colors: data.favorite_colors || "",
        avatar_url: data.avatar_url,
        gender_preference: (data as any).gender_preference || "All",
      });

      console.log("Profile created successfully");

    } catch (error: any) {
      console.error("Failed to create profile in database:", error);
      throw error;
    }
  };

  const syncGoogleProfile = async (silent = false) => {
    if (!user) return;

    try {
      if (!silent) setSyncingGoogle(true);
      setProfileError(null);
      
      const googleData = getGoogleProfileData();
      
      if (!googleData) {
        throw new Error("No Google profile data available");
      }

      console.log("Syncing Google data:", googleData);

      const updateData: any = {
        full_name: googleData.name || profile.full_name,
        email: googleData.email || profile.email,
        updated_at: new Date().toISOString(),
      };

      if (googleData.avatar) {
        updateData.avatar_url = googleData.avatar;
      }

      // Update in database
      const { error } = await (supabase as any)
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) {
        console.error("Database update error:", error);
        // Even if database fails, update local state
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        full_name: googleData.name || prev.full_name,
        email: googleData.email || prev.email,
        avatar_url: googleData.avatar || prev.avatar_url,
      }));

      setNeedsGoogleSync(false);

      if (!silent) {
        toast({
          title: "Profile synced!",
          description: "Your profile has been updated with Google account information.",
        });
      }

    } catch (error: any) {
      console.error("Error in Google profile sync:", error);
      if (!silent) {
        toast({
          title: "Sync failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setSyncingGoogle(false);
    }
  };

  const loadWardrobeStats = async () => {
    if (!user) return;

    try {
      setLoadingStats(true);
      setStatsError(null);

      // Load wardrobe items
      const { data: wardrobeData, error: wardrobeError } = await supabase
        .from("wardrobe_items")
        .select("id, category, is_favorite")
        .eq("user_id", user.id);

      if (wardrobeError) {
        console.error("Wardrobe items error:", wardrobeError);
        setStatsError("Could not load wardrobe items");
        return;
      }

      // Load outfits
      let outfitsCount = 0;
      try {
        const { data: outfitsData, error: outfitsError } = await (supabase as any)
          .from("outfits")
          .select("id")
          .eq("user_id", user.id);

        if (!outfitsError) {
          outfitsCount = (outfitsData || []).length || 0;
        }
      } catch (outfitsError) {
        console.warn("Outfits table might not exist:", outfitsError);
      }

      // Calculate favorites
      const savedItems = (wardrobeData || []).filter((item: any) => {
        return !!(item?.is_favorite);
      });

      // Calculate category breakdown
      const categoryCount: Record<string, number> = {};
      (wardrobeData || []).forEach((item: any) => {
        const category = String(item?.category || 'other').toLowerCase();
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      setWardrobeStats({
        totalItems: wardrobeData?.length || 0,
        totalOutfits: outfitsCount,
        savedItems: savedItems.length
      });

      setCategoryBreakdown(categoryCount);

    } catch (error: any) {
      console.error("Error loading wardrobe stats:", error);
      setStatsError("Could not load wardrobe statistics");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updatePayload: any = {
        full_name: profile.full_name,
        preferred_style: profile.preferred_style,
        favorite_colors: profile.favorite_colors,
        gender_preference: profile.gender_preference,
        updated_at: new Date().toISOString(),
      };

      // cast payload to any to prevent excessive type instantiation from Supabase generics
      // Bypass overly complex Supabase typings causing TS "excessively deep" errors
      const { error } = await (supabase as any)
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", user.id);

      if (error) throw error;

      if (profile.gender_preference) {
        localStorage.setItem('user_gender_preference', profile.gender_preference);
      }

      toast({
        title: "Profile updated!",
        description: "Your changes have been saved successfully.",
      });

    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;

      console.log("Uploading avatar:", fileName);

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      console.log("Upload successful. URL:", publicUrl);

      // Update profile (cast supabase to any to avoid deep generic type instantiation)
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) {
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      toast({
        title: "Avatar updated!",
        description: "Your profile picture has been updated successfully.",
      });

    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRetryStats = () => {
    loadWardrobeStats();
  };

  const getTopCategories = () => {
    const sortedCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
    return sortedCategories;
  };

  return (
    <div className="min-h-screen pb-20 md:pb-4">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Profile</h1>
          <p className="text-muted-foreground mb-12 text-lg">
            Manage your account and wardrobe preferences
          </p>

          <Card className="p-8 rounded-3xl space-y-8">
            {/* Google Sync Alert */}
            {needsGoogleSync && isGoogleUser && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="flex justify-between items-center">
                  <span>Sync your Google account data to fill your profile</span>
                  <Button 
                    size="sm" 
                    onClick={() => syncGoogleProfile(false)}
                    disabled={syncingGoogle}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    {syncingGoogle ? "Syncing..." : "Sync Now"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Profile Error Alert */}
            {profileError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {profileError}
                </AlertDescription>
              </Alert>
            )}

            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="w-32 h-32 border-4 border-primary">
                  <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-3xl bg-gradient-to-r from-primary to-purple-600 text-white">
                    {profile.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload"
                  className={`absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-medium hover:scale-110 transition-smooth cursor-pointer ${
                    uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <input 
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg, image/jpg, image/png, image/webp"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="sr-only"
                  />
                </label>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Click to change profile picture
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, or WebP • Max 5MB
                </p>
              </div>
            </div>

            {/* Profile Form */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="flex gap-2">
                  <Input 
                    id="name" 
                    placeholder="Enter your name" 
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="rounded-xl flex-1"
                  />
                  {isGoogleUser && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => syncGoogleProfile(false)}
                      disabled={syncingGoogle}
                      className="whitespace-nowrap"
                      title="Sync from Google"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
                {isGoogleUser && (
                  <p className="text-xs text-muted-foreground">
                    Signed in with Google • Click sync button to update from Google
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={profile.email || user?.email || ""}
                  disabled
                  className="rounded-xl bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender-preference">Gender Preference</Label>
                <Select 
                  value={profile.gender_preference} 
                  onValueChange={(value) => setProfile({ ...profile, gender_preference: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select your preferred style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Styles</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Unisex">Unisex</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This will be used for AI outfit recommendations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Preferred Style</Label>
                <Input 
                  id="style" 
                  placeholder="e.g., Casual, Formal, Streetwear"
                  value={profile.preferred_style}
                  onChange={(e) => setProfile({ ...profile, preferred_style: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="colors">Favorite Colors</Label>
                <Input 
                  id="colors" 
                  placeholder="e.g., Pastels, Earth Tones, Bold"
                  value={profile.favorite_colors}
                  onChange={(e) => setProfile({ ...profile, favorite_colors: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Stats Section */}
            <div className="py-6 border-t border-b">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Wardrobe Statistics</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetryStats}
                  disabled={loadingStats}
                  className="h-8"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {loadingStats ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : statsError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{statsError}</p>
                  <Button onClick={handleRetryStats} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-primary/10 rounded-2xl">
                      <Shirt className="w-6 h-6 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-primary">{wardrobeStats.totalItems}</p>
                      <p className="text-sm text-muted-foreground">Wardrobe Items</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/10 rounded-2xl">
                      <Star className="w-6 h-6 text-secondary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-secondary">{wardrobeStats.totalOutfits}</p>
                      <p className="text-sm text-muted-foreground">Created Outfits</p>
                    </div>
                    <div className="text-center p-4 bg-accent/10 rounded-2xl">
                      <Heart className="w-6 h-6 text-accent mx-auto mb-2" />
                      <p className="text-2xl font-bold text-accent">{wardrobeStats.savedItems}</p>
                      <p className="text-sm text-muted-foreground">Favorites</p>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-3">Category Distribution</h4>
                    <div className="space-y-2">
                      {wardrobeStats.totalItems === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No wardrobe items yet. Start by adding some clothing items!
                        </p>
                      ) : Object.keys(categoryBreakdown).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No category data available
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {getTopCategories().map(([category, count]) => (
                            <div key={category} className="flex justify-between p-2 bg-muted rounded-lg">
                              <span className="capitalize">{category}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="rounded-xl"
                  onClick={() => window.location.href = '/upload'}
                >
                  Add New Item
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-xl"
                  onClick={() => window.location.href = '/generate'}
                >
                  Generate Outfit
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <Button 
              className="w-full rounded-full" 
              size="lg"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Profile;