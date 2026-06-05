import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { z } from "zod";
import { useEffect } from "react";

const emailSchema = z.string().trim().email("Ungültige E-Mail").max(255);
const passwordSchema = z.string().min(6, "Mindestens 6 Zeichen").max(72);
const nameSchema = z.string().trim().min(1, "Name erforderlich").max(80);

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Ermittelt, ob die App als native Capacitor-App auf dem Smartphone läuft
  const getRedirectUrl = () => {
    const isCapacitor = window.origin.includes("localhost") || window.location.href.startsWith("file:");
    return isCapacitor ? "de.imperium.kochbuch://login-callback" : window.location.origin;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Willkommen zurück!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Anmeldung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const display_name = nameSchema.parse(fd.get("name"));
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
          data: { display_name },
        },
      });
      if (error) throw error;
      toast.success("Konto erstellt!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: getRedirectUrl(),
    });
    if (result.error) {
      toast.error("Google-Anmeldung fehlgeschlagen");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-imperial)" }}>
      <Card className="w-full max-w-md p-8 imperial-surface border-gold/30">
        <div className="flex flex-col items-center mb-6">
          <Crown className="w-12 h-12 text-gold mb-2" />
          <h1 className="imperial-heading text-2xl text-gold">Imperiales Kochbuch</h1>
          <div className="gold-divider w-32 my-3" />
          <p className="text-sm text-surface-foreground/70">Melde dich an, um zu beginnen</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="signin">Anmelden</TabsTrigger>
            <TabsTrigger value="signup">Registrieren</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <Label htmlFor="si-email">E-Mail</Label>
                <Input id="si-email" name="email" type="email" required maxLength={255} />
              </div>
              <div>
                <Label htmlFor="si-pw">Passwort</Label>
                <Input id="si-pw" name="password" type="password" required maxLength={72} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold-soft">
                Anmelden
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <Label htmlFor="su-name">Name</Label>
                <Input id="su-name" name="name" required maxLength={80} />
              </div>
              <div>
                <Label htmlFor="su-email">E-Mail</Label>
                <Input id="su-email" name="email" type="email" required maxLength={255} />
              </div>
              <div>
                <Label htmlFor="su-pw">Passwort (min. 6)</Label>
                <Input id="su-pw" name="password" type="password" required minLength={6} maxLength={72} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold-soft">
                Konto erstellen
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-2">
          <div className="gold-divider flex-1" />
          <span className="text-xs text-surface-foreground/60">oder</span>
          <div className="gold-divider flex-1" />
        </div>

        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full border-gold/40 hover:border-gold">
          Mit Google anmelden
        </Button>
      </Card>
    </div>
  );
}