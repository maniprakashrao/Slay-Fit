import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setStatus("Processing OAuth callback...");
        
        console.log("Current URL:", window.location.href);
        
        // Check URL for OAuth parameters in BOTH hash and query string
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
        
        console.log("Access token found:", !!accessToken);
        console.log("Refresh token found:", !!refreshToken);

        // If there's an OAuth error
        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription));
        }

        // If we have tokens in URL, set the session
        if (accessToken) {
          setStatus("Setting up your session...");
          
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (setSessionError) {
            console.error("Set session error:", setSessionError);
            throw setSessionError;
          }
          
          console.log("Session set successfully");
        }

        // Wait a moment for session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the current session to verify
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }

        console.log("Final session check:", session);
        console.log("Final user check:", session?.user);

        if (session?.user) {
          setStatus("Welcome! Redirecting to your wardrobe...");
          
          toast({
            title: "Welcome to Slay Fit! 🎉",
            description: `Hello ${session.user.email || 'there'}!`,
          });
          
          // Clear the OAuth parameters from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          setTimeout(() => {
            navigate("/wardrobe", { replace: true });
          }, 1000);
        } else {
          // Last resort: try to get user directly
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setStatus("Welcome! Redirecting...");
            toast({
              title: "Welcome to Slay Fit! 🎉",
              description: `Hello ${user.email || 'there'}!`,
            });
            setTimeout(() => {
              navigate("/wardrobe", { replace: true });
            }, 1000);
          } else {
            throw new Error("Authentication completed but no user session was created.");
          }
        }
      } catch (error) {
          console.error("Auth callback error:", error);
          setStatus("Authentication failed. Please try again.");
  
  let errorMessage = "Please try signing in again.";
  
  
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message);
        }
        
        toast({
          title: "Authentication failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        setTimeout(() => {
          navigate("/auth", { replace: true });
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-secondary">
      <div className="text-center p-8 bg-card rounded-3xl shadow-medium max-w-md w-full">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Completing Sign In</h2>
        <p className="text-muted-foreground mb-4">{status}</p>
        <div className="text-sm text-muted-foreground">
          <p>This should only take a moment...</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;