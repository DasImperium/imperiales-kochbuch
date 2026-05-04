import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

interface Recipe {
  id: string; title: string; description: string | null; image_url: string | null;
  category_id: string | null; author_id: string; forced_visible: boolean; is_draft: boolean;
}
interface Category { id: string; name: string; parent_id: string | null; is_root: boolean; }

export default function Recipes() {
  const { user, isAdmin } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [newSubcatName, setNewSubcatName] = useState("");
  const [newSubcatParent, setNewSubcatParent] = useState<string>("");

  const load = async () => {
    const [{ data: rs }, { data: cs }, { data: hs }] = await Promise.all([
      supabase.from("recipes").select("*").eq("is_draft", false).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("is_root", { ascending: false }).order("name"),
      user ? supabase.from("hidden_recipes").select("recipe_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any }),
    ]);
    setRecipes(rs ?? []);
    setCategories(cs ?? []);
    setHidden(new Set((hs ?? []).map((h: any) => h.recipe_id)));
  };

  useEffect(() => { load(); }, [user]);

  const toggleHide = async (rid: string) => {
    if (!user) return;
    if (hidden.has(rid)) {
      await supabase.from("hidden_recipes").delete().eq("user_id", user.id).eq("recipe_id", rid);
    } else {
      await supabase.from("hidden_recipes").insert({ user_id: user.id, recipe_id: rid });
    }
    load();
  };

  const addSubcategory = async () => {
    if (!user || !newSubcatName.trim() || !newSubcatParent) return;
    const { error } = await supabase.from("categories").insert({
      name: newSubcatName.trim(),
      parent_id: newSubcatParent,
      is_root: false,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Unterkategorie erstellt");
      setNewSubcatName("");
      load();
    }
  };

  const filtered = recipes.filter((r) => {
    if (!showHidden && hidden.has(r.id)) return false;
    if (showHidden && !hidden.has(r.id)) return false;
    if (filter !== "all" && r.category_id !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const rootCats = categories.filter((c) => c.is_root);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="imperial-heading text-3xl text-gold">Rezeptsammlung</h1>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold-soft">
          <Link to="/recipes/new"><Plus className="w-4 h-4 mr-1" /> Neues Rezept</Link>
        </Button>
      </div>

      <Card className="imperial-surface border-gold/30 p-4 mb-6 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <Input
            placeholder="Suche…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background/60"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="bg-background/60">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.is_root ? `★ ${c.name}` : `— ${c.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowHidden((v) => !v)}
            className="border-gold/40"
          >
            {showHidden ? <><Eye className="w-4 h-4 mr-1" />Sichtbare zeigen</> : <><EyeOff className="w-4 h-4 mr-1" />Ausgeblendete zeigen</>}
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gold/20">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-surface-foreground/70">Neue Unterkategorie</label>
            <Input value={newSubcatName} onChange={(e) => setNewSubcatName(e.target.value)} placeholder="z. B. Suppen" className="bg-background/60" />
          </div>
          <Select value={newSubcatParent} onValueChange={setNewSubcatParent}>
            <SelectTrigger className="w-[180px] bg-background/60">
              <SelectValue placeholder="Hauptkategorie" />
            </SelectTrigger>
            <SelectContent>
              {rootCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addSubcategory} className="bg-gold text-gold-foreground hover:bg-gold-soft">Hinzufügen</Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-center text-foreground/60 py-12">Keine Rezepte.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const cat = categories.find((c) => c.id === r.category_id);
            return (
              <article key={r.id} className="recipe-card overflow-hidden flex flex-col">
                <Link to={`/recipes/${r.id}`} className="block">
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-secondary to-surface">
                      <Star className="w-10 h-10 text-gold/40" />
                    </div>
                  )}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link to={`/recipes/${r.id}`} className="imperial-heading text-lg text-content-fg hover:text-gold transition-colors">
                      {r.title}
                    </Link>
                  </div>
                  {cat && <Badge variant="outline" className="self-start text-xs mb-2 border-gold/40">{cat.name}</Badge>}
                  <p className="text-sm text-content-fg/70 line-clamp-2 flex-1">{r.description}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleHide(r.id)}
                    className="self-end mt-2 text-xs"
                  >
                    {hidden.has(r.id) ? <><Eye className="w-3 h-3 mr-1" />Einblenden</> : <><EyeOff className="w-3 h-3 mr-1" />Ausblenden</>}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
