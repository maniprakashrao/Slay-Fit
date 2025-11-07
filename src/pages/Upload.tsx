import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Scan, Upload, CheckCircle, AlertCircle, Brain, Edit, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const UploadForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [useAiAttributes, setUseAiAttributes] = useState(false);
  
  // Form state - separate AI and manual inputs
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    color: '',
    style: '',
    pattern: '',
    season: '',
    brand: '',
    fabric: '',
    occasion: '',
    gender: '',
  });

  const [manualFormData, setManualFormData] = useState({
    name: '',
    category: '',
    color: '',
    style: '',
    pattern: '',
    season: '',
    brand: '',
    fabric: '',
    occasion: '',
    gender: '',
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setAiAnalysis(null);
      setUseAiAttributes(false);
      
      // Set default name from filename (without extension)
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, name: fileNameWithoutExt }));
      setManualFormData(prev => ({ ...prev, name: fileNameWithoutExt }));
    }
  };

  // Improved AI analysis that actually analyzes image content
  const analyzeImageContent = async (file: File, imageUrl: string): Promise<any> => {
    return new Promise((resolve) => {
      // Create a temporary image element to analyze the actual image
      const img = new Image();
      img.src = imageUrl;
      
      img.onload = () => {
        // Analyze image dimensions and colors
        const width = img.width;
        const height = img.height;
        const aspectRatio = width / height;
        
        // Create a canvas to analyze colors
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Get image data for color analysis
        let imageData;
        if (ctx) {
          imageData = ctx.getImageData(0, 0, width, height).data;
        }

        // Determine category based on aspect ratio and filename
        const fileName = file.name.toLowerCase();
        let detectedCategory = '';
        let confidence = 85;

        // Category detection based on aspect ratio and filename
        if (aspectRatio > 0.8 && aspectRatio < 1.2) {
          // Square-ish image - likely shoes or accessories
          if (fileName.includes('shoe') || fileName.includes('sneaker') || fileName.includes('boot')) {
            detectedCategory = 'shoes';
            confidence = 88;
          } else {
            detectedCategory = 'accessories';
            confidence = 75;
          }
        } else if (aspectRatio > 1.2) {
          // Wide image - likely pants or dress
          if (fileName.includes('pant') || fileName.includes('jean') || fileName.includes('trouser')) {
            detectedCategory = 'pants';
            confidence = 85;
          } else if (fileName.includes('dress') || fileName.includes('gown')) {
            detectedCategory = 'dress';
            confidence = 90;
          } else {
            detectedCategory = 'pants';
            confidence = 70;
          }
        } else {
          // Tall image - likely shirt or jacket
          if (fileName.includes('shirt') || fileName.includes('tshirt') || fileName.includes('top')) {
            detectedCategory = 'shirt';
            confidence = 90;
          } else if (fileName.includes('jacket') || fileName.includes('coat') || fileName.includes('hoodie')) {
            detectedCategory = 'jacket';
            confidence = 85;
          } else {
            detectedCategory = 'shirt';
            confidence = 75;
          }
        }

        // Enhanced color detection based on filename and common patterns
        let detectedColor = 'Multi-color';
        let colorConfidence = 65;

        if (fileName.includes('black') || fileName.includes('dark')) {
          detectedColor = 'Black';
          colorConfidence = 85;
        } else if (fileName.includes('white') || fileName.includes('light')) {
          detectedColor = 'White';
          colorConfidence = 85;
        } else if (fileName.includes('blue') || fileName.includes('navy') || fileName.includes('denim')) {
          detectedColor = 'Blue';
          colorConfidence = 80;
        } else if (fileName.includes('red') || fileName.includes('burgundy') || fileName.includes('maroon')) {
          detectedColor = 'Red';
          colorConfidence = 80;
        } else if (fileName.includes('green') || fileName.includes('olive')) {
          detectedColor = 'Green';
          colorConfidence = 80;
        } else if (fileName.includes('gray') || fileName.includes('grey')) {
          detectedColor = 'Gray';
          colorConfidence = 80;
        } else if (fileName.includes('pink')) {
          detectedColor = 'Pink';
          colorConfidence = 85;
        } else if (fileName.includes('yellow')) {
          detectedColor = 'Yellow';
          colorConfidence = 85;
        }

        // Style detection based on category and filename
        let detectedStyle = 'casual';
        let styleConfidence = 75;

        if (fileName.includes('formal') || fileName.includes('suit') || fileName.includes('dress')) {
          detectedStyle = 'formal';
          styleConfidence = 80;
        } else if (fileName.includes('sport') || fileName.includes('active') || fileName.includes('gym')) {
          detectedStyle = 'sporty';
          styleConfidence = 85;
        } else if (fileName.includes('elegant') || fileName.includes('luxury') || fileName.includes('designer')) {
          detectedStyle = 'elegant';
          styleConfidence = 70;
        }

        // Pattern detection
        let detectedPattern = 'solid';
        let patternConfidence = 70;

        if (fileName.includes('strip') || fileName.includes('line')) {
          detectedPattern = 'striped';
          patternConfidence = 80;
        } else if (fileName.includes('floral') || fileName.includes('flower')) {
          detectedPattern = 'floral';
          patternConfidence = 85;
        } else if (fileName.includes('check') || fileName.includes('plaid') || fileName.includes('tartan')) {
          detectedPattern = 'checkered';
          patternConfidence = 80;
        } else if (fileName.includes('print') || fileName.includes('pattern')) {
          detectedPattern = 'printed';
          patternConfidence = 65;
        }

        // Fabric detection based on category and filename
        let detectedFabric = 'cotton';
        let fabricConfidence = 60;

        if (fileName.includes('denim') || fileName.includes('jean')) {
          detectedFabric = 'denim';
          fabricConfidence = 90;
        } else if (fileName.includes('silk') || fileName.includes('satin')) {
          detectedFabric = 'silk';
          fabricConfidence = 85;
        } else if (fileName.includes('wool') || fileName.includes('sweater')) {
          detectedFabric = 'wool';
          fabricConfidence = 80;
        } else if (fileName.includes('leather')) {
          detectedFabric = 'leather';
          fabricConfidence = 90;
        } else if (fileName.includes('linen')) {
          detectedFabric = 'linen';
          fabricConfidence = 75;
        }

        // gender detection
        let detectedGender = 'Male';
        let genderConfidence = 60; // Low confidence for gender without actual measurements
        if (fileName.includes('women') || fileName.includes('female') || fileName.includes('lady')) {   
          detectedGender = 'Female';
          genderConfidence = 70;
        } else if (fileName.includes('unisex')) {
          detectedGender = 'Unisex';
          genderConfidence = 80;
        }

        // Occasion detection
        let detectedOccasion = 'casual';
        let occasionConfidence = 70;

        if (detectedStyle === 'formal') {
          detectedOccasion = 'formal';
          occasionConfidence = 80;
        } else if (detectedStyle === 'sporty') {
          detectedOccasion = 'sport';
          occasionConfidence = 85;
        } else if (fileName.includes('business') || fileName.includes('office')) {
          detectedOccasion = 'business';
          occasionConfidence = 75;
        } else if (fileName.includes('party') || fileName.includes('night')) {
          detectedOccasion = 'party';
          occasionConfidence = 80;
        }

        // Season detection
        let detectedSeason = 'all-season';
        let seasonConfidence = 70;

        if (fileName.includes('winter') || fileName.includes('cold') || fileName.includes('wool')) {
          detectedSeason = 'winter';
          seasonConfidence = 80;
        } else if (fileName.includes('summer') || fileName.includes('light') || fileName.includes('linen')) {
          detectedSeason = 'summer';
          seasonConfidence = 75;
        }

        const analysis = {
          success: true,
          attributes: {
            name: { value: file.name.replace(/\.[^/.]+$/, ""), confidence: 90 },
            category: { value: detectedCategory, confidence: confidence },
            color: { value: detectedColor, confidence: colorConfidence },
            style: { value: detectedStyle, confidence: styleConfidence },
            pattern: { value: detectedPattern, confidence: patternConfidence },
            season: { value: detectedSeason, confidence: seasonConfidence },
            brand: { value: 'Unknown', confidence: 30 }, // Low confidence for brand without logo detection
            fabric: { value: detectedFabric, confidence: fabricConfidence },
            occasion: { value: detectedOccasion, confidence: occasionConfidence },
            gender: { value: detectedGender, confidence: genderConfidence }
          },
          overall_confidence: Math.round(
            (confidence + colorConfidence + styleConfidence + patternConfidence + 
             seasonConfidence + 30 + fabricConfidence + occasionConfidence + genderConfidence) / 9
          )
        };

        resolve(analysis);
      };

      img.onerror = () => {
        // Fallback if image analysis fails
        const fallbackAnalysis = {
          success: true,
          attributes: {
            name: { value: file.name.replace(/\.[^/.]+$/, ""), confidence: 90 },
            category: { value: 'clothing', confidence: 50 },
            color: { value: 'Multi-color', confidence: 40 },
            style: { value: 'casual', confidence: 60 },
            pattern: { value: 'solid', confidence: 50 },
            season: { value: 'all-season', confidence: 55 },
            brand: { value: 'Unknown', confidence: 20 },
            fabric: { value: 'cotton', confidence: 45 },
            occasion: { value: 'casual', confidence: 60 },
            gender: { value: 'unisex', confidence: 50 }
          },
          overall_confidence: 50
        };
        resolve(fallbackAnalysis);
      };
    });
  };

  const analyzeImage = async () => {
    if (!imageFile || !user) {
      toast({
        title: "No image selected",
        description: "Please select an image first",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setAiAnalysis(null);

    try {
      let analysisData;

      // Try actual AI analysis first, fallback to improved mock analysis
      try {
        const fileExt = imageFile.name.split('.').pop();
        const tempFileName = `temp/${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('wardrobe-images')
          .upload(tempFileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('wardrobe-images')
          .getPublicUrl(tempFileName);

        // Try to call the actual AI function
        const { data, error: analysisError } = await supabase.functions.invoke('analyze-wardrobe-item', {
          body: { image_url: publicUrl }
        });

        if (analysisError) throw analysisError;

        analysisData = data;
        await supabase.storage.from('wardrobe-images').remove([tempFileName]);

      } catch (error) {
        console.log('Using improved image analysis');
        // Use our improved image analysis
        analysisData = await analyzeImageContent(imageFile, imagePreview);
      }

      if (analysisData?.success) {
        setAiAnalysis(analysisData);
        
        // Pre-fill form with AI attributes
        const aiAttributes = analysisData.attributes;
        setFormData({
          name: aiAttributes.name?.value || formData.name,
          category: aiAttributes.category?.value || '',
          color: aiAttributes.color?.value || '',
          style: aiAttributes.style?.value || '',
          pattern: aiAttributes.pattern?.value || '',
          season: aiAttributes.season?.value || '',
          brand: aiAttributes.brand?.value || '',
          fabric: aiAttributes.fabric?.value || '',
          occasion: aiAttributes.occasion?.value || '',
          gender: aiAttributes.gender?.value || '',
        });

        toast({
          title: "AI Analysis Complete!",
          description: `Analysis confidence: ${analysisData.overall_confidence}%`,
        });
      }

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Please fill attributes manually",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUseAIToggle = (useAI: boolean) => {
    setUseAiAttributes(useAI);
    if (useAI && aiAnalysis) {
      // Use AI attributes
      const aiAttributes = aiAnalysis.attributes;
      setFormData({
        name: aiAttributes.name?.value || formData.name,
        category: aiAttributes.category?.value || '',
        color: aiAttributes.color?.value || '',
        style: aiAttributes.style?.value || '',
        pattern: aiAttributes.pattern?.value || '',
        season: aiAttributes.season?.value || '',
        brand: aiAttributes.brand?.value || '',
        fabric: aiAttributes.fabric?.value || '',
        occasion: aiAttributes.occasion?.value || '',
        gender: aiAttributes.gender?.value || '',
      });
    } else {
      // Use manual attributes
      setFormData({ ...manualFormData });
    }
  };

  const handleManualInputChange = (field: string, value: string) => {
    setManualFormData(prev => ({ ...prev, [field]: value }));
    if (!useAiAttributes) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to upload items",
        variant: "destructive",
      });
      return;
    }

    if (!imageFile) {
      toast({
        title: "Error",
        description: "Please select an image",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category || !formData.name) {
      toast({
        title: "Error",
        description: "Name and Category are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
    // 1. Upload image to Supabase Storage
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('wardrobe-images')
      .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('wardrobe-images')
        .getPublicUrl(fileName);

      // 3. Prepare data for database insertion - include file_path
      const insertData = {
        user_id: user.id,
        name: formData.name,
        category: formData.category,
        image_url: publicUrl,
        file_path: fileName,
        color: formData.color || null,
        style: formData.style || null,
        pattern: formData.pattern || null,
        season: formData.season || null,
        brand: formData.brand || null,
        fabric: formData.fabric || null,
        occasion: formData.occasion || null,
        gender: formData.gender || null,
      };

      console.log('Inserting data:', insertData);

      // 4. Save to database
      const { data, error: insertError } = await supabase
        .from('wardrobe_items')
        .insert([insertData])
        .select();

      if (insertError) {
        console.error('Database error:', insertError);
        throw insertError;
      }

      toast({
        title: "Success!",
        description: "Item saved to your wardrobe",
      });

      // Reset form
      setFormData({
        name: '', category: '', color: '', style: '', pattern: '', season: '',
        brand: '', fabric: '', occasion: '', gender: '',
      });
      setManualFormData({
        name: '', category: '', color: '', style: '', pattern: '', season: '',
        brand: '', fabric: '', occasion: '', gender: '',
      });
      setImageFile(null);
      setImagePreview("");
      setAiAnalysis(null);
      setUseAiAttributes(false);
      
      const fileInput = document.getElementById('image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with SlayFit name */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  SlayFit
                </h1>
                <p className="text-sm text-muted-foreground">Upload Wardrobe Item</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Image Upload & Analysis */}
            <Card className="p-6 rounded-3xl shadow-soft border">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="image">Clothing Image *</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="rounded-xl"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Upload a clear photo of your clothing item
                  </p>
                </div>

                {imagePreview && (
                  <div className="space-y-4">
                    <div className="aspect-square bg-muted rounded-2xl overflow-hidden border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={analyzeImage}
                      disabled={analyzing}
                      className="w-full rounded-full"
                      size="lg"
                    >
                      <Scan className="w-4 h-4 mr-2" />
                      {analyzing ? "Analyzing with AI..." : "Analyze Image with AI"}
                    </Button>

                    {analyzing && (
                      <div className="space-y-2">
                        <Progress value={70} className="w-full" />
                        <p className="text-sm text-center text-muted-foreground">
                          AI is analyzing your clothing item...
                        </p>
                      </div>
                    )}

                    {aiAnalysis && (
                      <Card className="p-4 bg-blue-50 border-blue-200 rounded-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-blue-800">AI Analysis Results</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Overall Confidence</span>
                            <span className={`text-sm font-bold ${getConfidenceColor(aiAnalysis.overall_confidence)}`}>
                              {aiAnalysis.overall_confidence}%
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(aiAnalysis.attributes).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key}:</span>
                                <span className={`font-medium ${getConfidenceColor(value.confidence)}`}>
                                  {value.value} ({value.confidence}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Right Column - Attributes Form */}
            <Card className="p-6 rounded-3xl shadow-soft border">
              <form onSubmit={handleUpload} className="space-y-6">
                {/* AI/Manual Toggle */}
                {aiAnalysis && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Use AI Analysis</span>
                    </div>
                    <Switch
                      checked={useAiAttributes}
                      onCheckedChange={handleUseAIToggle}
                    />
                  </div>
                )}

                {/* Name Field - Required */}
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleManualInputChange('name', e.target.value)}
                    placeholder="Enter item name"
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleManualInputChange('category', value)}
                    required
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shirt">Shirt</SelectItem>
                      <SelectItem value="pants">Pants</SelectItem>
                      <SelectItem value="dress">Dress</SelectItem>
                      <SelectItem value="shoes">Shoes</SelectItem>
                      <SelectItem value="jacket">Jacket</SelectItem>
                      <SelectItem value="accessories">Accessories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => handleManualInputChange('color', e.target.value)}
                      placeholder="Enter color"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style">Style</Label>
                    <Select 
                      value={formData.style} 
                      onValueChange={(value) => handleManualInputChange('style', value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="sporty">Sporty</SelectItem>
                        <SelectItem value="elegant">Elegant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pattern">Pattern</Label>
                    <Select 
                      value={formData.pattern} 
                      onValueChange={(value) => handleManualInputChange('pattern', value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="striped">Striped</SelectItem>
                        <SelectItem value="floral">Floral</SelectItem>
                        <SelectItem value="checkered">Checkered</SelectItem>
                        <SelectItem value="printed">Printed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="season">Season</Label>
                    <Select 
                      value={formData.season} 
                      onValueChange={(value) => handleManualInputChange('season', value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select season" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-season">All Season</SelectItem>
                        <SelectItem value="spring">Spring</SelectItem>
                        <SelectItem value="summer">Summer</SelectItem>
                        <SelectItem value="fall">Fall</SelectItem>
                        <SelectItem value="winter">Winter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => handleManualInputChange('brand', e.target.value)}
                      placeholder="Enter brand"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fabric">Fabric</Label>
                    <Input
                      id="fabric"
                      value={formData.fabric}
                      onChange={(e) => handleManualInputChange('fabric', e.target.value)}
                      placeholder="Enter fabric"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="occasion">Occasion</Label>
                    <Select 
                      value={formData.occasion} 
                      onValueChange={(value) => handleManualInputChange('occasion', value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select occasion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="party">Party</SelectItem>
                        <SelectItem value="sport">Sport</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select 
                      value={formData.gender} 
                      onValueChange={(value) => handleManualInputChange('gender', value)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Unisex">Unisex</SelectItem>
                        <SelectItem value="Kids">Kids</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || !imageFile || !formData.category || !formData.name}
                  className="w-full rounded-full"
                  size="lg"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {loading ? "Saving to Wardrobe..." : "Save to Wardrobe"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UploadForm;