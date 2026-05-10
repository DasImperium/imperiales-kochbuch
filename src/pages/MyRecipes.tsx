import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/timeFormat";

export default function MyRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("recipes").select("*").eq("author_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRecipes(data ?? []));
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="imperial-heading text-3xl text-gold">Eigene Rezepte</h1>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold-soft">
          <Link to="/recipes/new"><Plus className="w-4 h-4 mr-1" /> Neues Rezept</Link>
        </Button>
      </div>
      {recipes.length === 0 ? (
        <p className="text-foreground/60">Du hast noch kein Rezept erstellt.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <Link key={r.id} to={`/recipes/${r.id}`} className="recipe-card overflow-hidden block relative">
              {r.image_url ? (
                <img src={r.image_url} alt={r.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-secondary"><Star className="w-10 h-10 text-gold/40" /></div>
              )}
              <span className="absolute top-32 left-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-white text-[#006400] shadow">
                <Clock className="w-3 h-3" /> {formatTime(r.time_required)}
              </span>
              <div className="p-4">
                <h3 className="imperial-heading text-lg">{r.title}</h3>
                {r.is_draft && <span className="text-xs text-destructive">Entwurf</span>}
                <p className="text-sm text-content-fg/70 line-clamp-2">{r.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
