import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";

export default function Favorites() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("favorites")
        .select("recipe:recipes(*)")
        .eq("user_id", user.id);
      setRecipes((data ?? []).map((d: any) => d.recipe).filter(Boolean));
    })();
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Lieblingsrezepte</h1>
      {recipes.length === 0 ? (
        <p className="text-foreground/60">Noch keine Favoriten.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <Link key={r.id} to={`/recipes/${r.id}`} className="recipe-card overflow-hidden block">
              {r.image_url ? (
                <img src={r.image_url} alt={r.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-secondary">
                  <Star className="w-10 h-10 text-gold/40" />
                </div>
              )}
              <div className="p-4">
                <h3 className="imperial-heading text-lg">{r.title}</h3>
                <p className="text-sm text-content-fg/70 line-clamp-2">{r.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
