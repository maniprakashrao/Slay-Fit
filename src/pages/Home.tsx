import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, Heart, ArrowRight, Calendar, Shirt, User, LogOut, Trash2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Event {
  id: string;
  title: string;
  date: string;
  occasion: string;
  description: string;
  dress_code: string;
  user_id?: string;
}

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventData, setEventData] = useState({
    title: "",
    date: "",
    occasion: "",
    description: "",
    dress_code: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  useEffect(() => {
    if (user) {
      fetchEvents();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      const res = await (supabase as any)
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      const data = res.data as Event[] | null;
      const error = res.error;

      if (error) {
        if (error.code === '42P01') {
          console.log('Events table does not exist yet');
          setEvents([]);
          return;
        }
        throw error;
      }
      setEvents(data || []);
    } catch (error: any) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSave = async () => {
    if (!user) return;

    if (!eventData.title || !eventData.date) {
      toast({
        title: "Missing information",
        description: "Please fill in at least title and date",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('events')
        .insert([
          {
            user_id: user.id,
            title: eventData.title,
            date: eventData.date,
            occasion: eventData.occasion,
            description: eventData.description,
            dress_code: eventData.dress_code,
          }
        ]);

      if (error) {
        if (error.code === '42P01') {
          toast({
            title: "Events feature not set up",
            description: "Please create the events table in your database",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Event added!",
        description: "Your event has been saved successfully.",
      });

      setEventData({
        title: "",
        date: "",
        occasion: "",
        description: "",
        dress_code: "",
      });
      
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Failed to save event",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      const { error } = await (supabase as any)
        .from('events')
        .delete()
        .eq('id', eventToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully.",
      });

      setEvents(events.filter(event => event.id !== eventToDelete.id));
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: "Failed to delete event",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      console.error('Error signing out:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-20">
        {/* User Menu Section */}
        {user && (
          <div className="flex justify-end mb-8">
            <div className="flex items-center gap-4">
              {/* Add Event Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-full gap-2">
                    <Calendar className="w-4 h-4" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Event</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-title">Event Title *</Label>
                      <Input
                        id="event-title"
                        placeholder="e.g., Birthday Party, Wedding, Meeting"
                        value={eventData.title}
                        onChange={(e) => setEventData({...eventData, title: e.target.value})}
                        className="rounded-xl"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Date *</Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventData.date}
                        onChange={(e) => setEventData({...eventData, date: e.target.value})}
                        className="rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="event-occasion">Occasion</Label>
                      <Select value={eventData.occasion} onValueChange={(value) => setEventData({...eventData, occasion: value})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select occasion" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="party">Party</SelectItem>
                          <SelectItem value="wedding">Wedding</SelectItem>
                          <SelectItem value="date">Date Night</SelectItem>
                          <SelectItem value="sports">Sports</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="event-dress-code">Dress Code</Label>
                      <Input
                        id="event-dress-code"
                        placeholder="e.g., Black Tie, Casual, Business Casual"
                        value={eventData.dress_code}
                        onChange={(e) => setEventData({...eventData, dress_code: e.target.value})}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="event-description">Description</Label>
                      <Textarea
                        id="event-description"
                        placeholder="Any additional details about the event..."
                        value={eventData.description}
                        onChange={(e) => setEventData({...eventData, description: e.target.value})}
                        className="rounded-xl min-h-[100px]"
                      />
                    </div>

                    <Button onClick={handleEventSave} className="w-full rounded-full">
                      Save Event
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Wardrobe Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full gap-2">
                    <Shirt className="w-4 h-4" />
                    Wardrobe
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-2xl w-48">
                  <DropdownMenuItem onClick={() => navigate("/wardrobe")} className="cursor-pointer">
                    <Shirt className="w-4 h-4 mr-2" />
                    View Wardrobe
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/upload")} className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Items
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/generate")} className="cursor-pointer">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Outfits
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Profile Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-2xl w-48">
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Your AI Fashion Stylist
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-150">
            Upload your wardrobe and let AI create stunning outfit combinations tailored just for you
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
            {user ? (
              <>
                <Button 
                  size="lg" 
                  onClick={() => navigate("/upload")}
                  className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-medium transition-smooth hover:scale-105"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Start Building Wardrobe
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => navigate("/generate")}
                  className="rounded-full px-8 border-2 transition-smooth hover:scale-105"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Outfits
                </Button>
              </>
            ) : (
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-medium transition-smooth hover:scale-105"
              >
                Get Started
              </Button>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-card rounded-3xl p-8 shadow-soft border hover:shadow-medium transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Upload Your Wardrobe</h3>
            <p className="text-muted-foreground">
              Snap photos of your clothes and let our AI analyze colors, styles, and patterns automatically
            </p>
          </div>

          <div className="bg-card rounded-3xl p-8 shadow-soft border hover:shadow-medium transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">AI-Powered Suggestions</h3>
            <p className="text-muted-foreground">
              Get personalized outfit recommendations based on style, occasion, and color harmony
            </p>
          </div>

          <div className="bg-card rounded-3xl p-8 shadow-soft border hover:shadow-medium transition-smooth">
            <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
              <Heart className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Save Your Favorites</h3>
            <p className="text-muted-foreground">
              Create a collection of your best looks and access them anytime you need inspiration
            </p>
          </div>
        </div>

        {/* Events Section */}
        {user && (
          <div className="max-w-6xl mx-auto mt-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Upcoming Events</h2>
              <p className="text-muted-foreground">
                Manage your events and get outfit suggestions for each occasion
              </p>
            </div>
            
            {events.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <Card key={event.id} className="p-6 rounded-3xl group relative">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-lg">{event.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {event.occasion}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => openDeleteDialog(event)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatDate(event.date)}
                    </p>
                    {event.dress_code && (
                      <p className="text-sm mb-3">
                        <span className="font-medium">Dress Code:</span> {event.dress_code}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 rounded-3xl text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold mb-2">No events yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Add your first event to get personalized outfit recommendations
                    </p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="lg" className="rounded-full">
                        <Calendar className="w-5 h-5 mr-2" />
                        Add Your First Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-3xl max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Event</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="event-title">Event Title *</Label>
                          <Input
                            id="event-title"
                            placeholder="e.g., Birthday Party, Wedding, Meeting"
                            value={eventData.title}
                            onChange={(e) => setEventData({...eventData, title: e.target.value})}
                            className="rounded-xl"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="event-date">Date *</Label>
                          <Input
                            id="event-date"
                            type="date"
                            value={eventData.date}
                            onChange={(e) => setEventData({...eventData, date: e.target.value})}
                            className="rounded-xl"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="event-occasion">Occasion</Label>
                          <Select value={eventData.occasion} onValueChange={(value) => setEventData({...eventData, occasion: value})}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select occasion" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="formal">Formal</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                              <SelectItem value="party">Party</SelectItem>
                              <SelectItem value="wedding">Wedding</SelectItem>
                              <SelectItem value="date">Date Night</SelectItem>
                              <SelectItem value="sports">Sports</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="event-dress-code">Dress Code</Label>
                          <Input
                            id="event-dress-code"
                            placeholder="e.g., Black Tie, Casual, Business Casual"
                            value={eventData.dress_code}
                            onChange={(e) => setEventData({...eventData, dress_code: e.target.value})}
                            className="rounded-xl"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="event-description">Description</Label>
                          <Textarea
                            id="event-description"
                            placeholder="Any additional details about the event..."
                            value={eventData.description}
                            onChange={(e) => setEventData({...eventData, description: e.target.value})}
                            className="rounded-xl min-h-[100px]"
                          />
                        </div>

                        <Button onClick={handleEventSave} className="w-full rounded-full">
                          Save Event
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the event "{eventToDelete?.title}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteEvent}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Home;