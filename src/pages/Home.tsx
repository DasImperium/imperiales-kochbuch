import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/imperial-hero.jpg";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, MessageSquare, Crown } from "lucide-react";

export default function Home() {
  const [stats, setStats] = useState({ recipes: 0, categories: 0, reactions: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: r }, { count: c }, { count: ra }, { count: co }] = await Promise.all([
        supabase.from("recipes").select("*", { count: "exact", head: true }),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("ratings").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
      ]);
      setStats({ recipes: r ?? 0, categories: c ?? 0, reactions: (ra ?? 0) + (co ?? 0) });
    })();
  }, []);

  return (
    <div>
      <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <img src={heroImg} alt="Imperiale Küche mit goldenem Kochbuch" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="relative text-center px-4 max-w-3xl">
          <Crown className="w-12 h-12 text-gold mx-auto mb-3" />
          <h1 className="imperial-heading text-4xl md:text-6xl text-gold mb-4">Imperiales Kochbuch</h1>
          <div className="gold-divider w-48 mx-auto mb-4" />
          <p className="text-lg text-foreground/80 mb-6">
            Sammle, teile und verwalte herausragende Rezepte würdig eines Imperiums.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild variant="gold"><Link to="/recipes">Rezepte entdecken</Link></Button>
            <Button asChild><Link to="/recipes/new">Rezept anlegen</Link></Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        <Card className="imperial-surface border-gold/30 p-6">
          <BookOpen className="w-8 h-8 text-gold mb-3" />
          <div className="text-3xl imperial-heading text-gold">{stats.recipes}</div>
          <div className="text-sm text-surface-foreground/70">Rezepte im Kochbuch</div>
        </Card>
        <Card className="imperial-surface border-gold/30 p-6">
          <Star className="w-8 h-8 text-gold mb-3" />
          <div className="text-3xl imperial-heading text-gold">{stats.categories}</div>
          <div className="text-sm text-surface-foreground/70">Kategorien</div>
        </Card>
        <Card className="imperial-surface border-gold/30 p-6">
          <MessageSquare className="w-8 h-8 text-gold mb-3" />
          <div className="text-3xl imperial-heading text-gold">{stats.reactions}</div>
          <div className="text-sm text-surface-foreground/70">Reaktionen & Kommentare</div>
        </Card>
      </section>
    </div>
  );
}
