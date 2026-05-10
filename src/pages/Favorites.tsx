import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Clock } from "lucide-react";
import { formatTime } from "@/lib/timeFormat";

export default function Favorites() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: favs }, { data: cs }] = await Promise.all([
        supabase.from("favorites").select("recipe:recipes(*)").eq("user_id", user.id),
        supabase.from("categories").select("id,name,is_root").order("name"),
      ]);
      setRecipes((favs ?? []).map((d: any) => d.recipe).filter(Boolean));
      setCategories(cs ?? []);
    })();
  }, [user]);

  const filtered = useMemo(() => recipes.filter((r) => {
    if (cat !== "all" && r.category_id !== cat) return false;
    if (q) {
      const s = q.toLowerCase();
      const ing = (r.ingredients ?? "").toLowerCase();
      const tags = (r.tags ?? []).join(" ").toLowerCase();
      if (!r.title.toLowerCase().includes(s) && !ing.includes(s) && !tags.includes(s)) return false;
    }
    return true;
  }), [recipes, cat, q]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="imperial-heading text-3xl text-gold mb-6">Lieblingsrezepte</h1>

      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche (Titel, Zutat, Tag)…" className="bg-surface text-surface-foreground border-gold/30" />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="bg-surface text-surface-foreground border-gold/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.is_root ? `★ ${c.name}` : `— ${c.name}`}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-foreground/60">Keine Treffer.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
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
                <p className="text-sm text-content-fg/70 line-clamp-2">{r.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
